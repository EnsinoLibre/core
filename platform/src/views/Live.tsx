import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  store, onLiveUpdate,
  exportAnalogPDF, exportMoodle, exportMarkdown, moodleQuestionCount, download,
} from '../lib/api';
import { PageHead, Avatar, Progress } from '../components/bits';
import { DeployModal } from '../components/DeployModal';

const VBADGE: Record<string, [string, string]> = {
  validated: ['el-badge', '✓ Validated'],
  review: ['el-badge el-badge--secondary', '⚑ Needs review'],
};

function toCSV(rows: any[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function Live() {
  const nav = useNavigate();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  useEffect(() => onLiveUpdate(rerender), []);
  const [validating, setValidating] = useState<{ aulaId: string; enr: string; ws: string } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const aulas = store.aulas();

  return (
    <div>
      <PageHead title="Live classroom" subtitle="Deploy worksheets to a class, then watch progress in real time, validate and export."
        actions={<button className="el-button" onClick={() => setDeploying(true)}>◉ Deploy a class</button>} />

      {aulas.length === 0 && (
        <div className="app-empty">
          <div className="app-empty-icon">◉</div>
          <h3>No live classes yet</h3>
          <p>Deploy a set of worksheets to a class. Students join with a code and their progress shows up here live.</p>
          <button className="el-button" onClick={() => setDeploying(true)}>◉ Deploy a class</button>
        </div>
      )}

      {aulas.map((a: any) => {
        const cls = store.classroom(a.classId);
        const students = store.enrollments(a.id);
        const worksheets = store.aulaWorksheets(a.id);
        const rows = store.exportRows(a.id);
        const complete = rows.filter((r: any) => r.status === 'complete').length;
        const avg = rows.length ? Math.round(rows.reduce((s: number, r: any) => s + r.scorePct, 0) / rows.length) : 0;

        return (
          <section key={a.id} className="app-side-section">
            <div className="app-share-strip">
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{a.title}</strong>
              <span className="app-muted"> · {cls?.name} · join code </span><strong className="app-code">{a.code}</strong>
              <a className="knw-open-link" href="../aula.html" target="_blank" rel="noopener" style={{ marginLeft: 8 }}>class page ↗</a>
              <span className="app-spacer" />
              <span className={a.status === 'live' ? 'app-live-dot' : 'el-badge el-badge--neutral'}>{a.status === 'live' ? '● Live' : 'Closed'}</span>
              <button className="el-button el-button--ghost el-button--small" onClick={() => { store.setAulaStatus(a.id, a.status === 'live' ? 'closed' : 'live'); rerender(); }}>
                {a.status === 'live' ? 'Close class' : 'Reopen'}
              </button>
              <button className="el-button el-button--ghost el-button--small" onClick={() => download(`aula-${a.code}.csv`, toCSV(store.exportRows(a.id)), 'text/csv')}>⬇ CSV</button>
              <button className="el-button el-button--ghost el-button--small" onClick={() => download(`aula-${a.code}.json`, JSON.stringify(store.exportRows(a.id), null, 2), 'application/json')}>⬇ JSON</button>
              <button className="el-button el-button--ghost el-button--small" title="Remove this deployment" onClick={() => { if (confirm(`Remove the live class "${a.title}"? Student progress for it will be discarded.`)) { store.removeAula(a.id); rerender(); } }}>Remove</button>
            </div>

            <div className="app-stats app-stats--tight">
              <div className="el-card app-stat"><span className="app-stat-value">{students.length}</span><span className="app-stat-label">Students joined</span></div>
              <div className="el-card app-stat"><span className="app-stat-value">{complete}/{rows.length}</span><span className="app-stat-label">Worksheets complete</span></div>
              <div className="el-card app-stat"><span className="app-stat-value">{avg}%</span><span className="app-stat-label">Average score</span></div>
            </div>

            {students.length === 0 ? (
              <p className="app-muted">Waiting for students — share code <strong>{a.code}</strong> (students open the class page).</p>
            ) : (
              <div className="app-table-wrap">
                <table className="app-table app-monitor-table">
                  <thead><tr><th>Student</th>{worksheets.map((w: any) => <th key={w.id}>{w.title}</th>)}<th>Overall</th></tr></thead>
                  <tbody>
                    {students.map((st: any) => {
                      let att = 0; let tot = 0;
                      const cells = worksheets.map((w: any) => {
                        const p = store.getProgress(a.id, st.id, w.id);
                        if (p) { att += p.attempted; tot += p.total; }
                        const pct = p && p.total ? Math.round((p.attempted / p.total) * 100) : 0;
                        const badge = p?.validated ? VBADGE[p.validated] : null;
                        return (
                          <td key={w.id}>
                            {p && (p.attempted || p.validated) ? (
                              <button className="app-cell-prog" onClick={() => setValidating({ aulaId: a.id, enr: st.id, ws: w.id })}>
                                <Progress pct={pct} label={`${p.done ? '✓ ' : ''}${Math.round((p.score || 0) * 100)}%`} />
                                {badge && <span className={badge[0]}>{badge[1]}</span>}
                              </button>
                            ) : <span className="app-muted app-cell-empty">–</span>}
                          </td>
                        );
                      });
                      const overall = tot ? Math.round((att / tot) * 100) : 0;
                      return <tr key={st.id}><td><div className="app-cell-user"><Avatar name={st.name} size={30} /><span>{st.name}</span></div></td>{cells}<td><Progress pct={overall} label={`${overall}%`} /></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* teacher-only worksheet exports */}
            <h2 className="app-section-title">Deployed worksheets</h2>
            <p className="app-muted">Export the materials for printing, Moodle import or your records. (Students never see export options.)</p>
            <div className="app-list" style={{ gap: 'var(--space-3)' }}>
              {worksheets.map((w: any) => (
                <div key={w.id} className="el-card app-deployed-ws">
                  <div>
                    <h3 className="el-card__title">{w.title}</h3>
                    <p className="app-muted">{w.subject} · {w.doc.sections.flatMap((s: any) => s.activities).length} activities</p>
                  </div>
                  <span className="app-spacer" />
                  <div className="app-ws-exports">
                    <button className="el-button el-button--ghost el-button--small" onClick={() => exportAnalogPDF(w.doc)}>📄 PDF</button>
                    <button className="el-button el-button--ghost el-button--small" title={`${moodleQuestionCount(w.doc)} auto-gradeable questions`} onClick={() => exportMoodle(w.doc)}>🎓 Moodle ({moodleQuestionCount(w.doc)})</button>
                    <button className="el-button el-button--ghost el-button--small" onClick={() => exportMarkdown(w.doc)}>⬇ MD</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <AnimatePresence>
        {validating && (
          <ValidateModal
            {...validating}
            onClose={() => setValidating(null)}
            onSet={(v) => { store.setValidation(validating.aulaId, validating.enr, validating.ws, v); setValidating(null); rerender(); }}
          />
        )}
        {deploying && <DeployModal onClose={() => setDeploying(false)} onDeployed={() => { setDeploying(false); rerender(); }} />}
      </AnimatePresence>
    </div>
  );
}

function ValidateModal({ aulaId, enr, ws, onClose, onSet }: { aulaId: string; enr: string; ws: string; onClose: () => void; onSet: (v: string | null) => void }) {
  const student = store.enrollment(enr);
  const worksheet = store.worksheet(ws);
  const p = store.getProgress(aulaId, enr, ws);
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title">{student?.name} · {worksheet?.title}</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="el-card__body">{p ? `Answered ${p.attempted}/${p.total} · ${Math.round((p.score || 0) * 100)}% correct · ${p.done ? 'complete' : 'in progress'}.` : 'No attempt yet.'}</p>
        <p className="el-label">Teacher validation</p>
        <div className="app-form-actions">
          <button className="el-button" onClick={() => onSet('validated')}>✓ Validate</button>
          <button className="el-button el-button--secondary" onClick={() => onSet('review')}>⚑ Needs review</button>
          <button className="el-button el-button--ghost" onClick={() => onSet(null)}>Clear</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
