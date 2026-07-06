import { useEffect, useState } from 'react';
import { store, onLiveUpdate } from '../lib/api';
import { PageHead, Avatar, Progress } from '../components/bits';

export function Live() {
  const [, force] = useState(0);
  useEffect(() => onLiveUpdate(() => force((n) => n + 1)), []);
  const aulas = store.aulas();

  return (
    <div>
      <PageHead title="Live classroom" subtitle="Students join deployed worksheets; their progress appears here in real time." />
      {aulas.map((a: any) => {
        const cls = store.classroom(a.classId);
        const students = store.enrollments(a.id);
        const worksheets = store.aulaWorksheets(a.id);
        return (
          <section key={a.id} className="app-side-section">
            <div className="app-share-strip">
              <strong className="knw-title" style={{ fontSize: '1.1rem' }}>{a.title}</strong>
              <span className="app-muted"> · {cls?.name} · join code </span><strong className="app-code">{a.code}</strong>
              <span className="app-spacer" />
              <span className={a.status === 'live' ? 'app-live-dot' : 'el-badge el-badge--neutral'}>{a.status === 'live' ? '● Live' : 'Closed'}</span>
            </div>
            {students.length === 0 ? (
              <p className="app-muted">Waiting for students — share code {a.code} (students open the class page).</p>
            ) : (
              <div className="app-table-wrap">
                <table className="app-table app-monitor-table">
                  <thead><tr><th>Student</th>{worksheets.map((w: any) => <th key={w.id}>{w.title}</th>)}</tr></thead>
                  <tbody>
                    {students.map((st: any) => (
                      <tr key={st.id}>
                        <td><div className="app-cell-user"><Avatar name={st.name} size={30} /><span>{st.name}</span></div></td>
                        {worksheets.map((w: any) => {
                          const p = store.getProgress(a.id, st.id, w.id);
                          const pct = p && p.total ? Math.round((p.attempted / p.total) * 100) : 0;
                          return <td key={w.id}>{p && p.attempted ? <Progress pct={pct} label={`${Math.round((p.score || 0) * 100)}%`} /> : <span className="app-muted">–</span>}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
