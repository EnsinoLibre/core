import { store } from '../lib/api';
import { PageHead, LevelBadge, Avatar, stripMarkdown } from '../components/bits';
import { useContent } from '../components/ContentPanel';

export function Students() {
  const { open } = useContent();
  const byClass = new Map<string, any[]>();
  for (const s of store.students()) { if (!byClass.has(s.classId)) byClass.set(s.classId, []); byClass.get(s.classId)!.push(s); }
  return (
    <div>
      <PageHead title="Students" subtitle="Every learner and the context you keep on them." />
      {[...byClass.entries()].map(([classId, students]) => {
        const cls = store.classroom(classId);
        return (
          <section key={classId} className="app-side-section">
            <h2 className="app-section-title">{cls ? cls.name : 'Class'}<span className="el-badge el-badge--neutral">{students.length}</span></h2>
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
          </section>
        );
      })}
    </div>
  );
}
