/**
 * EnsinoLibre — worksheet validator (schema v2).
 *
 * v2 extends the original six types to the full EnsinoLibre component
 * catalogue (see context/ in the repo). Each type has a
 * validate function returning human-readable problems. The authoritative
 * contract remains schema/worksheet.schema.json; the Node test suite
 * checks both agree on every example.
 *
 * Pure module: no DOM, no globals — importable from Node for testing.
 */

const GAP_RE = /\{\{([^{}]+)\}\}/g;
// #61: at least one **bold** span — the changing chunk grammar-forms/
// tense-shift sentences animate (renderer.js sentenceTiles/popTiles).
const EMPHASIS_RE = /\*\*[^*]+\*\*/;

// Crossword grid bounds. row/col feed an O(maxR*maxC) grid build in
// renderer.js / analog.js; without a cap a single clue (e.g. row: 999999) can
// hang the tab. Kept in sync with schema/worksheet.schema.json (crosswordClue).
const CROSSWORD_MAX_COORD = 20;
const CROSSWORD_MAX_ANSWER = 15;

function str(v) { return typeof v === 'string' && v.trim().length > 0; }
function arr(v, min, max) { return Array.isArray(v) && v.length >= min && (max == null || v.length <= max); }
function int(v, min) { return Number.isInteger(v) && v >= (min ?? -Infinity); }

/** Split gap-fill text into alternating literal / gap segments. */
export function parseGaps(text) {
  const segments = [];
  let last = 0;
  let m;
  GAP_RE.lastIndex = 0;
  while ((m = GAP_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) });
    segments.push({ kind: 'gap', answers: m[1].split('|').map((s) => s.trim()).filter(Boolean) });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

/* ---------- per-question primitives (reused by set types) ---------- */

function vMcqCore(a, at, e) {
  if (!str(a.question)) e.push(`${at}: missing "question".`);
  if (!arr(a.options, 2, 6) || !a.options.every(str)) e.push(`${at}: "options" must be 2–6 non-empty strings.`);
  else {
    // #60: two options that only differ by case/whitespace are visually
    // identical to a learner, so picking either the correct index or its
    // look-alike would be indistinguishable — matching already enforces
    // unique "right" values, MCQ-shaped types need the same guarantee.
    const seen = new Set();
    const dupes = new Set();
    for (const o of a.options) {
      const key = o.trim().toLowerCase();
      if (seen.has(key)) dupes.add(o.trim());
      seen.add(key);
    }
    if (dupes.size) e.push(`${at}: "options" has duplicate option(s) (${[...dupes].join(', ')}) — every option must be unique.`);
  }
  if (!int(a.answer, 0) || (Array.isArray(a.options) && a.answer >= a.options.length)) {
    e.push(`${at}: "answer" must be the zero-based index of the correct option.`);
  }
}
function vTfCore(a, at, e) {
  if (!str(a.statement)) e.push(`${at}: missing "statement".`);
  if (typeof a.answer !== 'boolean') e.push(`${at}: "answer" must be true or false.`);
}
// CONTRACTS documents "1–5 gaps" — validator.js is the behavioural source of
// truth (#59), so both bounds are enforced here (and mirrored in the schema
// pattern below). More than 5 gaps makes a gap-fill slow to complete; unlike
// the option-count/survey drifts in #59, more gaps is a real usability
// problem, not just a documentation mismatch, so this is a hard cap.
const GAP_FILL_MAX = 5;
function vGapCore(a, at, e) {
  if (!str(a.text)) { e.push(`${at}: missing "text".`); return; }
  const gapCount = parseGaps(a.text).filter((s) => s.kind === 'gap').length;
  if (gapCount < 1) e.push(`${at}: "text" must contain at least one gap written as {{answer}}.`);
  else if (gapCount > GAP_FILL_MAX) {
    e.push(`${at}: "text" has ${gapCount} gaps — keep gap-fill activities to at most ${GAP_FILL_MAX} gaps so they stay quick to complete.`);
  }
}
/**
 * Which of `words` can't be placed in a size×size grid — the IDENTICAL
 * deterministic greedy placement renderer.js `buildWordSearch` uses (longest
 * first, first free fit scanning row-major across →/↓/↘, overlaps only where
 * letters match). Because it matches the renderer exactly, "validator accepts"
 * guarantees "renderer places every word". Self-contained so the copies of this
 * file stay dependency-free.
 */
