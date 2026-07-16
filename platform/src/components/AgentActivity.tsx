import { useEffect, useState } from 'react';
import { store } from '../lib/api';
import { listRecentActivity, listAgentCreatedItems, logRevert, type ActivityRow, type AgentCreatedItem } from '../lib/agentkeys';

const HISTORY_MS = 30 * 24 * 60 * 60 * 1000; // matches the server-side retention window (issue #28)

function fmtWhen(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * "Agent activity" card (Profile page): the retained history behind the
 * Knowledge graph's short-lived popover (issue #28), plus a review/undo
 * surface for what an agent created — worksheets and resources carry
 * created_by_agent_key_id, so they can be listed and reverted here without
 * hunting rows down manually (issue #29).
 */
export function AgentActivityCard() {
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [created, setCreated] = useState<AgentCreatedItem[] | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = () => {
    listRecentActivity(new Date(Date.now() - HISTORY_MS).toISOString()).then((rows) => setActivity(rows.slice().reverse()));
    listAgentCreatedItems().then(setCreated);
  };
  useEffect(() => { load(); }, []);

  const revert = async (item: AgentCreatedItem) => {
    if (item.kind === 'worksheet' && store.aulas().some((a: any) => a.worksheetIds.includes(item.id))) {
      alert(`"${item.title}" is deployed in a live class — remove that deployment first.`);
      return;
    }
    if (!confirm(`Revert "${item.title}"? This deletes it — the action is logged but can't be undone itself.`)) return;
    setReverting(item.id);
    if (item.kind === 'worksheet') store.removeWorksheet(item.id); else store.removeResource(item.id);
    await logRevert(item.kind, item.title);
    setReverting(null);
    load();
  };

  return (
    <div className="el-card app-vault-card">
      <h3 className="el-card__title">🤖 Agent activity</h3>
      <p className="el-card__body">What your connected agents have done in the last 30 days, and anything they created — revert an item here if it's not what you wanted.</p>

      {created && created.length > 0 && (
        <div className="app-field">
          <label className="el-label">Agent-created items ({created.length})</label>
          <ul className="app-seed-files">
            {created.slice(0, 10).map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <span className="app-seed-file-name">{item.kind === 'worksheet' ? '📄' : '🗒️'} {item.title}</span>
                <span className="app-muted">{item.agentLabel} · {fmtWhen(item.createdAt)}</span>
                <button className="app-icon-btn" title="Revert" aria-label={`Revert ${item.title}`} disabled={reverting === item.id}
                  onClick={() => revert(item)}>↩</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="app-field">
        <label className="el-label">Recent tool calls</label>
        {activity == null ? (
          <p className="app-muted">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="app-muted">No agent activity yet — connect an agent from Worksheets → + Create worksheet → Connect via MCP.</p>
        ) : (
          <ul className="app-seed-files">
            {activity.slice(0, 25).map((r) => (
              <li key={r.id}>
                <span className="app-seed-file-name">{r.status === 'error' ? '⚠ ' : ''}{r.summary || r.tool}</span>
                <span className="app-muted">{r.agentLabel} · {fmtWhen(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
