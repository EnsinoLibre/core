/**
 * EnsinoLibre teacher workspace — local data store (BOILERPLATE, no backend).
 *
 * Everything lives in localStorage and is seeded with mock data on first run.
 * This is a UI prototype: when the real backend lands, swap the read/write
 * helpers here for API calls and the views stay unchanged. The data shape is
 * deliberately shaped around the product vision — persistent, per-class and
 * per-student *context* that an AI agent will later read and write.
 */

import { SEED_WORKSHEETS } from './seed-worksheets.js';

const KEY = 'ensinolibre.workspace.v1';
const SESSION_KEY = 'ensinolibre.session.v1';
const STUDENT_KEY = 'ensinolibre.student.v1';

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const nowISO = () => new Date().toISOString();

/* ---------------- seed ---------------- */

function seed() {
  const teacherId = 'teacher_demo';
  const c1 = uid('class');
  const c2 = uid('class');
  const c3 = uid('class');
  const students = [
    { id: uid('stu'), classId: c1, name: 'Ana Ferreira', level: 'A2', pronouns: 'she/her',
      goals: 'Build confidence speaking about daily routines; consolidate present simple.',
      needs: 'Prefers visual support. Dyslexia-friendly fonts help.',
      notes: [{ id: uid('n'), at: nowISO(), text: 'Strong on vocabulary, hesitant with question forms.' }] },
    { id: uid('stu'), classId: c1, name: 'Bruno Costa', level: 'A2', pronouns: 'he/him',
      goals: 'Accuracy with the past simple for a holiday recount.',
      needs: 'Works best with short, timed tasks.',
      notes: [] },
    { id: uid('stu'), classId: c1, name: 'Carla Nunes', level: 'A1', pronouns: 'she/her',
      goals: 'Core survival vocabulary: numbers, shops, directions.',
      needs: 'New to the group — light scaffolding.',
      notes: [{ id: uid('n'), at: nowISO(), text: 'Joined mid-term; catch-up pack assigned.' }] },
    { id: uid('stu'), classId: c2, name: 'Diogo Alves', level: 'B1', pronouns: 'he/him',
      goals: 'Extended writing: linking ideas with because/although.',
      needs: 'Motivated by football and gaming contexts.',
      notes: [] },
    { id: uid('stu'), classId: c2, name: 'Eva Marques', level: 'B1', pronouns: 'she/her',
      goals: 'Fluency in short discussions; reduce L1 fillers.',
      needs: '', notes: [] },
  ];
  const resources = [
    { id: uid('res'), title: 'Daily routines — A2 mixed practice', type: 'worksheet', subject: 'English',
      classId: c1, createdAt: nowISO(), tags: ['present-simple', 'vocabulary'], note: 'Generated from the worksheet builder.' },
    { id: uid('res'), title: 'Numbers & shops flashcards', type: 'flashdeck', subject: 'English',
      classId: c1, createdAt: nowISO(), tags: ['A1', 'vocabulary'], note: '' },
    { id: uid('res'), title: 'Holiday recount — writing scaffold', type: 'worksheet', subject: 'English',
      classId: c2, createdAt: nowISO(), tags: ['past-simple', 'writing'], note: '' },
  ];
  return {
    teacher: {
      id: teacherId, name: 'Sara Viana', email: 'teacher@ensinolibre.org',
      school: 'IPVC — Viana do Castelo', subjects: 'English as a Foreign Language',
      bio: 'Adult-education EFL teacher. Building persistent, per-student context so planning and feedback compound over time.',
      locale: 'en-GB',
    },
    classrooms: [
      { id: c1, name: 'English A2 — Evening', subject: 'English', level: 'A2', term: '2026 Spring',
        description: 'Adult learners, twice weekly. Focus on everyday communication.',
        context: 'Mixed A1–A2. The group responds well to real-life scenarios (shops, travel). Avoid heavy grammar metalanguage.',
        createdAt: nowISO() },
      { id: c2, name: 'English B1 — Morning', subject: 'English', level: 'B1', term: '2026 Spring',
        description: 'Pre-intermediate adults preparing for a workplace certificate.',
        context: 'Confident speakers, need writing structure and cohesion. Professional contexts land best.',
        createdAt: nowISO() },
      { id: c3, name: 'English A1 — Intensive', subject: 'English', level: 'A1', term: '2026 Spring',
        description: 'Absolute beginners, intensive four-week course.',
        context: 'Start from the alphabet and greetings. Lots of repetition and visual support.',
        createdAt: nowISO() },
    ],
    students,
    resources,
    aulas: [
      { id: 'aula_demo', classId: c1, title: 'Live class — Solar System & Routines', code: 'A2LIVE',
        status: 'live', worksheetIds: SEED_WORKSHEETS.map((w) => w.id), createdAt: nowISO() },
    ],
    worksheets: SEED_WORKSHEETS.map((w) => ({ ...w })),
    enrollments: [
      { id: 'enr_ana', aulaId: 'aula_demo', name: 'Ana Ferreira', joinedAt: nowISO() },
      { id: 'enr_bruno', aulaId: 'aula_demo', name: 'Bruno Costa', joinedAt: nowISO() },
      { id: 'enr_carla', aulaId: 'aula_demo', name: 'Carla Nunes', joinedAt: nowISO() },
    ],
    // progress keyed "aulaId:enrollmentId:worksheetId"
    progress: {
      'aula_demo:enr_ana:ws_solar': { total: 4, attempted: 4, correct: 4, done: true, score: 1, validated: null, updatedAt: nowISO() },
      'aula_demo:enr_ana:ws_routines': { total: 5, attempted: 2, correct: 2, done: false, score: 0.4, validated: null, updatedAt: nowISO() },
      'aula_demo:enr_bruno:ws_solar': { total: 4, attempted: 3, correct: 2, done: false, score: 0.5, validated: null, updatedAt: nowISO() },
      'aula_demo:enr_carla:ws_solar': { total: 4, attempted: 4, correct: 4, done: true, score: 1, validated: 'validated', updatedAt: nowISO() },
      'aula_demo:enr_carla:ws_routines': { total: 5, attempted: 5, correct: 4, done: true, score: 0.8, validated: 'review', updatedAt: nowISO() },
    },
  };
}