function wordSearchUnplaced(words, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const dirs = [[0, 1], [1, 0], [1, 1]];
  const unplaced = [];
  const fits = (w, row, col, dr, dc) => {
    if (row + dr * (w.length - 1) >= size || col + dc * (w.length - 1) >= size) return false;
    for (let i = 0; i < w.length; i++) { const cell = grid[row + dr * i][col + dc * i]; if (cell && cell !== w[i]) return false; }
    return true;
  };
  for (const raw of [...words].sort((x, y) => y.trim().length - x.trim().length)) {
    const w = raw.trim().toUpperCase();
    let done = false;
    for (const [dr, dc] of dirs) {
      for (let row = 0; row < size && !done; row++) for (let col = 0; col < size && !done; col++) {
        if (fits(w, row, col, dr, dc)) { for (let i = 0; i < w.length; i++) grid[row + dr * i][col + dc * i] = w[i]; done = true; }
      }
      if (done) break;
    }
    if (!done) unplaced.push(raw);
  }
  return unplaced;
}

function vPairs(a, at, e, min = 2, max = 8) {
  if (!arr(a.pairs, min, max)) { e.push(`${at}: "pairs" must be ${min}–${max} {left, right} objects.`); return; }
  a.pairs.forEach((p, i) => {
    if (!p || !str(p.left) || !str(p.right)) e.push(`${at}: pair ${i + 1} needs non-empty "left" and "right".`);
  });
  const rights = a.pairs.map((p) => p && p.right);
  if (new Set(rights).size !== rights.length) e.push(`${at}: every "right" value must be unique.`);
}

/* ---------- validator registry ---------- */

