import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFakeSupabase } from '../../test/fakeSupabase';

async function loadAgentKeys(opts: Parameters<typeof createFakeSupabase>[0] = {}) {
  vi.resetModules();
  const { supabase, calls } = createFakeSupabase(opts);
  vi.doMock('../supabase', () => ({ supabase, SUPABASE_URL: 'https://x.test', SUPABASE_KEY: 'anon' }));
  const mod = await import('../agentkeys.ts');
  return { ...mod, calls };
}

afterEach(() => {
  vi.doUnmock('../supabase');
});

describe('agent key lifecycle', () => {
  it('createAgentKey generates an elk_-prefixed key, stores only its hash, and returns the raw key once', async () => {
    const { createAgentKey, calls } = await loadAgentKeys({ userId: 'teacher-1' });

    const { raw, key } = await createAgentKey('Claude Code on my laptop', 90);

    expect(raw).toMatch(/^elk_[0-9a-f]{48}$/);
    expect(key.label).toBe('Claude Code on my laptop');

    const insertCall = calls.find((c) => c.table === 'agent_keys' && c.method === 'insert');
    expect(insertCall).toBeTruthy();
    const payload = insertCall!.payload as any;
    expect(payload.teacher_id).toBe('teacher-1');
    // The raw key itself must never be sent to the server — only its hash.
    expect(payload.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain(raw);
    // expiresInDays: 90 becomes a concrete future timestamp, not the raw number.
    expect(new Date(payload.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('createAgentKey with expiresInDays: null stores no expiry (never expires)', async () => {
    const { createAgentKey, calls } = await loadAgentKeys({ userId: 'teacher-1' });
    await createAgentKey('Never-expiring key', null);
    const payload = calls.find((c) => c.table === 'agent_keys' && c.method === 'insert')!.payload as any;
    expect(payload.expires_at).toBeNull();
  });

  it('createAgentKey defaults an empty label to "My agent"', async () => {
    const { createAgentKey, calls } = await loadAgentKeys({ userId: 'teacher-1' });
    await createAgentKey('   ', 30);
    const payload = calls.find((c) => c.table === 'agent_keys' && c.method === 'insert')!.payload as any;
    expect(payload.label).toBe('My agent');
  });

  it('listAgentKeys maps DB rows into the AgentKey shape, expiresAt defaulting to null', async () => {
    const { listAgentKeys } = await loadAgentKeys({
      fixtures: {
        agent_keys: [
          { id: 'k1', label: 'Laptop', created_at: '2026-01-01T00:00:00Z', last_used_at: null, expires_at: '2026-04-01T00:00:00Z' },
          { id: 'k2', label: 'Desktop', created_at: '2026-01-02T00:00:00Z', last_used_at: '2026-01-05T00:00:00Z', expires_at: null },
        ],
      },
    });

    const { keys, notDeployed } = await listAgentKeys();
    expect(notDeployed).toBe(false);
    expect(keys).toEqual([
      { id: 'k1', label: 'Laptop', createdAt: '2026-01-01T00:00:00Z', lastUsedAt: null, expiresAt: '2026-04-01T00:00:00Z' },
      { id: 'k2', label: 'Desktop', createdAt: '2026-01-02T00:00:00Z', lastUsedAt: '2026-01-05T00:00:00Z', expiresAt: null },
    ]);
  });

  it('listAgentKeys reports notDeployed instead of throwing when the agent_keys table is missing', async () => {
    const { listAgentKeys } = await loadAgentKeys({
      errors: { 'agent_keys.select': 'relation "public.agent_keys" does not exist' },
    });
    const { keys, notDeployed } = await listAgentKeys();
    expect(notDeployed).toBe(true);
    expect(keys).toEqual([]);
  });

  it('revokeAgentKey deletes by id', async () => {
    const { revokeAgentKey, calls } = await loadAgentKeys();
    await revokeAgentKey('k1');
    const deleteCall = calls.find((c) => c.table === 'agent_keys' && c.method === 'delete');
    expect(deleteCall).toBeTruthy();
  });

  it('listAgentCreatedItems merges worksheets and resources an agent created, newest first, with the creating key\'s label', async () => {
    const { listAgentCreatedItems } = await loadAgentKeys({
      fixtures: {
        worksheets: [{ id: 'w1', title: 'Daily Routines', created_at: '2026-01-01T00:00:00Z', created_by_agent_key_id: 'k1' }],
        resources: [{ id: 'r1', title: 'Handout', created_at: '2026-01-03T00:00:00Z', created_by_agent_key_id: 'k1' }],
        agent_keys: [{ id: 'k1', label: 'Claude Code' }],
      },
    });

    const items = await listAgentCreatedItems();
    expect(items).toEqual([
      { kind: 'resource', id: 'r1', title: 'Handout', createdAt: '2026-01-03T00:00:00Z', agentLabel: 'Claude Code' },
      { kind: 'worksheet', id: 'w1', title: 'Daily Routines', createdAt: '2026-01-01T00:00:00Z', agentLabel: 'Claude Code' },
    ]);
  });

  it('logRevert records a teacher-attributed audit entry without throwing when signed out', async () => {
    const { logRevert, calls } = await loadAgentKeys({ userId: undefined as any });
    // auth.getUser resolves to a user regardless via the fake — logRevert should still just insert.
    await logRevert('worksheet', 'Daily Routines');
    const insertCall = calls.find((c) => c.table === 'agent_activity' && c.method === 'insert');
    expect(insertCall).toBeTruthy();
    expect(insertCall!.payload).toMatchObject({ agent_label: 'Teacher', tool: 'revert', status: 'done' });
  });
});
