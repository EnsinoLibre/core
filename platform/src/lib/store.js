/**
 * EnsinoLibre teacher workspace — Supabase-backed data store.
 *
 * NOTE: the public-site copy this used to diverge from (site/assets/js/app/store.js,
 * localStorage-backed) is gone — dead code, removed in #32. This is now the
 * only store.js in the repo; the teacher platform is authenticated and its
 * data lives in Supabase.
 *
 * Design (kept deliberately simple so the React views don't change):
 *   - An in-memory `state` object holds the whole workspace, shaped exactly the
 *     way the views already expect (camelCase, notes[] on students, worksheetIds[]
 *     on aulas, progress keyed "aulaId:enrollmentId:worksheetId").
 *   - `hydrate()` runs once after login: it `select *`s every teacher table
 *     (RLS scopes each to the signed-in teacher) and builds `state`.
 *   - Reads stay SYNCHRONOUS from `state`.
 *   - Writes update `state` optimistically with a client-generated uuid, then
 *     fire the Supabase insert/update/delete (setting teacher_id). Method names
 *     are unchanged so the views keep working.
 *   - `onLiveUpdate()` subscribes to Supabase Realtime on enrollments+progress
 *     (written by students via RPC) so the Live monitor reflects real student
 *     work in under a couple seconds; falls back to a scoped poll if the
 *     realtime channel doesn't come up.
 */
import { supabase } from './supabase';

