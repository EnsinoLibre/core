import { useEffect, useState, type ReactNode } from 'react';
import { CopyButton } from './SeedKB';
import { listAgentKeys, createAgentKey, revokeAgentKey, connectionSnippets, MCP_ENDPOINT, type AgentKey } from '../lib/agentkeys';

/**
 * Agent-key management + connection snippets, shared by every "Connect via
 * MCP" tab (create-worksheet, seed-knowledge-base, …). Callers only supply
 * the intro copy, the tool names relevant to that flow, and a `check`
 * poller for "did my agent's writes show up yet".
 */
export function McpConnectTab({ intro, tools, checkLabel, onCheck }: {
  intro: ReactNode;
  tools: string[];
  checkLabel: string;
  onCheck: () => Promise<string>;
}) {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [notDeployed, setNotDeployed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [fresh, setFresh] = useState<{ raw: string; label: string } | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await listAgentKeys();
      setKeys(r.keys); setNotDeployed(r.notDeployed);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    setError('');
    try {
      const { raw, key } = await createAgentKey(label);
      setFresh({ raw, label: key.label });
      setLabel('');
      refresh();
    } catch (e: any) { setError(e.message); }
  };

  const runCheck = async () => {
    setChecking(true); setCheckResult(null);
    try { setCheckResult(await onCheck()); }
    catch (e: any) { setCheckResult('Refresh failed: ' + e.message); }
    setChecking(false);
  };

  const snippets = fresh ? connectionSnippets(fresh.raw) : null;

  return (
    <div className="app-form">
      <p className="app-muted" style={{ marginTop: 0 }}>{intro}</p>

      {notDeployed && (
        <div className="oc-errors">
          <strong>MCP backend not deployed yet.</strong> Run the <code>agent_keys</code> migration and deploy the
          <code> mcp</code> edge function (see <code>supabase/</code> in the repo and the “Connect your AI” docs page).
        </div>
      )}

      <div className="app-field">
        <label className="el-label">Your agent keys</label>
        {loading ? <p className="app-muted">Loading…</p> : keys.length === 0
          ? <p className="app-muted">No keys yet — generate one below.</p>
          : (
            <ul className="app-seed-files">
              {keys.map((k) => (
                <li key={k.id}>
                  <span className="app-seed-file-name">🔑 {k.label}</span>
                  <span className="app-muted">{k.lastUsedAt ? 'used ' + new Date(k.lastUsedAt).toLocaleDateString() : 'never used'}</span>
                  <button className="app-icon-btn" title="Revoke" aria-label={`Revoke ${k.label}`}
                    onClick={() => { if (confirm(`Revoke "${k.label}"? Agents using it lose access.`)) revokeAgentKey(k.id).then(refresh); }}>✕</button>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="app-field">
        <label className="el-label">Generate a key</label>
        <div className="app-field-row">
          <input className="el-input" value={label} placeholder='Label, e.g. "Claude Code on my laptop"' onChange={(e) => setLabel(e.target.value)} />
          <button className="el-button" onClick={create} disabled={notDeployed}>+ Generate</button>
        </div>
        {error && <p className="app-seed-error">{error}</p>}
      </div>

      {fresh && snippets && (
        <div className="app-field app-mcp-fresh">
          <p className="app-seed-hint"><strong>Copy your key now — it won't be shown again.</strong></p>
          <div className="app-field-row">
            <input className="el-input app-seed-prompt" readOnly value={fresh.raw} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={fresh.raw} label="⧉ Key" small />
          </div>
          <label className="el-label" style={{ marginTop: 12 }}>Claude Code</label>
          <div className="app-field-row">
            <input className="el-input app-seed-prompt" readOnly value={snippets.claudeCode} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={snippets.claudeCode} label="⧉" small />
          </div>
          <label className="el-label" style={{ marginTop: 12 }}>Other MCP clients (JSON)</label>
          <textarea className="el-input app-seed-prompt" readOnly rows={4} value={snippets.json} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      <div className="app-field">
        <label className="el-label">Endpoint &amp; tools</label>
        <p className="app-muted app-seed-hint">
          <code>{MCP_ENDPOINT}</code><br />
          Tools: {tools.map((t, i) => <span key={t}><code>{t}</code>{i < tools.length - 1 ? ' · ' : ''}</span>)}
        </p>
      </div>

      <div className="app-form-actions">
        <button className="el-button el-button--ghost" onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : checkLabel}</button>
        {checkResult && <span className="app-muted">{checkResult}</span>}
      </div>
    </div>
  );
}
