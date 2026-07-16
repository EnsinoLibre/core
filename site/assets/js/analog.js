/**
 * EnsinoLibre — analog (Markdown) emitter.
 *
 * emitAnalog(worksheet) translates a validated worksheet into an
 * Obsidian-ready Markdown document: the learner worksheet first, then an
 * answer-key / teacher page. Every activity type implements its analog
 * strategy from context/ in EnsinoLibre:
 *   direct        — prints as-is (quiz, gap-fill, crossword…)
 *   transform     — digital mechanic → analog equivalent
 *                   (flashdeck → vocabulary table, memory-game → cut-out
 *                   cards, scenario → numbered choose-your-path boxes…)
 *   teacher-audio — audio replaced by a boxed teacher read-aloud script
 *
 * Pure module: no DOM — importable from Node for testing.
 */

import { parseGaps } from './validator.js';
import { buildWordSearch } from './renderer.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const line = (n = 30) => '_'.repeat(n);

/** Deterministic shuffle so learner sheet and answer key always agree. */
function seededShuffle(arr, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Composite numbered markers (small circle + label) into an inline SVG
 * string, purely at the string level (no DOM), then wrap as a Markdown
 * data-URI image. Hotspot x/y are percentages of the scene; they are
 * converted into the SVG's own viewBox coordinate space so the dots land
 * in the right place regardless of the scene's native size.
 */
function svgWithHotspotMarkers(svg, hotspots) {
  const vbMatch = svg.match(/viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
  let minX = 0; let minY = 0; let width = 100; let height = 100;
  if (vbMatch) {
    [minX, minY, width, height] = vbMatch.slice(1, 5).map(Number);
  } else {
    const wMatch = svg.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
    const hMatch = svg.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
    if (wMatch) width = Number(wMatch[1]);
    if (hMatch) height = Number(hMatch[1]);
  }
  const r = Math.max(width, height) * 0.03;
  const dots = hotspots.map((h, i) => {
    const cx = minX + (h.x / 100) * width;
    const cy = minY + (h.y / 100) * height;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e11d48" stroke="#fff" stroke-width="${r * 0.15}"/>` +
      `<text x="${cx}" y="${cy}" font-size="${r * 1.2}" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
  }).join('');
  const markers = `<g>${dots}</g>`;
  return /<\/svg\s*>/i.test(svg) ? svg.replace(/<\/svg\s*>/i, `${markers}</svg>`) : svg + markers;
}

function svgDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function mcqBody(q, n) {
  const opts = q.options.map((o, i) => `   - [ ] ${LETTERS[i].toUpperCase()}. ${o}`).join('\n');
  return `**${n}.** ${q.question}\n\n${opts}`;
}
const mcqKey = (q, n) => `${n}. **${LETTERS[q.answer].toUpperCase()}** — ${q.options[q.answer]}${q.explanation ? ` (${q.explanation})` : ''}`;

function tfBody(q, n) { return `**${n}.** ${q.statement}   **T / F**`; }
const tfKey = (q, n) => `${n}. **${q.answer ? 'True' : 'False'}**${q.explanation ? ` — ${q.explanation}` : ''}`;

function gapBody(q, n) {
  const text = parseGaps(q.text).map((s) => (s.kind === 'text' ? s.value : line(Math.max(8, s.answers[0].length + 4)))).join('');
  return `**${n}.** ${text}`;
}
function gapKey(q, n) {
  const answers = parseGaps(q.text).filter((s) => s.kind === 'gap').map((s) => s.answers.join(' / '));
  return `${n}. ${answers.join(' · ')}${q.explanation ? ` — ${q.explanation}` : ''}`;
}

function matchBody(q, n, seed) {
  const rights = seededShuffle(q.pairs.map((p) => p.right), seed);
  const left = q.pairs.map((p, i) => `${i + 1}. ${p.left}`).join('\n');
  const right = rights.map((r, i) => `${LETTERS[i]}. ${r}`).join('\n');
  return `**${n}.** ${q.prompt || 'Match the items — write the letter next to each number.'}\n\n${left}\n\n${right}`;
}
function matchKey(q, n, seed) {
  const rights = seededShuffle(q.pairs.map((p) => p.right), seed);
  return `${n}. ` + q.pairs.map((p, i) => `${i + 1}-${LETTERS[rights.indexOf(p.right)]}`).join(', ');
}

/* Each emitter returns { body, key } (key may be null). n = activity number. */
const E = {
  'mcq': (a, n) => ({ body: mcqBody(a, n), key: mcqKey(a, n) }),
  'true-false': (a, n) => ({ body: tfBody(a, n), key: tfKey(a, n) }),
  'gap-fill': (a, n) => ({ body: gapBody(a, n), key: gapKey(a, n) }),
  'matching': (a, n) => ({ body: matchBody(a, n, a.prompt || 'm'), key: matchKey(a, n, a.prompt || 'm') }),
  'ordering': (a, n) => {
    const shuffledItems = seededShuffle(a.items, a.prompt);
    const rows = shuffledItems.map((it) => `- [ &nbsp; ] ${it}`).join('\n');
    return {
      body: `**${n}.** ${a.prompt} *(number the items 1–${a.items.length})*\n\n${rows}`,
      key: `${n}. ${a.items.join(' → ')}`,
    };
  },
  'open-response': (a, n) => ({
    body: `**${n}.** ${a.prompt}${a.minWords ? ` *(at least ${a.minWords} words)*` : ''}\n\n${line(60)}\n\n${line(60)}\n\n${line(60)}`,
    key: a.sampleAnswer ? `${n}. Model answer: ${a.sampleAnswer}` : null,
  }),

  'content': (a, n) => ({
    body: a.sections.map((s) => `#### ${s.heading}\n\n${s.body}`).join('\n\n'),
    key: null,
  }),
  'course-presentation': (a, n) => ({
    body: a.slides.map((s, i) => {
      let md = `#### ${s.title || `Part ${i + 1}`}` + (s.body ? `\n\n${s.body}` : '');
      if (s.activity) {
        md += '\n\n> **Quick check:** ' + (s.activity.subtype === 'mcq'
          ? `${s.activity.question}\n> ${s.activity.options.map((o, j) => `${LETTERS[j].toUpperCase()}) ${o}`).join('  ·  ')}`
          : `${s.activity.statement}   **T / F**`);
      }
      return md;
    }).join('\n\n'),
    key: a.slides.filter((s) => s.activity).map((s, i) => {
      const q = s.activity;
      return q.subtype === 'mcq'
        ? `Quick check (“${s.title || 'slide'}”): ${LETTERS[q.answer].toUpperCase()}`
        : `Quick check (“${s.title || 'slide'}”): ${q.answer ? 'True' : 'False'}`;
    }).join('\n') || null,
  }),
  'timeline': (a, n) => ({
    body: `**${n}.** Chronology\n\n| Date | Event | Details |\n|------|-------|---------|\n` +
      a.items.map((it) => `| ${it.date} | ${it.headline} | ${it.text || ''} |`).join('\n'),
    key: null,
  }),
  'dialogue': (a, n) => ({
    body: (a.context ? `*Scene: ${a.context}*\n\n` : '') +
      a.lines.map((l) => `**${l.speaker === 'a' ? a.speakerA : a.speakerB}:** ${l.text}${l.gloss ? `\n  *${l.gloss}*` : ''}`).join('\n\n'),
    key: null,
  }),
  'grammar-forms': (a, n) => ({
    body: `**${n}.** ${a.grammar}\n\n| Form | Sentence |${a.forms.some((f) => f.gloss) ? ' Gloss |' : ''}\n|------|----------|${a.forms.some((f) => f.gloss) ? '-------|' : ''}\n` +
      a.forms.map((f) => `| ${f.label} | ${f.sentence} |${a.forms.some((x) => x.gloss) ? ` ${f.gloss || ''} |` : ''}`).join('\n'),
    key: null,
  }),
  'tense-shift': (a, n) => ({
    body: `**${n}.** ${a.verb}${a.context ? ` — ${a.context}` : ''}\n\n| Tense | Sentence |${a.tenses.some((t) => t.gloss) ? ' Gloss |' : ''}\n|-------|----------|${a.tenses.some((t) => t.gloss) ? '-------|' : ''}\n` +
      a.tenses.map((t) => `| ${t.label} | ${t.sentence} |${a.tenses.some((x) => x.gloss) ? ` ${t.gloss || ''} |` : ''}`).join('\n'),
    key: null,
  }),
  'word-transform': (a, n) => ({
    body: `**${n}.** Word family of **${a.baseWord}**\n\n| Word | Built as | Class |${a.steps.some((s) => s.gloss) ? ' Meaning |' : ''} Example |\n|------|----------|-------|${a.steps.some((s) => s.gloss) ? '---------|' : ''}---------|\n` +
      a.steps.map((s) => {
        const built = s.morphemes.map((m) => (m.role === 'root' ? m.text : `**${m.text}**`)).join(' + ');
        return `| ${s.derived} | ${built} | ${s.pos} |${a.steps.some((x) => x.gloss) ? ` ${s.gloss || ''} |` : ''} ${s.example || ''} |`;
      }).join('\n'),
    key: null,
  }),
  'translation-compare': (a, n) => ({
    body: a.pairs.map((p) => {
      const marks = p.links.map((l, i) => i + 1);
      const src = p.sourceTokens.map((t, i) => {
        const li = p.links.findIndex((l) => l.s === i);
        return li >= 0 ? `${t}⁽${marks[li]}⁾` : t;
      }).join(' ');
      const tgt = p.targetTokens.map((t, i) => {
        const li = p.links.findIndex((l) => l.t === i);
        return li >= 0 ? `${t}⁽${marks[li]}⁾` : t;
      }).join(' ');
      const notes = p.links.filter((l) => l.note).map((l) => `> ⁽${marks[p.links.indexOf(l)]}⁾ ${l.note}`).join('\n');
      return `${p.headline ? `**${p.headline}**\n\n` : ''}> ${src}\n> ${tgt}${notes ? `\n${notes}` : ''}`;
    }).join('\n\n'),
    key: null,
  }),

  'flashdeck': (a, n) => {
    const hasPron = a.cards.some((c) => c.pronunciation);
    const hasEx = a.cards.some((c) => c.example);
    const head = `| # | Word |${hasPron ? ' Pronunciation |' : ''} Meaning |${hasEx ? ' Example |' : ''}`;
    const sep = `|---|------|${hasPron ? '---------------|' : ''}---------|${hasEx ? '---------|' : ''}`;
    const rows = a.cards.map((c, i) =>
      `| ${i + 1} | ${c.emoji ? c.emoji + ' ' : ''}${c.front} |${hasPron ? ` ${c.pronunciation ? `/${c.pronunciation}/` : ''} |` : ''} ${c.back} |${hasEx ? ` ${c.example || ''} |` : ''}`).join('\n');
    return { body: `**${n}.** Vocabulary\n\n${head}\n${sep}\n${rows}`, key: null };
  },
  'memory-game': (a, n) => {
    const cards = seededShuffle(a.pairs.flatMap((p) => [p.left, p.right]), a.pairs[0].left);
    const rows = [];
    for (let i = 0; i < cards.length; i += 4) {
      rows.push('| ' + cards.slice(i, i + 4).map((c) => `✂ ${c}`).join(' | ') + ' |');
      rows.push('|' + '------|'.repeat(Math.min(4, cards.length - i)));
    }
    return {
      body: `**${n}.** Memory game — cut out the cards along the lines, place them face down, and play in pairs: turn over two cards; if they belong together, keep them.\n\n${rows.filter((_, i) => i % 2 === 0 ? true : i === 1).join('\n')}`,
      key: `${n}. Pairs: ` + a.pairs.map((p) => `${p.left} ↔ ${p.right}`).join('; '),
    };
  },
  'word-search': (a, n) => {
    const { grid, placed } = buildWordSearch(a.words, a.gridSize);
    const gridMd = '```\n' + grid.map((row) => row.join(' ')).join('\n') + '\n```';
    return {
      body: `**${n}.** Word search — find these words: ${a.words.join(', ')}\n\n${gridMd}`,
      key: `${n}. ` + placed.map((p) => `${p.word}: row ${p.row + 1}, column ${p.col + 1}, ${p.dr && p.dc ? 'diagonal' : p.dr ? 'down' : 'across'}`).join('; '),
    };
  },

  /* dictation & listen-mcq: out of scope until browser TTS lands (core#2). */

  'quiz': (a, n) => ({
    body: (a.passMark ? `*Pass mark: ${a.passMark} of ${a.questions.length}*\n\n` : '') +
      a.questions.map((q, i) => mcqBody(q, `${n}.${i + 1}`)).join('\n\n'),
    key: a.questions.map((q, i) => mcqKey(q, `${n}.${i + 1}`)).join('\n'),
  }),
  'single-choice-set': (a, n) => ({
    body: `*Work quickly — first instinct.*\n\n` + a.questions.map((q, i) => mcqBody(q, `${n}.${i + 1}`)).join('\n\n'),
    key: a.questions.map((q, i) => mcqKey(q, `${n}.${i + 1}`)).join('\n'),
  }),
  'question-set': (a, n) => ({
    body: a.questions.map((q, i) => {
      const m = `${n}.${i + 1}`;
      return q.subtype === 'mcq' ? mcqBody(q, m) : q.subtype === 'true-false' ? tfBody(q, m) : gapBody(q, m);
    }).join('\n\n'),
    key: a.questions.map((q, i) => {
      const m = `${n}.${i + 1}`;
      return q.subtype === 'mcq' ? mcqKey(q, m) : q.subtype === 'true-false' ? tfKey(q, m) : gapKey(q, m);
    }).join('\n'),
  }),
  'mark-words': (a, n) => ({
    body: `**${n}.** ${a.instruction} *(underline them)*\n\n> ${a.text}`,
    key: `${n}. ${a.targets.join(', ')}`,
  }),

  'reading-comp': (a, n) => {
    const parts = a.questions.map((q, i) => {
      const m = `${n}.${i + 1}`;
      if (q.type === 'mcq') return { b: mcqBody(q, m), k: mcqKey(q, m) };
      if (q.type === 'true-false') return { b: tfBody(q, m), k: tfKey(q, m) };
      if (q.type === 'gap-fill') return { b: gapBody(q, m), k: gapKey(q, m) };
      return { b: matchBody(q, m, q.prompt || String(i)), k: matchKey(q, m, q.prompt || String(i)) };
    });
    return {
      body: `**${n}.** Read the text, then answer the questions.\n\n> ${a.passage.replace(/\n/g, '\n> ')}\n\n` + parts.map((p) => p.b).join('\n\n'),
      key: parts.map((p) => p.k).join('\n'),
    };
  },
  'translation': (a, n) => ({
    body: `**${n}.** Translate each sentence.\n\n` +
      a.sentences.map((s, i) => `${i + 1}. ${s.source}\n\n   ${line(55)}`).join('\n\n'),
    key: `${n}. ` + a.sentences.map((s, i) => `(${i + 1}) ${s.target}${s.alternatives && s.alternatives.length ? ` [also: ${s.alternatives.join(' / ')}]` : ''}`).join(' '),
  }),
  'scenario': (a, n) => {
    const order = seededShuffle(a.nodes.map((x) => x.id), a.startNode);
    // Keep the start node as box 1 so learners know where to begin.
    order.splice(order.indexOf(a.startNode), 1);
    const boxNo = new Map([[a.startNode, 1], ...order.map((id, i) => [id, i + 2])]);
    const boxes = [...a.nodes].sort((x, y) => boxNo.get(x.id) - boxNo.get(y.id)).map((node) => {
      let md = `**Box ${boxNo.get(node.id)}** — *${node.speaker}:* “${node.text}”`;
      if (node.isEnd) md += `\n${node.endMessage ? `> 🏁 ${node.endMessage}` : '> 🏁 The end.'}`;
      else md += '\n' + node.choices.map((c) => `> → If you reply “${c.text}”, go to box ${boxNo.get(c.nextNode)}.`).join('\n');
      return md;
    });
    const best = [];
    let cur = a.startNode;
    const nodesById = new Map(a.nodes.map((x) => [x.id, x]));
    for (let guard = 0; guard < a.nodes.length + 1; guard++) {
      const node = nodesById.get(cur);
      best.push(boxNo.get(cur));
      if (!node || node.isEnd) break;
      const pick = node.choices.find((c) => c.isCorrect) || node.choices[0];
      cur = pick.nextNode;
    }
    return {
      body: `**${n}.** ${a.instruction || 'Choose your path — start at box 1.'}\n\n${boxes.join('\n\n')}`,
      key: `${n}. Best path: box ${best.join(' → box ')}`,
    };
  },
  'lesson': (a, n) => {
    const boxNo = new Map(a.pages.map((p, i) => [p.id, i + 1]));
    const boxes = a.pages.map((p) => {
      let md = `**Box ${boxNo.get(p.id)}**${p.title ? ` — ${p.title}` : ''}`;
      if (p.pageType === 'content') {
        md += `\n${p.body}`;
        md += p.nextPage != null ? `\n> Continue at box ${boxNo.get(p.nextPage)}.` : '\n> 🏁 End of lesson.';
      } else {
        md += `\n${p.question}\n` + p.options.map((o, i) => `> ${LETTERS[i].toUpperCase()}) ${o}`).join('\n');
        md += `\n> Correct → box ${p.onCorrect != null ? boxNo.get(p.onCorrect) : '🏁'}; wrong → box ${p.onWrong != null ? boxNo.get(p.onWrong) : (p.onCorrect != null ? boxNo.get(p.onCorrect) : '🏁')}. Check your answer below before moving on.`;
      }
      return md;
    });
    const key = a.pages.filter((p) => p.pageType === 'question')
      .map((p) => `Box ${boxNo.get(p.id)}: ${LETTERS[p.answer].toUpperCase()}${p.explanation ? ` — ${p.explanation}` : ''}`).join('\n');
    return { body: `**${n}.** Work through the boxes, starting at box ${boxNo.get(a.startPage)}.\n\n${boxes.join('\n\n')}`, key: key || null };
  },
  'crossword': (a, n) => {
    const all = [...a.clues.across.map((c) => ({ ...c, dir: 'across' })), ...a.clues.down.map((c) => ({ ...c, dir: 'down' }))];
    let maxR = 0; let maxC = 0;
    const solution = new Map();
    const startNum = new Map(); // "r,c" -> clue number of the cell where a clue starts
    for (const c of all) {
      const key = `${c.row},${c.col}`;
      if (!startNum.has(key)) startNum.set(key, c.number);
      const L = c.answer.toUpperCase();
      for (let i = 0; i < L.length; i++) {
        const r = c.dir === 'across' ? c.row : c.row + i;
        const cc = c.dir === 'across' ? c.col + i : c.col;
        solution.set(`${r},${cc}`, L[i]);
        maxR = Math.max(maxR, r); maxC = Math.max(maxC, cc);
      }
    }
    const gridLines = [];
    const keyLines = [];
    const legend = []; // for clue numbers too wide to fit inline (>= 10)
    for (let r = 0; r <= maxR; r++) {
      let row = ''; let solved = '';
      for (let c = 0; c <= maxC; c++) {
        const key = `${r},${c}`;
        if (solution.has(key)) {
          const num = startNum.get(key);
          if (num != null && num <= 9) {
            row += `${num} `;
          } else {
            if (num != null) legend.push(`${num} → row ${r + 1}, col ${c + 1}`);
            row += '☐ ';
          }
          solved += solution.get(key) + ' ';
        } else {
          row += '■ ';
          solved += '■ ';
        }
      }
      gridLines.push(row.trimEnd());
      keyLines.push(solved.trimEnd());
    }
    const clues = (dir, label) => a.clues[dir].length
      ? `**${label}**\n` + a.clues[dir].map((c) => `${c.number}. ${c.clue} (${c.answer.length})`).join('\n')
      : '';
    const legendBlock = legend.length ? `\n\n*Clue numbers:* ${legend.join('; ')}` : '';
    return {
      body: `**${n}.** Crossword\n\n\`\`\`\n${gridLines.join('\n')}\n\`\`\`${legendBlock}\n\n${clues('across', 'Across')}\n\n${clues('down', 'Down')}`.trim(),
      key: `${n}.\n\`\`\`\n${keyLines.join('\n')}\n\`\`\``,
    };
  },
  'image-hotspot': (a, n) => {
    const scene = svgWithHotspotMarkers(a.svg, a.hotspots);
    return {
      body: `**${n}.** ${a.instruction || 'Label the picture.'} *(the picture shows numbered markers — write each label next to its number)*\n\n` +
        `![scene](${svgDataUri(scene)})\n\n` +
        a.hotspots.map((h, i) => `${i + 1}. ${line(20)}`).join('\n'),
      key: `${n}. ` + a.hotspots.map((h, i) => `(${i + 1}) ${h.label}`).join(', '),
    };
  },

  'summary': (a, n) => ({
    body: `**${n}.** ${a.intro ? a.intro + '\n\n' : ''}Tick the statements that are true, then copy them below as a summary paragraph.\n\n` +
      a.statements.map((s) => `- [ ] ${s.text}`).join('\n') + `\n\n${line(60)}\n\n${line(60)}`,
    key: `${n}. True statements: ` + a.statements.map((s, i) => s.correct ? i + 1 : null).filter(Boolean).join(', ') +
      '\n' + a.statements.filter((s) => s.explanation).map((s, i) => `- “${s.text}” — ${s.explanation}`).join('\n'),
  }),
  'survey': (a, n) => ({
    body: `**${n}.** Your opinion — there are no wrong answers.\n\n` + a.items.map((it, i) => {
      if (it.itemType === 'scale') {
        const nDots = it.scale ?? 5;
        const dots = Array.from({ length: nDots }, (_, k) => `${k + 1} ◯`).join('   ');
        return `${i + 1}. ${it.question}\n\n   ${it.labels && it.labels[0] ? it.labels[0] + '  ' : ''}${dots}${it.labels && it.labels[1] ? '  ' + it.labels[1] : ''}`;
      }
      if (it.itemType === 'choice') return `${i + 1}. ${it.question}\n\n` + it.options.map((o) => `   - [ ] ${o}`).join('\n');
      return `${i + 1}. ${it.question}\n\n   ${line(55)}\n\n   ${line(55)}`;
    }).join('\n\n'),
    key: null,
  }),
  'poll': (a, n) => ({
    body: `**${n}.** ${a.question} *(tick one — there is no wrong answer)*\n\n` + a.options.map((o) => `- [ ] ${o.text}`).join('\n'),
    key: a.options.some((o) => o.followUp)
      ? `${n}. Guidance per choice:\n` + a.options.filter((o) => o.followUp).map((o) => `- “${o.text}” → ${o.followUp}`).join('\n')
      : null,
  }),
};

export const ANALOG_EMITTERS = E;

/**
 * @param {object} ws validated worksheet
 * @returns {string} complete Markdown document: learner sheet + answer key / teacher page
 */
export function emitAnalog(ws) {
  const bodies = [];
  const keys = [];
  let counter = 0;
  for (const section of ws.sections) {
    bodies.push(`## ${section.title}`);
    if (section.instructions) bodies.push(`*${section.instructions}*`);
    for (const a of section.activities) {
      counter += 1;
      const { body, key } = E[a.type](a, counter);
      if (a.instruction && !body.includes(a.instruction)) bodies.push(`*${a.instruction}*`);
      bodies.push(body);
      if (key) keys.push(key);
    }
  }
  const meta = [ws.subject, ws.topic, ws.audience, ws.estimatedMinutes ? `~${ws.estimatedMinutes} min` : null].filter(Boolean).join(' · ');
  const parts = [
    '---',
    `title: ${ws.title}`,
    `subject: ${ws.subject}`,
    `language: ${ws.language}`,
    'source: EnsinoLibre',
    '---',
    '',
    `# ${ws.title}`,
    '',
    `*${meta}*`,
    '',
    `Name: ${line(25)}   Date: ${line(12)}`,
    '',
  ];
  if (ws.instructions) parts.push(ws.instructions, '');
  parts.push(bodies.join('\n\n'));
  if (keys.length) {
    parts.push('', '---', '', '# Answer key & teacher page', '', keys.join('\n\n'));
  }
  return parts.join('\n');
}
