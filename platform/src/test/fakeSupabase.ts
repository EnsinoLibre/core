/**
 * A minimal fake of the subset of the supabase-js query builder that
 * platform/src/lib/*.js actually uses: chainable .select/.eq/.in/.order,
 * terminal .maybeSingle/.single, and thenable insert/update/delete (the real
 * PostgrestFilterBuilder is itself a thenable — store.js's fire()/fireTracked()
 * rely on `Promise.resolve(builder)` resolving without an explicit .select()).
 *
 * `fixtures` seeds each table's rows for reads. `errors` (keyed "table.method",
 * e.g. "classrooms.insert") makes that call resolve with an error instead, to
 * exercise onWriteError.
 */
export interface RecordedCall {
  table: string;
  method: 'insert' | 'update' | 'delete' | 'upsert';
  payload?: unknown;
}

export function createFakeSupabase(opts: {
  fixtures?: Record<string, any[]>;
  errors?: Record<string, string>;
  userId?: string;
  userEmail?: string;
} = {}) {
  const fixtures = opts.fixtures ?? {};
  const errors = opts.errors ?? {};
  const calls: RecordedCall[] = [];

  class FakeQuery implements PromiseLike<{ data: any; error: any }> {
    private rows: any[];
    private isSingle = false;
    private forcedError: string | null;

    constructor(private table: string, private method: RecordedCall['method'] | 'select' = 'select', insertedPayload?: any) {
      // Mirror Postgrest: insert/upsert followed by .select() returns the row
      // that was just written (payload + generated id/timestamps), not the
      // pre-seeded fixture rows.
      this.rows = (method === 'insert' || method === 'upsert')
        ? [{ id: `generated-${Math.random().toString(36).slice(2)}`, created_at: new Date().toISOString(), last_used_at: null, ...insertedPayload }]
        : [...(fixtures[table] ?? [])];
      this.forcedError = errors[`${table}.${method}`] ?? null;
    }

    select() { return this; }
    order() { return this; }
    eq(col: string, val: unknown) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
    in(col: string, vals: unknown[]) { this.rows = this.rows.filter((r) => (vals as any[]).includes(r[col])); return this; }
    not(col: string, op: string, val: unknown) {
      if (op === 'is' && val === null) this.rows = this.rows.filter((r) => r[col] != null);
      return this;
    }
    gte(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] >= val); return this; }
    maybeSingle() { this.isSingle = true; return this; }
    single() { this.isSingle = true; return this; }

    then<TResult1 = { data: any; error: any }, TResult2 = never>(
      onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      const result = this.forcedError
        ? { data: null, error: { message: this.forcedError } }
        : { data: this.isSingle ? (this.rows[0] ?? null) : this.rows, error: null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  const from = (table: string) => ({
    select: () => new FakeQuery(table, 'select'),
    insert: (payload: unknown) => { calls.push({ table, method: 'insert', payload }); return new FakeQuery(table, 'insert', payload); },
    update: (payload: unknown) => { calls.push({ table, method: 'update', payload }); return new FakeQuery(table, 'update'); },
    upsert: (payload: unknown) => { calls.push({ table, method: 'upsert', payload }); return new FakeQuery(table, 'upsert', payload); },
    delete: () => { calls.push({ table, method: 'delete' }); return new FakeQuery(table, 'delete'); },
  });

  const supabase = {
    from,
    auth: {
      getUser: async (): Promise<{ data: { user: { id: string; email: string } | null }; error: { message: string } | null }> => ({
        data: { user: { id: opts.userId ?? 'teacher-1', email: opts.userEmail ?? 'teacher@example.com' } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    channel: () => ({
      on: function on() { return this; },
      subscribe: (cb?: (status: string) => void) => { cb?.('SUBSCRIBED'); return {}; },
    }),
    removeChannel: () => {},
  };

  return { supabase, calls };
}
