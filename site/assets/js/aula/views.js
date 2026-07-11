/** EnsinoLibre — student aula views (Supabase-backed, code-gated public access). */
import { el, clear, avatar } from '../app/util.js';
import { navigate } from '../app/router.js';
import { validateWorksheet } from '../validator.js';
import { renderWorksheet as renderWs } from '../renderer.js';
import { trackWorksheet } from '../app/track.js';
import { themeToggle } from '../theme.js';
import { session, getAula, joinAula, getMyProgress, saveProgress } from './api.js';

function brandTop(right) {
  return el('header', { class: 'app-student-top' }, [
    el('a', { class: 'app-brand', href: '#/' }, [el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 22 })]),
    el('span', { class: 'app-spacer' }),
    themeToggle(),
    ...(right || []),
  ]);
}

/* ---------------- join ---------------- */

const JOIN_ERRORS = {
  not_found: 'No live class found for that code. Check with your teacher.',
  closed: 'That class is not open right now.',
  name_required: 'Please enter your name.',
  not_on_roster: 'That name isn’t on this class’s roster. Check with your teacher.',
  password_required: 'Please enter the password.',
  bad_password: 'That password is incorrect.',
};

/** Two-stage join: code first, then (once we know the deployment) a roster
 * dropdown or free-text name, plus a password field if one is required. */
export function renderJoin(root) {
  clear(root);
  const params = new URLSearchParams(location.search);
  const presetCode = (params.get('code') || '').toUpperCase();
  const card = el('div', { class: 'el-card app-auth-card' });
  let info = null; // set once the code resolves: { code, class, roster, has_password }

  function showCodeStep(prefill = '', message = '') {
    clear(card);
    const code = el('input', { class: 'el-input app-join-code', placeholder: 'CLASS CODE', maxlength: 10, value: prefill, autocapitalize: 'characters' });
    const err = el('p', { class: 'el-help-text el-help-text--invalid', text: message });
    const submit = el('button', { class: 'el-button app-join-submit', type: 'submit', text: 'Continue' });
    const form = el('form', { class: 'app-form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const c = code.value.trim();
      if (!c) { code.classList.add('el-input--invalid'); return; }
      submit.disabled = true; submit.textContent = 'Checking…';
      const data = await getAula(c);
      submit.disabled = false; submit.textContent = 'Continue';
      if (data.error) { err.textContent = JOIN_ERRORS[data.error] || ('Could not check that code: ' + data.error); return; }
      info = { code: c, ...data };
      showNameStep();
    } }, [
      el('label', { class: 'el-label', text: 'Class code' }), code,
      err, submit,
    ]);
    card.append(
      el('h1', { class: 'app-auth-title', text: 'Join your class' }),
      el('p', { class: 'app-auth-sub', text: 'Enter the code your teacher shared.' }),
      form,
    );
    code.focus();
  }

  function showNameStep() {
    clear(card);
    const hasRoster = Array.isArray(info.roster) && info.roster.length > 0;
    const nameField = hasRoster
      ? el('select', { class: 'el-input' }, [
        el('option', { value: '', text: 'Select your name…' }),
        ...info.roster.map((n) => el('option', { value: n, text: n })),
      ])
      : el('input', { class: 'el-input', placeholder: 'Your name', autocomplete: 'name' });
    const password = info.has_password ? el('input', { class: 'el-input', type: 'password', placeholder: 'Password', autocomplete: 'off' }) : null;
    const err = el('p', { class: 'el-help-text el-help-text--invalid', text: '' });
    const submit = el('button', { class: 'el-button app-join-submit', type: 'submit', text: 'Join the class' });
    const back = el('button', { class: 'app-back', type: 'button', text: '← Different code', onclick: () => showCodeStep(info.code) });

    const form = el('form', { class: 'app-form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const n = (nameField.value || '').trim();
      const pw = password ? password.value : '';
      if (!n) { nameField.classList.add('el-input--invalid'); return; }
      if (password && !pw) { password.classList.add('el-input--invalid'); return; }
      submit.disabled = true; submit.textContent = 'Joining…';
      const data = await joinAula(info.code, n, pw);
      submit.disabled = false; submit.textContent = 'Join the class';
      if (data.error) { err.textContent = JOIN_ERRORS[data.error] || ('Could not join: ' + data.error); return; }
      session.set({ code: info.code, enrollmentId: data.enrollment_id, name: data.student_name, aula: { title: data.title, class: data.class, worksheets: data.worksheets } });
      navigate('/');
    } }, [
      el('label', { class: 'el-label', text: 'Your name' }), nameField,
      ...(password ? [el('label', { class: 'el-label', text: 'Password' }), password] : []),
      err, submit, back,
    ]);
    card.append(
      el('h1', { class: 'app-auth-title', text: info.class || 'Join' }),
      el('p', { class: 'app-auth-sub', text: hasRoster ? 'Select your name to join.' : 'Enter your name to join.' }),
      form,
    );
    nameField.focus();
  }

  root.append(
    el('div', { class: 'app-auth' }, [
      el('div', { class: 'app-auth-brand' }, [el('img', { src: 'assets/brand/wordmark-primary-light.svg', alt: 'EnsinoLibre', height: 30 })]),
      card,
    ]),
  );

  if (presetCode) {
    card.append(el('p', { class: 'app-muted', text: 'Loading…' }));
    getAula(presetCode).then((data) => {
      if (data.error) { showCodeStep(presetCode, JOIN_ERRORS[data.error] || ''); return; }
      info = { code: presetCode, ...data };
      showNameStep();
    });
  } else {
    showCodeStep();
  }
}