const nowISO = () => new Date().toISOString();
const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ---------------- write-error surfacing (issue #17) ----------------
 * Writes are optimistic: state mutates first, then the Supabase write is fired.
 * If that write fails (RLS, network, FK) we must NOT swallow it — the teacher
 * would keep working on data the database never accepted and lose it on the
 * next hydrate, and an agent reading via MCP would see a different world than
 * the teacher's screen. fire() therefore notifies subscribers so the Shell can
 * surface the failure and offer a reload that reconciles state with DB truth.
 */
const writeErrorHandlers = new Set();
let writeErrorCount = 0;

/** Subscribe to write failures. handler({ label, message, count }). Returns an unsubscribe. */
export function onWriteError(handler) {
  writeErrorHandlers.add(handler);
  return () => writeErrorHandlers.delete(handler);
}
/** Total write failures observed this session (for a "N changes unsaved" badge). */
export const writeErrorTotal = () => writeErrorCount;

function reportWriteError(label, error) {
  writeErrorCount += 1;
  const message = (error && (error.message || String(error))) || 'unknown error';
  console.error(`[store] ${label} failed:`, message);
  const detail = { label, message, count: writeErrorCount };
  for (const h of writeErrorHandlers) {
    try { h(detail); } catch (e) { console.error('[store] onWriteError handler threw', e); }
  }
}

/** Fire a Supabase write; surface failures (issue #17) instead of swallowing them. */
function fire(builder, label) {
  Promise.resolve(builder).then(({ error }) => {
    if (error) reportWriteError(label, error);
  }).catch((e) => reportWriteError(label, e));
}

/*
 * Pending-write registry (issue #30): fire() is fire-and-forget by design
 * (optimistic UI). A few call sites insert a PARENT row (e.g. addClassroom)
 * whose id a caller may go on to reference in a CHILD insert moments later
 * (e.g. addStudent, from an inline "+ Create" in a relation picker) — the
 * child's FK/RLS check needs the parent row to have actually landed in
 * Postgres first, which a plain fire() doesn't guarantee. Rather than making
 * every write awaited (losing the point of fire()), track the in-flight
 * promise per row id so a caller that knows it just created that id can
 * await it — via whenReady() — before firing the dependent write.
 */
const pendingWrites = new Map();

function fireTracked(builder, label, id) {
  const p = Promise.resolve(builder).then(({ error }) => {
    if (error) reportWriteError(label, error);
  }).catch((e) => reportWriteError(label, e)).finally(() => {
    if (pendingWrites.get(id) === p) pendingWrites.delete(id);
  });
  pendingWrites.set(id, p);
  return p;
}

/** Resolves once row `id`'s own write (if fired via fireTracked) has settled — a no-op for any id that was never tracked (e.g. an already-existing row). */
async function whenReady(id) {
  await (pendingWrites.get(id) || Promise.resolve());
}

/* ---------------- in-memory state ---------------- */

function emptyState() {
  return {
    teacher: { id: null, name: 'Teacher', email: '', school: '', subjects: '', bio: '', locale: 'en-GB' },
    classrooms: [], students: [], resources: [], worksheets: [],
    aulas: [], enrollments: [], progress: {},
  };
}

let state = emptyState();
let hydrated = false;
let teacherId = null;

export const isHydrated = () => hydrated;

/* ---------------- row <-> state mappers ---------------- */

const mapClassroom = (r) => ({ id: r.id, name: r.name, subject: r.subject || '', level: r.level || '', term: r.term || '', description: r.description || '', context: r.context || '', createdAt: r.created_at });
const mapStudent = (r) => ({ id: r.id, classId: r.class_id, name: r.name, level: r.level || '', pronouns: r.pronouns || '', goals: r.goals || '', needs: r.needs || '', notes: [], createdAt: r.created_at });
const mapNote = (r) => ({ id: r.id, at: r.created_at, text: r.text });
const mapWorksheet = (r) => ({ id: r.id, title: r.title, subject: r.subject || '', doc: r.doc });
const mapResource = (r) => ({ id: r.id, title: r.title, kind: r.kind || 'material', type: r.type || 'other', subject: r.subject || '', classId: r.class_id || null, studentId: r.student_id || null, url: r.url || undefined, note: r.note || '', tags: r.tags || [], links: r.links || [], createdAt: r.created_at });
const mapAula = (r) => ({ id: r.id, classId: r.class_id || null, title: r.title, code: r.code, status: r.status || 'live', hasPassword: !!r.password_hash, worksheetIds: [], createdAt: r.created_at });
const mapEnrollment = (r) => ({ id: r.id, aulaId: r.aula_id, name: r.name, joinedAt: r.joined_at });
const mapProgressRow = (r) => ({ total: r.total || 0, attempted: r.attempted || 0, correct: r.correct || 0, done: !!r.done, score: Number(r.score) || 0, validated: r.validated ?? null, updatedAt: r.updated_at });
const progressKey = (aulaId, enrollmentId, worksheetId) => `${aulaId}:${enrollmentId}:${worksheetId}`;

/* ---------------- hydrate ---------------- */

/**
 * Load the whole workspace for the signed-in teacher into `state`.
 * Safe to call again (e.g. after re-login) — it rebuilds state from scratch.
 */
export async function hydrate() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error('Not authenticated');
  const user = userData.user;
  teacherId = user.id;

  const [prof, cls, stu, notes, ws, res, aul, aulWs, enr, prog] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('classrooms').select('*').order('created_at', { ascending: true }),
    supabase.from('students').select('*').order('created_at', { ascending: true }),
    supabase.from('student_notes').select('*').order('created_at', { ascending: false }),
    supabase.from('worksheets').select('*').order('created_at', { ascending: false }),
    supabase.from('resources').select('*').order('created_at', { ascending: false }),
    supabase.from('aulas').select('*').order('created_at', { ascending: false }),
    supabase.from('aula_worksheets').select('*').order('position', { ascending: true }),
    supabase.from('enrollments').select('*').order('joined_at', { ascending: true }),
    supabase.from('progress').select('*'),
  ]);

  const fresh = emptyState();

  const p = prof.data;
  fresh.teacher = {
    id: user.id,
    name: p?.name || user.email?.split('@')[0] || 'Teacher',
    email: p?.email || user.email || '',
    school: p?.school || '', subjects: p?.subjects || '', bio: p?.bio || '',
    locale: 'en-GB',
  };

  fresh.classrooms = (cls.data || []).map(mapClassroom);

  const notesByStudent = new Map();
  for (const n of notes.data || []) {
    if (!notesByStudent.has(n.student_id)) notesByStudent.set(n.student_id, []);
    notesByStudent.get(n.student_id).push(mapNote(n));
  }
  fresh.students = (stu.data || []).map((r) => ({ ...mapStudent(r), notes: notesByStudent.get(r.id) || [] }));

  fresh.worksheets = (ws.data || []).map(mapWorksheet);
  fresh.resources = (res.data || []).map(mapResource);

  const wsByAula = new Map();
  for (const link of aulWs.data || []) {
    if (!wsByAula.has(link.aula_id)) wsByAula.set(link.aula_id, []);
    wsByAula.get(link.aula_id).push(link.worksheet_id);
  }
  fresh.aulas = (aul.data || []).map((r) => ({ ...mapAula(r), worksheetIds: wsByAula.get(r.id) || [] }));

  fresh.enrollments = (enr.data || []).map(mapEnrollment);

  for (const r of prog.data || []) {
    fresh.progress[progressKey(r.aula_id, r.enrollment_id, r.worksheet_id)] = mapProgressRow(r);
  }

  state = fresh;
  hydrated = true;
  return state;
}

