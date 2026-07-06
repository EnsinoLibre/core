/**
 * EnsinoLibre teacher workspace — views (BOILERPLATE UI, no backend).
 * Each exported function returns a DOM node for a route.
 */
import { store, auth } from './store.js';
import { navigate } from './router.js';
import {
  el, avatar, levelBadge, fmtDate, relTime, modal, field, input, textarea, select, emptyState,
} from './util.js';

/* ---------- shared bits ---------- */

function pageHead(title, subtitle, actions) {
  return el('div', { class: 'app-page-head' }, [
    el('div', {}, [
      el('h1', { class: 'app-page-title', text: title }),
      subtitle ? el('p', { class: 'app-page-sub', text: subtitle }) : null,
    ]),
    actions ? el('div', { class: 'app-page-actions' }, actions) : null,
  ]);
}

function statCard(label, value, to) {
  return el('button', { class: 'el-card el-card--interactive app-stat', onclick: () => navigate(to) }, [
    el('span', { class: 'app-stat-value', text: String(value) }),
    el('span', { class: 'app-stat-label', text: label }),
  ]);
}

/**
 * The agent-integration stub. The product's real value: an assistant that
 * reads and writes this persistent context. UI-only for now.
 */
function assistantPanel(scopeLabel, contextText) {
  const inputEl = input({ placeholder: `Ask about ${scopeLabel}…`, disabled: true });
  return el('section', { class: 'el-card app-assistant' }, [
    el('div', { class: 'app-assistant-head' }, [
      el('span', { class: 'app-assistant-badge', text: '✦ Assistant' }),
      el('span', { class: 'el-badge el-badge--accent', text: 'Coming soon' }),
    ]),
    el('p', { class: 'el-card__body', text:
      `Your AI assistant will use ${scopeLabel} context to plan lessons, generate targeted worksheets and draft feedback — and write what it learns back here.` }),
    contextText ? el('blockquote', { class: 'app-context-quote', text: contextText }) : null,
    el('div', { class: 'app-assistant-input' }, [
      inputEl,
      el('button', { class: 'el-button', disabled: true, text: 'Send' }),
    ]),
  ]);
}

function backLink(label, to) {
  return el('button', { class: 'app-back', onclick: () => navigate(to) }, [el('span', { text: '←' }), label]);
}

/* ---------- login ---------- */

export function loginView() {
  const wrap = el('div', { class: 'app-auth' });
  let mode = 'login';
  const card = el('div', { class: 'el-card app-auth-card' });
  wrap.appendChild(el('div', { class: 'app-auth-brand' }, [
    el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 30 }),
  ]));
  wrap.appendChild(card);

  function render() {
    card.replaceChildren();
    const nameEl = input({ type: 'text', placeholder: 'Your name', autocomplete: 'name' });
    const emailEl = input({ type: 'email', placeholder: 'you@school.org', value: 'teacher@ensinolibre.org', autocomplete: 'email' });
    const passEl = input({ type: 'password', placeholder: '••••••••', value: 'demo', autocomplete: 'current-password' });

    const submit = el('button', { class: 'el-button app-auth-submit', text: mode === 'login' ? 'Sign in' : 'Create account' });
    const form = el('form', { class: 'app-auth-form', onsubmit: (e) => {
      e.preventDefault();
      if (mode === 'signup') auth.signup(nameEl.value.trim(), emailEl.value.trim());
      else auth.login(emailEl.value.trim());
      navigate('/');
    } }, [
      mode === 'signup' ? field('Name', nameEl) : null,
      field('Email', emailEl),
      field('Password', passEl),
      submit,
    ]);

    card.append(
      el('h1', { class: 'app-auth-title', text: mode === 'login' ? 'Teacher sign in' : 'Create your teacher account' }),
      el('p', { class: 'app-auth-sub', text: 'Prototype — any details work; nothing is sent anywhere.' }),
      form,
      el('p', { class: 'app-auth-switch' }, [
        mode === 'login' ? 'New here? ' : 'Already have an account? ',
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; render(); },
          text: mode === 'login' ? 'Create an account' : 'Sign in' }),
      ]),
      el('p', { class: 'app-auth-back' }, [el('a', { href: 'index.html', text: '← Back to the worksheet generator' })]),
    );
  }
  render();
  return wrap;
}

