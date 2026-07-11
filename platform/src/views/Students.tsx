import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { store } from '../lib/api';
import { PageHead, LevelBadge, Avatar, stripMarkdown, FilterBar, SectionAccordion, namePreview } from '../components/bits';
import { useContent } from '../components/ContentPanel';
import { AddStudentModal } from '../components/AddEntity';

const ALL = '__all__';

export function Students() {
  const { open } = useContent();
  const [, force] = useState(0);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const all = store.students();
  const classes = store.classrooms();
  const levels = useMemo(() => ([...new Set(all.map((s: any) => s.level).filter(Boolean))] as string[]).sort(), [all]);

  const q = query.trim().toLowerCase();
  const filtered = all.filter((s: any) => {
    if (classId !== ALL && s.classId !== classId) return false;
    if (level !== ALL && s.level !== level) return false;
    if (q && !`${s.name} ${s.goals} ${s.needs}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const byClass = new Map<string, any[]>();
  for (const s of filtered) { if (!byClass.has(s.classId)) byClass.set(s.classId, []); byClass.get(s.classId)!.push(s); }

  return (
    <div>
      <PageHead title="Students" subtitle="Every learner and the context you keep on them."
        actions={<button className="el-button el-button--ghost" onClick={() => setAdding(true)}>+ Add student</button>} />
      <FilterBar
        query={query} onQuery={setQuery} placeholder="Search students…"
        filters={[
          { label: 'Classroom', value: classId, onChange: setClassId, options: [{ value: ALL, label: 'All classrooms' }, ...classes.map((c: any) => ({ value: c.id, label: c.name }))] },
          { label: 'Level', value: level, onChange: setLevel, options: [{ value: ALL, label: 'All levels' }, ...levels.map((l: string) => ({ value: l, label: l }))] },
        ]}
      />
      {[...byClass.entries()].map(([classId, students]) => {
        const cls = store.classroom(classId);
        return (
          <SectionAccordion key={classId} label={cls ? cls.name : 'Class'} count={students.length} preview={namePreview(students, (s) => s.name)}>
            <div className="app-card-grid">
              {students.map((s) => {
                const openIt = () => open('student:' + s.id);
                return (
                  <div key={s.id} className="el-card app-student-card app-cardlink--full" role="button" tabIndex={0}
                    onClick={openIt} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); } }}>
                    <div className="app-cell-user">
                      <Avatar name={s.name} size={40} />
                      <div><div className="app-student-name">{s.name}</div><div className="app-muted">{s.pronouns}</div></div>
                      <LevelBadge level={s.level} />
                    </div>
                    <p className="el-card__body app-clamp-2">{stripMarkdown(s.goals) || 'No goals set yet.'}</p>
                  </div>
                );
              })}
            </div>
          </SectionAccordion>
        );
      })}
      <AnimatePresence>
        {adding && <AddStudentModal onClose={() => setAdding(false)} onAdded={() => force((n) => n + 1)} />}
      </AnimatePresence>
    </div>
  );
}
