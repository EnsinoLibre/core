import { useMemo, useState } from 'react';
import { store } from '../lib/api';
import { PageHead, FilterBar, SectionAccordion, namePreview, fmtDate, stripMarkdown } from '../components/bits';
import { useContent } from '../components/ContentPanel';
import { SeedButton } from '../components/SeedKB';

const KIND_LABEL: Record<string, string> = {
  worksheet: 'Worksheets', material: 'Teaching materials', guideline: 'Guidelines', external: 'External resources', context: 'Context',
};
const KIND_ICON: Record<string, string> = { worksheet: '📝', material: '📎', guideline: '📐', external: '🔗', context: '🧠' };
const ORDER = ['worksheet', 'material', 'guideline', 'external', 'context'];
// Subcategories a teacher can seed from files (worksheets come from the generator).
const SEEDABLE = new Set(['material', 'guideline', 'external', 'context']);
const ALL = '__all__';

export function Resources() {
  const { open } = useContent();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState(ALL);
  const [classId, setClassId] = useState(ALL);
  const all = store.resources();

  const subjects = useMemo(() => ([...new Set(all.map((r: any) => r.subject).filter(Boolean))] as string[]).sort(), [all]);
  const classes = store.classrooms();

  const q = query.trim().toLowerCase();
  const filtered = all.filter((r: any) => {
    if (subject !== ALL && r.subject !== subject) return false;
    if (classId !== ALL && r.classId !== classId) return false;
    if (q && !`${r.title} ${r.subject} ${r.note} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const byKind = new Map<string, any[]>();
  for (const r of filtered) { const k = r.kind || 'material'; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(r); }
  // Seedable subcategories always show (each is an upload surface); others only when populated.
  const kinds = ORDER.filter((k) => byKind.has(k) || SEEDABLE.has(k));

  return (
    <div>
      <PageHead
        title="Resources"
        subtitle="A linked knowledge repository — worksheets, materials, guidelines, external resources and captured context."
        actions={<SeedButton label="🌱 Seed knowledge base" onApplied={rerender} />}
      />
      <FilterBar
        query={query} onQuery={setQuery} placeholder="Search resources…"
        filters={[
          { label: 'Subject', value: subject, onChange: setSubject, options: [{ value: ALL, label: 'All subjects' }, ...subjects.map((s: string) => ({ value: s, label: s }))] },
          { label: 'Classroom', value: classId, onChange: setClassId, options: [{ value: ALL, label: 'All classrooms' }, ...classes.map((c: any) => ({ value: c.id, label: c.name }))] },
        ]}
      />
      {kinds.map((k) => {
        const rs = byKind.get(k) || [];
        return (
          <SectionAccordion
            key={k} icon={KIND_ICON[k]} label={KIND_LABEL[k]} count={rs.length}
            preview={rs.length ? namePreview(rs, (r) => r.title) : undefined}
            actions={SEEDABLE.has(k) ? <SeedButton scope={{ kind: k }} label="⬆ Add files" small onApplied={rerender} /> : undefined}
          >
            {rs.length === 0 && <p className="app-muted">Nothing here yet — add files and your local agent will summarize them into linked notes.</p>}
            <div className="app-card-grid">
              {rs.map((r) => {
                const cls = r.classId ? store.classroom(r.classId) : null;
                const links = (r.links || []).length;
                const openIt = () => open('resource:' + r.id);
                return (
                  <div key={r.id} className="el-card app-res-card app-cardlink--full" role="button" tabIndex={0}
                    onClick={openIt} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); } }}>
                    <h3 className="el-card__title">{r.title}</h3>
                    <p className="app-muted">{r.subject}{cls ? ' · ' + cls.name : ''} · {fmtDate(r.createdAt)}</p>
                    {r.note && <p className="el-card__body app-clamp-2">{stripMarkdown(r.note)}</p>}
                    {r.url && <p><a className="knw-open-link" href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{r.url} ↗</a></p>}
                    <div className="el-card__footer">
                      <span className="el-badge el-badge--neutral">🔗 {links} link{links === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionAccordion>
        );
      })}
    </div>
  );
}
