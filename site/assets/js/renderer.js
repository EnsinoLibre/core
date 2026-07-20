/**
 * EnsinoLibre — worksheet renderer (schema v2, full catalogue).
 *
 * renderWorksheet(worksheet, container) turns validated worksheet JSON into
 * an interactive DOM widget. Tiered feedback everywhere: hint on the first
 * two wrong tries, answer revealed on the third. All worksheet data is
 * rendered with textContent (untrusted input); the only exception is
 * image-hotspot's svg field, which is validated and mounted via a data URI
 * (no script execution). Read-aloud uses the browser's built-in
 * speechSynthesis — fully self-contained, no assets — and only appears when
 * the device actually has a voice for the worksheet's language (see #2).
 *
 * Browser-only module; pure logic lives in validator.js.
 */

import { parseGaps } from './validator.js';
import { warmAnime, enterTiles, exitTiles, popTiles, pulseWave, flyInMorphemes, drawPaths, flipCard, flipSwap, shakeTiles, flashCorrect } from './anim.js';

let uid = 0;
const nextId = (p) => `oc-${p}-${++uid}`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function shuffled(a0) {
  const a = a0.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const normalise = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const normLoose = (s) => normalise(s).replace(/[.,!?;:'"’‘“”]/g, '');

/** Minimal safe inline formatter: **bold**, *italic*, `code` → DOM nodes. */
function richText(target, text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  for (const part of parts) {
    if (/^\*\*[^*]+\*\*$/.test(part)) target.appendChild(el('strong', null, part.slice(2, -2)));
    else if (/^\*[^*]+\*$/.test(part)) target.appendChild(el('em', null, part.slice(1, -1)));
    else if (/^`[^`]+`$/.test(part)) target.appendChild(el('code', null, part.slice(1, -1)));
    else if (part) target.appendChild(document.createTextNode(part));
  }
  return target;
}

/* ================= read-aloud (capability-gated, #2) ===================== */

/**
 * Read-aloud runs on the browser's own speechSynthesis: 0 KB, nothing
 * vendored, which is the only option compatible with the inline-dependency
 * budget (a neural TTS voice model is megabytes — see EnsinoLibre/core#2).
 *
 * Previously every 🔊 button was hard-disabled because the *default* voice
 * sounds poor. But getVoices() exposes the platform's whole voice set, and
 * modern OS voices (Windows "… Natural", Apple Siri/Enhanced, Google) are
 * good. So rather than judging the default, we pick the best voice available
 * for the worksheet's language and show the button ONLY when one exists —
 * a device with no matching voice gets no button, never a dead one.
 */
const HQ_VOICE = /natural|neural|siri|premium|enhanced|google|online/i;

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesCache = null;
let currentLang = '';
const voiceWaiters = new Set();

function allVoices() {
  if (!hasSpeech()) return [];
  const live = window.speechSynthesis.getVoices() || [];
  if (live.length) voicesCache = live;
  return voicesCache || [];
}

/**
 * Prime the voice list. getVoices() is commonly empty on the first call and
 * only populated later via 'voiceschanged', so buttons built before that
 * fires re-check themselves once the list arrives.
 */
export function warmVoices() {
  if (!hasSpeech()) return;
  allVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    voicesCache = window.speechSynthesis.getVoices() || voicesCache;
    for (const recheck of [...voiceWaiters]) { try { recheck(); } catch { /* ignore */ } }
    voiceWaiters.clear();
  }, { once: true });
}

/** Best voice for a BCP-47 tag, or null when the device has none for it. */
export function pickVoice(lang) {
  const want = String(lang || '').toLowerCase().replace(/_/g, '-');
  if (!want) return null;
  const base = want.split('-')[0];
  const matches = allVoices().filter((v) => {
    const vl = String(v.lang || '').toLowerCase().replace(/_/g, '-');
    return vl === want || vl.split('-')[0] === base;
  });
  if (!matches.length) return null;
  // Prefer a known-good voice, then an exact locale match, then an offline one.
  const score = (v) => (HQ_VOICE.test(v.name) ? 4 : 0)
    + (String(v.lang).toLowerCase().replace(/_/g, '-') === want ? 2 : 0)
    + (v.localService ? 1 : 0);
  return matches.slice().sort((a, b) => score(b) - score(a))[0];
}

/**
 * A 🔊 button, or null when speech is unavailable at all. `getText` may be a
 * string or a function resolved at click time (for decks that change card).
 * The button stays hidden until a voice for `lang` is known to exist.
 */
function readAloudButton(getText, { lang, label = '🔊 Play', onSpeak } = {}) {
  if (!hasSpeech()) return null;
  const btn = el('button', 'oc-btn oc-btn--check oc-tts', label);
  btn.type = 'button';
  const recheck = () => { btn.hidden = !pickVoice(lang); };
  recheck();
  if (btn.hidden) voiceWaiters.add(recheck); // voices may still be loading
  btn.addEventListener('click', () => {
    const voice = pickVoice(lang);
    if (!voice) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(typeof getText === 'function' ? getText() : getText);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
    if (onSpeak) onSpeak();
  });
  return btn;
}

/** Tiered feedback: hint, hint, reveal on third wrong attempt. */
function makeFeedback(card, activity, revealText) {
  const box = el('div', 'oc-feedback');
  box.setAttribute('aria-live', 'polite');
  card.appendChild(box);
  let attempts = 0;
  return {
    get attempts() { return attempts; }, // wrong-tries so far, for first-attempt scoring (#63)
    correct(extra) {
      card.dataset.state = 'correct';
      box.className = 'oc-feedback oc-feedback--correct';
      const explain = extra ?? activity.explanation;
      box.textContent = explain ? `Correct! ${explain}` : 'Correct!';
      flashCorrect(card); // shared across all 13 check-based types (#14)
    },
    wrong() {
      attempts += 1;
      card.dataset.state = 'wrong';
      box.className = 'oc-feedback oc-feedback--wrong';
      shakeTiles([card]); // shared "not quite" shake (#14)
      if (attempts >= 3) {
        box.textContent = `The answer is: ${revealText()}` + (activity.explanation ? ` — ${activity.explanation}` : '');
        card.dataset.state = 'revealed';
      } else if (activity.hint) {
        box.textContent = `Not quite. Hint: ${activity.hint}`;
      } else {
        box.textContent = 'Not quite — have another look and try again.';
      }
    },
    neutral(msg) { box.className = 'oc-feedback'; box.textContent = msg; },
  };
}

function checkButton(onCheck, label = 'Check') {
  const btn = el('button', 'oc-btn oc-btn--check', label);
  btn.type = 'button';
  btn.addEventListener('click', onCheck);
  return btn;
}

function activityCard(a, index) {
  const card = el('div', `oc-activity oc-activity--${a.type}`);
  if (index != null) card.appendChild(el('span', 'oc-activity-number', String(index)));
  if (a.instruction) card.appendChild(el('p', 'oc-section-instructions', a.instruction));
  return card;
}

/* ================= question primitives (standalone + reused in sets) ===== */

/** One MCQ question block with its own check + tiered feedback. onResolve(correct) optional. */
function qMcq(q, { onResolve } = {}) {
  const block = el('div', 'oc-qblock');
  block.appendChild(el('p', 'oc-activity-prompt', q.question));
  const name = nextId('mcq');
  const list = el('div', 'oc-options');
  q.options.forEach((opt, i) => {
    const label = el('label', 'oc-option');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = String(i);
    label.appendChild(input);
    label.appendChild(el('span', null, opt));
    list.appendChild(label);
  });
  block.appendChild(list);
  const fb = makeFeedback(block, q, () => q.options[q.answer]);
  let done = false;
  block.appendChild(checkButton(() => {
    const picked = block.querySelector(`input[name="${name}"]:checked`);
    if (!picked) return fb.neutral('Choose an option first.');
    const ok = Number(picked.value) === q.answer;
    ok ? fb.correct() : fb.wrong();
    if (!done && (ok || block.dataset.state === 'revealed')) { done = true; onResolve && onResolve(ok, { attempts: fb.attempts }); }
  }));
  return block;
}

function qTf(q, { onResolve } = {}) {
  const block = el('div', 'oc-qblock');
  block.appendChild(el('p', 'oc-activity-prompt', q.statement));
  const name = nextId('tf');
  const list = el('div', 'oc-options oc-options--row');
  [['True', 'true'], ['False', 'false']].forEach(([labelText, val]) => {
    const label = el('label', 'oc-option');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = val;
    label.appendChild(input);
    label.appendChild(el('span', null, labelText));
    list.appendChild(label);
  });
  block.appendChild(list);
  const fb = makeFeedback(block, q, () => (q.answer ? 'True' : 'False'));
  let done = false;
  block.appendChild(checkButton(() => {
    const picked = block.querySelector(`input[name="${name}"]:checked`);
    if (!picked) return fb.neutral('Choose True or False first.');
    const ok = (picked.value === 'true') === q.answer;
    ok ? fb.correct() : fb.wrong();
    if (!done && (ok || block.dataset.state === 'revealed')) { done = true; onResolve && onResolve(ok, { attempts: fb.attempts }); }
  }));
  return block;
}

function qGap(q, { onResolve } = {}) {
  const block = el('div', 'oc-qblock');
  const p = el('p', 'oc-activity-prompt oc-gap-text');
  const gaps = [];
  for (const seg of parseGaps(q.text)) {
    if (seg.kind === 'text') p.appendChild(document.createTextNode(seg.value));
    else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'oc-gap-input';
      input.setAttribute('aria-label', 'gap');
      input.size = Math.max(6, seg.answers[0].length + 2);
      gaps.push({ input, answers: seg.answers });
      p.appendChild(input);
    }
  }
  block.appendChild(p);
  const fb = makeFeedback(block, q, () => gaps.map((g) => g.answers[0]).join(', '));
  let done = false;
  block.appendChild(checkButton(() => {
    let allFilled = true;
    let allRight = true;
    for (const g of gaps) {
      const val = normalise(g.input.value);
      if (!val) allFilled = false;
      const ok = g.answers.some((ans) => normalise(ans) === val);
      g.input.classList.toggle('oc-gap-input--wrong', Boolean(val) && !ok);
      g.input.classList.toggle('oc-gap-input--right', ok);
      if (!ok) allRight = false;
    }
    if (!allFilled) return fb.neutral('Fill in every gap first.');
    allRight ? fb.correct() : fb.wrong();
    if (!done && (allRight || block.dataset.state === 'revealed')) { done = true; onResolve && onResolve(allRight, { attempts: fb.attempts }); }
  }));
  return block;
}

function qMatch(q, { onResolve } = {}) {
  const block = el('div', 'oc-qblock');
  if (q.prompt) block.appendChild(el('p', 'oc-activity-prompt', q.prompt));
  const rights = shuffled(q.pairs.map((p) => p.right));
  const table = el('div', 'oc-match');
  const selects = [];
  q.pairs.forEach((pair) => {
    const row = el('div', 'oc-match-row');
    row.appendChild(el('span', 'oc-match-left', pair.left));
    const select = document.createElement('select');
    select.className = 'oc-match-select';
    select.setAttribute('aria-label', `match for ${pair.left}`);
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— choose —';
    select.appendChild(blank);
    rights.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      select.appendChild(opt);
    });
    selects.push({ select, expected: pair.right });
    row.appendChild(select);
    table.appendChild(row);
  });
  block.appendChild(table);
  const fb = makeFeedback(block, q, () => q.pairs.map((p) => `${p.left} → ${p.right}`).join('; '));
  let done = false;
  block.appendChild(checkButton(() => {
    if (selects.some((s) => !s.select.value)) return fb.neutral('Match every item first.');
    let allRight = true;
    for (const s of selects) {
      const ok = s.select.value === s.expected;
      s.select.classList.toggle('oc-match-select--wrong', !ok);
      if (!ok) allRight = false;
    }
    allRight ? fb.correct() : fb.wrong();
    if (!done && (allRight || block.dataset.state === 'revealed')) { done = true; onResolve && onResolve(allRight); }
  }));
  return block;
}

const Q_PRIMITIVES = { 'mcq': qMcq, 'true-false': qTf, 'gap-fill': qGap, 'matching': qMatch };

/** Stagger (ms) for entering `count` tiles, clamped so a long set's total
 *  entrance never blows past ~1s (a 12-question quiz shouldn't take 4s to
 *  appear) — scales the per-tile delay down as count grows (#66). */
function clampedStagger(count, base = 70, capTotal = 900) {
  if (count <= 1) return base;
  return Math.max(15, Math.min(base, Math.floor(capTotal / count)));
}

/**
 * Score tracker banner for set types with a passMark. Tracks both eventual
 * correctness (hint-cycled to the right answer counts) and first-attempt
 * correctness (right first try, attempts === 0) so a learner can't hint-cycle
 * every MCQ and still bank a "passed" — pass/fail is decided on the first-try
 * tally, and both numbers are shown once they diverge (#63). The tiered
 * hint→hint→reveal learning flow itself is untouched; this only changes what
 * gets counted for the passMark banner.
 */
function scoreTracker(card, total, passMark) {
  const bar = el('p', 'oc-word-count');
  bar.textContent = `0 / ${total} correct` + (passMark ? ` · pass mark ${passMark}` : '');
  card.appendChild(bar);
  let correct = 0;
  let firstTry = 0;
  let resolved = 0;
  return (ok, meta) => {
    resolved += 1;
    if (ok) {
      correct += 1;
      if (!meta || meta.attempts === 0) firstTry += 1;
    }
    bar.textContent = firstTry === correct
      ? `${correct} / ${total} correct` + (passMark ? ` · pass mark ${passMark}` : '')
      : `${firstTry} / ${total} first try · ${correct} / ${total} after retries` + (passMark ? ` · pass mark ${passMark}` : '');
    if (resolved === total && passMark) {
      const passed = firstTry >= passMark;
      bar.classList.add(passed ? 'oc-word-count--met' : 'oc-feedback--wrong');
      bar.textContent += passed ? ' — passed! 🎉' : ' — not passed, review and retry.';
    }
  };
}

/* ================= activity renderers ==================================== */

const R = {};

/* --- original six --- */
R['mcq'] = (a, i) => { const c = activityCard(a, i); c.appendChild(qMcq(a)); return c; };
R['true-false'] = (a, i) => { const c = activityCard(a, i); c.appendChild(qTf(a)); return c; };
R['gap-fill'] = (a, i) => { const c = activityCard(a, i); c.appendChild(qGap(a)); return c; };
R['matching'] = (a, i) => { const c = activityCard(a, i); c.appendChild(qMatch(a)); return c; };

R['ordering'] = (a, index) => {
  const card = activityCard(a, index);
  card.appendChild(el('p', 'oc-activity-prompt', a.prompt));
  let order = shuffled(a.items);
  if (order.join(' ') === a.items.join(' ')) order = [order[1], order[0], ...order.slice(2)];
  const list = el('ol', 'oc-order');
  let busy = false;
  // The new position after ↑/↓ was silent to assistive tech — announce it (#68).
  const status = el('p', 'oc-word-count');
  status.setAttribute('aria-live', 'polite');
  function draw() {
    list.textContent = '';
    order.forEach((item, i) => {
      const li = el('li', 'oc-order-item');
      li.appendChild(el('span', 'oc-order-label', item));
      const controls = el('span', 'oc-order-controls');
      const up = el('button', 'oc-btn oc-btn--mini', '↑');
      up.type = 'button';
      up.disabled = busy || i === 0;
      up.setAttribute('aria-label', `move "${item}" up`);
      up.addEventListener('click', () => swap(i - 1, i, item));
      const down = el('button', 'oc-btn oc-btn--mini', '↓');
      down.type = 'button';
      down.disabled = busy || i === order.length - 1;
      down.setAttribute('aria-label', `move "${item}" down`);
      down.addEventListener('click', () => swap(i, i + 1, item));
      controls.appendChild(up);
      controls.appendChild(down);
      li.appendChild(controls);
      list.appendChild(li);
    });
  }
  // FLIP the two rows that just swapped positions (#64): measure their
  // current rects, mutate the order + redraw, then animate from the old
  // position back to identity. Buttons are disabled for the swap's duration
  // so state and DOM can't race further clicks; reduced motion / no
  // `animate` resolves instantly via anim.js's canAnimate no-op.
  async function swap(i, j, movedItem) {
    if (busy || i < 0 || j >= order.length) return;
    const lis = [...list.children];
    const liA = lis[i];
    const liB = lis[j];
    const rectA = liA.getBoundingClientRect();
    const rectB = liB.getBoundingClientRect();
    [order[i], order[j]] = [order[j], order[i]];
    busy = true;
    draw();
    const newLis = [...list.children];
    try {
      await flipSwap(newLis[i], rectB, newLis[j], rectA);
    } finally {
      busy = false;
      draw();
      const newIndex = order.indexOf(movedItem);
      status.textContent = `Moved to position ${newIndex + 1} of ${order.length}`;
    }
  }
  draw();
  card.appendChild(list);
  card.appendChild(status);
  const fb = makeFeedback(card, a, () => a.items.join(' → '));
  card.appendChild(checkButton(() => { order.join(' ') === a.items.join(' ') ? fb.correct() : fb.wrong(); }));
  return card;
};

R['open-response'] = (a, index) => {
  const card = activityCard(a, index);
  card.appendChild(el('p', 'oc-activity-prompt', a.prompt));
  const ta = document.createElement('textarea');
  ta.className = 'oc-open-input';
  ta.rows = 5;
  ta.setAttribute('aria-label', 'your answer');
  card.appendChild(ta);
  const counter = el('p', 'oc-word-count', a.minWords ? `0 words (aim for at least ${a.minWords})` : '0 words');
  card.appendChild(counter);
  let wasMet = false;
  ta.addEventListener('input', () => {
    const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    counter.textContent = a.minWords ? `${words} words (aim for at least ${a.minWords})` : `${words} words`;
    if (a.minWords) {
      const met = words >= a.minWords;
      counter.classList.toggle('oc-word-count--met', met);
      if (met && !wasMet) popTiles([counter]); // celebrate crossing the target (#16)
      wasMet = met;
    }
  });
  if (a.sampleAnswer) {
    const details = el('details', 'oc-sample');
    details.appendChild(el('summary', null, 'Show a model answer'));
    details.appendChild(el('p', null, a.sampleAnswer));
    card.appendChild(details);
  }
  return card;
};

/* --- input types --- */

R['content'] = (a, index) => {
  const card = activityCard(a, index);
  const items = [];
  a.sections.forEach((s) => {
    const h = el('h4', 'oc-content-heading', s.heading);
    card.appendChild(h); items.push(h);
    s.body.split(/\n{2,}/).forEach((para) => { const p = richText(el('p', 'oc-content-body'), para); card.appendChild(p); items.push(p); });
  });
  enterTiles(items); // light staggered entrance (#15)
  return card;
};

R['course-presentation'] = (a, index) => {
  const card = activityCard(a, index);
  let current = 0;
  let busy = false;
  const stage = el('div', 'oc-slide');
  stage.setAttribute('aria-live', 'polite'); // slide changes are announced (#68)
  const dots = el('p', 'oc-word-count');
  async function draw(transition) {
    if (busy) return; // ignore re-entrant calls while an exit/enter is in flight (#54)
    busy = true;
    prev.disabled = true;
    next.disabled = true;
    try {
      if (transition) { const leaving = [...stage.children]; if (leaving.length) await exitTiles(leaving); } // wipe the slide (#13)
      stage.textContent = '';
      const s = a.slides[current];
      if (s.title) stage.appendChild(el('h4', 'oc-content-heading', s.title));
      if (s.body) stage.appendChild(richText(el('p', 'oc-content-body'), s.body));
      if (s.activity) {
        const boxed = el('div', 'oc-qblock oc-slide-check');
        boxed.appendChild(el('p', 'oc-live-example-label', 'Quick check'));
        boxed.appendChild(s.activity.subtype === 'mcq' ? qMcq(s.activity) : qTf(s.activity));
        stage.appendChild(boxed);
      }
      dots.textContent = `Slide ${current + 1} of ${a.slides.length}`;
      if (transition) await enterTiles([...stage.children]); // paint the next slide in (#13)
    } finally {
      busy = false;
      prev.disabled = current === 0;
      next.disabled = current === a.slides.length - 1;
    }
  }
  const prev = el('button', 'oc-btn oc-btn--check', '← Previous');
  prev.type = 'button';
  prev.addEventListener('click', () => { if (busy) return; current -= 1; draw(true); });
  const next = el('button', 'oc-btn oc-btn--check', 'Next →');
  next.type = 'button';
  next.addEventListener('click', () => { if (busy) return; current += 1; draw(true); });
  card.appendChild(stage);
  const row = el('div', 'oc-actions-row');
  row.appendChild(prev);
  row.appendChild(dots);
  row.appendChild(next);
  card.appendChild(row);
  draw();
  return card;
};

R['timeline'] = (a, index) => {
  const card = activityCard(a, index);
  const list = el('ol', 'oc-timeline');
  const items = [];
  a.items.forEach((it) => {
    const li = el('li', 'oc-timeline-item');
    li.appendChild(el('span', 'oc-timeline-date', it.date));
    const body = el('div', 'oc-timeline-body');
    body.appendChild(el('strong', null, it.headline));
    if (it.text) body.appendChild(el('p', 'oc-content-body', it.text));
    li.appendChild(body);
    list.appendChild(li); items.push(li);
  });
  card.appendChild(list);
  enterTiles(items); // staggered entrance down the timeline (#15)
  return card;
};

R['dialogue'] = (a, index) => {
  const card = activityCard(a, index);
  if (a.context) card.appendChild(el('p', 'oc-section-instructions', `📍 ${a.context}`));
  const chat = el('div', 'oc-chat');
  const bubbles = [];
  a.lines.forEach((l) => {
    const bubble = el('div', `oc-bubble oc-bubble--${l.speaker}`);
    bubble.appendChild(el('span', 'oc-bubble-name', l.speaker === 'a' ? a.speakerA : a.speakerB));
    bubble.appendChild(el('span', null, l.text));
    if (l.gloss) bubble.appendChild(el('span', 'oc-bubble-gloss', l.gloss));
    chat.appendChild(bubble); bubbles.push(bubble);
  });
  card.appendChild(chat);
  enterTiles(bubbles); // bubbles arrive one after another (#15)
  const playDialogue = readAloudButton(
    a.lines.map((l) => l.text).join('\n'),
    { lang: currentLang, label: '🔊 Play dialogue' },
  );
  if (playDialogue) card.appendChild(playDialogue);
  return card;
};

/** Split a sentence into word tiles; text wrapped in **bold** is the emphasis
 *  (the changing part). Returns the word-tile nodes for animation. */
function sentenceTiles(stage, sentence) {
  const row = el('div', 'oc-forms-row');
  const tiles = [];
  // Tokens: **emphasised** chunks or runs of non-space; whitespace is a separator.
  const parts = sentence.match(/\*\*[^*]+\*\*|\S+/g) || [];
  for (const part of parts) {
    const emphasised = /^\*\*[^*]+\*\*$/.test(part);
    const text = emphasised ? part.slice(2, -2) : part;
    const tile = el('span', `oc-word-tile${emphasised ? ' oc-word-tile--emph' : ''}`, text);
    tile.dataset.emph = emphasised ? '1' : '0';
    tiles.push(tile);
    row.appendChild(tile);
  }
  stage.appendChild(row);
  return tiles;
}

function formsTabs(card, entries, headline) {
  if (headline) card.appendChild(el('h4', 'oc-content-heading', headline));
  // Tab semantics + arrow-key navigation between tabs (#68).
  const tabs = el('div', 'oc-checks');
  tabs.setAttribute('role', 'tablist');
  if (headline) tabs.setAttribute('aria-label', headline);
  const stageId = nextId('formsstage');
  const stage = el('div', 'oc-forms-stage');
  stage.id = stageId;
  stage.setAttribute('role', 'tabpanel');
  stage.setAttribute('aria-live', 'polite');
  const glossEl = el('p', 'oc-bubble-gloss');
  const buttons = [];
  let currentTiles = [];
  let busy = false;
  let currentIndex = -1;

  function paint(i) {
    stage.textContent = '';
    currentTiles = sentenceTiles(stage, entries[i].sentence);
    glossEl.textContent = entries[i].gloss || '';
    return currentTiles;
  }
  async function show(i, animated) {
    if (busy || i === currentIndex) return;
    busy = true;
    buttons.forEach((b, j) => {
      const active = i === j;
      b.classList.toggle('oc-tab--active', active);
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
    });
    if (animated && currentTiles.length) await exitTiles(currentTiles);
    currentIndex = i;
    const tiles = paint(i);
    if (animated) {
      await enterTiles(tiles);
      popTiles(tiles.filter((t) => t.dataset.emph === '1'));
    }
    busy = false;
  }
  entries.forEach((f, i) => {
    const b = el('button', 'oc-btn oc-btn--check', f.label);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', 'false');
    b.setAttribute('aria-controls', stageId);
    b.tabIndex = -1;
    b.addEventListener('click', () => show(i, true));
    b.addEventListener('keydown', (ev) => {
      // Roving-tabindex arrow-key navigation between tabs (standard tablist pattern).
      let target = null;
      if (ev.key === 'ArrowRight') target = (i + 1) % buttons.length;
      else if (ev.key === 'ArrowLeft') target = (i - 1 + buttons.length) % buttons.length;
      else if (ev.key === 'Home') target = 0;
      else if (ev.key === 'End') target = buttons.length - 1;
      if (target != null) {
        ev.preventDefault();
        buttons[target].focus();
        show(target, true);
      }
    });
    buttons.push(b);
    tabs.appendChild(b);
  });
  card.appendChild(tabs);
  card.appendChild(stage);
  card.appendChild(glossEl);

  const listen = readAloudButton(
    () => entries[currentIndex].sentence.replace(/\*\*/g, ''),
    { lang: currentLang, label: '🔊 Read aloud', onSpeak: () => pulseWave(currentTiles) },
  );
  if (listen) card.appendChild(listen);

  // Initial paint + entrance animation.
  buttons[0].classList.add('oc-tab--active');
  buttons[0].setAttribute('aria-selected', 'true');
  buttons[0].tabIndex = 0;
  currentIndex = 0;
  enterTiles(paint(0)).then(() => popTiles(currentTiles.filter((t) => t.dataset.emph === '1')));
  return { show };
}

R['grammar-forms'] = (a, index) => {
  const card = activityCard(a, index);
  formsTabs(card, a.forms, a.grammar);
  return card;
};

R['tense-shift'] = (a, index) => {
  const card = activityCard(a, index);
  formsTabs(card, a.tenses, a.context ? `${a.verb} — ${a.context}` : a.verb);
  return card;
};

R['word-transform'] = (a, index) => {
  const card = activityCard(a, index);
  card.appendChild(el('h4', 'oc-content-heading', `Base word: ${a.baseWord}`));
  const rows = [];
  a.steps.forEach((s) => {
    const row = el('div', 'oc-morph-row');
    const word = el('span', 'oc-morph-word');
    const tiles = [];
    s.morphemes.forEach((m) => {
      const tile = el('span', `oc-morph oc-morph--${m.role}`, m.text);
      tile.dataset.role = m.role;
      tiles.push(tile);
      word.appendChild(tile);
    });
    row.appendChild(word);
    row.appendChild(el('span', 'oc-badge', s.pos));
    if (s.gloss) row.appendChild(el('span', 'oc-bubble-gloss', s.gloss));
    if (s.example) row.appendChild(el('p', 'oc-content-body', s.example));
    card.appendChild(row);
    rows.push(tiles);
  });
  // Reveal each word family one row at a time on a play button; also on first view.
  const play = el('button', 'oc-btn oc-btn--check oc-tts', '▶ Build the words');
  play.type = 'button';
  const runAll = async () => {
    for (const tiles of rows) await flyInMorphemes(tiles);
  };
  play.addEventListener('click', runAll);
  card.appendChild(play);
  requestAnimationFrame(runAll);
  return card;
};

R['translation-compare'] = (a, index) => {
  const card = activityCard(a, index);
  // Emitted once per activity, not once per pair — with several pairs the
  // same instruction used to print once per pair (#58).
  card.appendChild(el('p', 'oc-word-count', 'Tap a word in the top row — its match and the link light up.'));
  a.pairs.forEach((p) => {
    if (p.headline) card.appendChild(el('h4', 'oc-content-heading', p.headline));
    const wrap = el('div', 'oc-tc');
    // SVG overlay for the connector curves, sized to the wrap after layout.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'oc-tc-svg');
    svg.setAttribute('aria-hidden', 'true');
    wrap.appendChild(svg);
    const srcRow = el('div', 'oc-tc-row');
    const tgtRow = el('div', 'oc-tc-row');
    const tgtEls = p.targetTokens.map((t) => el('span', 'oc-tc-token', t));
    const srcEls = [];
    const paths = [];
    p.sourceTokens.forEach((t, si) => {
      const tok = el('button', 'oc-tc-token oc-tc-token--src', t);
      tok.type = 'button';
      tok.addEventListener('click', () => {
        srcEls.forEach((e2) => e2.classList.remove('oc-tc-token--active'));
        tgtEls.forEach((e2) => e2.classList.remove('oc-tc-token--hit'));
        paths.forEach((pa) => pa.classList.remove('oc-tc-path--active'));
        tok.classList.add('oc-tc-token--active');
        p.links.filter((l) => l.s === si).forEach((l) => {
          tgtEls[l.t].classList.add('oc-tc-token--hit');
          const path = paths.find((pa) => pa.dataset.s === String(l.s) && pa.dataset.t === String(l.t));
          if (path) path.classList.add('oc-tc-path--active');
        });
      });
      srcEls.push(tok);
      srcRow.appendChild(tok);
    });
    tgtEls.forEach((e2) => tgtRow.appendChild(e2));
    wrap.appendChild(srcRow);
    wrap.appendChild(tgtRow);
    card.appendChild(wrap);
    p.links.filter((l) => l.note).forEach((l) => {
      card.appendChild(el('p', 'oc-bubble-gloss', `⚠ ${p.sourceTokens[l.s]} → ${p.targetTokens[l.t]}: ${l.note}`));
    });

    // Draw the connector curves once the tokens have a measured position.
    let layoutTries = 0;
    function layoutPaths() {
      // Stop once the node is detached (e.g. React unmounted the worksheet) —
      // no wasted retries and, with the ResizeObserver below, no leaked work.
      if (!wrap.isConnected) return;
      const box = wrap.getBoundingClientRect();
      if (!box.width) {
        // Retry with setTimeout too, so a throttled rAF can't stop us measuring.
        if (layoutTries++ < 30) setTimeout(layoutPaths, 60);
        return;
      }
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      svg.style.width = `${box.width}px`;
      svg.style.height = `${box.height}px`;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      paths.length = 0;
      const center = (node, atBottom) => {
        const r = node.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: (atBottom ? r.top : r.bottom) - box.top };
      };
      p.links.forEach((l) => {
        const from = center(srcEls[l.s], false);
        const to = center(tgtEls[l.t], true);
        const midY = (from.y + to.y) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`);
        path.setAttribute('class', 'oc-tc-path' + (l.note ? ' oc-tc-path--note' : ''));
        path.dataset.s = String(l.s);
        path.dataset.t = String(l.t);
        svg.appendChild(path);
        paths.push(path);
      });
      drawPaths(paths);
    }
    requestAnimationFrame(layoutPaths);
    setTimeout(layoutPaths, 80);
    // Re-layout on size changes via a ResizeObserver on the wrap itself, NOT a
    // window 'resize' listener: the observer stops firing (and is GC'd) once the
    // node is detached, so re-mounting from React can't leak a growing pile of
    // stale global listeners (#7). It also catches container resizes a window
    // listener would miss.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => { layoutTries = 0; requestAnimationFrame(layoutPaths); });
      ro.observe(wrap);
    }
  });
  return card;
};