const liveAulaIds = () => state.aulas.filter((a) => a.status === 'live').map((a) => a.id);

/** Merge one fresh enrollment/progress row into state (used by both the poll and realtime paths). */
const applyEnrollmentRow = (r) => {
  const mapped = mapEnrollment(r);
  const i = state.enrollments.findIndex((e) => e.id === mapped.id);
  if (i >= 0) state.enrollments[i] = mapped; else state.enrollments.push(mapped);
};
const applyProgressRow = (r) => {
  state.progress[progressKey(r.aula_id, r.enrollment_id, r.worksheet_id)] = mapProgressRow(r);
};

/**
 * Re-select the live-facing tables (enrollments + progress), scoped to
 * currently-live aulas only — a closed aula's history came in at hydrate()
 * and doesn't get new writes, so re-fetching it every tick is wasted work.
 * Merges into state rather than replacing it, so closed-aula rows loaded at
 * hydrate() survive.
 */
async function refreshLive() {
  const ids = liveAulaIds();
  if (!ids.length) return;
  const [enr, prog] = await Promise.all([
    supabase.from('enrollments').select('*').in('aula_id', ids).order('joined_at', { ascending: true }),
    supabase.from('progress').select('*').in('aula_id', ids),
  ]);
  (enr.data || []).forEach(applyEnrollmentRow);
  (prog.data || []).forEach(applyProgressRow);
}

/* ---------------- session (kept for api.ts compatibility; not the primary path) ---------------- */

export const auth = {
  async signOut() { hydrated = false; teacherId = null; state = emptyState(); return supabase.auth.signOut(); },
};

// Student session marker is a public-site concern; kept as a no-op stub so the
// api.ts re-export stays valid inside the teacher platform.
export const studentAuth = {
  current() { return null; },
  isJoined() { return false; },
  join() { return null; },
  leave() {},
};

/* ---------------- reads (synchronous) ---------------- */

