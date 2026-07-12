import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  store, onLiveUpdate,
  exportAnalogPDF, exportMoodle, exportMarkdown, moodleQuestionCount, download,
} from '../lib/api';
import { PageHead, Avatar, Progress, KebabMenu } from '../components/bits';
import { DeployModal, joinLink } from '../components/DeployModal';
import { CopyButton } from '../components/SeedKB';
import { useContent } from '../components/ContentPanel';

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
  const { open: openContent } = useContent();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  useEffect(() => onLiveUpdate(rerender), []);
  const [validating, setValidating] = useState<{ aulaId: string; enr: string; ws: string } | null>(null);
  const [drilling, setDrilling] = useState<{ aulaId: string; enr: string } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const aulas = store.aulas();

  // Import an offline "answers" file (from the self-contained worksheet) into
  // this class, so the student shows up in the monitor for validation.
  const importAnswers = (a: any) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      let data: any;
      try { data = JSON.parse(await file.text()); } catch { alert('That file is not valid JSON.'); return; }
      if (!data || data.kind !== 'ensinolibre-answers') { alert('That does not look like an EnsinoLibre answers file.'); return; }
      if (!a.worksheetIds.includes(data.worksheetId)) {
        alert(`These answers are for "${data.worksheetTitle || 'a worksheet'}", which isn’t deployed to this class. Add that worksheet to this class first.`);
        return;
      }
      await store.importSubmission(a.id, data.name || 'Student', data.worksheetId, {
        total: data.total | 0, attempted: data.attempted | 0, correct: data.correct | 0, done: !!data.done, score: Number(data.score) || 0,
      });
      rerender();
    };
    input.click();
  };

  return (
    <div>
      <PageHead title="Live classroom" subtitle="Deploy worksheets to a class or a public link, then watch progress in real time, validate and export."
        actions={<button className="el-button" onClick={() => setDeploying(true)}>◉ Deploy</button>} />

      {aulas.length === 0 && (
        <div className="app-empty">
          <div className="app-empty-icon">◉</div>
          <h3>No live deployments yet</h3>
          <p>Deploy a set of worksheets to a class, or as a public link. Students join with a code and their progress shows up here live.</p>
          <button className="el-button" onClick={() => setDeploying(true)}>◉ Deploy</button>
        </div>
      )}

      {aulas.map((a: any) => {
        const cls = store.classroom(a.classId);
        const students = store.enrollments(a.id);
        const worksheets = store.aulaWorksheets(a.id);
        const rows = store.exportRows(a.id);
        const complete = rows.filter((r: any) => r.status === 'complete').length;
        const avg = rows.length ? Math.round(rows.reduce((s: number, r: any) => s + r.scorePct, 0) / rows.length) : 0;
        const open = !collapsed.has(a.id);

        return (
          <div key={a.id} className="el-card app-aula-card">
            <div className="app-aula-head">
              <button type="button" className="app-accordion-toggle app-aula-toggle" onClick={() => toggleCollapsed(a.id)} aria-expanded={open}>
                <span className={`app-accordion-chevron${open ? ' app-accordion-chevron--open' : ''}`}>▸</span>
                <span className="app-aula-title">
                  <strong>{a.title}</strong>
                  <span className="app-muted"> · {cls ? cls.name : 'Public link'} · </span>
                  <strong className="app-code">{a.code}</strong>
                </span>
                {a.hasPassword && <span className="el-badge el-badge--neutral" title="Password required to join">🔒</span>}
                <span className={a.status === 'live' ? 'app-live-dot' : 'el-badge el-badge--neutral'}>{a.status === 'live' ? '● Live' : 'Closed'}</span>
              </button>
              <span className="app-spacer" />
              <CopyButton text={joinLink(a.code)} label="⧉ Copy link" small />
              <KebabMenu items={[
                { label: a.status === 'live' ? 'Close class' : 'Reopen', onClick: () => { store.setAulaStatus(a.id, a.status === 'live' ? 'closed' : 'live'); rerender(); } },
                { label: '↗ Open class page', onClick: () => window.open(`../aula.html?code=${a.code}`, '_blank', 'noopener') },
                { label: '⬆ Import answers', onClick: () => importAnswers(a) },
                { label: '⬇ Export CSV', onClick: () => download(`aula-${a.code}.csv`, toCSV(store.exportRows(a.id)), 'text/csv') },
                { label: '⬇ Export JSON', onClick: () => download(`aula-${a.code}.json`, JSON.stringify(store.exportRows(a.id), null, 2), 'application/json') },
                {
                  label: 'Remove', danger: true, onClick: () => {
                    if (confirm(`Remove the live class "${a.title}"? Student progress for it will be discarded.`)) { store.removeAula(a.id); rerender(); }
                  },
                },
              ]} />
            </div>

            {!open && (
              <p className="app-muted app-accordion-preview">
                {students.length} student{students.length === 1 ? '' : 's'} joined · {complete}/{rows.length} worksheets complete · {avg}% average score
              </p>
            )}

            {open && (
              <>
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
                          return <tr key={st.id}><td><button className="app-cell-user-btn" onClick={() => setDrilling({ aulaId: a.id, enr: st.id })} title="Open this student’s progress"><Avatar name={st.name} size={30} /><span>{st.name}</span></button></td>{cells}<td><Progress pct={overall} label={`${overall}%`} /></td></tr>;
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
                      <button className="el-button el-button--small" onClick={() => openContent('worksheet:' + w.id)}>Open worksheet</button>
                      <KebabMenu items={[
                        { label: '📄 PDF', onClick: () => exportAnalogPDF(w.doc) },
                        { label: `🎓 Moodle (${moodleQuestionCount(w.doc)})`, onClick: () => exportMoodle(w.doc) },
                        { label: '⬇ Markdown', onClick: () => exportMarkdown(w.doc) },
                      ]} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
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
        {drilling && (
          <StudentDrilldown
            {...drilling}
            onClose={() => setDrilling(null)}
            onValidate={(ws, v) => { store.setValidation(drilling.aulaId, drilling.enr, ws, v); rerender(); }}
          />
        )}
        {deploying && <DeployModal onClose={() => setDeploying(false)} onDeployed={() => { setDeploying(false); rerender(); }} />}
      </AnimatePresence>
    </div>
  );
}

function StudentDrilldown({ aulaId, enr, onClose, onValidate }: { aulaId: string; enr: string; onClose: () => void; onValidate: (ws: string, v: string | null) => void }) {
  const student = store.enrollment(enr);
  const aula = store.aula(aulaId);
  const worksheets = store.aulaWorksheets(aulaId);
  return (
    <motion.div className="app-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="app-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="app-modal-head">
          <h2 className="app-modal-title"><Avatar name={student?.name || '?'} size={28} /> {student?.name}</h2>
          <button className="app-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="app-muted" style={{ marginTop: 0 }}>{aula?.title} · progress across all deployed worksheets.</p>
        <div className="app-list" style={{ gap: 'var(--space-3)' }}>
          {worksheets.map((w: any) => {
            const p = store.getProgress(aulaId, enr, w.id);
            const pct = p && p.total ? Math.round((p.attempted / p.total) * 100) : 0;
            const badge = p?.validated ? VBADGE[p.validated] : null;
            return (
              <div key={w.id} className="el-card app-deployed-ws" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <strong>{w.title}</strong><span className="app-spacer" />
                  {badge && <span className={badge[0]}>{badge[1]}</span>}
                </div>
                {p && (p.attempted || p.done) ? (
                  <>
                    <Progress pct={pct} label={`${p.done ? '✓ ' : ''}${p.attempted}/${p.total} · ${Math.round((p.score || 0) * 100)}%`} />
                    <div className="app-form-actions" style={{ gap: 'var(--space-2)' }}>
                      <button className="el-button el-button--small" onClick={() => onValidate(w.id, 'validated')}>✓ Validate</button>
                      <button className="el-button el-button--secondary el-button--small" onClick={() => onValidate(w.id, 'review')}>⚑ Needs review</button>
                      <button className="el-button el-button--ghost el-button--small" onClick={() => onValidate(w.id, null)}>Clear</button>
                    </div>
                  </>
                ) : <span className="app-muted">Not started</span>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
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