/* ---------- dashboard ---------- */

export function dashboardView() {
  const t = store.teacher();
  const c = store.counts();
  const node = el('div', {});
  node.append(
    pageHead(`Welcome back, ${t.name.split(' ')[0]}`, 'Your classes, students and resources at a glance.'),
    el('div', { class: 'app-stats' }, [
      statCard('Classrooms', c.classrooms, '/classrooms'),
      statCard('Students', c.students, '/students'),
      statCard('Resources', c.resources, '/resources'),
    ]),
    el('div', { class: 'app-grid-2' }, [
      el('section', {}, [
        el('h2', { class: 'app-section-title', text: 'Your classrooms' }),
        el('div', { class: 'app-card-grid' }, store.classrooms().slice(0, 4).map(classroomCard)),
      ]),
      assistantPanel('your whole workspace',
        'Once connected, ask things like “draft a B1 writing task for Diogo using his goals” or “which A2 students still struggle with question forms?”'),
    ]),
  );
  return node;
}

function classroomCard(cls) {
  const roster = store.studentsIn(cls.id);
  return el('div', { class: 'el-card el-card--interactive app-class-card', onclick: () => navigate(`/classrooms/${cls.id}`) }, [
    el('div', { class: 'app-class-card-top' }, [
      el('h3', { class: 'el-card__title', text: cls.name }),
      levelBadge(cls.level),
    ]),
    el('p', { class: 'el-card__body', text: cls.description }),
    el('div', { class: 'el-card__footer' }, [
      el('span', { class: 'el-badge el-badge--neutral', text: `${roster.length} student${roster.length === 1 ? '' : 's'}` }),
      el('span', { class: 'el-badge el-badge--neutral', text: cls.term }),
    ]),
  ]);
}

/* ---------- classrooms ---------- */

export function classroomsView() {
  const node = el('div', {});
  const grid = el('div', { class: 'app-card-grid' });
  function paint() {
    grid.replaceChildren();
    const list = store.classrooms();
    if (!list.length) grid.appendChild(emptyState('🏫', 'No classrooms yet', 'Create your first class to start tracking students and context.',
      el('button', { class: 'el-button', text: 'New classroom', onclick: () => newClassroomModal(paint) })));
    else list.forEach((c) => grid.appendChild(classroomCard(c)));
  }
  node.append(
    pageHead('Classrooms', 'Each class carries its own context your assistant can use.', [
      el('button', { class: 'el-button', text: '+ New classroom', onclick: () => newClassroomModal(paint) }),
    ]),
    grid,
  );
  paint();
  return node;
}

function newClassroomModal(onDone) {
  const name = input({ placeholder: 'e.g. English A2 — Evening' });
  const subject = input({ placeholder: 'e.g. English', value: 'English' });
  const level = select(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((v) => ({ value: v, label: v, selected: v === 'A2' })));
  const term = input({ placeholder: 'e.g. 2026 Spring', value: '2026 Spring' });
  const desc = textarea({ placeholder: 'One-line description of the group.' });
  const context = textarea({ placeholder: 'What should the assistant know about this class? (level spread, interests, what lands well)' });
  const m = modal('New classroom', el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim()) { name.classList.add('el-input--invalid'); return; }
    store.addClassroom({ name: name.value.trim(), subject: subject.value.trim(), level: level.value, term: term.value.trim(), description: desc.value.trim(), context: context.value.trim() });
    m.close(); onDone && onDone();
  } }, [
    field('Class name', name),
    el('div', { class: 'app-form-row' }, [field('Subject', subject), field('Level', level), field('Term', term)]),
    field('Description', desc),
    field('Class context', context, 'Persistent notes the AI assistant will draw on.'),
    el('div', { class: 'app-form-actions' }, [
      el('button', { type: 'button', class: 'el-button el-button--ghost', text: 'Cancel', onclick: () => m.close() }),
      el('button', { type: 'submit', class: 'el-button', text: 'Create classroom' }),
    ]),
  ]));
}

/* ---------- classroom detail ---------- */