/* --- vocabulary --- */

R['flashdeck'] = (a, index) => {
  const card = activityCard(a, index);
  let current = 0;
  let showBack = false;
  let busy = false;
  const face = el('button', 'oc-flashcard');
  face.type = 'button';
  face.setAttribute('aria-live', 'polite'); // the face swap mid-flip was silent (#68)
  const counter = el('p', 'oc-word-count');
  async function doFlip(mutate) {
    // Serialise flips: a click landing mid-animation used to desync showBack
    // from the visible face (#67) — busy guards the whole flip like formsTabs.
    if (busy) return;
    busy = true;
    mutate();
    try { await flipCard(face, draw); } finally { busy = false; }
  }
  function draw() {
    const c = a.cards[current];
    face.textContent = '';
    if (!showBack) {
      if (c.emoji) face.appendChild(el('span', 'oc-flash-emoji', c.emoji));
      face.appendChild(el('span', 'oc-flash-front', c.front));
      if (c.pronunciation) face.appendChild(el('span', 'oc-bubble-gloss', `/${c.pronunciation}/`));
      face.appendChild(el('span', 'oc-word-count', 'tap to flip'));
      face.setAttribute('aria-label', `front: ${c.front}`);
    } else {
      face.appendChild(el('span', 'oc-flash-front', c.back));
      if (c.example) face.appendChild(el('span', 'oc-bubble-gloss', c.example));
      face.setAttribute('aria-label', `back: ${c.back}`);
    }
    counter.textContent = `Card ${current + 1} of ${a.cards.length}`;
  }
  // Flip the card face-over on tap; swap content at the edge-on midpoint (#11).
  face.addEventListener('click', () => doFlip(() => { showBack = !showBack; }));
  card.appendChild(face);
  const row = el('div', 'oc-actions-row');
  const prev = el('button', 'oc-btn oc-btn--check', '←');
  prev.type = 'button';
  prev.addEventListener('click', () => doFlip(() => { current = (current - 1 + a.cards.length) % a.cards.length; showBack = false; }));
  const next = el('button', 'oc-btn oc-btn--check', '→');
  next.type = 'button';
  next.addEventListener('click', () => doFlip(() => { current = (current + 1) % a.cards.length; showBack = false; }));
  row.appendChild(prev);
  row.appendChild(counter);
  const say = readAloudButton(() => a.cards[current].front, { lang: currentLang, label: '🔊 Word' });
  if (say) row.appendChild(say);
  row.appendChild(next);
  card.appendChild(row);
  draw();
  return card;
};

