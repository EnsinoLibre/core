/**
 * EnsinoLibre — agent keys for the MCP endpoint.
 *
 * A teacher generates a personal agent key in the app; their AI (Claude Code,
 * Claude Desktop, any MCP client) presents it as a bearer token to the `mcp`
 * edge function, which maps it back to the teacher and writes worksheets /
 * resources into their workspace under RLS-equivalent scoping.
 *
 * Only the SHA-256 hash of a key is stored (table `agent_keys`); the raw key
 * is shown once at creation time.
 */
import { supabase, SUPABASE_URL } from './supabase';

export const MCP_ENDPOINT = `${SUPABASE_URL}/functions/v1/mcp`;

export interface AgentKey { id: string; label: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }

const mapKey = (r: any): AgentKey => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at, expiresAt: r.expires_at ?? null });

/** True when the error means the MCP backend (agent_keys table) isn't deployed yet. */
const missingTable = (error: any) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /agent_keys/.test(error.message || ''));

export async function listAgentKeys(): Promise<{ keys: AgentKey[]; notDeployed: boolean }> {
  const { data, error } = await supabase.from('agent_keys')
    .select('id,label,created_at,last_used_at,expires_at').order('created_at', { ascending: false });
  if (error) {
    if (missingTable(error)) return { keys: [], notDeployed: true };
    throw new Error(error.message);
  }
  return { keys: (data || []).map(mapKey), notDeployed: false };
}

async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a key; returns the RAW key (shown once) plus the stored row. `expiresInDays` null = never expires. */
export async function createAgentKey(label: string, expiresInDays: number | null): Promise<{ raw: string; key: AgentKey }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error('Not signed in.');
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = 'elk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const key_hash = await sha256hex(raw);
  const expires_at = expiresInDays != null ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null;
  const { data, error } = await supabase.from('agent_keys')
    .insert({ teacher_id: uid, key_hash, label: label.trim() || 'My agent', expires_at })
    .select('id,label,created_at,last_used_at,expires_at').single();
  if (error) throw new Error(missingTable(error) ? 'MCP backend not deployed yet.' : error.message);
  return { raw, key: mapKey(data) };
}

export async function revokeAgentKey(id: string) {
  const { error } = await supabase.from('agent_keys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Ready-to-paste client config snippets for a freshly created key. */
export function connectionSnippets(rawKey: string) {
  return {
    endpoint: MCP_ENDPOINT,
    claudeCode: `claude mcp add --transport http ensinolibre "${MCP_ENDPOINT}" --header "Authorization: Bearer ${rawKey}"`,
    json: JSON.stringify({
      mcpServers: { ensinolibre: { type: 'http', url: MCP_ENDPOINT, headers: { Authorization: `Bearer ${rawKey}` } } },
    }, null, 2),
  };
}

/* ---------------- live agent activity (Knowledge graph overlay) ---------------- */

export interface ActivityRow {
  id: string; agentKeyId: string | null; agentLabel: string; tool: string;
  status: 'start' | 'done' | 'error'; targetNodeId: string | null; createdAt: string;
  summary: string | null;
}

const mapActivity = (r: any): ActivityRow => ({
  id: r.id, agentKeyId: r.agent_key_id, agentLabel: r.agent_label, tool: r.tool,
  status: r.status, targetNodeId: r.target_node_id, createdAt: r.created_at, summary: r.summary ?? null,
});

/** Every agent_activity row for this teacher since `sinceIso` (RLS-scoped). */
export async function listRecentActivity(sinceIso: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from('agent_activity')
    .select('id,agent_key_id,agent_label,tool,status,target_node_id,created_at,summary')
    .gte('created_at', sinceIso).order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map(mapActivity);
}

/* ---------------- agent-created items: review & undo (issue #29) ---------------- */

export interface AgentCreatedItem {
  kind: 'worksheet' | 'resource'; id: string; title: string; createdAt: string; agentLabel: string;
}

/** Worksheets and resources an MCP agent created (created_by_agent_key_id set), newest first — the review surface for reverting an agent's write. */
export async function listAgentCreatedItems(): Promise<AgentCreatedItem[]> {
  const [ws, res, keys] = await Promise.all([
    supabase.from('worksheets').select('id,title,created_at,created_by_agent_key_id').not('created_by_agent_key_id', 'is', null),
    supabase.from('resources').select('id,title,created_at,created_by_agent_key_id').not('created_by_agent_key_id', 'is', null),
    supabase.from('agent_keys').select('id,label'),
  ]);
  const labelById = new Map((keys.data || []).map((k: any) => [k.id, k.label as string]));
  const items: AgentCreatedItem[] = [
    ...(ws.data || []).map((w: any) => ({ kind: 'worksheet' as const, id: w.id, title: w.title, createdAt: w.created_at, agentLabel: labelById.get(w.created_by_agent_key_id) || 'Agent' })),
    ...(res.data || []).map((r: any) => ({ kind: 'resource' as const, id: r.id, title: r.title, createdAt: r.created_at, agentLabel: labelById.get(r.created_by_agent_key_id) || 'Agent' })),
  ];
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Record a teacher-initiated revert in the same audit trail an agent's own writes use. */
export async function logRevert(kind: 'worksheet' | 'resource', title: string) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  await supabase.from('agent_activity').insert({
    teacher_id: uid, agent_label: 'Teacher', tool: 'revert', status: 'done',
    summary: `Reverted agent-created ${kind} "${title}"`,
  });
}