export function classroomView({ id }) {
  const cls = store.classroom(id);
  if (!cls) return notFoundBlock('Classroom not found', '/classrooms');
  const node = el('div', {});

  const roster = el('div', {});
  function paintRoster() {
    roster.replaceChildren();
    const students = store.studentsIn(cls.id);
    if (!students.length) {
      roster.appendChild(emptyState('🧑‍🎓', 'No students yet', 'Add students to build per-student context.',
        el('button', { class: 'el-button', text: 'Add student', onclick: () => newStudentModal(cls.id, paintRoster) })));
      return;
    }
    const table = el('table', { class: 'app-table' }, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Student' }), el('th', { text: 'Level' }), el('th', { text: 'Goals' }), el('th', {})])),
      el('tbody', {}, students.map((s) => el('tr', { class: 'app-row', onclick: () => navigate(`/students/${s.id}`) }, [
        el('td', {}, el('div', { class: 'app-cell-user' }, [avatar(s.name, 32), el('span', { text: s.name })])),
        el('td', {}, levelBadge(s.level) || el('span', { class: 'app-muted', text: '—' })),
        el('td', {}, el('span', { class: 'app-clamp', text: s.goals || '—' })),
        el('td', {}, el('span', { class: 'app-chevron', text: '›' })),
      ]))),
    ]);
    roster.appendChild(table);
  }
  paintRoster();

  const resources = store.resourcesIn(cls.id);

  node.append(
    backLink('Classrooms', '/classrooms'),
    pageHead(cls.name, `${cls.subject} · ${cls.level} · ${cls.term}`, [
      el('button', { class: 'el-button el-button--ghost', text: 'Edit', onclick: () => editClassroomModal(cls, () => navigate(`/classrooms/${cls.id}`)) }),
      el('button', { class: 'el-button', text: '+ Add student', onclick: () => newStudentModal(cls.id, paintRoster) }),
    ]),
    el('div', { class: 'app-grid-2' }, [
      el('div', {}, [
        el('section', { class: 'el-card app-context-card' }, [
          el('h2', { class: 'app-section-title', text: 'Class context' }),
          el('p', { class: 'el-card__body', text: cls.context || 'No context yet — add notes the assistant can use.' }),
        ]),
        el('section', {}, [
          el('h2', { class: 'app-section-title', text: `Roster (${store.studentsIn(cls.id).length})` }),
          roster,
        ]),
      ]),
      el('div', {}, [
        assistantPanel(`the ${cls.name} class`, cls.context),
        el('section', { class: 'app-side-section' }, [
          el('h2', { class: 'app-section-title', text: `Resources (${resources.length})` }),
          resources.length
            ? el('div', { class: 'app-list' }, resources.map(resourceRow))
            : el('p', { class: 'app-muted', text: 'No resources linked to this class yet.' }),
        ]),
      ]),
    ]),
  );
  return node;
}

function editClassroomModal(cls, onDone) {
  const name = input({ value: cls.name });
  const desc = textarea({ value: cls.description });
  const context = textarea({ value: cls.context, rows: 5 });
  const m = modal('Edit classroom', el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    store.updateClassroom(cls.id, { name: name.value.trim(), description: desc.value.trim(), context: context.value.trim() });
    m.close(); onDone && onDone();
  } }, [
    field('Class name', name),
    field('Description', desc),
    field('Class context', context, 'Persistent notes the AI assistant will draw on.'),
    el('div', { class: 'app-form-actions' }, [
      el('button', { type: 'button', class: 'el-button el-button--danger el-button--small', text: 'Delete class', onclick: () => {
        if (confirm(`Delete “${cls.name}” and its students? This cannot be undone.`)) { store.removeClassroom(cls.id); m.close(); navigate('/classrooms'); }
      } }),
      el('span', { class: 'app-spacer' }),
      el('button', { type: 'button', class: 'el-button el-button--ghost', text: 'Cancel', onclick: () => m.close() }),
      el('button', { type: 'submit', class: 'el-button', text: 'Save' }),
    ]),
  ]));
}