R['memory-game'] = (a, index) => {
  const card = activityCard(a, index);
  const faces = shuffled(a.pairs.flatMap((p) => [
    { key: p.left + ' ' + p.right, text: p.left },
    { key: p.left + ' ' + p.right, text: p.right },
  ]));
  const grid = el('div', 'oc-memory');
  const moves = el('p', 'oc-word-count', 'Moves: 0');
  moves.setAttribute('aria-live', 'polite');
  let open = [];
  let moveCount = 0;
  let matched = 0;
  // Every cell was labelled "?" — indistinguishable to a screen reader (#68).
  // Give each a positional label, kept in sync with its visible state.
  faces.forEach((f, i) => {
    const cell = el('button', 'oc-memory-card', '?');
    cell.type = 'button';
    const position = i + 1;
    const label = (state) => cell.setAttribute('aria-label', `card ${position}, ${state}`);
    label('face down');
    cell.addEventListener('click', () => {
      if (cell.classList.contains('oc-memory-card--done') || open.includes(cell) || open.length === 2) return;
      cell.dataset.key = f.key;
      open.push(cell);
      // Flip the card face-up (#12).
      flipCard(cell, () => {
        cell.textContent = f.text;
        cell.classList.add('oc-memory-card--open');
        label(`showing ${f.text}`);
      });
      if (open.length === 2) {
        moveCount += 1;
        moves.textContent = `Moves: ${moveCount}`;
        const [x, y] = open;
        if (x.dataset.key === y.dataset.key) {
          x.classList.add('oc-memory-card--done');
          y.classList.add('oc-memory-card--done');
          x.setAttribute('aria-label', x.getAttribute('aria-label').replace('showing', 'matched:'));
          y.setAttribute('aria-label', y.getAttribute('aria-label').replace('showing', 'matched:'));
          setTimeout(() => popTiles([x, y]), 320); // pop once the reveal flip settles
          matched += 1;
          open = [];
          if (matched === a.pairs.length) moves.textContent = `Completed in ${moveCount} moves! 🎉`;
        } else {
          const pair = [x, y];
          setTimeout(async () => {
            await shakeTiles(pair);            // signal the miss, then flip both back
            for (const c of pair) flipCard(c, () => {
              c.textContent = '?';
              c.classList.remove('oc-memory-card--open');
            });
            for (const c of pair) c.setAttribute('aria-label', c.getAttribute('aria-label').replace(/showing.*/, 'face down'));
            open = [];
          }, 700);
        }
      }
    });
    grid.appendChild(cell);
  });
  card.appendChild(grid);
  card.appendChild(moves);
  return card;
};

