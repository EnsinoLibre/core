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

const KEY = 'ensinolibre.workspace.v2';
const SESSION_KEY = 'ensinolibre.session.v1';
const STUDENT_KEY = 'ensinolibre.student.v1';

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const nowISO = () => new Date().toISOString();

/* ---------------- seed ---------------- */

/** Deterministic pseudo-random in [0,1) from a string — stable demo data. */
function seedRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Count auto-gradeable "units" in a worksheet doc (mirrors the live tracker). */
function gradeableUnits(doc) {
  let n = 0;
  for (const sec of doc.sections) for (const a of sec.activities) {
    switch (a.type) {
      case 'mcq': case 'true-false': case 'gap-fill': case 'matching':
      case 'ordering': case 'mark-words': case 'crossword': case 'summary': n += 1; break;
      case 'quiz': case 'single-choice-set': case 'question-set': case 'reading-comp': n += (a.questions ? a.questions.length : 0); break;
      case 'translation': n += (a.sentences ? a.sentences.length : 0); break;
      default: break;
    }
  }
  return n;
}

function seed() {
  const teacherId = 'teacher_demo';

  // ---- Classrooms (stable ids so everything else can reference them) ----
  const classrooms = [
    { id: 'c_a1', name: 'English A1 — Intensive', subject: 'English', level: 'A1', term: '2026 Spring',
      description: 'Absolute beginners, intensive four-week course.',
      context: 'Start from the alphabet, greetings, numbers. Lots of repetition and visual support; avoid metalanguage.', createdAt: nowISO() },
    { id: 'c_a2e', name: 'English A2 — Evening', subject: 'English', level: 'A2', term: '2026 Spring',
      description: 'Working adults, twice weekly. Everyday communication.',
      context: 'Mixed A1–A2. Responds well to real-life scenarios (shops, travel, routines). Keep grammar light.', createdAt: nowISO() },
    { id: 'c_a2m', name: 'English A2 — Morning', subject: 'English', level: 'A2', term: '2026 Spring',
      description: 'Retirees and part-time learners. Relaxed pace.',
      context: 'Confidence-building group. Enjoys pair work and vocabulary games. Directions and shopping are current topics.', createdAt: nowISO() },
    { id: 'c_b1', name: 'English B1 — Morning', subject: 'English', level: 'B1', term: '2026 Spring',
      description: 'Pre-intermediate adults preparing for a workplace certificate.',
      context: 'Confident speakers; need writing structure, cohesion and past narrative. Professional contexts land best.', createdAt: nowISO() },
    { id: 'c_b2', name: 'Business B2 — Corporate', subject: 'Business English', level: 'B2', term: '2026 Spring',
      description: 'In-company course for a logistics firm.',
      context: 'Goal is professional email and meeting language. Motivated but time-poor; short focused tasks work best.', createdAt: nowISO() },
  ];

  // ---- Students (distributed across classrooms) ----
  const note = (text) => [{ id: uid('n'), at: nowISO(), text }];
  const students = [
    // A1 Intensive
    { id: 's_carla', classId: 'c_a1', name: 'Carla Nunes', level: 'A1', pronouns: 'she/her', goals: 'Survival vocabulary: numbers, shops, directions.', needs: 'New to the group — light scaffolding.', notes: note('Joined mid-term; catch-up pack assigned.') },
    { id: 's_hugo', classId: 'c_a1', name: 'Hugo Batista', level: 'A1', pronouns: 'he/him', goals: 'Recognise and say the alphabet and greetings.', needs: 'Anxious about speaking — build up gently.', notes: [] },
    { id: 's_ines', classId: 'c_a1', name: 'Inês Rocha', level: 'A1', pronouns: 'she/her', goals: 'Basic classroom language and numbers.', needs: 'Fast learner; give extension tasks.', notes: note('Ready to move up to A2 next term.') },
    { id: 's_joao', classId: 'c_a1', name: 'João Pereira', level: 'A1', pronouns: 'he/him', goals: 'Talk about family and home.', needs: 'Irregular attendance — keep tasks self-contained.', notes: [] },
    // A2 Evening
    { id: 's_ana', classId: 'c_a2e', name: 'Ana Ferreira', level: 'A2', pronouns: 'she/her', goals: 'Confidence with daily routines; consolidate present simple.', needs: 'Prefers visual support. Dyslexia-friendly fonts help.', notes: note('Strong vocabulary, hesitant with question forms.') },
    { id: 's_bruno', classId: 'c_a2e', name: 'Bruno Costa', level: 'A2', pronouns: 'he/him', goals: 'Accuracy with everyday transactions (shops, prices).', needs: 'Works best with short, timed tasks.', notes: [] },
    { id: 's_lara', classId: 'c_a2e', name: 'Lara Simões', level: 'A2', pronouns: 'she/her', goals: 'Speak about her week without long pauses.', needs: 'Motivated by cooking and travel topics.', notes: [] },
    { id: 's_marco', classId: 'c_a2e', name: 'Marco Dias', level: 'A1', pronouns: 'he/him', goals: 'Catch up to the group on present simple.', needs: 'Lower than the class average — pair with a stronger student.', notes: note('Border A1/A2; monitor for frustration.') },
    { id: 's_nadia', classId: 'c_a2e', name: 'Nádia Lopes', level: 'A2', pronouns: 'she/her', goals: 'Prepositions of place; giving directions.', needs: '', notes: [] },
    { id: 's_paulo', classId: 'c_a2e', name: 'Paulo Reis', level: 'A2', pronouns: 'he/him', goals: 'Fluency in short conversations.', needs: 'Confident but inaccurate — focus on -s endings.', notes: [] },
    // A2 Morning
    { id: 's_rita', classId: 'c_a2m', name: 'Rita Gomes', level: 'A2', pronouns: 'she/her', goals: 'Shopping and money language.', needs: 'Enjoys role-play.', notes: [] },
    { id: 's_sofia', classId: 'c_a2m', name: 'Sofia Melo', level: 'A2', pronouns: 'she/her', goals: 'Directions around town.', needs: 'Hearing support — face the class when modelling.', notes: note('Benefits from written back-up of instructions.') },
    { id: 's_tiago', classId: 'c_a2m', name: 'Tiago Fonseca', level: 'A2', pronouns: 'he/him', goals: 'Confidence asking questions.', needs: '', notes: [] },
    { id: 's_vera', classId: 'c_a2m', name: 'Vera Antunes', level: 'A2', pronouns: 'she/her', goals: 'Consolidate present simple; start past simple.', needs: 'Ready for a challenge.', notes: [] },
    { id: 's_yara', classId: 'c_a2m', name: 'Yara Cunha', level: 'A1', pronouns: 'she/her', goals: 'Numbers and prices for shopping.', needs: 'New arrival; still building basics.', notes: [] },
    // B1 Morning
    { id: 's_diogo', classId: 'c_b1', name: 'Diogo Alves', level: 'B1', pronouns: 'he/him', goals: 'Extended writing: linking with because/although.', needs: 'Motivated by football and gaming contexts.', notes: note('Great past narrative; watch comma splices.') },
    { id: 's_eva', classId: 'c_b1', name: 'Eva Marques', level: 'B1', pronouns: 'she/her', goals: 'Fluency in short discussions; reduce L1 fillers.', needs: '', notes: [] },
    { id: 's_filipe', classId: 'c_b1', name: 'Filipe Tavares', level: 'B1', pronouns: 'he/him', goals: 'Comparatives and superlatives for describing.', needs: 'Perfectionist — encourage risk-taking.', notes: [] },
    { id: 's_gabriela', classId: 'c_b1', name: 'Gabriela Pinto', level: 'B2', pronouns: 'she/her', goals: 'Stretch tasks; considering C1 later.', needs: 'Ahead of the class — give leadership roles.', notes: note('Candidate to move to the B2 group.') },
    { id: 's_kevin', classId: 'c_b1', name: 'Kevin Sousa', level: 'B1', pronouns: 'he/him', goals: 'Accuracy in past questions and negatives.', needs: 'Confident speaker, weaker writer.', notes: [] },
    // B2 Business
    { id: 's_luisa', classId: 'c_b2', name: 'Luísa Cardoso', level: 'B2', pronouns: 'she/her', goals: 'Formal email register and tone.', needs: 'Very time-poor — bite-size homework.', notes: [] },
    { id: 's_manuel', classId: 'c_b2', name: 'Manuel Freitas', level: 'B2', pronouns: 'he/him', goals: 'Chairing meetings in English.', needs: 'Needs pronunciation work on stress.', notes: [] },
    { id: 's_olga', classId: 'c_b2', name: 'Olga Ramos', level: 'B2', pronouns: 'she/her', goals: 'Negotiation language.', needs: '', notes: [] },
    { id: 's_ricardo', classId: 'c_b2', name: 'Ricardo Matos', level: 'B1', pronouns: 'he/him', goals: 'Bridge B1→B2 for report writing.', needs: 'Slightly below the group; extra scaffolding on cohesion.', notes: note('Struggles with linkers; assigned the feedback rubric.') },
  ];

  // ---- Aulas (live classes): deploy worksheets to classrooms; some worksheets shared ----
  const aulas = [
    { id: 'aula_a2e', classId: 'c_a2e', title: 'A2 Evening — Routines, Shopping & Space', code: 'A2LIVE', status: 'live', worksheetIds: ['ws_routines', 'ws_shopping', 'ws_solar'], createdAt: nowISO() },
    { id: 'aula_a2m', classId: 'c_a2m', title: 'A2 Morning — Routines & Directions', code: 'A2MORN', status: 'live', worksheetIds: ['ws_routines', 'ws_directions'], createdAt: nowISO() },
    { id: 'aula_b1', classId: 'c_b1', title: 'B1 — Past Holiday & Comparatives', code: 'B1LIVE', status: 'live', worksheetIds: ['ws_past_holiday', 'ws_comparatives'], createdAt: nowISO() },
    { id: 'aula_a1', classId: 'c_a1', title: 'A1 — Animals & Directions (session 3)', code: 'A1JOIN', status: 'closed', worksheetIds: ['ws_animals', 'ws_directions'], createdAt: nowISO() },
  ];

  // ---- Generated enrolments + progress (consistent, varied, deterministic) ----
  const wsUnits = {};
  for (const w of SEED_WORKSHEETS) wsUnits[w.id] = gradeableUnits(w.doc);
  const enrollments = [];
  const progress = {};
  for (const a of aulas) {
    const roster = students.filter((s) => s.classId === a.classId);
    roster.forEach((s) => {
      // most students have joined; a couple of live-class stragglers have not
      const joined = a.status === 'closed' || seedRand(a.id + s.id) > 0.16;
      if (!joined) return;
      const enrId = `enr_${a.id.slice(5)}_${s.id.slice(2)}`;
      enrollments.push({ id: enrId, aulaId: a.id, name: s.name, joinedAt: nowISO() });
      for (const wid of a.worksheetIds) {
        const total = wsUnits[wid] || 4;
        const r = seedRand(enrId + wid);
        const acc = seedRand(wid + enrId + 'acc');
        const attempted = a.status === 'closed' ? total : Math.round(r * total);
        const done = attempted >= total;
        if (attempted === 0 && !done) continue; // not started yet — leave unstored
        const correct = attempted ? Math.max(0, Math.min(attempted, Math.round(attempted * (0.55 + acc * 0.45)))) : 0;
        const score = total ? correct / total : 1;
        let validated = null;
        if (done) validated = acc > 0.7 ? 'validated' : (acc < 0.12 ? 'review' : null);
        progress[`${a.id}:${enrId}:${wid}`] = { total, attempted, correct, done, score, validated, updatedAt: nowISO() };
      }
    });
  }

  // ---- Knowledge repository: guidelines, materials, external, context, saved worksheets ----
  const R = (o) => ({ createdAt: nowISO(), type: 'other', tags: [], links: [], ...o });
  const resources = [
    // guidelines (apply across classrooms)
    R({ id: 'r_g_a1', title: 'Guideline — CEFR A1 can-do statements', kind: 'guideline', subject: 'English', classId: null, tags: ['cefr', 'assessment'], note: 'A1 descriptors for planning and validating beginner tasks.', links: ['class:c_a1'] }),
    R({ id: 'r_g_a2', title: 'Guideline — CEFR A2 descriptors', kind: 'guideline', subject: 'English', classId: null, tags: ['cefr', 'assessment'], note: 'Can-do statements for A2 speaking and writing.', links: ['class:c_a2e', 'class:c_a2m'] }),
    R({ id: 'r_g_b1', title: 'Guideline — CEFR B1 descriptors', kind: 'guideline', subject: 'English', classId: null, tags: ['cefr', 'assessment'], note: 'B1 descriptors: narrative, opinion, cohesion.', links: ['class:c_b1'] }),
    R({ id: 'r_g_b2', title: 'Guideline — B2 workplace writing criteria', kind: 'guideline', subject: 'Business English', classId: null, tags: ['cefr', 'writing'], note: 'Register, tone and structure for professional writing.', links: ['class:c_b2'] }),
    R({ id: 'r_g_feedback', title: 'Guideline — Written-feedback rubric', kind: 'guideline', subject: 'English', classId: null, tags: ['assessment', 'feedback'], note: 'Shared rubric for marking and validating written work across levels.', links: ['class:c_a2e', 'class:c_b1', 'class:c_b2'] }),
    // materials (tied to worksheets + classes)
    R({ id: 'r_m_shops', title: 'Material — In the shops role-play cards', kind: 'material', subject: 'English', classId: 'c_a2e', tags: ['speaking', 'vocabulary'], note: 'Printable role-play cards for shopping dialogues.', links: ['worksheet:ws_shopping', 'class:c_a2e', 'class:c_a2m', 'resource:r_g_a2'] }),
    R({ id: 'r_m_map', title: 'Material — Town map handout', kind: 'material', subject: 'English', classId: 'c_a2m', tags: ['directions'], note: 'A4 town map for directions practice.', links: ['worksheet:ws_directions', 'class:c_a1', 'class:c_a2m'] }),
    R({ id: 'r_m_animals', title: 'Material — Animal picture flashcards', kind: 'material', subject: 'English', classId: 'c_a1', tags: ['vocabulary', 'A1'], note: 'Printable animal flashcards.', links: ['worksheet:ws_animals', 'class:c_a1'] }),
    R({ id: 'r_m_emails', title: 'Material — Business email templates', kind: 'material', subject: 'Business English', classId: 'c_b2', tags: ['writing', 'email'], note: 'Model formal/neutral email openings and closings.', links: ['worksheet:ws_jobs_email', 'class:c_b2', 'resource:r_g_b2'] }),
    // external
    R({ id: 'r_x_bbc', title: 'BBC Learning English', kind: 'external', subject: 'English', classId: 'c_a2e', tags: ['listening', 'external'], url: 'https://www.bbc.co.uk/learningenglish', note: 'Short clips and quizzes for homework.', links: ['class:c_a2e', 'class:c_b1', 'resource:r_g_a2'] }),
    R({ id: 'r_x_ted', title: 'TED-Ed talks', kind: 'external', subject: 'English', classId: 'c_b1', tags: ['listening', 'external'], url: 'https://ed.ted.com', note: 'Short talks for B1/B2 listening and discussion.', links: ['class:c_b1', 'class:c_b2'] }),
    // per-student context (link a student, their class, and a relevant guideline)
    R({ id: 'r_ctx_ana', title: 'Context — Ana Ferreira learning profile', kind: 'context', subject: 'English', classId: 'c_a2e', studentId: 's_ana', tags: ['context', 'differentiation'], note: 'Visual learner; confident vocabulary, hesitant with question forms; dyslexia-friendly fonts help.', links: ['student:s_ana', 'class:c_a2e', 'resource:r_g_a2'] }),
    R({ id: 'r_ctx_carla', title: 'Context — Carla Nunes catch-up plan', kind: 'context', subject: 'English', classId: 'c_a1', studentId: 's_carla', tags: ['context', 'onboarding'], note: 'Joined mid-term; needs numbers, shops and directions before rejoining the main sequence.', links: ['student:s_carla', 'class:c_a1', 'resource:r_g_a1'] }),
    R({ id: 'r_ctx_diogo', title: 'Context — Diogo Alves writing profile', kind: 'context', subject: 'English', classId: 'c_b1', studentId: 's_diogo', tags: ['context', 'writing'], note: 'Strong narrative; target comma splices and paragraph cohesion.', links: ['student:s_diogo', 'class:c_b1', 'resource:r_g_feedback'] }),
    R({ id: 'r_ctx_ricardo', title: 'Context — Ricardo Matos bridge plan (B1→B2)', kind: 'context', subject: 'Business English', classId: 'c_b2', studentId: 's_ricardo', tags: ['context', 'differentiation'], note: 'Below group level; extra scaffolding on linkers and report structure.', links: ['student:s_ricardo', 'class:c_b2', 'resource:r_g_b2', 'resource:r_g_feedback'] }),
    // saved generated worksheets (as knowledge nodes)
    R({ id: 'r_ws_routines', title: 'Saved — Daily routines practice', kind: 'worksheet', type: 'worksheet', subject: 'English', classId: 'c_a2e', tags: ['present-simple'], note: 'Generated from the worksheet builder and deployed live.', links: ['worksheet:ws_routines', 'class:c_a2e', 'aula:aula_a2e'] }),
    R({ id: 'r_ws_holiday', title: 'Saved — My last holiday', kind: 'worksheet', type: 'worksheet', subject: 'English', classId: 'c_b1', tags: ['past-simple', 'writing'], note: 'Past-simple narrative worksheet.', links: ['worksheet:ws_past_holiday', 'class:c_b1', 'aula:aula_b1'] }),
  ];

  return {
    teacher: {
      id: teacherId, name: 'Sara Viana', email: 'teacher@ensinolibre.org',
      school: 'IPVC — Viana do Castelo', subjects: 'English as a Foreign Language',
      bio: 'Adult-education EFL teacher. Building persistent, per-student context so planning and feedback compound over time.',
      locale: 'en-GB',
    },
    classrooms,
    students,
    resources,
    aulas,
    worksheets: SEED_WORKSHEETS.map((w) => ({ ...w })),
    enrollments,
    progress,
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
    const r = { id: uid('res'), createdAt: nowISO(), tags: [], note: '', type: 'worksheet', kind: 'material', links: [], ...data };
    state.resources.unshift(r);
    persist();
    return r;
  },
  linkResource(id, targetNodeId) {
    const r = this.resource(id);
    if (r) { r.links = r.links || []; if (!r.links.includes(targetNodeId)) { r.links.push(targetNodeId); persist(); } }
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

  /** Add a worksheet document to the library (e.g. saved from the generator). */
  addWorksheet(doc) {
    const w = { id: uid('ws'), title: doc.title || 'Untitled worksheet', subject: doc.subject || '', doc };
    state.worksheets = state.worksheets || [];
    state.worksheets.unshift(w);
    persist(); broadcast({ type: 'worksheet' });
    return w;
  },
  removeWorksheet(id) {
    state.worksheets = (state.worksheets || []).filter((w) => w.id !== id);
    // detach from any aula
    for (const a of state.aulas || []) a.worksheetIds = a.worksheetIds.filter((wid) => wid !== id);
    persist(); broadcast({ type: 'worksheet' });
  },

  /** Deploy worksheets to a class as a new live aula (with a unique join code). */
  createAula(classId, title, worksheetIds) {
    const used = new Set((state.aulas || []).map((a) => a.code));
    let code;
    do { code = 'A' + Math.random().toString(36).slice(2, 6).toUpperCase(); } while (used.has(code));
    const a = { id: uid('aula'), classId, title, code, status: 'live', worksheetIds: worksheetIds.slice(), createdAt: nowISO() };
    state.aulas.unshift(a); persist(); broadcast({ type: 'aula' });
    return a;
  },
  setAulaStatus(id, status) { const a = this.aula(id); if (a) { a.status = status; persist(); broadcast({ type: 'aula' }); } return a; },
  removeAula(id) {
    state.aulas = (state.aulas || []).filter((a) => a.id !== id);
    state.enrollments = (state.enrollments || []).filter((e) => e.aulaId !== id);
    for (const k of Object.keys(state.progress || {})) if (k.startsWith(id + ':')) delete state.progress[k];
    persist(); broadcast({ type: 'aula' });
  },

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