function newStudentModal(classId, onDone) {
  const name = input({ placeholder: 'Full name' });
  const level = select(['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((v) => ({ value: v, label: v || 'Level…' })));
  const pronouns = input({ placeholder: 'e.g. she/her' });
  const goals = textarea({ placeholder: 'Learning goals for this student.' });
  const needs = textarea({ placeholder: 'Support needs, interests, anything the assistant should respect.' });
  const m = modal('Add student', el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim()) { name.classList.add('el-input--invalid'); return; }
    store.addStudent(classId, { name: name.value.trim(), level: level.value, pronouns: pronouns.value.trim(), goals: goals.value.trim(), needs: needs.value.trim() });
    m.close(); onDone && onDone();
  } }, [
    field('Name', name),
    el('div', { class: 'app-form-row' }, [field('Level', level), field('Pronouns', pronouns)]),
    field('Goals', goals),
    field('Needs & context', needs),
    el('div', { class: 'app-form-actions' }, [
      el('button', { type: 'button', class: 'el-button el-button--ghost', text: 'Cancel', onclick: () => m.close() }),
      el('button', { type: 'submit', class: 'el-button', text: 'Add student' }),
    ]),
  ]));
}

/* ---------- students (all) ---------- */

export function studentsView() {
  const node = el('div', {});
  const list = store.students();
  const byClass = new Map();
  for (const s of list) { if (!byClass.has(s.classId)) byClass.set(s.classId, []); byClass.get(s.classId).push(s); }
  const sections = [...byClass.entries()].map(([classId, students]) => {
    const cls = store.classroom(classId);
    return el('section', { class: 'app-side-section' }, [
      el('h2', { class: 'app-section-title' }, [
        el('a', { href: `#/classrooms/${classId}`, text: cls ? cls.name : 'Class' }),
        el('span', { class: 'el-badge el-badge--neutral', text: `${students.length}` }),
      ]),
      el('div', { class: 'app-card-grid' }, students.map(studentCard)),
    ]);
  });
  node.append(
    pageHead('Students', 'Every learner and the context you keep on them.'),
    list.length ? el('div', {}, sections) : emptyState('🧑‍🎓', 'No students yet', 'Add students from a classroom.'),
  );
  return node;
}

function studentCard(s) {
  return el('div', { class: 'el-card el-card--interactive app-student-card', onclick: () => navigate(`/students/${s.id}`) }, [
    el('div', { class: 'app-cell-user' }, [avatar(s.name, 40), el('div', {}, [
      el('div', { class: 'app-student-name', text: s.name }),
      el('div', { class: 'app-muted', text: s.pronouns || '' }),
    ]), levelBadge(s.level)]),
    el('p', { class: 'el-card__body app-clamp-2', text: s.goals || 'No goals set yet.' }),
  ]);
}

/* ---------- student detail ---------- */

export function studentView({ id }) {
  const s = store.student(id);
  if (!s) return notFoundBlock('Student not found', '/students');
  const cls = store.classroom(s.classId);
  const node = el('div', {});

  const notesWrap = el('div', { class: 'app-notes' });
  function paintNotes() {
    notesWrap.replaceChildren();
    if (!s.notes.length) notesWrap.appendChild(el('p', { class: 'app-muted', text: 'No notes yet.' }));
    else s.notes.forEach((n) => notesWrap.appendChild(el('div', { class: 'app-note' }, [
      el('p', { class: 'app-note-text', text: n.text }),
      el('span', { class: 'app-note-time', text: relTime(n.at) }),
    ])));
  }
  paintNotes();

  const noteInput = input({ placeholder: 'Add an observation…' });
  const addNote = () => { if (noteInput.value.trim()) { store.addStudentNote(s.id, noteInput.value); noteInput.value = ''; paintNotes(); } };

  node.append(
    backLink(cls ? cls.name : 'Students', cls ? `/classrooms/${cls.id}` : '/students'),
    el('div', { class: 'app-student-head' }, [
      avatar(s.name, 64),
      el('div', {}, [
        el('h1', { class: 'app-page-title', text: s.name }),
        el('p', { class: 'app-page-sub' }, [
          s.pronouns ? el('span', { text: s.pronouns + ' · ' }) : null,
          cls ? el('span', { text: cls.name }) : null,
        ]),
      ]),
      levelBadge(s.level),
      el('span', { class: 'app-spacer' }),
      el('button', { class: 'el-button el-button--ghost', text: 'Edit', onclick: () => editStudentModal(s, () => navigate(`/students/${s.id}`)) }),
    ]),
    el('div', { class: 'app-grid-2' }, [
      el('div', {}, [
        el('section', { class: 'el-card app-context-card' }, [
          el('h2', { class: 'app-section-title', text: 'Goals' }),
          el('p', { class: 'el-card__body', text: s.goals || 'No goals set yet.' }),
          el('h2', { class: 'app-section-title', text: 'Needs & context' }),
          el('p', { class: 'el-card__body', text: s.needs || 'No context yet.' }),
        ]),
        el('section', {}, [
          el('h2', { class: 'app-section-title', text: 'Observations' }),
          el('div', { class: 'app-note-add' }, [noteInput, el('button', { class: 'el-button el-button--small', text: 'Add', onclick: addNote })]),
          notesWrap,
        ]),
      ]),
      assistantPanel(`${s.name.split(' ')[0]}`,
        [s.goals, s.needs].filter(Boolean).join(' — ') || 'Add goals and context so the assistant can personalise tasks.'),
    ]),
  );
  return node;
}