const V = {
  /* --- original six (v1, unchanged) --- */
  'mcq': (a, at, e) => vMcqCore(a, at + ' (mcq)', e),
  'true-false': (a, at, e) => vTfCore(a, at + ' (true-false)', e),
  'gap-fill': (a, at, e) => vGapCore(a, at + ' (gap-fill)', e),
  'matching': (a, at, e) => {
    if (!str(a.prompt)) e.push(`${at} (matching): missing "prompt".`);
    vPairs(a, at + ' (matching)', e);
  },
  'ordering': (a, at, e) => {
    if (!str(a.prompt)) e.push(`${at} (ordering): missing "prompt".`);
    if (!arr(a.items, 3, 8) || !a.items.every(str)) e.push(`${at} (ordering): "items" must be 3–8 non-empty strings in the correct order.`);
  },
  'open-response': (a, at, e) => {
    if (!str(a.prompt)) e.push(`${at} (open-response): missing "prompt".`);
    if (a.minWords != null && !int(a.minWords, 1)) e.push(`${at} (open-response): "minWords" must be a positive whole number.`);
  },

  /* --- input types --- */
  'content': (a, at, e) => {
    if (!arr(a.sections, 1)) { e.push(`${at} (content): "sections" must be a non-empty array.`); return; }
    a.sections.forEach((s, i) => {
      if (!s || !str(s.heading) || !str(s.body)) e.push(`${at} (content): section ${i + 1} needs "heading" and "body".`);
    });
  },
  'course-presentation': (a, at, e) => {
    if (!arr(a.slides, 2, 12)) { e.push(`${at} (course-presentation): "slides" must be 2–12 slides.`); return; }
    a.slides.forEach((s, i) => {
      if (!s || (!str(s.title) && !str(s.body))) e.push(`${at} (course-presentation): slide ${i + 1} needs a "title" or "body".`);
      if (s && s.activity != null) {
        const q = s.activity;
        const qt = `${at} (course-presentation): slide ${i + 1} activity`;
        if (q.subtype === 'mcq') vMcqCore(q, qt, e);
        else if (q.subtype === 'true-false') vTfCore(q, qt, e);
        else e.push(`${qt} must have subtype "mcq" or "true-false".`);
      }
    });
  },
  'timeline': (a, at, e) => {
    if (!arr(a.items, 3, 12)) { e.push(`${at} (timeline): "items" must be 3–12 entries.`); return; }
    a.items.forEach((it, i) => {
      if (!it || !str(it.date) || !str(it.headline)) e.push(`${at} (timeline): item ${i + 1} needs "date" and "headline".`);
    });
  },
  'dialogue': (a, at, e) => {
    if (!str(a.speakerA) || !str(a.speakerB)) e.push(`${at} (dialogue): needs "speakerA" and "speakerB" names.`);
    if (!arr(a.lines, 2, 16)) { e.push(`${at} (dialogue): "lines" must be 2–16 entries.`); return; }
    a.lines.forEach((l, i) => {
      if (!l || (l.speaker !== 'a' && l.speaker !== 'b') || !str(l.text)) {
        e.push(`${at} (dialogue): line ${i + 1} needs speaker "a" or "b" and "text".`);
      }
    });
  },
  'grammar-forms': (a, at, e) => {
    if (!str(a.grammar)) e.push(`${at} (grammar-forms): missing "grammar" (the point being taught).`);
    if (!arr(a.forms, 2, 6)) { e.push(`${at} (grammar-forms): "forms" must be 2–6 entries.`); return; }
    a.forms.forEach((f, i) => {
      if (!f || !str(f.label) || !str(f.sentence)) e.push(`${at} (grammar-forms): form ${i + 1} needs "label" and "sentence".`);
      // #61: renderer.js's sentenceTiles/popTiles pipeline animates the
      // **bold** span as the changing chunk — a sentence with none renders as
      // a flat row with a pop animation that fires on zero nodes.
      else if (!EMPHASIS_RE.test(f.sentence)) {
        e.push(`${at} (grammar-forms): form ${i + 1} — wrap the changing words in **double asterisks** so they can be highlighted.`);
      }
    });
  },
  'tense-shift': (a, at, e) => {
    if (!str(a.verb)) e.push(`${at} (tense-shift): missing "verb".`);
    if (!arr(a.tenses, 2, 6)) { e.push(`${at} (tense-shift): "tenses" must be 2–6 entries.`); return; }
    a.tenses.forEach((t, i) => {
      if (!t || !str(t.label) || !str(t.sentence)) e.push(`${at} (tense-shift): tense ${i + 1} needs "label" and "sentence".`);
      else if (!EMPHASIS_RE.test(t.sentence)) {
        e.push(`${at} (tense-shift): tense ${i + 1} — wrap the changing words in **double asterisks** so they can be highlighted.`);
      }
    });
  },
  // #59: renderer.js's word-transform view never reads step.derived (it only
  // builds morpheme tiles + the pos badge) — BUT analog.js's word-transform
  // emitter uses step.derived as the headline word of the printed table
  // (`| ${s.derived} | ${built} | ${s.pos} |`). Since the analog (print/PDF)
  // path is a first-class output of every activity type, "derived" stays
  // required rather than being dropped to match the renderer alone.
  'word-transform': (a, at, e) => {
    if (!str(a.baseWord)) e.push(`${at} (word-transform): missing "baseWord".`);
    if (!arr(a.steps, 2, 8)) { e.push(`${at} (word-transform): "steps" must be 2–8 entries.`); return; }
    a.steps.forEach((s, i) => {
      const st = `${at} (word-transform): step ${i + 1}`;
      if (!s || !str(s.derived) || !str(s.pos)) e.push(`${st} needs "derived" and "pos".`);
      if (!s || !arr(s.morphemes, 1) || !s.morphemes.every((m) => m && str(m.text) && ['prefix', 'root', 'suffix'].includes(m.role))) {
        e.push(`${st}: "morphemes" must be pieces of {text, role: prefix|root|suffix}.`);
      }
    });
  },
  'translation-compare': (a, at, e) => {
    if (!arr(a.pairs, 1, 6)) { e.push(`${at} (translation-compare): "pairs" must be 1–6 entries.`); return; }
    a.pairs.forEach((p, i) => {
      const pt = `${at} (translation-compare): pair ${i + 1}`;
      if (!p || !arr(p.sourceTokens, 2) || !arr(p.targetTokens, 2)) { e.push(`${pt} needs "sourceTokens" and "targetTokens" arrays.`); return; }
      if (!arr(p.links, 1)) { e.push(`${pt} needs a "links" array.`); return; }
      p.links.forEach((l, j) => {
        if (!l || !int(l.s, 0) || !int(l.t, 0) || l.s >= p.sourceTokens.length || l.t >= p.targetTokens.length) {
          e.push(`${pt}: link ${j + 1} has out-of-range "s"/"t" token indices.`);
        }
      });
    });
  },

  /* --- vocabulary --- */
  'flashdeck': (a, at, e) => {
    if (!arr(a.cards, 3, 20)) { e.push(`${at} (flashdeck): "cards" must be 3–20 entries.`); return; }
    a.cards.forEach((c, i) => {
      if (!c || !str(c.front) || !str(c.back)) e.push(`${at} (flashdeck): card ${i + 1} needs "front" and "back".`);
    });
  },
  'memory-game': (a, at, e) => vPairs(a, at + ' (memory-game)', e, 3, 8),
  'word-search': (a, at, e) => {
    if (!arr(a.words, 4, 14)) { e.push(`${at} (word-search): "words" must be 4–14 words.`); return; }
    const size = a.gridSize ?? 12;
    if (a.gridSize != null && (!int(a.gridSize, 6) || a.gridSize > 16)) e.push(`${at} (word-search): "gridSize" must be 6–16.`);
    const before = e.length;
    a.words.forEach((w, i) => {
      if (!str(w) || !/^[\p{L}]+$/u.test(w.trim())) e.push(`${at} (word-search): word ${i + 1} must be letters only (no spaces or hyphens).`);
      else if (w.trim().length > size) e.push(`${at} (word-search): "${w}" is longer than the grid size (${size}).`);
    });
    // Only worth checking collective placement once every word is individually
    // valid — otherwise reject the whole set if they can't all fit the grid
    // (a per-word length check alone doesn't guarantee the SET fits).
    if (e.length === before) {
      const unplaced = wordSearchUnplaced(a.words, size);
      if (unplaced.length) {
        e.push(`${at} (word-search): these words don't all fit a ${size}×${size} grid together — use fewer/shorter words or a larger "gridSize": ${unplaced.join(', ')}.`);
      }
    }
  },

  /* Audio exercises (dictation, listen-mcq) are out of scope until a
     high-quality browser TTS lands — see EnsinoLibre/core#2. */

  /* --- practice sets --- */
  'quiz': (a, at, e) => {
    if (!arr(a.questions, 2, 12)) { e.push(`${at} (quiz): "questions" must be 2–12 items.`); return; }
    a.questions.forEach((q, i) => vMcqCore(q, `${at} (quiz): question ${i + 1}`, e));
    if (a.passMark != null && (!int(a.passMark, 1) || a.passMark > a.questions.length)) {
      e.push(`${at} (quiz): "passMark" must be between 1 and the number of questions.`);
    }
  },
  'single-choice-set': (a, at, e) => {
    if (!arr(a.questions, 3, 12)) { e.push(`${at} (single-choice-set): "questions" must be 3–12 items.`); return; }
    a.questions.forEach((q, i) => vMcqCore(q, `${at} (single-choice-set): question ${i + 1}`, e));
  },
  'question-set': (a, at, e) => {
    if (!arr(a.questions, 2, 12)) { e.push(`${at} (question-set): "questions" must be 2–12 items.`); return; }
    a.questions.forEach((q, i) => {
      const qt = `${at} (question-set): item ${i + 1}`;
      if (!q || !['mcq', 'true-false', 'gap-fill'].includes(q.subtype)) e.push(`${qt} needs subtype "mcq", "true-false" or "gap-fill".`);
      else if (q.subtype === 'mcq') vMcqCore(q, qt, e);
      else if (q.subtype === 'true-false') vTfCore(q, qt, e);
      else vGapCore(q, qt, e);
    });
    // passMark mirrors quiz — the JSON Schema requires a positive integer, and
    // the renderer's scoreTracker does `correct >= passMark` (a non-number
    // silently reads as never-passed), so the two must agree.
    if (a.passMark != null && (!int(a.passMark, 1) || a.passMark > a.questions.length)) {
      e.push(`${at} (question-set): "passMark" must be between 1 and the number of questions.`);
    }
  },
  'mark-words': (a, at, e) => {
    if (!str(a.instruction)) e.push(`${at} (mark-words): "instruction" is required (it states the criterion).`);
    if (!str(a.text)) { e.push(`${at} (mark-words): missing "text".`); return; }
    if (!arr(a.targets, 1)) { e.push(`${at} (mark-words): "targets" must be a non-empty array.`); return; }
    const words = new Set(a.text.toLowerCase().match(/[\p{L}'’-]+/gu) || []);
    a.targets.forEach((t) => {
      if (!str(t) || !words.has(t.trim().toLowerCase())) e.push(`${at} (mark-words): target "${t}" does not appear as a word in the text.`);
    });
  },

  /* --- contextualised --- */
  'reading-comp': (a, at, e) => {
    if (!str(a.passage)) e.push(`${at} (reading-comp): missing "passage".`);
    if (!arr(a.questions, 1, 10)) { e.push(`${at} (reading-comp): "questions" must be 1–10 items.`); return; }
    a.questions.forEach((q, i) => {
      const qt = `${at} (reading-comp): question ${i + 1}`;
      if (!q || !['mcq', 'true-false', 'gap-fill', 'matching'].includes(q.type)) {
        e.push(`${qt} must carry "type": mcq, true-false, gap-fill or matching (a question without a type renders blank).`);
      } else V[q.type](q, qt, e);
    });
  },
  'translation': (a, at, e) => {
    if (!arr(a.sentences, 1, 10)) { e.push(`${at} (translation): "sentences" must be 1–10 entries.`); return; }
    a.sentences.forEach((s, i) => {
      if (!s || !str(s.source) || !str(s.target)) e.push(`${at} (translation): sentence ${i + 1} needs "source" and "target".`);
    });
  },
  'scenario': (a, at, e) => {
    if (!str(a.startNode)) e.push(`${at} (scenario): missing "startNode".`);
    if (!arr(a.nodes, 2, 20)) { e.push(`${at} (scenario): "nodes" must be 2–20 nodes (aim for 5–10).`); return; }
    const ids = new Map(a.nodes.map((n) => [n && n.id, n]));
    if (!ids.has(a.startNode)) e.push(`${at} (scenario): startNode "${a.startNode}" is not a node id.`);
    let endSeen = false;
    a.nodes.forEach((n, i) => {
      const nt = `${at} (scenario): node ${i + 1}`;
      if (!n || !str(n.id) || !str(n.speaker) || !str(n.text)) { e.push(`${nt} needs "id", "speaker" and "text".`); return; }
      if (n.isEnd) { endSeen = true; return; }
      if (!arr(n.choices, 1)) { e.push(`${nt} ("${n.id}") needs "choices" or "isEnd": true.`); return; }
      n.choices.forEach((c, j) => {
        if (!c || !str(c.text) || !str(c.nextNode)) e.push(`${nt}: choice ${j + 1} needs "text" and "nextNode".`);
        else if (!ids.has(c.nextNode)) e.push(`${nt}: choice ${j + 1} points to unknown node "${c.nextNode}".`);
      });
    });
    if (!endSeen) e.push(`${at} (scenario): at least one node must have "isEnd": true.`);
  },
  'lesson': (a, at, e) => {
    if (!str(a.startPage)) e.push(`${at} (lesson): missing "startPage".`);
    if (!arr(a.pages, 2, 20)) { e.push(`${at} (lesson): "pages" must be 2–20 pages (aim for 4–8).`); return; }
    const ids = new Set(a.pages.map((p) => p && p.id));
    if (!ids.has(a.startPage)) e.push(`${at} (lesson): startPage "${a.startPage}" is not a page id.`);
    const ref = (id, where) => { if (id != null && !ids.has(id)) e.push(`${where} points to unknown page "${id}".`); };
    a.pages.forEach((p, i) => {
      const pt = `${at} (lesson): page ${i + 1}`;
      if (!p || !str(p.id)) { e.push(`${pt} needs an "id".`); return; }
      if (p.pageType === 'content') {
        if (!str(p.body)) e.push(`${pt} ("${p.id}"): content pages need "body".`);
        if (p.nextPage !== null) ref(p.nextPage, `${pt} ("${p.id}") nextPage`);
      } else if (p.pageType === 'question') {
        vMcqCore(p, `${pt} ("${p.id}")`, e);
        ref(p.onCorrect ?? null, `${pt} ("${p.id}") onCorrect`);
        ref(p.onWrong ?? null, `${pt} ("${p.id}") onWrong`);
      } else e.push(`${pt} needs pageType "content" or "question".`);
    });
  },
  'crossword': (a, at, e) => {
    const across = a.clues && Array.isArray(a.clues.across) ? a.clues.across : null;
    const down = a.clues && Array.isArray(a.clues.down) ? a.clues.down : null;
    if (!across || !down || across.length + down.length < 2) {
      e.push(`${at} (crossword): "clues" must have "across" and "down" arrays (2+ words total).`);
      return;
    }
    const grid = new Map();
    const place = (c, dir) => {
      if (!c || !str(c.clue) || !str(c.answer) || !int(c.row, 0) || !int(c.col, 0) || !int(c.number, 1)) {
        e.push(`${at} (crossword): every clue needs number, clue, answer, row, col.`);
        return;
      }
      // Bound the grid: row/col drive an O(maxR*maxC) DOM/Markdown grid build in
      // the renderer and analog emitter, so an unbounded value can freeze the tab.
      if (c.row > CROSSWORD_MAX_COORD || c.col > CROSSWORD_MAX_COORD) {
        e.push(`${at} (crossword): row/col must be between 0 and ${CROSSWORD_MAX_COORD}.`);
        return;
      }
      if (c.answer.length > CROSSWORD_MAX_ANSWER) {
        e.push(`${at} (crossword): answer "${c.answer}" is too long (max ${CROSSWORD_MAX_ANSWER} letters).`);
        return;
      }
      if (!/^[\p{L}]+$/u.test(c.answer)) { e.push(`${at} (crossword): answer "${c.answer}" must be letters only.`); return; }
      const letters = c.answer.toUpperCase();
      for (let i = 0; i < letters.length; i++) {
        const key = dir === 'across' ? `${c.row},${c.col + i}` : `${c.row + i},${c.col}`;
        const existing = grid.get(key);
        if (existing && existing !== letters[i]) {
          e.push(`${at} (crossword): "${c.answer}" clashes at cell (${key}) — crossing words must share the same letter.`);
          return;
        }
        grid.set(key, letters[i]);
      }
    };
    across.forEach((c) => place(c, 'across'));
    down.forEach((c) => place(c, 'down'));
  },
  'image-hotspot': (a, at, e) => {
    if (!str(a.svg)) e.push(`${at} (image-hotspot): "svg" (a self-contained inline SVG scene) is required — external image paths are not allowed.`);
    else if (!/^\s*<svg[\s>]/i.test(a.svg)) e.push(`${at} (image-hotspot): "svg" must start with an <svg> tag.`);
    else if (/<script|on\w+\s*=|href\s*=/i.test(a.svg)) e.push(`${at} (image-hotspot): "svg" must not contain scripts, event handlers or links.`);
    if (!arr(a.hotspots, 2, 10)) { e.push(`${at} (image-hotspot): "hotspots" must be 2–10 entries.`); return; }
    a.hotspots.forEach((h, i) => {
      if (!h || !str(h.label) || typeof h.x !== 'number' || typeof h.y !== 'number' || h.x < 0 || h.x > 100 || h.y < 0 || h.y > 100) {
        e.push(`${at} (image-hotspot): hotspot ${i + 1} needs "label" and percentage "x"/"y" (0–100).`);
      }
    });
  },

  /* --- checks & forms --- */
  'summary': (a, at, e) => {
    if (!arr(a.statements, 4, 12)) { e.push(`${at} (summary): "statements" must be 4–12 entries.`); return; }
    a.statements.forEach((s, i) => {
      if (!s || !str(s.text) || typeof s.correct !== 'boolean') e.push(`${at} (summary): statement ${i + 1} needs "text" and boolean "correct".`);
    });
    if (!a.statements.some((s) => s && s.correct === true)) e.push(`${at} (summary): at least one statement must be correct.`);
  },
  'survey': (a, at, e) => {
    if (!arr(a.items, 1, 8)) { e.push(`${at} (survey): "items" must be 1–8 entries.`); return; }
    a.items.forEach((it, i) => {
      const itAt = `${at} (survey): item ${i + 1}`;
      if (!it || !str(it.question)) { e.push(`${itAt} needs a "question".`); return; }
      if (!['scale', 'choice', 'opentext'].includes(it.itemType)) e.push(`${itAt} needs itemType "scale", "choice" or "opentext".`);
      if (it.itemType === 'scale' && it.scale != null && (!int(it.scale, 2) || it.scale > 10)) e.push(`${itAt}: "scale" must be 2–10.`);
      if (it.itemType === 'choice' && (!arr(it.options, 2) || !it.options.every(str))) e.push(`${itAt}: choice items need 2+ "options".`);
    });
  },
  'poll': (a, at, e) => {
    if (!str(a.question)) e.push(`${at} (poll): missing "question".`);
    if (!arr(a.options, 2, 5)) { e.push(`${at} (poll): "options" must be 2–5 entries.`); return; }
    a.options.forEach((o, i) => {
      if (!o || !str(o.text)) e.push(`${at} (poll): option ${i + 1} needs "text".`);
    });
  },
};

export const KNOWN_TYPES = Object.keys(V);

/** @returns {string[]} problems for one activity object */
export function validateActivity(a, at = 'Activity') {
  if (!a || typeof a !== 'object') return [`${at} is not an object.`];
  if (!KNOWN_TYPES.includes(a.type)) {
    return [`${at}: unknown "type" ${JSON.stringify(a.type)} — expected one of ${KNOWN_TYPES.join(', ')}.`];
  }
  const errors = [];
  V[a.type](a, at, errors);
  return errors;
}

/**
 * @param {unknown} ws parsed worksheet JSON
 * @returns {string[]} human-readable problems; empty array means valid
 */
export function validateWorksheet(ws) {
  const errors = [];
  if (!ws || typeof ws !== 'object' || Array.isArray(ws)) {
    return ['The pasted text must be a single JSON object (starting with { and ending with }).'];
  }
  for (const field of ['title', 'subject', 'audience', 'language']) {
    if (!str(ws[field])) errors.push(`Missing or empty "${field}" at the top level.`);
  }
  if (!Array.isArray(ws.sections) || ws.sections.length === 0) {
    errors.push('The worksheet needs a non-empty "sections" array.');
    return errors;
  }
  ws.sections.forEach((section, si) => {
    const where = `Section ${si + 1}`;
    if (!section || typeof section !== 'object') { errors.push(`${where} is not an object.`); return; }
    if (!str(section.title)) errors.push(`${where} is missing a "title".`);
    if (!Array.isArray(section.activities) || section.activities.length === 0) {
      errors.push(`${where} needs a non-empty "activities" array.`);
      return;
    }
    section.activities.forEach((a, ai) => errors.push(...validateActivity(a, `${where}, activity ${ai + 1}`)));
  });
  return errors;
}
