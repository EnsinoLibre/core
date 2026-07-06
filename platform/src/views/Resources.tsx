import { useNavigate } from 'react-router-dom';
import { store } from '../lib/api';
import { PageHead, fmtDate } from '../components/bits';

const KIND_LABEL: Record<string, string> = {
  worksheet: 'Worksheets', material: 'Teaching materials', guideline: 'Guidelines', external: 'External resources', context: 'Context',
};
const KIND_ICON: Record<string, string> = { worksheet: '📝', material: '📎', guideline: '📐', external: '🔗', context: '🧠' };
const ORDER = ['worksheet', 'material', 'guideline', 'external', 'context'];

export function Resources() {
  const nav = useNavigate();
  const all = store.resources();
  const byKind = new Map<string, any[]>();
  for (const r of all) { const k = r.kind || 'material'; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(r); }
  const kinds = ORDER.filter((k) => byKind.has(k));
  return (
    <div>
      <PageHead
        title="Resources"
        subtitle="A linked knowledge repository — worksheets, materials, guidelines, external resources and captured context."
        actions={<button className="el-button" onClick={() => nav('/knowledge')}>✸ Open knowledge graph</button>}
      />
      {kinds.map((k) => (
        <section key={k} className="app-side-section">
          <h2 className="app-section-title">{KIND_ICON[k]} {KIND_LABEL[k]}<span className="el-badge el-badge--neutral">{byKind.get(k)!.length}</span></h2>
          <div className="app-card-grid">
            {byKind.get(k)!.map((r) => {
              const cls = r.classId ? store.classroom(r.classId) : null;
              const links = (r.links || []).length;
              return (
                <div key={r.id} className="el-card app-res-card">
                  <h3 className="el-card__title">{r.title}</h3>
                  <p className="app-muted">{r.subject}{cls ? ' · ' + cls.name : ''} · {fmtDate(r.createdAt)}</p>
                  {r.note && <p className="el-card__body app-clamp-2">{r.note}</p>}
                  {r.url && <p><a className="knw-open-link" href={r.url} target="_blank" rel="noreferrer">{r.url} ↗</a></p>}
                  <div className="el-card__footer">
                    <span className="el-badge el-badge--neutral">🔗 {links} link{links === 1 ? '' : 's'}</span>
                    <span className="app-spacer" />
                    <button className="el-button el-button--ghost el-button--small" onClick={() => nav('/knowledge?focus=resource:' + r.id)}>View in graph</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
