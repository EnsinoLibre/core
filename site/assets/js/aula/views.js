/** EnsinoLibre aula — student-facing views (join, worksheet list, do worksheet). */
import { store, studentAuth, refresh } from '../app/store.js';
import { el, clear, avatar } from '../app/util.js';
import { navigate } from '../app/router.js';
import { validateWorksheet } from '../validator.js';
import { renderWorksheet } from '../renderer.js';
import { trackWorksheet } from '../app/track.js';

function progressBar(pct, label) {
  return el('div', { class: 'app-progress' }, [
    el('div', { class: 'app-progress-track' }, [el('div', { class: 'app-progress-fill', style: `width:${Math.round(pct)}%` })]),
    label ? el('span', { class: 'app-progress-label', text: label }) : null,
  ]);
}

/* ---------- join ---------- */

export function joinView() {
  refresh();
  const code = el('input', { class: 'el-input app-join-code', placeholder: 'CLASS CODE', maxlength: 8, autocapitalize: 'characters' });
  const name = el('input', { class: 'el-input', placeholder: 'Your name', autocomplete: 'name' });
  const err = el('p', { class: 'el-help-text el-help-text--invalid', text: '' });

  const form = el('form', { class: 'app-form', onsubmit: (e) => {
    e.preventDefault();
    const aula = store.aulaByCode(code.value.trim());
    if (!aula) { err.textContent = 'No live class found for that code. Try A2LIVE.'; code.classList.add('el-input--invalid'); return; }
    if (aula.status !== 'live') { err.textContent = 'That class is not open right now.'; return; }
    if (!name.value.trim()) { name.classList.add('el-input--invalid'); return; }
    const enr = store.enroll(aula.id, name.value.trim());
    studentAuth.join(aula.id, enr);
    navigate('/');
  } }, [
    el('label', { class: 'el-label', text: 'Class code' }), code,
    el('label', { class: 'el-label', text: 'Your name' }), name,
    err,
    el('button', { class: 'el-button app-join-submit', type: 'submit', text: 'Join the class' }),
  ]);

  return el('div', { class: 'app-auth' }, [
    el('div', { class: 'app-auth-brand' }, [el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 30 })]),
    el('div', { class: 'el-card app-auth-card' }, [
      el('h1', { class: 'app-auth-title', text: 'Join your class' }),
      el('p', { class: 'app-auth-sub', text: 'Enter the code your teacher shared. Demo code: A2LIVE.' }),
      form,
    ]),
  ]);
}

/* ---------- student home (worksheet list) ---------- */

export function homeView() {
  refresh();
  const s = studentAuth.current();
  const aula = store.aula(s.aulaId);
  if (!aula) return notJoined();
  const cls = store.classroom(aula.classId);
  const worksheets = store.aulaWorksheets(aula.id);

  const list = el('div', { class: 'app-ws-list' }, worksheets.map((w) => {
    const p = store.getProgress(aula.id, s.enrollmentId, w.id);
    const pct = p ? (p.attempted / Math.max(1, p.total)) * 100 : 0;
    const status = p?.done ? 'Complete' : (p?.attempted ? 'In progress' : 'Not started');
    return el('button', { class: 'el-card el-card--interactive app-ws-card', onclick: () => navigate(`/w/${w.id}`) }, [
      el('div', { class: 'app-ws-card-main' }, [
        el('h3', { class: 'el-card__title', text: w.title }),
        el('p', { class: 'app-muted', text: `${w.subject} · ~${w.doc.estimatedMinutes || 10} min` }),
        progressBar(pct, `${p?.attempted || 0}/${p?.total || w.doc.sections.flatMap((x) => x.activities).length} · ${status}`),
      ]),
      el('span', { class: p?.done ? 'el-badge' : 'el-badge el-badge--neutral', text: p?.done ? '✓ Done' : 'Open' }),
    ]);
  }));

  return el('div', { class: 'app-student-wrap' }, [
    el('header', { class: 'app-student-top' }, [
      el('a', { class: 'app-brand', href: '#/' }, [el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 22 })]),
      el('span', { class: 'app-spacer' }),
      el('span', { class: 'app-student-chip' }, [avatar(s.name, 28), el('span', { text: s.name })]),
      el('button', { class: 'el-button el-button--ghost el-button--small', text: 'Leave', onclick: () => { studentAuth.leave(); navigate('/join'); } }),
    ]),
    el('main', { class: 'app-student-main' }, [
      el('div', { class: 'app-page-head' }, [el('div', {}, [
        el('h1', { class: 'app-page-title', text: cls ? cls.name : 'Your class' }),
        el('p', { class: 'app-page-sub', text: `${aula.title} · your work is saved as you go` }),
      ])]),
      el('h2', { class: 'app-section-title', text: 'Worksheets' }),
      list,
    ]),
  ]);
}

/* ---------- do a worksheet ---------- */

export function worksheetView({ id }) {
  refresh();
  const s = studentAuth.current();
  const aula = store.aula(s.aulaId);
  const w = store.worksheet(id);
  if (!aula || !w) return notJoined();

  const host = el('div', {});
  const statusEl = el('span', { class: 'app-muted', text: '' });

  const errors = validateWorksheet(w.doc);
  if (errors.length) host.appendChild(el('div', { class: 'oc-errors', text: 'This worksheet could not be loaded.' }));
  else {
    renderWorksheet(w.doc, host);
    trackWorksheet(host, (snap) => {
      store.setProgress(aula.id, s.enrollmentId, w.id, snap);
      statusEl.textContent = `Saved · ${snap.attempted}/${snap.total} answered`;
    });
  }

  const finish = el('button', { class: 'el-button', text: 'Finish & back to class', onclick: () => navigate('/') });

  return el('div', { class: 'app-student-wrap' }, [
    el('header', { class: 'app-student-top' }, [
      el('button', { class: 'app-back', onclick: () => navigate('/') }, [el('span', { text: '←' }), 'Class']),
      el('span', { class: 'app-spacer' }),
      statusEl,
    ]),
    el('main', { class: 'app-student-main app-worksheet-do' }, [host, el('div', { class: 'app-ws-foot' }, [finish])]),
  ]);
}

/* ---------- misc ---------- */

function notJoined() {
  studentAuth.leave();
  setTimeout(() => navigate('/join'), 0);
  return el('div', { class: 'app-boot', text: 'Rejoining…' });
}