/** Deterministic PRNG so learner grid and answer key always match. */
function mulberry32(seedStr) {
  let h = 1779033703;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Place words into a letter grid (shared with the analog emitter).
 *
 * Deterministic greedy placement: longest words first, first free fit scanning
 * row-major across the three directions (→, ↓, ↘), allowing overlaps only where
 * letters match. Being deterministic, the validator (`wordSearchUnplaced` in
 * validator.js) runs the IDENTICAL placement and rejects any set this can't fully
 * place — so the learner is never shown "find X" for a word that isn't in the
 * grid. `unplaced` lists any words that didn't fit (empty for a valid worksheet).
 */
export function buildWordSearch(words, gridSize) {
  const size = gridSize ?? 12;
  const rnd = mulberry32(words.join('|') + size);
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placed = [];
  const unplaced = [];
  const dirs = [[0, 1], [1, 0], [1, 1]];
  const fits = (w, row, col, dr, dc) => {
    if (row + dr * (w.length - 1) >= size || col + dc * (w.length - 1) >= size) return false;
    for (let i = 0; i < w.length; i++) {
      const cell = grid[row + dr * i][col + dc * i];
      if (cell && cell !== w[i]) return false;
    }
    return true;
  };
  for (const raw of [...words].sort((x, y) => y.trim().length - x.trim().length)) {
    const w = raw.trim().toUpperCase();
    let done = false;
    for (const [dr, dc] of dirs) {
      for (let row = 0; row < size && !done; row++) {
        for (let col = 0; col < size && !done; col++) {
          if (fits(w, row, col, dr, dc)) {
            for (let i = 0; i < w.length; i++) grid[row + dr * i][col + dc * i] = w[i];
            placed.push({ word: raw, row, col, dr, dc });
            done = true;
          }
        }
      }
      if (done) break;
    }
    if (!done) unplaced.push(raw);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(rnd() * 26)];
  }
  return { grid, placed, unplaced, size };
}