export const store = {
  teacher: () => state.teacher,
  classrooms: () => state.classrooms.slice(),
  classroom: (id) => state.classrooms.find((c) => c.id === id) || null,
  students: () => state.students.slice(),
  studentsIn: (classId) => state.students.filter((s) => s.classId === classId),
  student: (id) => state.students.find((s) => s.id === id) || null,
  resources: () => state.resources.slice(),
  resourcesIn: (classId) => state.resources.filter((r) => r.classId === classId),
  resource: (id) => state.resources.find((r) => r.id === id) || null,

  counts: () => ({
    classrooms: state.classrooms.length,
    students: state.students.length,
    resources: state.resources.length,
  }),

  /* -------------- writes -------------- */

  updateTeacher(patch) {
    Object.assign(state.teacher, patch);
    const dbPatch = {};
    for (const k of ['name', 'email', 'school', 'subjects', 'bio']) if (k in patch) dbPatch[k] = patch[k];
    if (Object.keys(dbPatch).length && teacherId) fire(supabase.from('profiles').update(dbPatch).eq('id', teacherId), 'updateTeacher');
  },

  addClassroom(data) {
    const c = { id: uuid(), createdAt: nowISO(), subject: '', level: '', term: '', description: '', context: '', ...data };
    state.classrooms.unshift(c);
    fireTracked(supabase.from('classrooms').insert({
      id: c.id, teacher_id: teacherId, name: c.name, subject: c.subject, level: c.level,
      term: c.term, description: c.description, context: c.context,
    }), 'addClassroom', c.id);
    return c;
  },
  /** Await a just-created row's own write before firing a dependent child insert that references it (issue #30). No-op for ids that were never tracked. */
  whenReady,
  /**
   * Like addClassroom, but AWAITS the insert. Bulk imports (Google Classroom)
   * fire students/resources referencing this classroom's id immediately
   * after creating it — those inserts' RLS/FK checks need the parent row to
   * exist first, so this can't be fire-and-forget the way addClassroom is.
   */
  async importClassroom(data) {
    const c = { id: uuid(), createdAt: nowISO(), subject: '', level: '', term: '', description: '', context: '', ...data };
    state.classrooms.unshift(c);
    const { error } = await supabase.from('classrooms').insert({
      id: c.id, teacher_id: teacherId, name: c.name, subject: c.subject, level: c.level,
      term: c.term, description: c.description, context: c.context,
    });
    if (error) console.error('[store] importClassroom failed:', error.message);
    return c;
  },
  updateClassroom(id, patch) {
    const c = this.classroom(id);
    if (c) {
      Object.assign(c, patch);
      const dbPatch = {};
      for (const k of ['name', 'subject', 'level', 'term', 'description', 'context']) if (k in patch) dbPatch[k] = patch[k];
      if (Object.keys(dbPatch).length) fire(supabase.from('classrooms').update(dbPatch).eq('id', id), 'updateClassroom');
    }
    return c;
  },
  removeClassroom(id) {
    state.classrooms = state.classrooms.filter((c) => c.id !== id);
    state.students = state.students.filter((s) => s.classId !== id);
    // resources FK is SET NULL; keep them but drop the class link in memory
    for (const r of state.resources) if (r.classId === id) r.classId = null;
    // aulas cascade in DB; drop them (and their enrollments/progress) in memory too
    const goneAulas = new Set(state.aulas.filter((a) => a.classId === id).map((a) => a.id));
    state.aulas = state.aulas.filter((a) => a.classId !== id);
    state.enrollments = state.enrollments.filter((e) => !goneAulas.has(e.aulaId));
    for (const k of Object.keys(state.progress)) if (goneAulas.has(k.split(':')[0])) delete state.progress[k];
    fire(supabase.from('classrooms').delete().eq('id', id), 'removeClassroom'); // cascades students/aulas/notes
  },

  addStudent(classId, data) {
    const s = { id: uuid(), classId, level: '', pronouns: '', goals: '', needs: '', notes: [], createdAt: nowISO(), ...data };
    state.students.push(s);
    fire(supabase.from('students').insert({
      id: s.id, teacher_id: teacherId, class_id: classId, name: s.name, level: s.level,
      pronouns: s.pronouns, goals: s.goals, needs: s.needs,
    }), 'addStudent');
    return s;
  },
  updateStudent(id, patch) {
    const s = this.student(id);
    if (s) {
      Object.assign(s, patch);
      const dbPatch = {};
      for (const k of ['name', 'level', 'pronouns', 'goals', 'needs']) if (k in patch) dbPatch[k] = patch[k];
      if ('classId' in patch) dbPatch.class_id = patch.classId;
      if (Object.keys(dbPatch).length) fire(supabase.from('students').update(dbPatch).eq('id', id), 'updateStudent');
    }
    return s;
  },
  addStudentNote(id, text) {
    const s = this.student(id);
    if (s && text.trim()) {
      const note = { id: uuid(), at: nowISO(), text: text.trim() };
      s.notes.unshift(note);
      fire(supabase.from('student_notes').insert({ id: note.id, teacher_id: teacherId, student_id: id, text: note.text }), 'addStudentNote');
    }
    return s;
  },
  removeStudent(id) {
    state.students = state.students.filter((s) => s.id !== id);
    for (const r of state.resources) if (r.studentId === id) r.studentId = null;
    fire(supabase.from('students').delete().eq('id', id), 'removeStudent'); // cascades notes
  },

  addResource(data) {
    const r = { id: uuid(), createdAt: nowISO(), tags: [], note: '', type: 'other', kind: 'material', links: [], classId: null, studentId: null, ...data };
    state.resources.unshift(r);
    fire(supabase.from('resources').insert({
      id: r.id, teacher_id: teacherId, title: r.title, kind: r.kind, type: r.type, subject: r.subject || '',
      class_id: r.classId, student_id: r.studentId, url: r.url || null, note: r.note, tags: r.tags, links: r.links,
    }), 'addResource');
    return r;
  },
  linkResource(id, targetNodeId) {
    const r = this.resource(id);
    if (r) {
      r.links = r.links || [];
      if (!r.links.includes(targetNodeId)) {
        r.links.push(targetNodeId);
        fire(supabase.from('resources').update({ links: r.links }).eq('id', id), 'linkResource');
      }
    }
    return r;
  },
  removeResource(id) {
    state.resources = state.resources.filter((r) => r.id !== id);
    fire(supabase.from('resources').delete().eq('id', id), 'removeResource');
  },

  /* -------------- aula (live classroom) -------------- */

  aulas: () => state.aulas.slice(),
  aula: (id) => state.aulas.find((a) => a.id === id) || null,
  aulaByCode: (code) => state.aulas.find((a) => a.code.toUpperCase() === String(code).toUpperCase()) || null,
  aulasForClass: (classId) => state.aulas.filter((a) => a.classId === classId),
  worksheet: (id) => state.worksheets.find((w) => w.id === id) || null,
  worksheetsAll: () => state.worksheets.slice(),
  aulaWorksheets: (aulaId) => {
    const a = store.aula(aulaId);
    return a ? a.worksheetIds.map((id) => store.worksheet(id)).filter(Boolean) : [];
  },
  enrollments: (aulaId) => state.enrollments.filter((e) => e.aulaId === aulaId),
  enrollment: (id) => state.enrollments.find((e) => e.id === id) || null,

  /** Add a worksheet document to the library (e.g. saved from the generator). */
  addWorksheet(doc) {
    const w = { id: uuid(), title: doc.title || 'Untitled worksheet', subject: doc.subject || '', doc };
    state.worksheets.unshift(w);
    fire(supabase.from('worksheets').insert({ id: w.id, teacher_id: teacherId, title: w.title, subject: w.subject, doc }), 'addWorksheet');
    return w;
  },
  updateWorksheet(id, doc) {
    const w = this.worksheet(id);
    if (w) {
      w.title = doc.title || w.title;
      w.subject = doc.subject || '';
      w.doc = doc;
      fire(supabase.from('worksheets').update({ title: w.title, subject: w.subject, doc }).eq('id', id), 'updateWorksheet');
    }
    return w;
  },
  removeWorksheet(id) {
    state.worksheets = state.worksheets.filter((w) => w.id !== id);
    for (const a of state.aulas) a.worksheetIds = a.worksheetIds.filter((wid) => wid !== id);
    fire(supabase.from('worksheets').delete().eq('id', id), 'removeWorksheet'); // cascades aula_worksheets/progress
  },

  /**
   * Deploy worksheets as a new live aula (unique join code) — to a class
   * (classId set, roster-gated on join) or as a public link (classId null,
   * anyone with the code + password, if set, can join under any name).
   */
  async createAula(classId, title, worksheetIds, password) {
    const used = new Set(state.aulas.map((a) => a.code));
    let code;
    do { code = 'A' + Math.random().toString(36).slice(2, 6).toUpperCase(); } while (used.has(code));
    const a = { id: uuid(), classId: classId || null, title, code, status: 'live', hasPassword: !!password, worksheetIds: worksheetIds.slice(), createdAt: nowISO() };
    state.aulas.unshift(a);
    // Await the parent row before firing the worksheet links: aula_worksheets'
    // RLS check looks up this aula by id, so it must exist first (fire() no
    // longer serializes writes in call order).
    const { error } = await supabase.from('aulas').insert({ id: a.id, teacher_id: teacherId, class_id: classId || null, title, code, status: 'live' });
    if (error) { console.error('[store] createAula failed:', error.message); return a; }
    if (password) {
      // Hashed server-side with bcrypt (set_aula_password RPC) — the client
      // never computes or uploads a password hash itself (issue #46).
      const { error: pwErr } = await supabase.rpc('set_aula_password', { p_aula_id: a.id, p_password: password });
      if (pwErr) { a.hasPassword = false; reportWriteError('createAula.password', pwErr); }
    }
    if (a.worksheetIds.length) {
      fire(supabase.from('aula_worksheets').insert(a.worksheetIds.map((wid, i) => ({ aula_id: a.id, worksheet_id: wid, position: i }))), 'createAula.worksheets');
    }
    return a;
  },
  setAulaStatus(id, status) {
    const a = this.aula(id);
    if (a) { a.status = status; fire(supabase.from('aulas').update({ status }).eq('id', id), 'setAulaStatus'); }
    return a;
  },
  removeAula(id) {
    state.aulas = state.aulas.filter((a) => a.id !== id);
    state.enrollments = state.enrollments.filter((e) => e.aulaId !== id);
    for (const k of Object.keys(state.progress)) if (k.startsWith(id + ':')) delete state.progress[k];
    fire(supabase.from('aulas').delete().eq('id', id), 'removeAula'); // cascades enrollments/progress/aula_worksheets
  },

  /** Enrol (or re-find) a student by name in an aula. (Teacher-side; students use the join_aula RPC.) */
  enroll(aulaId, name) {
    const existing = state.enrollments.find((e) => e.aulaId === aulaId && e.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;
    const e = { id: uuid(), aulaId, name: name.trim(), joinedAt: nowISO() };
    state.enrollments.push(e);
    fire(supabase.from('enrollments').insert({ id: e.id, aula_id: aulaId, name: e.name }), 'enroll');
    return e;
  },

  /**
   * Import an OFFLINE submission (an `ensinolibre-answers` file) into an aula:
   * enrol the student by name, then write their progress row. Async so the
   * enrolment insert commits before the progress insert (FK). Teachers may write
   * enrolments/progress for their own aulas (RLS).
   */
  async importSubmission(aulaId, name, worksheetId, snap) {
    const nm = String(name || '').trim() || 'Student';
    let e = state.enrollments.find((x) => x.aulaId === aulaId && x.name.toLowerCase() === nm.toLowerCase());
    if (!e) {
      e = { id: uuid(), aulaId, name: nm, joinedAt: nowISO() };
      state.enrollments.push(e);
      const { error } = await supabase.from('enrollments').insert({ id: e.id, aula_id: aulaId, name: nm });
      if (error) console.error('[store] importSubmission enrol failed:', error.message);
    }
    const key = progressKey(aulaId, e.id, worksheetId);
    const existed = !!state.progress[key];
    const prevValidated = existed ? (state.progress[key].validated ?? null) : null;
    const row = { total: snap.total, attempted: snap.attempted, correct: snap.correct, done: snap.done, score: snap.score };
    state.progress[key] = { ...row, validated: prevValidated, updatedAt: nowISO() };
    const res = existed
      ? await supabase.from('progress').update(row).eq('aula_id', aulaId).eq('enrollment_id', e.id).eq('worksheet_id', worksheetId)
      : await supabase.from('progress').insert({ aula_id: aulaId, enrollment_id: e.id, worksheet_id: worksheetId, ...row });
    if (res.error) console.error('[store] importSubmission progress failed:', res.error.message);
    return e;
  },

  progressKey,
  getProgress(aulaId, enrollmentId, worksheetId) {
    return state.progress[progressKey(aulaId, enrollmentId, worksheetId)] || null;
  },
  progressForAula: (aulaId) => Object.entries(state.progress)
    .filter(([k]) => k.startsWith(aulaId + ':'))
    .map(([k, v]) => { const [, enrollmentId, worksheetId] = k.split(':'); return { enrollmentId, worksheetId, ...v }; }),

  setProgress(aulaId, enrollmentId, worksheetId, snap) {
    // Progress is authored by STUDENTS via the save_progress RPC; this teacher
    // path exists only for API parity and updates an existing row in place.
    // (There is no unique constraint on the three keys, so no upsert here.)
    const key = progressKey(aulaId, enrollmentId, worksheetId);
    const prev = state.progress[key] || {};
    state.progress[key] = { ...prev, ...snap, validated: prev.validated ?? null, updatedAt: nowISO() };
    fire(supabase.from('progress')
      .update({ total: snap.total, attempted: snap.attempted, correct: snap.correct, done: snap.done, score: snap.score })
      .eq('aula_id', aulaId).eq('enrollment_id', enrollmentId).eq('worksheet_id', worksheetId), 'setProgress');
    return state.progress[key];
  },
  setValidation(aulaId, enrollmentId, worksheetId, validated) {
    const key = progressKey(aulaId, enrollmentId, worksheetId);
    if (!state.progress[key]) state.progress[key] = { total: 0, attempted: 0, correct: 0, done: false, score: 0 };
    state.progress[key].validated = validated;
    state.progress[key].updatedAt = nowISO();
    // The Live monitor only surfaces the validate control for existing progress
    // rows, so a plain UPDATE on the three-key match is enough.
    fire(supabase.from('progress').update({ validated })
      .eq('aula_id', aulaId).eq('enrollment_id', enrollmentId).eq('worksheet_id', worksheetId), 'setValidation');
    return state.progress[key];
  },

  /** Flat rows for analytics export. */
  exportRows(aulaId) {
    const rows = [];
    for (const e of store.enrollments(aulaId)) {
      for (const w of store.aulaWorksheets(aulaId)) {
        const p = store.getProgress(aulaId, e.id, w.id);
        rows.push({
          student: e.name, worksheet: w.title,
          attempted: p?.attempted ?? 0, total: p?.total ?? 0,
          correct: p?.correct ?? 0,
          scorePct: p ? Math.round((p.score || 0) * 100) : 0,
          status: p?.done ? 'complete' : (p?.attempted ? 'in progress' : 'not started'),
          validation: p?.validated || '',
          updated: p?.updatedAt || '',
        });
      }
    }
    return rows;
  },

  /** Re-pull the whole workspace from Supabase (dev affordance / manual refresh). */
  async reset() { await hydrate(); },
};

/* ---------------- live sync (Supabase Realtime, scoped-poll fallback) ---------------- */

const LIVE_POLL_MS = 4000;
// How long to wait for the realtime channel to confirm SUBSCRIBED before
// falling back to polling — covers the gap while the socket handshakes, and
// any environment where realtime is unreachable (proxy, ad-blocker, outage).
const REALTIME_FALLBACK_MS = 3000;

/**
 * Subscribe to live updates. Students write enrollments/progress via RPC
 * (join_aula, save_progress); a Supabase Realtime channel on those two
 * tables (RLS-scoped, so this teacher only ever receives their own aulas'
 * rows — see migration 20260716140000) applies each change into `state`
 * directly, no re-query needed. If the channel errors, times out, or closes,
 * a poll scoped to live aulas only (closed aulas don't get new writes) takes
 * over, and pauses while the tab is hidden. Returns an unsubscribe function.
 */
export function onLiveUpdate(handler) {
  let stopped = false;
  let pollTimer = null;

  const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
  const tick = async () => {
    if (stopped || document.hidden) return;
    try { await refreshLive(); if (!stopped) handler({ type: 'poll' }); }
    catch (e) { console.error('[store] live poll failed:', e); }
  };
  const startPoll = () => { if (!pollTimer) { pollTimer = setInterval(tick, LIVE_POLL_MS); tick(); } };

  const channel = supabase
    .channel(`live-progress-${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, (payload) => {
      if (stopped || !payload.new) return;
      applyProgressRow(payload.new);
      handler({ type: 'realtime' });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, (payload) => {
      if (stopped || !payload.new) return;
      applyEnrollmentRow(payload.new);
      handler({ type: 'realtime' });
    })
    .subscribe((status) => {
      if (stopped) return;
      if (status === 'SUBSCRIBED') stopPoll();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPoll();
    });

  // Initial paint so the monitor isn't empty before the first realtime event.
  tick();
  const fallbackTimer = setTimeout(() => { if (!stopped && !pollTimer) startPoll(); }, REALTIME_FALLBACK_MS);

  const onVisibility = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stopped = true;
    stopPoll();
    clearTimeout(fallbackTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    supabase.removeChannel(channel);
  };
}

/** No-op: state is always live in memory. Kept for api.ts / KnowledgeGraph compatibility. */
export function refresh() { /* in-memory state is always current */ }
