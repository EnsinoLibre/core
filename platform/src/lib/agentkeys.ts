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

export interface AgentKey { id: string; label: string; createdAt: string; lastUsedAt: string | null }

const mapKey = (r: any): AgentKey => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at });

/** True when the error means the MCP backend (agent_keys table) isn't deployed yet. */
const missingTable = (error: any) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /agent_keys/.test(error.message || ''));

export async function listAgentKeys(): Promise<{ keys: AgentKey[]; notDeployed: boolean }> {
  const { data, error } = await supabase.from('agent_keys')
    .select('id,label,created_at,last_used_at').order('created_at', { ascending: false });
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

/** Create a key; returns the RAW key (shown once) plus the stored row. */
export async function createAgentKey(label: string): Promise<{ raw: string; key: AgentKey }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error('Not signed in.');
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = 'elk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const key_hash = await sha256hex(raw);
  const { data, error } = await supabase.from('agent_keys')
    .insert({ teacher_id: uid, key_hash, label: label.trim() || 'My agent' })
    .select('id,label,created_at,last_used_at').single();
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