/* ---------------- persistence ---------------- */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt state */ }
  const fresh = seed();
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

let state = load();

function persist() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ---------------- session (fake auth) ---------------- */

export const auth = {
  current() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  },
  isAuthed() { return Boolean(this.current()); },
  /** Any credentials work — this is boilerplate. */
  login(email) {
    const session = { email: email || state.teacher.email, since: nowISO() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (email && email !== state.teacher.email) { state.teacher.email = email; persist(); }
    return session;
  },
  signup(name, email) {
    if (name) state.teacher.name = name;
    if (email) state.teacher.email = email;
    persist();
    return this.login(email);
  },
  logout() { localStorage.removeItem(SESSION_KEY); },
};

/* ---------------- reads ---------------- */

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

  updateTeacher(patch) { Object.assign(state.teacher, patch); persist(); },

  addClassroom(data) {
    const c = { id: uid('class'), createdAt: nowISO(), context: '', ...data };
    state.classrooms.unshift(c);
    persist();
    return c;
  },
  updateClassroom(id, patch) {
    const c = this.classroom(id);
    if (c) { Object.assign(c, patch); persist(); }
    return c;
  },
  removeClassroom(id) {
    state.classrooms = state.classrooms.filter((c) => c.id !== id);
    state.students = state.students.filter((s) => s.classId !== id);
    state.resources = state.resources.filter((r) => r.classId !== id);
    persist();
  },

  addStudent(classId, data) {
    const s = { id: uid('stu'), classId, level: '', pronouns: '', goals: '', needs: '', notes: [], ...data };
    state.students.push(s);
    persist();
    return s;
  },
  updateStudent(id, patch) {
    const s = this.student(id);
    if (s) { Object.assign(s, patch); persist(); }
    return s;
  },
  addStudentNote(id, text) {
    const s = this.student(id);
    if (s && text.trim()) { s.notes.unshift({ id: uid('n'), at: nowISO(), text: text.trim() }); persist(); }
    return s;
  },
  removeStudent(id) { state.students = state.students.filter((s) => s.id !== id); persist(); },

  addResource(data) {
    const r = { id: uid('res'), createdAt: nowISO(), tags: [], note: '', type: 'worksheet', ...data };
    state.resources.unshift(r);
    persist();
    return r;
  },
  removeResource(id) { state.resources = state.resources.filter((r) => r.id !== id); persist(); },

  /* -------------- aula (live classroom) -------------- */

  aulas: () => (state.aulas || []).slice(),
  aula: (id) => (state.aulas || []).find((a) => a.id === id) || null,
  aulaByCode: (code) => (state.aulas || []).find((a) => a.code.toUpperCase() === String(code).toUpperCase()) || null,
  aulasForClass: (classId) => (state.aulas || []).filter((a) => a.classId === classId),
  worksheet: (id) => (state.worksheets || []).find((w) => w.id === id) || null,
  worksheetsAll: () => (state.worksheets || []).slice(),
  aulaWorksheets: (aulaId) => {
    const a = store.aula(aulaId);
    return a ? a.worksheetIds.map((id) => store.worksheet(id)).filter(Boolean) : [];
  },
  enrollments: (aulaId) => (state.enrollments || []).filter((e) => e.aulaId === aulaId),
  enrollment: (id) => (state.enrollments || []).find((e) => e.id === id) || null,

  createAula(classId, title, worksheetIds) {
    const code = 'A' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const a = { id: uid('aula'), classId, title, code, status: 'live', worksheetIds: worksheetIds.slice(), createdAt: nowISO() };
    state.aulas.unshift(a); persist(); broadcast({ type: 'aula' });
    return a;
  },
  setAulaStatus(id, status) { const a = this.aula(id); if (a) { a.status = status; persist(); broadcast({ type: 'aula' }); } return a; },

  /** Enrol (or re-find) a student by name in an aula. */
  enroll(aulaId, name) {
    const existing = (state.enrollments || []).find((e) => e.aulaId === aulaId && e.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;
    const e = { id: uid('enr'), aulaId, name: name.trim(), joinedAt: nowISO() };
    state.enrollments.push(e); persist(); broadcast({ type: 'enroll', aulaId });
    return e;
  },

  progressKey: (aulaId, enrollmentId, worksheetId) => `${aulaId}:${enrollmentId}:${worksheetId}`,
  getProgress(aulaId, enrollmentId, worksheetId) {
    return (state.progress || {})[store.progressKey(aulaId, enrollmentId, worksheetId)] || null;
  },
  progressForAula: (aulaId) => Object.entries(state.progress || {})
    .filter(([k]) => k.startsWith(aulaId + ':'))
    .map(([k, v]) => { const [, enrollmentId, worksheetId] = k.split(':'); return { enrollmentId, worksheetId, ...v }; }),

  setProgress(aulaId, enrollmentId, worksheetId, snap) {
    const key = store.progressKey(aulaId, enrollmentId, worksheetId);
    const prev = state.progress[key] || {};
    state.progress[key] = { ...prev, ...snap, validated: prev.validated ?? null, updatedAt: nowISO() };
    persist();
    broadcast({ type: 'progress', aulaId, enrollmentId, worksheetId });
    return state.progress[key];
  },
  setValidation(aulaId, enrollmentId, worksheetId, validated) {
    const key = store.progressKey(aulaId, enrollmentId, worksheetId);
    if (!state.progress[key]) state.progress[key] = { total: 0, attempted: 0, correct: 0, done: false, score: 0 };
    state.progress[key].validated = validated;
    state.progress[key].updatedAt = nowISO();
    persist(); broadcast({ type: 'progress', aulaId });
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

  /** Wipe local data (dev affordance). */
  reset() { localStorage.removeItem(KEY); localStorage.removeItem(STUDENT_KEY); state = load(); },
};

/* ---------------- student session (separate from teacher) ---------------- */

export const studentAuth = {
  current() { try { return JSON.parse(localStorage.getItem(STUDENT_KEY) || 'null'); } catch { return null; } },
  isJoined() { return Boolean(this.current()); },
  join(aulaId, enrollment) {
    const s = { aulaId, enrollmentId: enrollment.id, name: enrollment.name, since: nowISO() };
    localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
    return s;
  },
  leave() { localStorage.removeItem(STUDENT_KEY); },
};

/* ---------------- cross-tab live sync (no backend) ---------------- */

const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('ensinolibre.aula') : null;

function broadcast(msg) { if (channel) channel.postMessage(msg); }

/** Subscribe to live updates from other tabs. Reloads state before notifying. */
export function onLiveUpdate(handler) {
  const wrapped = (ev) => { state = load(); handler(ev.data); };
  if (channel) channel.addEventListener('message', wrapped);
  // Fallback: another tab wrote localStorage directly.
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); handler({ type: 'storage' }); } });
  return () => { if (channel) channel.removeEventListener('message', wrapped); };
}

/** Re-read persisted state (used by student tab before rendering). */
export function refresh() { state = load(); }
