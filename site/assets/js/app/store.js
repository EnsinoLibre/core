/**
 * EnsinoLibre teacher workspace — local data store (BOILERPLATE, no backend).
 *
 * Everything lives in localStorage and is seeded with mock data on first run.
 * This is a UI prototype: when the real backend lands, swap the read/write
 * helpers here for API calls and the views stay unchanged. The data shape is
 * deliberately shaped around the product vision — persistent, per-class and
 * per-student *context* that an AI agent will later read and write.
 */

const KEY = 'ensinolibre.workspace.v1';
const SESSION_KEY = 'ensinolibre.session.v1';

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

  /** Wipe local data (dev affordance). */
  reset() { localStorage.removeItem(KEY); state = load(); },
};