function editStudentModal(s, onDone) {
  const name = input({ value: s.name });
  const level = select(['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((v) => ({ value: v, label: v || 'Level…', selected: v === s.level })));
  const pronouns = input({ value: s.pronouns });
  const goals = textarea({ value: s.goals, rows: 3 });
  const needs = textarea({ value: s.needs, rows: 3 });
  const m = modal('Edit student', el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    store.updateStudent(s.id, { name: name.value.trim(), level: level.value, pronouns: pronouns.value.trim(), goals: goals.value.trim(), needs: needs.value.trim() });
    m.close(); onDone && onDone();
  } }, [
    field('Name', name),
    el('div', { class: 'app-form-row' }, [field('Level', level), field('Pronouns', pronouns)]),
    field('Goals', goals),
    field('Needs & context', needs),
    el('div', { class: 'app-form-actions' }, [
      el('button', { type: 'button', class: 'el-button el-button--danger el-button--small', text: 'Remove', onclick: () => {
        if (confirm(`Remove ${s.name}?`)) { const cid = s.classId; store.removeStudent(s.id); m.close(); navigate(`/classrooms/${cid}`); }
      } }),
      el('span', { class: 'app-spacer' }),
      el('button', { type: 'button', class: 'el-button el-button--ghost', text: 'Cancel', onclick: () => m.close() }),
      el('button', { type: 'submit', class: 'el-button', text: 'Save' }),
    ]),
  ]));
}

/* ---------- resources ---------- */

const RES_ICON = { worksheet: '📝', flashdeck: '🃏', reading: '📖', quiz: '✅', other: '📎' };

export function resourcesView() {
  const node = el('div', {});
  const grid = el('div', { class: 'app-card-grid' });
  function paint() {
    grid.replaceChildren();
    const list = store.resources();
    if (!list.length) grid.appendChild(emptyState('📚', 'No resources yet', 'Save a worksheet from the generator, or add one here.',
      el('button', { class: 'el-button', text: 'Add resource', onclick: () => newResourceModal(paint) })));
    else list.forEach((r) => grid.appendChild(resourceCard(r)));
  }
  node.append(
    pageHead('Resources', 'Worksheets and materials, linked to classes and reusable across them.', [
      el('a', { class: 'el-button el-button--ghost', href: 'index.html', text: 'Open generator' }),
      el('button', { class: 'el-button', text: '+ Add resource', onclick: () => newResourceModal(paint) }),
    ]),
    grid,
  );
  paint();
  return node;
}

function resourceCard(r) {
  const cls = store.classroom(r.classId);
  return el('div', { class: 'el-card app-res-card' }, [
    el('div', { class: 'app-res-top' }, [
      el('span', { class: 'app-res-icon', text: RES_ICON[r.type] || RES_ICON.other }),
      el('div', {}, [
        el('h3', { class: 'el-card__title', text: r.title }),
        el('p', { class: 'app-muted', text: `${r.subject}${cls ? ' · ' + cls.name : ''} · ${fmtDate(r.createdAt)}` }),
      ]),
    ]),
    r.tags && r.tags.length ? el('div', { class: 'app-tags' }, r.tags.map((t) => el('span', { class: 'el-badge el-badge--neutral', text: t }))) : null,
    el('div', { class: 'el-card__footer' }, [
      el('span', { class: 'el-badge', text: r.type }),
      el('span', { class: 'app-spacer' }),
      el('button', { class: 'el-button el-button--ghost el-button--small', text: 'Remove', onclick: () => { if (confirm('Remove this resource?')) { store.removeResource(r.id); resourceCard; navigate('/resources'); } } }),
    ]),
  ]);
}

