import { describe, it, expect, vi } from 'vitest';

const classroom = { id: 'c1', name: 'English A2', subject: 'English', level: 'A2', term: '2026 Spring', description: 'Evening group', context: 'Working adults, twice weekly.' };
const student = { id: 's1', classId: 'c1', name: 'Rui Santos', level: 'A2', pronouns: 'he/him', goals: 'Pass the certificate', needs: '', notes: [{ at: '2026-01-03T00:00:00Z', text: 'Struggled with past tense.' }] };
// A student-only resource (no classId) — must still surface in the student's "Context files" (issue fixed alongside #33's session).
const classResource = { id: 'r1', title: 'Handout: Colours', kind: 'material', type: 'pdf', subject: 'English: Grammar', classId: 'c1', studentId: null, note: 'A vocabulary handout.', tags: ['vocab'], createdAt: '2026-01-01T00:00:00Z' };
const studentResource = { id: 'r2', title: "Rui's placement notes", kind: 'context', type: 'note', subject: '', classId: null, studentId: 's1', note: 'Placed into A2 after interview.', tags: [], createdAt: '2026-01-02T00:00:00Z' };
const worksheet = { id: 'w1', title: 'Daily Routines: Present Simple', subject: 'English', doc: { sections: [] } };
const aula = { id: 'a1', classId: 'c1', title: 'Tuesday session', code: 'A2LIVE', status: 'live', worksheetIds: ['w1'], createdAt: '2026-01-04T00:00:00Z' };
const enrollment = { id: 'e1', aulaId: 'a1', name: 'Rui Santos' };

const fixtureStore = {
  teacher: () => ({ name: 'Ana Teixeira', email: 'ana@example.com', school: 'Lisbon Language Centre', subjects: 'English', bio: 'EFL teacher.' }),
  classrooms: () => [classroom],
  students: () => [student],
  resources: () => [classResource, studentResource],
  worksheetsAll: () => [worksheet],
  aulas: () => [aula],
  studentsIn: (classId: string) => [student].filter((s) => s.classId === classId),
  resourcesIn: (classId: string) => [classResource, studentResource].filter((r) => r.classId === classId),
  aulasForClass: (classId: string) => [aula].filter((a) => a.classId === classId),
  classroom: (id: string) => [classroom].find((c) => c.id === id) || null,
  aulaWorksheets: (_aulaId: string) => [worksheet],
  enrollments: (_aulaId: string) => [enrollment],
  getProgress: (_aulaId: string, _enrollmentId: string, _worksheetId: string) => ({ attempted: 2, total: 3, correct: 2, score: 0.67, done: false, validated: null }),
};

vi.mock('../store.js', () => ({ store: fixtureStore }));
vi.mock('../analog.js', () => ({ emitAnalog: () => '---\ntitle: dummy\n---\n\n# Daily Routines: Present Simple\n\nAnalog body.\n' }));

const { buildVault } = await import('../vault.js');

describe('buildVault', () => {
  it('emits one note per classroom/student/worksheet/resource/live-class plus a Teacher note and an index', () => {
    const files = buildVault();
    const names = files.map((f: any) => f.name);
    expect(names).toEqual(expect.arrayContaining([
      'Teacher.md',
      'Classrooms/English A2.md',
      'Students/Rui Santos.md',
      'Worksheets/Daily Routines- Present Simple.md',
      'Resources/Handout- Colours.md',
      "Resources/Rui's placement notes.md",
      'Live Classes/Tuesday session.md',
      'README.md',
    ]));
  });

  it('sanitizes filesystem-illegal characters out of note names but keeps spaces', () => {
    const files = buildVault();
    const worksheetFile = files.find((f: any) => f.name.startsWith('Worksheets/'));
    // ":" is filesystem-illegal and becomes "-"; the space around it is preserved.
    expect(worksheetFile!.name).toBe('Worksheets/Daily Routines- Present Simple.md');
  });

  it("links a student's own resource even when it has no classId (issue #33 vault gap)", () => {
    const files = buildVault();
    const studentFile = files.find((f: any) => f.name === 'Students/Rui Santos.md');
    expect(studentFile!.content).toContain('[[Rui\'s placement notes]]');
  });

  it('wikilinks a classroom note to its roster and resources', () => {
    const files = buildVault();
    const classFile = files.find((f: any) => f.name === 'Classrooms/English A2.md');
    expect(classFile!.content).toContain('[[Rui Santos]]');
    // link() sanitizes the target through noteName() too, so the colon becomes "-" just like the filename.
    expect(classFile!.content).toContain('[[Handout- Colours]]');
  });

  it('renders a live-class progress table from enrollments x worksheets', () => {
    const files = buildVault();
    const aulaFile = files.find((f: any) => f.name === 'Live Classes/Tuesday session.md');
    expect(aulaFile!.content).toContain('| Rui Santos | Daily Routines: Present Simple | 2/3 | 67% | in progress |  |');
  });

  it('quotes a frontmatter scalar value that itself contains a colon', () => {
    const files = buildVault();
    const resourceFile = files.find((f: any) => f.name === 'Resources/Handout- Colours.md');
    // subject "English: Grammar" contains ":", which would otherwise break YAML parsing unquoted.
    expect(resourceFile!.content).toContain('subject: "English: Grammar"');
  });

  it('falls back gracefully when a worksheet fails to render as analog Markdown', async () => {
    vi.resetModules();
    vi.doMock('../store.js', () => ({ store: fixtureStore }));
    vi.doMock('../analog.js', () => ({ emitAnalog: () => { throw new Error('boom'); } }));
    const { buildVault: buildVaultThrowing } = await import('../vault.js');
    const files = buildVaultThrowing();
    const worksheetFile = files.find((f: any) => f.name.startsWith('Worksheets/'));
    expect(worksheetFile!.content).toContain('_Worksheet content unavailable._');
  });
});
