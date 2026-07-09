import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { store, exportAnalogPDF, exportMoodle, exportMarkdown, moodleQuestionCount } from '../lib/api';
import { PageHead, Avatar, Progress } from '../components/bits';
// @ts-ignore - shared DOM worksheet engine (bundled by Vite from ../site)
import { renderWorksheet } from '../../../site/assets/js/renderer.js';
// Raw site stylesheet, scoped into a shadow root below so it can't leak into
// the platform chrome. `:root` → `:host` re-scopes the --oc-* bridge; the
// design tokens (--color-*) inherit through the shadow boundary, so light/dark
// still resolve from the host <html>.
// @ts-ignore - ?raw returns the file contents as a string
import worksheetCssRaw from '../../../site/assets/styles.css?raw';

const WORKSHEET_CSS = String(worksheetCssRaw)
  .replace(/@import[^;]+;/g, '')
  .replace(/:root/g, ':host');

const VBADGE: Record<string, [string, string]> = {
  validated: ['el-badge', '✓ Validated'],
  review: ['el-badge el-badge--secondary', '⚑ Needs review'],
};

/** Read-only worksheet preview, isolated in a shadow root. */
function WorksheetPreview({ doc }: { doc: any }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = WORKSHEET_CSS;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    mount.className = 'oc-worksheet-preview';
    shadow.appendChild(mount);
    try { renderWorksheet(doc, mount); }
    catch (e) { console.error('renderWorksheet failed', e); mount.textContent = 'Could not render this worksheet.'; }
    return () => { shadow.innerHTML = ''; };
  }, [doc]);
  return <div ref={hostRef} className="app-ws-preview-host" />;
}

export function WorksheetDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const w = id ? store.worksheet(id) : null;

  if (!w) {
    return (
      <div>
        <PageHead title="Worksheet not found" subtitle="It may have been removed." />
        <button className="el-button el-button--ghost" onClick={() => nav('/worksheets')}>← Back to worksheets</button>
      </div>
    );
  }

  // Every deployment (aula) that includes this worksheet → per-student progress.
  const deployments = store.aulas().filter((a: any) => a.worksheetIds.includes(w.id));
  type Row = { student: string; aulaTitle: string; className: string; p: any };
  const rows: Row[] = [];
  for (const a of deployments) {
    const cls = store.classroom(a.classId);
    for (const e of store.enrollments(a.id)) {
      rows.push({ student: e.name, aulaTitle: a.title, className: cls?.name || '', p: store.getProgress(a.id, e.id, w.id) });
    }
  }
  const withProgress = rows.filter((r) => r.p && (r.p.attempted || r.p.validated));
  const completed = withProgress.filter((r) => r.p.done).length;
  const avg = withProgress.length
    ? Math.round(withProgress.reduce((s, r) => s + (r.p.score || 0) * 100, 0) / withProgress.length)
    : 0;
  const mq = moodleQuestionCount(w.doc);
  const activities = w.doc.sections.reduce((n: number, s: any) => n + s.activities.length, 0);

  return (
    <div>
      <PageHead
        title={w.title}
        subtitle={`${w.subject} · ${activities} activities · ${mq} auto-graded`}
        actions={<>
          <button className="el-button el-button--ghost" onClick={() => nav('/worksheets')}>← All worksheets</button>
          <button className="el-button el-button--ghost" onClick={() => exportAnalogPDF(w.doc)}>📄 PDF</button>
          <button className="el-button el-button--ghost" onClick={() => exportMoodle(w.doc)}>🎓 Moodle</button>
          <button className="el-button el-button--ghost" onClick={() => exportMarkdown(w.doc)}>⬇ MD</button>
        </>}
      />

      {/* Progress dashboard across every deployment that includes this worksheet */}
      <section className="app-side-section">
        <h2 className="app-section-title">Progress</h2>
        {deployments.length === 0 ? (
          <p className="app-muted">This worksheet isn’t deployed to any live class yet. Deploy it from the Worksheets or Live view to start collecting progress.</p>
        ) : (
          <>
            <div className="app-stats app-stats--tight">
              <div className="el-card app-stat"><span className="app-stat-value">{deployments.length}</span><span className="app-stat-label">Deployment{deployments.length === 1 ? '' : 's'}</span></div>
              <div className="el-card app-stat"><span className="app-stat-value">{withProgress.length}/{rows.length}</span><span className="app-stat-label">Students attempted</span></div>
              <div className="el-card app-stat"><span className="app-stat-value">{completed}</span><span className="app-stat-label">Completed</span></div>
              <div className="el-card app-stat"><span className="app-stat-value">{avg}%</span><span className="app-stat-label">Average score</span></div>
            </div>
            <div className="app-table-wrap">
              <table className="app-table">
                <thead><tr><th>Student</th><th>Deployment</th><th>Progress</th><th>Score</th><th>Status</th><th>Validation</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const p = r.p;
                    const pct = p && p.total ? Math.round((p.attempted / p.total) * 100) : 0;
                    const badge = p?.validated ? VBADGE[p.validated] : null;
                    return (
                      <tr key={i}>
                        <td><div className="app-cell-user"><Avatar name={r.student} size={28} /><span>{r.student}</span></div></td>
                        <td><span className="app-muted">{r.className || r.aulaTitle}</span></td>
                        <td>{p && (p.attempted || p.done) ? <Progress pct={pct} label={`${p.attempted}/${p.total}`} /> : <span className="app-muted">–</span>}</td>
                        <td>{p && (p.attempted || p.done) ? `${Math.round((p.score || 0) * 100)}%` : <span className="app-muted">–</span>}</td>
                        <td>{p?.done ? <span className="el-badge el-badge--neutral">Complete</span> : p?.attempted ? <span className="app-muted">In progress</span> : <span className="app-muted">Not started</span>}</td>
                        <td>{badge ? <span className={badge[0]}>{badge[1]}</span> : <span className="app-muted">–</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Read-only render of the actual worksheet */}
      <section className="app-side-section">
        <h2 className="app-section-title">Worksheet preview</h2>
        <p className="app-muted">This is exactly what students see. Try it — nothing here is saved.</p>
        <div className="el-card" style={{ padding: 'var(--space-4)' }}>
          <WorksheetPreview doc={w.doc} />
        </div>
      </section>
    </div>
  );
}
