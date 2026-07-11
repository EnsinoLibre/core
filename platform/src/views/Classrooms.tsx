import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { store } from '../lib/api';
import { PageHead, LevelBadge, stripMarkdown, FilterBar } from '../components/bits';
import { useContent } from '../components/ContentPanel';
import { ClassroomImportButton } from '../components/SeedKB';
import { AddClassroomModal } from '../components/AddEntity';

const ALL = '__all__';

export function Classrooms() {
  const { open } = useContent();
  const [, force] = useState(0);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const all = store.classrooms();
  const subjects = useMemo(() => ([...new Set(all.map((c: any) => c.subject).filter(Boolean))] as string[]).sort(), [all]);
  const levels = useMemo(() => ([...new Set(all.map((c: any) => c.level).filter(Boolean))] as string[]).sort(), [all]);

  const q = query.trim().toLowerCase();
  const filtered = all.filter((c: any) => {
    if (subject !== ALL && c.subject !== subject) return false;
    if (level !== ALL && c.level !== level) return false;
    if (q && !`${c.name} ${c.description} ${c.context}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div>
      <PageHead title="Classrooms" subtitle="Each class carries its own context your assistant can use."
        actions={<>
          <button className="el-button el-button--ghost" onClick={() => setAdding(true)}>+ Add classroom</button>
          <ClassroomImportButton onApplied={() => force((n) => n + 1)} />
        </>} />
      <FilterBar
        query={query} onQuery={setQuery} placeholder="Search classrooms…"
        filters={[
          { label: 'Subject', value: subject, onChange: setSubject, options: [{ value: ALL, label: 'All subjects' }, ...subjects.map((s: string) => ({ value: s, label: s }))] },
          { label: 'Level', value: level, onChange: setLevel, options: [{ value: ALL, label: 'All levels' }, ...levels.map((l: string) => ({ value: l, label: l }))] },
        ]}
      />
      <div className="app-card-grid">
        {filtered.map((c: any) => {
          const roster = store.studentsIn(c.id);
          const openIt = () => open('class:' + c.id);
          return (
            <div key={c.id} className="el-card app-class-card app-cardlink--full" role="button" tabIndex={0}
              onClick={openIt} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); } }}>
              <div className="app-class-card-top"><h3 className="el-card__title">{c.name}</h3><LevelBadge level={c.level} /></div>
              <p className="el-card__body">{c.description}</p>
              {c.context && <p className="app-context-quote app-clamp-2">{stripMarkdown(c.context)}</p>}
              <div className="el-card__footer">
                <span className="el-badge el-badge--neutral">{roster.length} students</span>
                <span className="el-badge el-badge--neutral">{c.term}</span>
              </div>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {adding && <AddClassroomModal onClose={() => setAdding(false)} onAdded={() => force((n) => n + 1)} />}
      </AnimatePresence>
    </div>
  );
}
