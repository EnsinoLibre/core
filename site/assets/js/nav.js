/**
 * EnsinoLibre — public topbar wiring (landing + docs).
 * Appends the theme toggle and a persistent account control: a "Teacher
 * login" button, or the teacher's avatar if a session already exists
 * (boilerplate — reads the same localStorage the platform writes).
 */
import { themeToggle } from './theme.js';

function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

export function initTopbar() {
  const links = document.querySelector('.oc-nav-links');
  const account = document.querySelector('#oc-account');
  if (!links) return;

  // theme toggle sits just before the account control
  const toggle = themeToggle();
  if (account) links.insertBefore(toggle, account);
  else links.appendChild(toggle);

  if (!account) return;

  let session = null;
  let name = 'Teacher';
  try { session = JSON.parse(localStorage.getItem('ensinolibre.session.v1') || 'null'); } catch { /* ignore */ }
  try { const ws = JSON.parse(localStorage.getItem('ensinolibre.workspace.v1') || 'null'); if (ws && ws.teacher && ws.teacher.name) name = ws.teacher.name; } catch { /* ignore */ }

  account.textContent = '';
  if (session) {
    const a = document.createElement('a');
    a.href = 'app/';
    a.className = 'oc-account';
    a.title = `${name} — open your platform`;
    const av = document.createElement('span');
    av.className = 'oc-account-avatar';
    av.textContent = initials(name);
    const label = document.createElement('span');
    label.className = 'oc-account-name';
    label.textContent = name.split(' ')[0];
    a.append(av, label);
    account.appendChild(a);
  } else {
    const a = document.createElement('a');
    a.href = 'app/';
    a.className = 'oc-nav-cta';
    a.textContent = 'Teacher login →';
    account.appendChild(a);
  }
}