/* ---------------- home (worksheet list) ---------------- */

export async function renderHome(root) {
  const s = session.get();
  if (!s) return navigate('/join');
  clear(root);
  const wrap = el('div', { class: 'app-student-wrap' });
  root.appendChild(wrap);
  wrap.appendChild(brandTop([
    el('span', { class: 'app-student-chip' }, [avatar(s.name, 28), el('span', { text: s.name })]),
    el('button', { class: 'el-button el-button--ghost el-button--small', text: 'Leave', onclick: () => { session.clear(); navigate('/join'); } }),
  ]));

  const main = el('main', { class: 'app-student-main' });
  wrap.appendChild(main);
  main.append(
    el('div', { class: 'app-page-head' }, [el('div', {}, [
      el('h1', { class: 'app-page-title', text: s.aula.class || 'Your class' }),
      el('p', { class: 'app-page-sub', text: `${s.aula.title} · your work is saved online as you go` }),
    ])]),
    el('h2', { class: 'app-section-title', text: 'Worksheets' }),
  );

  const list = el('div', { class: 'app-ws-list' });
  main.appendChild(list);
  list.appendChild(el('p', { class: 'app-muted', text: 'Loading your progress…' }));

  const prog = await getMyProgress(s.enrollmentId);
  const byWs = new Map(prog.map((p) => [p.worksheet_id, p]));
  list.textContent = '';
  for (const w of s.aula.worksheets) {
    const p = byWs.get(w.id);
    const total = p ? p.total : (w.doc.sections.flatMap((x) => x.activities).length);
    const pct = p && p.total ? (p.attempted / p.total) * 100 : 0;
    const status = p && p.done ? 'Complete' : (p && p.attempted ? 'In progress' : 'Not started');
    list.appendChild(el('button', { class: 'el-card el-card--interactive app-ws-card', onclick: () => navigate(`/w/${w.id}`) }, [
      el('div', { class: 'app-ws-card-main' }, [
        el('h3', { class: 'el-card__title', text: w.title }),
        el('p', { class: 'app-muted', text: `${w.subject} · ~${w.doc.estimatedMinutes || 10} min` }),
        el('div', { class: 'app-progress' }, [
          el('div', { class: 'app-progress-track' }, [el('div', { class: 'app-progress-fill', style: `width:${Math.round(pct)}%` })]),
          el('span', { class: 'app-progress-label', text: `${p ? p.attempted : 0}/${total} · ${status}` }),
        ]),
      ]),
      el('span', { class: p && p.done ? 'el-badge' : 'el-badge el-badge--neutral', text: p && p.done ? '✓ Done' : 'Open' }),
    ]));
  }
}

/* ---------------- do a worksheet ---------------- */

export function renderWorksheet(root, worksheetId) {
  const s = session.get();
  if (!s) return navigate('/join');
  const w = s.aula.worksheets.find((x) => x.id === worksheetId);
  if (!w) return navigate('/');
  clear(root);

  const wrap = el('div', { class: 'app-student-wrap' });
  root.appendChild(wrap);
  const statusEl = el('span', { class: 'app-muted', text: '' });
  wrap.appendChild(brandTop([]));
  // replace the brand top for the worksheet view with a back control
  wrap.firstChild.replaceWith(el('header', { class: 'app-student-top' }, [
    el('button', { class: 'app-back', onclick: () => navigate('/') }, [el('span', { text: '←' }), 'Class']),
    el('span', { class: 'app-spacer' }),
    themeToggle(),
    statusEl,
  ]));

  const host = el('div', {});
  const errors = validateWorksheet(w.doc);
  if (errors.length) host.appendChild(el('div', { class: 'oc-errors', text: 'This worksheet could not be loaded.' }));
  else {
    renderWs(w.doc, host);
    let saving = false;
    trackWorksheet(host, async (snap) => {
      statusEl.textContent = 'Saving…';
      const ok = await saveProgress(s.enrollmentId, w.id, snap);
      statusEl.textContent = ok ? `Saved · ${snap.attempted}/${snap.total} answered` : 'Offline — will retry';
      saving = saving; // noop to keep lints quiet
    });
  }

  const main = el('main', { class: 'app-student-main app-worksheet-do' }, [
    host,
    el('div', { class: 'app-ws-foot' }, [el('button', { class: 'el-button', text: 'Finish & back to class', onclick: () => navigate('/') })]),
  ]);
  wrap.appendChild(main);
}
