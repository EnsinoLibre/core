import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFakeSupabase } from '../../test/fakeSupabase';

/**
 * store.js holds module-level singleton state (`state`, `hydrated`,
 * `teacherId`), so each test needs a fresh module instance wired to its own
 * fake supabase client — vi.resetModules() + a dynamic re-import gives that
 * isolation without editing store.js to accept an injected client.
 */
async function loadStore(opts: Parameters<typeof createFakeSupabase>[0] = {}) {
  vi.resetModules();
  const { supabase, calls } = createFakeSupabase(opts);
  vi.doMock('../supabase', () => ({ supabase, SUPABASE_URL: 'https://x.test', SUPABASE_KEY: 'anon' }));
  const mod = await import('../store.js');
  return { ...mod, calls };
}

const baseFixtures = {
  profiles: [{ id: 'teacher-1', name: 'Ana Teixeira', email: 'ana@example.com', school: 'Lisbon Language Centre', subjects: 'English', bio: '' }],
  classrooms: [{ id: 'c1', name: 'English A2', subject: 'English', level: 'A2', term: '2026 Spring', description: '', context: '', created_at: '2026-01-01T00:00:00Z' }],
  students: [{ id: 's1', class_id: 'c1', name: 'Rui', level: 'A2', pronouns: '', goals: '', needs: '', created_at: '2026-01-02T00:00:00Z' }],
  student_notes: [{ id: 'n1', student_id: 's1', text: 'Struggled with past tense.', created_at: '2026-01-03T00:00:00Z' }],
  worksheets: [],
  resources: [],
  aulas: [],
  aula_worksheets: [],
  enrollments: [],
  progress: [],
};

afterEach(() => {
  vi.doUnmock('../supabase');
});

describe('store.hydrate', () => {
  it('builds in-memory state from the fixture rows for the signed-in teacher', async () => {
    const { store, hydrate } = await loadStore({ fixtures: baseFixtures, userId: 'teacher-1' });
    await hydrate();

    expect(store.teacher().name).toBe('Ana Teixeira');
    expect(store.classrooms()).toHaveLength(1);
    expect(store.classrooms()[0]).toMatchObject({ id: 'c1', name: 'English A2', level: 'A2' });

    const students = store.students() as any[];
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ id: 's1', classId: 'c1', name: 'Rui' });
    // student_notes rows are folded onto their student, not left as a separate collection.
    expect(students[0].notes).toEqual([{ id: 'n1', at: '2026-01-03T00:00:00Z', text: 'Struggled with past tense.' }]);
  });

  it('throws instead of silently hydrating an empty workspace when auth.getUser fails', async () => {
    vi.resetModules();
    const { supabase } = createFakeSupabase({ fixtures: baseFixtures });
    supabase.auth.getUser = async () => ({ data: { user: null }, error: { message: 'no session' } });
    vi.doMock('../supabase', () => ({ supabase, SUPABASE_URL: 'https://x.test', SUPABASE_KEY: 'anon' }));
    const { hydrate } = await import('../store.js');

    await expect(hydrate()).rejects.toThrow('Not authenticated');
  });
});

describe('store optimistic writes', () => {
  it('addClassroom updates state immediately and fires a scoped insert', async () => {
    const { store, hydrate, calls } = await loadStore({ fixtures: baseFixtures, userId: 'teacher-1' });
    await hydrate();

    const before = store.classrooms().length;
    const created = store.addClassroom({ name: 'English B1', subject: 'English', level: 'B1' });

    // Optimistic: visible in state synchronously, no await needed.
    expect(store.classrooms().length).toBe(before + 1);
    expect(store.classrooms()[0]).toBe(created);
    expect(created.id).toBeTruthy();

    await store.whenReady(created.id);

    const insertCall = calls.find((c) => c.table === 'classrooms' && c.method === 'insert');
    expect(insertCall).toBeTruthy();
    expect(insertCall!.payload).toMatchObject({ id: created.id, teacher_id: 'teacher-1', name: 'English B1', level: 'B1' });
  });

  it('whenReady is a no-op for a row id that was never fired via fireTracked', async () => {
    const { store, hydrate } = await loadStore({ fixtures: baseFixtures, userId: 'teacher-1' });
    await hydrate();
    await expect(store.whenReady('never-created-id')).resolves.toBeUndefined();
  });

  it('surfaces a failed write to onWriteError instead of swallowing it (issue #17)', async () => {
    const { store, hydrate, onWriteError, writeErrorTotal } = await loadStore({
      fixtures: baseFixtures,
      errors: { 'classrooms.insert': 'new row violates row-level security policy' },
      userId: 'teacher-1',
    });
    await hydrate();

    const before = writeErrorTotal();
    const seen: any[] = [];
    const unsubscribe = onWriteError((detail: any) => seen.push(detail));

    const created = store.addClassroom({ name: 'Will fail', subject: '', level: '' });
    await store.whenReady(created.id);

    expect(writeErrorTotal()).toBe(before + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ label: 'addClassroom', message: 'new row violates row-level security policy' });
    // The optimistic add is NOT rolled back — the teacher keeps working; the
    // banner (driven by onWriteError) is what tells them to reconcile.
    expect(store.classrooms().some((c: any) => c.id === created.id)).toBe(true);

    unsubscribe();
  });
});