R['word-search'] = (a, index) => {
  const card = activityCard(a, index);
  const { grid, placed, size } = buildWordSearch(a.words, a.gridSize);
  const table = el('div', 'oc-ws');
  table.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  const cells = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const cell = el('button', 'oc-ws-cell', grid[r][c]);
    cell.type = 'button';
    cell.dataset.r = r;
    cell.dataset.c = c;
    cells.push(cell);
    table.appendChild(cell);
  }
  card.appendChild(table);
  // List only words actually hidden in the grid. A valid worksheet places every
  // word (the validator enforces it), so this equals a.words; it's defensive so
  // the learner is never asked to find a word that isn't there.
  const placedWords = placed.map((p) => p.word);
  const listEl = el('p', 'oc-word-count', 'Find: ' + placedWords.join(', '));
  card.appendChild(listEl);
  // The two-tap selection model is invisible to assistive tech — announce
  // each step (#68): which letter was picked as the start, and the result
  // of completing a selection.
  const status = el('p', 'oc-feedback');
  status.setAttribute('aria-live', 'polite');
  const found = new Set();
  let start = null;
  function cellAt(r, c) { return cells[r * size + c]; }
  table.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.oc-ws-cell');
    if (!cell) return;
    if (!start) {
      start = cell;
      cell.classList.add('oc-ws-cell--sel');
      status.textContent = `Start letter selected: ${cell.textContent}, row ${+cell.dataset.r + 1} column ${+cell.dataset.c + 1}`;
      return;
    }
    const r0 = +start.dataset.r; const c0 = +start.dataset.c;
    const r1 = +cell.dataset.r; const c1 = +cell.dataset.c;
    start.classList.remove('oc-ws-cell--sel');
    start = null;
    const dr = Math.sign(r1 - r0); const dc = Math.sign(c1 - c0);
    const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
    if (!(dr === 0 || dc === 0 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) { status.textContent = 'Not a straight line — try again.'; return; }
    let word = '';
    const lineCells = [];
    for (let i = 0; i < len; i++) {
      const rc = cellAt(r0 + dr * i, c0 + dc * i);
      if (!rc) return;
      word += rc.textContent;
      lineCells.push(rc);
    }
    const hit = placed.find((p) => {
      const w = p.word.trim().toUpperCase();
      return (w === word || w === [...word].reverse().join('')) && !found.has(p.word);
    });
    if (hit) {
      found.add(hit.word);
      lineCells.forEach((lc) => lc.classList.add('oc-ws-cell--found'));
      popTiles(lineCells); // pulse the found word (#16)
      listEl.textContent = 'Find: ' + placedWords.filter((w) => !found.has(w)).join(', ');
      status.textContent = `Found: ${hit.word}`;
      if (found.size === placed.length) { listEl.textContent = 'All words found! 🎉'; status.textContent = 'All words found!'; }
    } else {
      status.textContent = 'No word there — try again.';
    }
  });
  card.appendChild(el('p', 'oc-word-count', 'Tap the first letter of a word, then its last letter.'));
  card.appendChild(status);
  return card;
};

