import { useState } from 'react';
import { store } from '../lib/api';
import { PageHead, LevelBadge, stripMarkdown } from '../components/bits';
import { useContent } from '../components/ContentPanel';
import { ClassroomImportButton } from '../components/SeedKB';

export function Classrooms() {
  const { open } = useContent();
  const [, force] = useState(0);
  return (
    <div>
      <PageHead title="Classrooms" subtitle="Each class carries its own context your assistant can use."
        actions={<ClassroomImportButton onApplied={() => force((n) => n + 1)} />} />
      <div className="app-card-grid">
        {store.classrooms().map((c: any) => {
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
    </div>
  );
}
