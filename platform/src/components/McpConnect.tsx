import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CopyButton } from './SeedKB';
import { listAgentKeys, createAgentKey, revokeAgentKey, connectionSnippets, MCP_ENDPOINT, type AgentKey } from '../lib/agentkeys';

/**
 * Agent-key management + connection snippets, shared by every "Connect via
 * MCP" tab (create-worksheet, seed-knowledge-base, …). Callers only supply
 * the intro copy, the tool names relevant to that flow, and a `check`
 * poller for "did my agent's writes show up yet".
 */
export function McpConnectTab({ intro, tools, checkLabel, onCheck, skillHint }: {
  intro: ReactNode;
  tools: string[];
  checkLabel: string;
  onCheck: () => Promise<string>;
  /** Optional callout for flows where an agentic skill (not just raw tools) does the real work. */
  skillHint?: ReactNode;
}) {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [notDeployed, setNotDeployed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);
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
      const { raw, key } = await createAgentKey(label, expiresInDays);
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
              {keys.map((k) => {
                const expired = k.expiresAt ? new Date(k.expiresAt).getTime() < Date.now() : false;
                const expiryLabel = k.expiresAt ? `${expired ? 'expired' : 'expires'} ${new Date(k.expiresAt).toLocaleDateString()}` : 'never expires';
                return (
                  <li key={k.id}>
                    <span className="app-seed-file-name">🔑 {k.label}{expired && <span className="app-seed-error" style={{ marginLeft: 6 }}>(expired)</span>}</span>
                    <span className="app-muted">{k.lastUsedAt ? 'used ' + new Date(k.lastUsedAt).toLocaleDateString() : 'never used'} · {expiryLabel}</span>
                    <button className="app-icon-btn" title="Revoke" aria-label={`Revoke ${k.label}`}
                      onClick={() => { if (confirm(`Revoke "${k.label}"? Agents using it lose access.`)) revokeAgentKey(k.id).then(refresh); }}>✕</button>
                  </li>
                );
              })}
            </ul>
          )}
      </div>

      <div className="app-field">
        <label className="el-label">Generate a key</label>
        <div className="app-field-row">
          <input className="el-input" value={label} placeholder='Label, e.g. "Claude Code on my laptop"' onChange={(e) => setLabel(e.target.value)} />
          <select className="el-input" style={{ maxWidth: 160 }} value={expiresInDays ?? 'never'}
            onChange={(e) => setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))}>
            <option value="30">Expires in 30 days</option>
            <option value="90">Expires in 90 days</option>
            <option value="365">Expires in 1 year</option>
            <option value="never">Never expires</option>
          </select>
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

      {skillHint && <div className="app-field app-mcp-skill-hint">{skillHint}</div>}

      <div className="app-form-actions">
        <button className="el-button el-button--ghost" onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : checkLabel}</button>
        {checkResult && <span className="app-muted">{checkResult}</span>}
      </div>
    </div>
  );
}

/** Standalone "Connect your AI" modal — just McpConnectTab in the standard
 * modal chrome, for surfaces (like the Knowledge graph's AI node) that want
 * the connect flow on its own rather than as one tab of a bigger modal. */
export function McpConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal app-seed-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">Connect your AI</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <McpConnectTab
          intro={<>
            Connect Claude (or any MCP client) straight to your workspace. Generate a key, hand the
            snippet to your local agent, and it can read your classes and context, create worksheets,
            file knowledge notes, and import classrooms and rosters directly — no copy-paste, and no
            size limit on how much it can bring in.
          </>}
          tools={['get_workspace_context', 'get_worksheet_contract', 'create_worksheet', 'list_worksheets', 'add_resource', 'upsert_classroom', 'upsert_student']}
          checkLabel="↻ Refresh"
          onCheck={async () => {
            const r = await listAgentKeys();
            return r.keys.length > 0 ? `✓ ${r.keys.length} agent key${r.keys.length === 1 ? '' : 's'} active.` : 'No agent keys yet — generate one above.';
          }}
          skillHint={<>
            <strong>Using Claude Code?</strong> It can drive a whole bulk import — a Google Classroom export,
            a folder of teaching files — in one go, file by file, with no context-window wall. Point it at{' '}
            <code>skills/seed-knowledge-base</code> in the <a className="knw-open-link" href="https://github.com/EnsinoLibre/core" target="_blank" rel="noopener">core repo</a>{' '}
            (<code>npx skills add EnsinoLibre/core</code> to install it into your own project), or just describe the
            import and it'll work it out from the tools above.
          </>}
        />
      </motion.div>
    </motion.div>
  );
}
