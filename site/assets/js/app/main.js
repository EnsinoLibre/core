/** EnsinoLibre teacher workspace — shell, auth guard and routes (BOILERPLATE). */
import { store, auth } from './store.js';
import { route, setNotFound, startRouter, navigate, current } from './router.js';
import { el, avatar, clear } from './util.js';
import {
  loginView, dashboardView, classroomsView, classroomView,
  studentsView, studentView, resourcesView, profileView,
} from './views.js';

const root = document.getElementById('app');

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◱' },
  { to: '/classrooms', label: 'Classrooms', icon: '▦' },
  { to: '/students', label: 'Students', icon: '☺' },
  { to: '/resources', label: 'Resources', icon: '❏' },
  { to: '/profile', label: 'Profile', icon: '⚙' },
];

/** Which nav item is active for a given path. */
function activeNav(path) {
  if (path === '/' ) return '/';
  const seg = '/' + path.split('/').filter(Boolean)[0];
  if (seg === '/classrooms') return '/classrooms';
  if (seg === '/students') return '/students';
  if (seg === '/resources') return '/resources';
  if (seg === '/profile') return '/profile';
  return '/';
}

let shellEls = null;

function buildShell() {
  const content = el('main', { class: 'app-content', id: 'app-content' });

  const teacherChip = el('button', { class: 'app-teacher-chip', onclick: () => navigate('/profile') });
  const renderChip = () => {
    const t = store.teacher();
    teacherChip.replaceChildren(avatar(t.name, 30), el('span', { class: 'app-teacher-name', text: t.name }));
  };
  renderChip();
  document.addEventListener('teacher-updated', renderChip);

  const navLinks = NAV.map((n) => el('a', {
    class: 'app-nav-link', href: '#' + n.to, dataset: { to: n.to },
  }, [el('span', { class: 'app-nav-icon', text: n.icon }), el('span', { text: n.label })]));

  const sidebar = el('aside', { class: 'app-sidebar' }, [
    el('nav', { class: 'app-nav' }, navLinks),
    el('div', { class: 'app-sidebar-foot' }, [
      el('a', { class: 'app-nav-link app-nav-link--muted', href: 'index.html' }, [el('span', { class: 'app-nav-icon', text: '✦' }), el('span', { text: 'Worksheet generator' })]),
    ]),
  ]);

  const topbar = el('header', { class: 'app-topbar' }, [
    el('a', { class: 'app-brand', href: '#/' }, [el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 24 })]),
    el('span', { class: 'app-topbar-tag', text: 'Teacher workspace' }),
    el('span', { class: 'app-spacer' }),
    teacherChip,
    el('button', { class: 'el-button el-button--ghost el-button--small', text: 'Sign out', onclick: () => { auth.logout(); navigate('/login'); } }),
  ]);

  const layout = el('div', { class: 'app-shell' }, [topbar, el('div', { class: 'app-body' }, [sidebar, content])]);
  clear(root);
  root.appendChild(layout);
  shellEls = { content, navLinks };
}

/** Mount a view into the shell, guarding auth and setting the active nav. */
function mount(viewFactory) {
  if (!auth.isAuthed()) { navigate('/login'); return; }
  if (!shellEls || !root.querySelector('.app-shell')) buildShell();
  const path = current();
  for (const link of shellEls.navLinks) link.classList.toggle('active', link.dataset.to === activeNav(path));
  clear(shellEls.content);
  try {
    shellEls.content.appendChild(viewFactory());
  } catch (err) {
    shellEls.content.appendChild(el('div', { class: 'oc-errors', text: 'Something went wrong rendering this view: ' + err.message }));
    console.error(err);
  }
  window.scrollTo(0, 0);
}

function mountLogin() {
  if (auth.isAuthed()) { navigate('/'); return; }
  shellEls = null;
  clear(root);
  root.appendChild(loginView());
}

/* routes */
route('/login', mountLogin);
route('/', () => mount(dashboardView));
route('/classrooms', () => mount(classroomsView));
route('/classrooms/:id', (p) => mount(() => classroomView(p)));
route('/students', () => mount(studentsView));
route('/students/:id', (p) => mount(() => studentView(p)));
route('/resources', () => mount(resourcesView));
route('/profile', () => mount(profileView));
setNotFound(() => navigate(auth.isAuthed() ? '/' : '/login'));

startRouter();