function resourceRow(r) {
  return el('a', { class: 'app-list-row', href: '#/resources' }, [
    el('span', { class: 'app-res-icon-sm', text: RES_ICON[r.type] || RES_ICON.other }),
    el('span', { class: 'app-list-row-title', text: r.title }),
    el('span', { class: 'app-muted', text: fmtDate(r.createdAt) }),
  ]);
}

function newResourceModal(onDone) {
  const title = input({ placeholder: 'Resource title' });
  const type = select([['worksheet', 'Worksheet'], ['flashdeck', 'Flashcards'], ['reading', 'Reading'], ['quiz', 'Quiz'], ['other', 'Other']].map(([value, label]) => ({ value, label })));
  const subject = input({ value: 'English' });
  const classOpts = [{ value: '', label: 'No class' }, ...store.classrooms().map((c) => ({ value: c.id, label: c.name }))];
  const classSel = select(classOpts);
  const tags = input({ placeholder: 'comma, separated, tags' });
  const m = modal('Add resource', el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    if (!title.value.trim()) { title.classList.add('el-input--invalid'); return; }
    store.addResource({ title: title.value.trim(), type: type.value, subject: subject.value.trim(),
      classId: classSel.value || null, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) });
    m.close(); onDone && onDone();
  } }, [
    field('Title', title),
    el('div', { class: 'app-form-row' }, [field('Type', type), field('Subject', subject)]),
    field('Class', classSel),
    field('Tags', tags),
    el('div', { class: 'app-form-actions' }, [
      el('button', { type: 'button', class: 'el-button el-button--ghost', text: 'Cancel', onclick: () => m.close() }),
      el('button', { type: 'submit', class: 'el-button', text: 'Add resource' }),
    ]),
  ]));
}

/* ---------- profile ---------- */

export function profileView() {
  const t = store.teacher();
  const node = el('div', {});
  const name = input({ value: t.name });
  const email = input({ type: 'email', value: t.email });
  const school = input({ value: t.school });
  const subjects = input({ value: t.subjects });
  const bio = textarea({ value: t.bio, rows: 4 });
  const saved = el('span', { class: 'app-saved', text: '' });

  node.append(
    pageHead('Teacher profile', 'How you appear across the workspace.'),
    el('div', { class: 'app-grid-2' }, [
      el('form', { class: 'el-card app-form', onsubmit: (e) => {
        e.preventDefault();
        store.updateTeacher({ name: name.value.trim(), email: email.value.trim(), school: school.value.trim(), subjects: subjects.value.trim(), bio: bio.value.trim() });
        saved.textContent = 'Saved ✓';
        setTimeout(() => { saved.textContent = ''; }, 2500);
        document.dispatchEvent(new CustomEvent('teacher-updated'));
      } }, [
        field('Full name', name),
        field('Email', email),
        field('School / institution', school),
        field('Subjects', subjects),
        field('Bio', bio),
        el('div', { class: 'app-form-actions' }, [
          el('button', { type: 'submit', class: 'el-button', text: 'Save changes' }),
          saved,
        ]),
      ]),
      el('div', {}, [
        el('div', { class: 'el-card app-profile-card' }, [
          avatar(t.name, 72),
          el('h3', { class: 'el-card__title app-profile-name', text: t.name }),
          el('p', { class: 'app-muted', text: t.school }),
          el('p', { class: 'el-card__body', text: t.subjects }),
        ]),
        el('div', { class: 'el-card app-danger-card' }, [
          el('h3', { class: 'el-card__title', text: 'Local data' }),
          el('p', { class: 'el-card__body', text: 'This prototype stores everything in your browser. Reset to reseed the demo data.' }),
          el('button', { class: 'el-button el-button--ghost el-button--small', text: 'Reset demo data', onclick: () => {
            if (confirm('Reset all local workspace data to the demo seed?')) { store.reset(); navigate('/'); location.reload(); }
          } }),
        ]),
      ]),
    ]),
  );
  return node;
}

/* ---------- misc ---------- */

function notFoundBlock(msg, to) {
  return emptyState('🔍', msg, 'It may have been removed.', el('button', { class: 'el-button', text: 'Go back', onclick: () => navigate(to) }));
}