/* Audio exercises (dictation, listen-mcq) are out of scope until a
   high-quality browser TTS lands — see EnsinoLibre/core#2. */

/* --- practice sets --- */

R['quiz'] = (a, index) => {
  const card = activityCard(a, index);
  const track = scoreTracker(card, a.questions.length, a.passMark);
  const blocks = a.questions.map((q) => qMcq(q, { onResolve: track }));
  blocks.forEach((b) => card.appendChild(b));
  enterTiles(blocks, { stagger: clampedStagger(blocks.length) }); // #66
  return card;
};

R['single-choice-set'] = (a, index) => {
  const card = activityCard(a, index);
  const stage = el('div');
  stage.setAttribute('aria-live', 'polite'); // question swaps are announced (#68)
  card.appendChild(stage);
  const track = scoreTracker(card, a.questions.length);
  let current = 0;
  async function draw() {
    // Exit the leaving question, then paint + enter the next one (short
    // stagger keeps the rapid-fire feel) — was an instant textContent swap
    // unlike course-presentation/lesson (#65).
    const leaving = [...stage.children];
    if (leaving.length) await exitTiles(leaving, { stagger: 20 });
    if (!stage.isConnected) return; // unmounted mid-exit (e.g. React re-render)
    stage.textContent = '';
    if (current >= a.questions.length) { stage.appendChild(el('p', 'oc-feedback--correct oc-feedback', 'Set complete!')); await enterTiles([...stage.children]); return; }
    stage.appendChild(el('p', 'oc-word-count', `Question ${current + 1} of ${a.questions.length} — first instinct!`));
    stage.appendChild(qMcq(a.questions[current], {
      onResolve: (ok, meta) => {
        track(ok, meta);
        current += 1;
        setTimeout(() => { if (stage.isConnected) draw(); }, 800); // guard: don't mutate a detached stage (#65)
      },
    }));
    await enterTiles([...stage.children], { stagger: 20 });
  }
  draw();
  return card;
};

R['question-set'] = (a, index) => {
  const card = activityCard(a, index);
  const track = scoreTracker(card, a.questions.length, a.passMark);
  const blocks = a.questions.map((q) => {
    const fn = { 'mcq': qMcq, 'true-false': qTf, 'gap-fill': qGap }[q.subtype];
    return fn(q, { onResolve: track });
  });
  blocks.forEach((b) => card.appendChild(b));
  enterTiles(blocks, { stagger: clampedStagger(blocks.length) }); // #66
  return card;
};

