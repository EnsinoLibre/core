import { useNavigate } from 'react-router-dom';
import { store } from '../lib/api';
import { PageHead, LevelBadge } from '../components/bits';

export function Classrooms() {
  const nav = useNavigate();
  return (
    <div>
      <PageHead title="Classrooms" subtitle="Each class carries its own context your assistant can use." />
      <div className="app-card-grid">
        {store.classrooms().map((c: any) => {
          const roster = store.studentsIn(c.id);
          return (
            <div key={c.id} className="el-card app-class-card">
              <div className="app-class-card-top"><h3 className="el-card__title">{c.name}</h3><LevelBadge level={c.level} /></div>
              <p className="el-card__body">{c.description}</p>
              {c.context && <p className="app-context-quote">{c.context}</p>}
              <div className="el-card__footer">
                <span className="el-badge el-badge--neutral">{roster.length} students</span>
                <span className="el-badge el-badge--neutral">{c.term}</span>
                <span className="app-spacer" />
                <button className="el-button el-button--ghost el-button--small" onClick={() => nav('/knowledge?focus=class:' + c.id)}>View in graph</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
