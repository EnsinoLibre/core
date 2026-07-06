import type { ReactNode } from 'react';
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

function GithubIcon() {
  return (
    <a className="oc-icon-link" href="https://github.com/EnsinoLibre" target="_blank" rel="noopener" aria-label="GitHub" title="GitHub">
      <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
    </a>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const t = store.teacher();
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <a className="app-brand" href="../index.html" title="EnsinoLibre home">
          <img className="oc-wordmark oc-wordmark--light" src="./brand/wordmark-primary-light.svg" alt="EnsinoLibre" height={24} />
          <img className="oc-wordmark oc-wordmark--dark" src="./brand/wordmark-primary-dark.svg" alt="EnsinoLibre" height={24} />
        </a>
        <span className="app-topbar-tag">Teacher platform</span>
        <span className="app-spacer" />
        <a className="app-topbar-link" href="../docs.html">Docs</a>
        <GithubIcon />
        <button className="oc-theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
        <button className="app-teacher-chip" onClick={() => nav('/profile')} title="Your profile">
          <Avatar name={t.name} size={30} /><span className="app-teacher-name">{t.name.split(' ')[0]}</span>
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