R['mark-words'] = (a, index) => {
  const card = activityCard(a, index);
  const targets = new Set(a.targets.map((t) => t.trim().toLowerCase()));
  const p = el('p', 'oc-activity-prompt oc-gap-text');
  const wordEls = [];
  for (const token of a.text.split(/(\s+)/)) {
    if (/^\s+$/.test(token) || token === '') { p.appendChild(document.createTextNode(token)); continue; }
    const core = token.match(/[\p{L}'’-]+/u);
    const btn = el('button', 'oc-markword', token);
    btn.type = 'button';
    btn.dataset.word = core ? core[0].toLowerCase() : '';
    btn.addEventListener('click', () => btn.classList.toggle('oc-markword--sel'));
    wordEls.push(btn);
    p.appendChild(btn);
  }
  card.appendChild(p);
  // Every occurrence of a target must be marked — a repeated target ("cat"
  // appearing 3x) only counts as fully found once every instance is tapped,
  // not just one of them (#62).
  const fb = makeFeedback(card, a, () => `every occurrence of: ${a.targets.join(', ')}`);
  card.appendChild(checkButton(() => {
    let hits = 0;
    let misses = 0;
    let falseAlarms = 0;
    let targetOccurrences = 0;
    for (const w of wordEls) {
      const sel = w.classList.contains('oc-markword--sel');
      const isTarget = targets.has(w.dataset.word);
      w.classList.toggle('oc-markword--wrong', sel && !isTarget);
      w.classList.toggle('oc-markword--missed', false); // reset before recheck below
      if (isTarget) {
        targetOccurrences += 1;
        if (sel) hits += 1; else misses += 1;
        w.classList.toggle('oc-markword--missed', !sel);
      } else if (sel) {
        falseAlarms += 1;
      }
    }
    if (misses === 0 && falseAlarms === 0) fb.correct();
    else if (hits === 0 && falseAlarms === 0 && targetOccurrences > 0) fb.neutral('Tap the words in the text first.');
    else fb.wrong();
  }));
  return card;
};

/* --- contextualised --- */

R['reading-comp'] = (a, index) => {
  const card = activityCard(a, index);
  const passage = el('div', 'oc-passage');
  const paras = a.passage.split(/\n{2,}/).map((para) => el('p', null, para));
  paras.forEach((p) => passage.appendChild(p));
  card.appendChild(passage);
  enterTiles(paras, { stagger: clampedStagger(paras.length) }); // #66
  const blocks = a.questions.map((q) => Q_PRIMITIVES[q.type](q));
  blocks.forEach((b) => card.appendChild(b));
  enterTiles(blocks, { stagger: clampedStagger(blocks.length) }); // #66
  return card;
};

/** Strip combining diacritics after NFD-normalising, on top of normLoose's
 *  lowercase/trim/punctuation stripping — an accent-insensitive fallback
 *  tier for "cafe" vs "café" style near-misses (#55). */
export const normAccentless = (s) => normLoose(s).normalize('NFD').replace(/\p{M}/gu, '');

R['translation'] = (a, index) => {
  const card = activityCard(a, index);
  const blocks = a.sentences.map((s, i) => {
    const block = el('div', 'oc-qblock');
    block.appendChild(el('p', 'oc-activity-prompt', `${i + 1}. ${s.source}`));
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'oc-open-input';
    input.setAttribute('aria-label', `translation ${i + 1}`);
    block.appendChild(input);
    const fb = makeFeedback(block, s, () => s.target);
    block.appendChild(checkButton(() => {
      if (!input.value.trim()) return fb.neutral('Write your translation first.');
      const targets = [s.target, ...(s.alternatives || [])];
      const val = normLoose(input.value);
      const exact = targets.some((t) => normLoose(t) === val);
      if (exact) { fb.correct(); return; }
      // Softer tier: accent-insensitive match — correct, but nudge them to
      // mind the diacritics rather than silently accepting it (#55).
      const valAccentless = normAccentless(input.value);
      const nearMatch = targets.some((t) => normAccentless(t) === valAccentless);
      if (nearMatch) { fb.correct(`Watch the accents: ${s.target}`); return; }
      fb.wrong();
    }));
    card.appendChild(block);
    return block;
  });
  enterTiles(blocks, { stagger: clampedStagger(blocks.length) }); // #66
  return card;
};

R['scenario'] = (a, index) => {
  const card = activityCard(a, index);
  const nodes = new Map(a.nodes.map((n) => [n.id, n]));
  const stage = el('div', 'oc-chat');
  stage.setAttribute('aria-live', 'polite'); // new turns/choices are announced (#68)
  card.appendChild(stage);
  // Give choices[].isCorrect a digital meaning (it already drives the analog
  // "Best path" answer key): track whether every marked decision was the best
  // one and say so at the end. Scenarios without isCorrect data stay open-ended.
  let sawBestData = false;
  let tookBestPath = true;
  function show(id) {
    const n = nodes.get(id);
    const bubble = el('div', 'oc-bubble oc-bubble--a');
    bubble.appendChild(el('span', 'oc-bubble-name', n.speaker));
    bubble.appendChild(el('span', null, n.text));
    stage.appendChild(bubble);
    enterTiles([bubble]); // each turn arrives with motion (#13)
    if (n.isEnd) {
      if (n.endMessage) stage.appendChild(el('p', 'oc-feedback oc-feedback--correct', n.endMessage));
      if (sawBestData) {
        stage.appendChild(el('p', tookBestPath ? 'oc-feedback oc-feedback--correct' : 'oc-feedback',
          tookBestPath ? '🌟 You took the best path!' : 'You reached an ending — there was an even better path. Try again?'));
      }
      const again = el('button', 'oc-btn oc-btn--check', '↻ Start again');
      again.type = 'button';
      again.addEventListener('click', () => { stage.textContent = ''; sawBestData = false; tookBestPath = true; show(a.startNode); });
      stage.appendChild(again);
      return;
    }
    const choiceBox = el('div', 'oc-options');
    n.choices.forEach((c) => {
      const btn = el('button', 'oc-option oc-choice-btn', c.text);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (n.choices.some((ch) => ch.isCorrect != null)) {
          sawBestData = true;
          if (!c.isCorrect) tookBestPath = false;
        }
        choiceBox.remove();
        const mine = el('div', 'oc-bubble oc-bubble--b');
        mine.appendChild(el('span', 'oc-bubble-name', 'You'));
        mine.appendChild(el('span', null, c.text));
        stage.appendChild(mine);
        enterTiles([mine]); // the learner's reply slides in too (#13)
        const nextNode = nodes.get(c.nextNode);
        if (nextNode && nextNode.feedback) stage.appendChild(el('p', 'oc-bubble-gloss', nextNode.feedback));
        show(c.nextNode);
      });
      choiceBox.appendChild(btn);
    });
    stage.appendChild(choiceBox);
    enterTiles([...choiceBox.children]); // choices stagger in (#13)
    choiceBox.scrollIntoView({ block: 'nearest' });
  }
  show(a.startNode);
  return card;
};

R['lesson'] = (a, index) => {
  const card = activityCard(a, index);
  const pages = new Map(a.pages.map((p) => [p.id, p]));
  const stage = el('div');
  stage.setAttribute('aria-live', 'polite'); // page swaps are announced (#68)
  card.appendChild(stage);
  async function show(id) {
    const leaving = [...stage.children];
    if (leaving.length) await exitTiles(leaving); // wipe the old page with motion (#13)
    stage.textContent = '';
    if (id == null) { stage.appendChild(el('p', 'oc-feedback oc-feedback--correct', 'Lesson complete! 🎉')); enterTiles([...stage.children]); return; }
    const p = pages.get(id);
    if (p.title) stage.appendChild(el('h4', 'oc-content-heading', p.title));
    if (p.pageType === 'content') {
      if (p.body) p.body.split(/\n{2,}/).forEach((para) => stage.appendChild(richText(el('p', 'oc-content-body'), para)));
      const btn = el('button', 'oc-btn oc-btn--check', 'Continue →');
      btn.type = 'button';
      btn.addEventListener('click', () => show(p.nextPage ?? null));
      stage.appendChild(btn);
    } else {
      stage.appendChild(qMcq(p, { onResolve: (ok) => {
        const btn = el('button', 'oc-btn oc-btn--check', 'Continue →');
        btn.type = 'button';
        btn.addEventListener('click', () => show((ok ? p.onCorrect : p.onWrong) ?? p.onCorrect ?? null));
        stage.appendChild(btn);
      } }));
    }
    enterTiles([...stage.children]); // paint the new page in with motion (#13)
  }
  show(a.startPage);
  return card;
};

R['crossword'] = (a, index) => {
  const card = activityCard(a, index);
  const all = [...a.clues.across.map((c) => ({ ...c, dir: 'across' })), ...a.clues.down.map((c) => ({ ...c, dir: 'down' }))];
  let maxR = 0;
  let maxC = 0;
  const solution = new Map();
  const numbers = new Map();
  for (const c of all) {
    numbers.set(`${c.row},${c.col}`, c.number);
    const L = c.answer.toUpperCase();
    for (let i = 0; i < L.length; i++) {
      const r = c.dir === 'across' ? c.row : c.row + i;
      const cc = c.dir === 'across' ? c.col + i : c.col;
      solution.set(`${r},${cc}`, L[i]);
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, cc);
    }
  }
  const grid = el('div', 'oc-ws oc-cw');
  grid.style.gridTemplateColumns = `repeat(${maxC + 1}, 1fr)`;
  const inputs = new Map();
  // Arrow-key navigation + auto-advance typing (#68): no keyboard flow existed
  // before — every cell was reachable only by Tab, one at a time.
  let dir = 'across';
  const step = () => (dir === 'across' ? [0, 1] : [1, 0]);
  const move = (r, c, dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    const next = inputs.get(`${nr},${nc}`);
    if (next) next.focus();
  };
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const key = `${r},${c}`;
    if (!solution.has(key)) { grid.appendChild(el('span', 'oc-cw-block')); continue; }
    const cell = el('span', 'oc-cw-cell');
    if (numbers.has(key)) cell.appendChild(el('span', 'oc-cw-num', String(numbers.get(key))));
    const input = document.createElement('input');
    input.maxLength = 1;
    input.className = 'oc-cw-input';
    input.setAttribute('aria-label', `crossword cell ${key}`);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); dir = 'across'; move(r, c, 0, 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); dir = 'across'; move(r, c, 0, -1); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); dir = 'down'; move(r, c, 1, 0); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); dir = 'down'; move(r, c, -1, 0); }
      else if (ev.key === 'Backspace' && !input.value) { const [dr, dc] = step(); move(r, c, -dr, -dc); }
    });
    input.addEventListener('input', () => {
      if (!input.value) return;
      const [dr, dc] = step();
      move(r, c, dr, dc); // typing advances to the next cell in the active direction
    });
    inputs.set(key, input);
    cell.appendChild(input);
    grid.appendChild(cell);
  }
  card.appendChild(grid);
  for (const [dir, label] of [['across', 'Across'], ['down', 'Down']]) {
    if (!a.clues[dir].length) continue;
    card.appendChild(el('h4', 'oc-content-heading', label));
    const ol = el('ul', 'oc-content-body');
    a.clues[dir].forEach((c) => ol.appendChild(el('li', null, `${c.number}. ${c.clue} (${c.answer.length})`)));
    card.appendChild(ol);
  }
  const fb = makeFeedback(card, a, () => all.map((c) => `${c.number} ${c.dir}: ${c.answer}`).join('; '));
  card.appendChild(checkButton(() => {
    let filled = true;
    let right = true;
    for (const [key, input] of inputs) {
      const val = input.value.trim().toUpperCase();
      if (!val) filled = false;
      const ok = val === solution.get(key);
      input.classList.toggle('oc-gap-input--wrong', Boolean(val) && !ok);
      if (!ok) right = false;
    }
    if (!filled) return fb.neutral('Fill in the whole grid first (every white cell).');
    right ? fb.correct() : fb.wrong();
  }));
  return card;
};

