import { useNavigate } from 'react-router-dom';
import { store } from '../lib/api';
import { PageHead, LevelBadge } from '../components/bits';

export function Dashboard() {
  const nav = useNavigate();
  const t = store.teacher();
  const c = store.counts();
  const stats: [string, number, string][] = [
    ['Classrooms', c.classrooms, '/classrooms'],
    ['Students', c.students, '/students'],
    ['Resources', c.resources, '/resources'],
  ];
  return (
    <div>
      <PageHead title={`Welcome back, ${t.name.split(' ')[0]}`} subtitle="Your classes, students and knowledge at a glance." />
      <div className="app-stats">
        {stats.map(([label, value, to]) => (
          <button key={label} className="el-card el-card--interactive app-stat" onClick={() => nav(to)}>
            <span className="app-stat-value">{value}</span><span className="app-stat-label">{label}</span>
          </button>
        ))}
      </div>
      <section>
        <h2 className="app-section-title">Your classrooms</h2>
        <div className="app-card-grid">
          {store.classrooms().slice(0, 4).map((cls: any) => {
            const roster = store.studentsIn(cls.id);
            return (
              <div key={cls.id} className="el-card el-card--interactive app-class-card" onClick={() => nav('/classrooms')}>
                <div className="app-class-card-top"><h3 className="el-card__title">{cls.name}</h3><LevelBadge level={cls.level} /></div>
                <p className="el-card__body">{cls.description}</p>
                <div className="el-card__footer">
                  <span className="el-badge el-badge--neutral">{roster.length} students</span>
                  <span className="el-badge el-badge--neutral">{cls.term}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
