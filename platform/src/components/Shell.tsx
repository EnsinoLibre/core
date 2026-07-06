import { NavLink, useNavigate } from 'react-router-dom';
import { auth, store } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Avatar } from './bits';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◱', end: true },
  { to: '/knowledge', label: 'Knowledge', icon: '✸' },
  { to: '/live', label: 'Live classroom', icon: '◉' },
  { to: '/classrooms', label: 'Classrooms', icon: '▦' },
  { to: '/students', label: 'Students', icon: '☺' },
  { to: '/resources', label: 'Resources', icon: '❏' },
  { to: '/profile', label: 'Profile', icon: '⚙' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const t = store.teacher();
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <a className="app-brand" href="../index.html"><img src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={24} /></a>
        <span className="app-topbar-tag">Teacher platform</span>
        <span className="app-spacer" />
        <button className="oc-theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
        <button className="app-teacher-chip" onClick={() => nav('/profile')}>
          <Avatar name={t.name} size={30} /><span className="app-teacher-name">{t.name}</span>
        </button>
        <button className="el-button el-button--ghost el-button--small" onClick={() => { auth.logout(); nav('/login'); }}>Sign out</button>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="app-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                <span className="app-nav-icon">{n.icon}</span><span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="app-sidebar-foot">
            <a className="app-nav-link app-nav-link--muted" href="../index.html"><span className="app-nav-icon">✦</span><span>Worksheet generator</span></a>
          </div>
        </aside>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