R['image-hotspot'] = (a, index) => {
  const card = activityCard(a, index);
  const frame = el('div', 'oc-hotspot-frame');
  const img = document.createElement('img');
  img.alt = a.instruction || 'scene';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
  img.className = 'oc-hotspot-img';
  frame.appendChild(img);
  const info = el('p', 'oc-feedback');
  info.setAttribute('aria-live', 'polite'); // hotspot info wasn't announced (#68)
  a.hotspots.forEach((h, i) => {
    const dot = el('button', 'oc-hotspot-dot', String(i + 1));
    dot.type = 'button';
    dot.style.left = `${h.x}%`;
    dot.style.top = `${h.y}%`;
    dot.setAttribute('aria-label', `hotspot ${i + 1}`);
    dot.addEventListener('click', () => {
      info.className = 'oc-feedback oc-feedback--correct';
      info.textContent = `${i + 1}: ${h.label}` + (h.description ? ` — ${h.description}` : '');
      popTiles([dot]); // pulse the tapped hotspot (#16)
    });
    frame.appendChild(dot);
  });
  card.appendChild(frame);
  card.appendChild(info);
  return card;
};

/* --- checks & forms --- */

R['summary'] = (a, index) => {
  const card = activityCard(a, index);
  if (a.intro) card.appendChild(el('p', 'oc-content-body', a.intro));
  const boxes = [];
  const list = el('div', 'oc-options');
  a.statements.forEach((s) => {
    const label = el('label', 'oc-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    label.appendChild(input);
    label.appendChild(el('span', null, s.text));
    boxes.push({ input, s, label });
    list.appendChild(label);
  });
  card.appendChild(list);
  const fb = makeFeedback(card, a, () => a.statements.filter((s) => s.correct).map((s) => s.text).join(' · '));
  // Per-statement explanations appear digitally once the answer is settled
  // (correct or revealed) — previously they only reached the analog answer key.
  let explained = false;
  const explain = () => {
    if (explained) return;
    explained = true;
    for (const { s, label } of boxes) {
      if (s.explanation) label.appendChild(el('span', 'oc-bubble-gloss', s.explanation));
    }
  };
  card.appendChild(checkButton(() => {
    let right = true;
    for (const { input, s, label } of boxes) {
      const ok = input.checked === s.correct;
      label.classList.toggle('oc-option--wrong', !ok);
      if (!ok) right = false;
    }
    right ? fb.correct() : fb.wrong();
    if (right || card.dataset.state === 'revealed') explain();
  }));
  return card;
};

R['survey'] = (a, index) => {
  const card = activityCard(a, index);
  a.items.forEach((it) => {
    const block = el('div', 'oc-qblock');
    block.appendChild(el('p', 'oc-activity-prompt', it.question));
    if (it.itemType === 'scale') {
      const n = it.scale ?? 5;
      const row = el('div', 'oc-options oc-options--row');
      if (it.labels && it.labels[0]) row.appendChild(el('span', 'oc-word-count', it.labels[0]));
      const name = nextId('scale');
      for (let i = 1; i <= n; i++) {
        const label = el('label', 'oc-option');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.addEventListener('change', () => popTiles([label])); // confirm the pick (#16)
        label.appendChild(input);
        label.appendChild(el('span', null, String(i)));
        row.appendChild(label);
      }
      if (it.labels && it.labels[1]) row.appendChild(el('span', 'oc-word-count', it.labels[1]));
      block.appendChild(row);
    } else if (it.itemType === 'choice') {
      const name = nextId('svc');
      const list = el('div', 'oc-options');
      it.options.forEach((o) => {
        const label = el('label', 'oc-option');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.addEventListener('change', () => popTiles([label])); // confirm the pick (#16)
        label.appendChild(input);
        label.appendChild(el('span', null, o));
        list.appendChild(label);
      });
      block.appendChild(list);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'oc-open-input';
      ta.rows = 3;
      ta.setAttribute('aria-label', it.question);
      block.appendChild(ta);
    }
    card.appendChild(block);
  });
  const done = el('p', 'oc-feedback');
  done.setAttribute('aria-live', 'polite'); // confirmation line wasn't announced (#68)
  card.appendChild(checkButton(() => { done.className = 'oc-feedback oc-feedback--correct'; done.textContent = 'Thank you! Your answers are not saved or sent anywhere — share them with your teacher if asked.'; }, 'Done'));
  card.appendChild(done);
  return card;
};

R['poll'] = (a, index) => {
  const card = activityCard(a, index);
  card.appendChild(el('p', 'oc-activity-prompt', a.question));
  const list = el('div', 'oc-options');
  const info = el('p', 'oc-feedback');
  info.setAttribute('aria-live', 'polite'); // confirmation line wasn't announced (#68)
  a.options.forEach((o) => {
    const btn = el('button', 'oc-option oc-choice-btn', o.text);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      [...list.children].forEach((c) => c.classList.remove('oc-option--picked'));
      btn.classList.add('oc-option--picked');
      info.className = 'oc-feedback oc-feedback--correct';
      info.textContent = o.followUp || 'Noted — there are no wrong answers here.';
      popTiles([btn]); // confirm the pick (#16)
    });
    list.appendChild(btn);
  });
  card.appendChild(list);
  card.appendChild(info);
  return card;
};

export const RENDERERS = R;

/**
 * Render a worksheet into a container element (replacing its contents).
 * The worksheet should already have passed validateWorksheet().
 */
export function renderWorksheet(ws, container) {
  warmAnime();
  warmVoices();
  // Read-aloud picks a voice for the worksheet's own language (#2). Renderers
  // are called synchronously below, so a module-level value is enough and the
  // R[type](activity, index) signature stays unchanged.
  currentLang = ws.language || '';
  container.textContent = '';
  const root = el('article', 'oc-worksheet');
  const header = el('header', 'oc-worksheet-header');
  header.appendChild(el('h2', 'oc-worksheet-title', ws.title));
  const meta = el('p', 'oc-worksheet-meta');
  const bits = [ws.subject, ws.topic, ws.audience, ws.estimatedMinutes ? `~${ws.estimatedMinutes} min` : null].filter(Boolean);
  meta.textContent = bits.join(' · ');
  header.appendChild(meta);
  if (ws.instructions) header.appendChild(el('p', 'oc-worksheet-instructions', ws.instructions));
  root.appendChild(header);

  let counter = 0;
  ws.sections.forEach((section) => {
    const sec = el('section', 'oc-section');
    sec.appendChild(el('h3', 'oc-section-title', section.title));
    if (section.instructions) sec.appendChild(el('p', 'oc-section-instructions', section.instructions));
    section.activities.forEach((a) => {
      counter += 1;
      // Isolate each activity: a throwing renderer (a bug, or a validator blind
      // spot) must not blank the rest of the worksheet for the student (#69).
      try {
        sec.appendChild(R[a.type](a, counter));
      } catch (err) {
        console.error(`renderWorksheet: activity ${counter} (${a.type}) failed to render`, err);
        const fallback = activityCard(a, counter);
        const msg = el('p', 'oc-feedback oc-feedback--wrong', "This activity couldn't be displayed.");
        msg.setAttribute('aria-live', 'polite');
        fallback.appendChild(msg);
        sec.appendChild(fallback);
      }
    });
    root.appendChild(sec);
  });
  container.appendChild(root);
  return root;
}
