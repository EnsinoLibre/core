/**
 * EnsinoLibre — offline worksheet player.
 *
 * This module is bundled (esbuild → vendor/player.bundle.js) and inlined into a
 * single self-contained .html file together with the worksheet JSON and the
 * styles. A student opens that file in any browser FULLY OFFLINE, does the
 * exercises (same renderer + tiered feedback as online), then downloads a small
 * "answers" file the teacher imports back into the platform for validation.
 *
 * No network, no account, no external dependencies.
 */
import { renderWorksheet } from '../renderer.js';
import { validateWorksheet } from '../validator.js';
import { snapshot } from '../app/track.js';

const DATA = (typeof window !== 'undefined' && window.__EL__) || {};
const DOC = DATA.doc || {};
const WORKSHEET_ID = DATA.worksheetId || DOC.id || '';
const TITLE = DATA.worksheetTitle || DOC.title || 'Worksheet';

function h(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  if (kids != null) for (const c of [].concat(kids)) if (c != null) n.append(c);
  return n;
}

function sanitizeFile(s) { return String(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim(); }

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Per-unit result detail, read from the data-state the renderer sets. */
function collectDetails(host) {
  const btns = [...host.querySelectorAll('.oc-btn--check')];
  return btns.map((btn, i) => {
    const card = btn.closest('.oc-qblock') || btn.closest('.oc-activity');
    const promptEl = card && card.querySelector('.oc-prompt, .oc-qtext, .oc-activity-prompt, h4, h3');
    return {
      i,
      state: (card && card.dataset && card.dataset.state) || '',
      prompt: promptEl ? promptEl.textContent.trim().slice(0, 140) : '',
    };
  });
}

/* ---------------- views ---------------- */

const root = document.getElementById('el-player');

function shell(children) {
  const wrap = h('div', { class: 'elp-wrap' }, [
    h('header', { class: 'elp-top' }, [
      h('span', { class: 'elp-brand', text: 'EnsinoLibre' }),
      h('span', { class: 'elp-top-title', text: TITLE }),
    ]),
    h('main', { class: 'elp-main' }, children),
  ]);
  root.textContent = '';
  root.appendChild(wrap);
}

function showGate() {
  const name = h('input', { class: 'el-input', placeholder: 'Your name', autocomplete: 'name' });
  const err = h('p', { class: 'elp-err', text: '' });
  const start = () => {
    const n = name.value.trim();
    if (!n) { err.textContent = 'Please enter your name.'; name.focus(); return; }
    showWorksheet(n);
  };
  shell([
    h('div', { class: 'el-card elp-gate' }, [
      h('h1', { class: 'elp-h1', text: TITLE }),
      h('p', { class: 'elp-sub', text: DOC.subject ? `${DOC.subject}${DOC.estimatedMinutes ? ` · ~${DOC.estimatedMinutes} min` : ''}` : 'Enter your name to begin. Your work stays on this device until you send it back.' }),
      h('label', { class: 'el-label', text: 'Your name' }), name, err,
      h('button', { class: 'el-button elp-start', text: 'Start worksheet', onclick: start }),
    ]),
  ]);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  name.focus();
}

function showWorksheet(name) {
  const host = h('div', {});
  const problems = validateWorksheet(DOC);
  if (problems.length) { host.appendChild(h('div', { class: 'oc-errors', text: 'This worksheet could not be loaded.' })); }
  else { renderWorksheet(DOC, host); }

  const finish = () => {
    const snap = snapshot(host);
    const result = {
      kind: 'ensinolibre-answers',
      v: 1,
      worksheetId: WORKSHEET_ID,
      worksheetTitle: TITLE,
      name,
      submittedAt: new Date().toISOString(),
      total: snap.total,
      attempted: snap.attempted,
      correct: snap.correct,
      done: snap.done,
      score: snap.score,
      details: collectDetails(host),
    };
    downloadJSON(`${sanitizeFile(name)} — ${sanitizeFile(TITLE)}.answers.json`, result);
    showDone(name, snap, finish);
  };

  shell([
    host,
    h('div', { class: 'elp-foot' }, [
      h('button', { class: 'el-button elp-finish', text: '✓ Finish & download my answers', onclick: finish }),
      h('p', { class: 'elp-foot-note', text: 'This saves a small file to your device. Email it back to your teacher.' }),
    ]),
  ]);
}

function showDone(name, snap, again) {
  const pct = snap.total ? Math.round((snap.score || 0) * 100) : 0;
  const banner = h('div', { class: 'el-card elp-done' }, [
    h('h2', { class: 'elp-h1', text: 'Answers downloaded ✓' }),
    h('p', { class: 'elp-sub', text: `${name} — ${snap.attempted}/${snap.total} answered · ${pct}% correct.` }),
    h('p', { class: 'elp-sub', text: 'Send the downloaded file to your teacher. You can keep working and download again if you like.' }),
    h('div', { class: 'elp-done-actions' }, [
      h('button', { class: 'el-button el-button--ghost', text: 'Keep working', onclick: () => banner.remove() }),
      h('button', { class: 'el-button', text: '↻ Download again', onclick: again }),
    ]),
  ]);
  const main = root.querySelector('.elp-main');
  main.insertBefore(banner, main.firstChild);
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

if (root) {
  if (!DOC || !DOC.sections) {
    root.appendChild(h('p', { class: 'elp-err', text: 'No worksheet found in this file.' }));
  } else {
    showGate();
  }
}
