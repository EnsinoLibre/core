/**
 * Open Curriculum — test suite.
 * Run:  node open-curriculum/tests/run-tests.mjs
 *
 * Covers:
 *  1. JSON Schema (Ajv) validation of every example worksheet — including
 *     the ```worksheet blocks embedded in every docs page.
 *  2. Agreement between the JSON Schema and the lightweight browser validator.
 *  3. prompt-builder: spec validation + prompt content.
 *  4. validator edge cases (bad worksheets must fail, with readable messages).
 *  5. gap parsing.
 *  6. docs integrity: wikilinks resolve, frontmatter present, sidebar slugs exist.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { buildPrompt, validateSpec, ACTIVITY_TYPES, CONTRACTS } = await import(
  new URL('../site/assets/js/prompt-builder.js', import.meta.url)
);
const { validateWorksheet, validateActivity, parseGaps, KNOWN_TYPES } = await import(
  new URL('../site/assets/js/validator.js', import.meta.url)
);
const { RENDERERS, buildWordSearch } = await import(
  new URL('../site/assets/js/renderer.js', import.meta.url)
);
const { ANALOG_EMITTERS, emitAnalog } = await import(
  new URL('../site/assets/js/analog.js', import.meta.url)
);
const { toMoodleXML } = await import(
  new URL('../site/assets/js/exporters.js', import.meta.url)
);

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  const ok = () => { passed += 1; console.log(`  ok    ${name}`); };
  const fail = (e) => {
    failed += 1;
    failures.push({ name, error: e });
    console.error(`  FAIL  ${name}\n        ${e.message}`);
  };
  let result;
  try {
    result = fn();
  } catch (e) {
    fail(e);
    return;
  }
  if (result && typeof result.then === 'function') {
    return result.then(ok, fail);
  }
  ok();
}

/* ---------- setup: schema + gather examples ---------- */

const schema = JSON.parse(await readFile(join(ROOT, 'schema', 'worksheet.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

async function collectDocs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectDocs(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const docFiles = await collectDocs(join(ROOT, 'docs'));
const docTexts = new Map();
for (const f of docFiles) docTexts.set(f, await readFile(f, 'utf8'));

/** Wrap a bare activity into a minimal worksheet (mirror of docs.js toWorksheet).
 *  A full worksheet has "sections" and no "type"; note the content activity
 *  ALSO has "sections", so the "type" check is load-bearing. */
function toWorksheet(parsed) {
  if (parsed.sections && !parsed.type) return parsed;
  return {
    title: 'Live example', subject: 'Example', audience: 'Documentation readers',
    language: 'en-GB', sections: [{ title: 'Try it', activities: [parsed] }],
  };
}

const embedded = [];
for (const [file, text] of docTexts) {
  for (const m of text.matchAll(/```worksheet\r?\n([\s\S]*?)```/g)) {
    embedded.push({ file, json: m[1] });
  }
}

console.log('\n1) Example worksheets validate against the JSON Schema');

const demoText = await readFile(join(ROOT, 'site', 'examples', 'demo-worksheet.json'), 'utf8');
test('demo-worksheet.json is valid JSON + passes the schema', () => {
  const ws = JSON.parse(demoText);
  assert.ok(validateSchema(ws), JSON.stringify(validateSchema.errors, null, 2));
});

test(`docs contain embedded live examples (found ${embedded.length})`, () => {
  assert.ok(embedded.length >= 10, `expected at least 10, found ${embedded.length}`);
});

for (const { file, json } of embedded) {
  const rel = file.slice(ROOT.length + 1);
  test(`embedded example in ${rel} passes the schema`, () => {
    const ws = toWorksheet(JSON.parse(json));
    assert.ok(validateSchema(ws), JSON.stringify(validateSchema.errors, null, 2));
  });
}

console.log('\n2) Browser validator agrees with the JSON Schema on all examples');

for (const { file, json } of embedded) {
  const rel = file.slice(ROOT.length + 1);
  test(`browser validator accepts example in ${rel}`, () => {
    const ws = toWorksheet(JSON.parse(json));
    assert.deepEqual(validateWorksheet(ws), []);
  });
}
test('browser validator accepts demo-worksheet.json', () => {
  assert.deepEqual(validateWorksheet(JSON.parse(demoText)), []);
});

console.log('\n3) Prompt builder');

const goodSpec = {
  subject: 'History', topic: 'The Roman Empire', audience: 'Year 7 pupils',
  language: 'English (UK)', difficulty: 'introductory', activityCount: 8,
  activityTypes: ['mcq', 'gap-fill'], extras: 'focus on daily life',
};

test('validateSpec accepts a complete spec', () => {
  assert.deepEqual(validateSpec(goodSpec), []);
});
test('validateSpec rejects missing required fields', () => {
  const errs = validateSpec({ subject: 'x' });
  assert.ok(errs.some((e) => e.includes('topic')));
  assert.ok(errs.some((e) => e.includes('audience')));
});
test('validateSpec rejects bad count / type / difficulty', () => {
  assert.ok(validateSpec({ ...goodSpec, activityCount: 0 }).length === 1);
  assert.ok(validateSpec({ ...goodSpec, activityTypes: ['karaoke'] }).length === 1);
  assert.ok(validateSpec({ ...goodSpec, difficulty: 'impossible' }).length === 1);
});
test('buildPrompt includes spec fields, rules and format contract', () => {
  const p = buildPrompt(goodSpec);
  for (const needle of [
    'Subject: History', 'Topic: The Roman Empire', 'Audience: Year 7 pupils',
    'focus on daily life', 'Quality rules', 'NEVER quote', 'Return ONLY a single JSON object',
    '"type": "mcq"', 'double curly braces',
  ]) {
    assert.ok(p.includes(needle), `prompt missing: ${needle}`);
  }
});
test('buildPrompt lists only the chosen activity types', () => {
  const p = buildPrompt(goodSpec);
  assert.ok(p.includes('- "mcq"'));
  assert.ok(p.includes('- "gap-fill"'));
  assert.ok(!p.includes('- "matching"'));
});
test('buildPrompt defaults: core types, English (UK), 8 activities', () => {
  const p = buildPrompt({ subject: 'Maths', topic: 'Fractions', audience: 'Year 5' });
  for (const t of ACTIVITY_TYPES.filter((x) => x.group === 'Core')) assert.ok(p.includes(`- "${t.id}"`));
  assert.ok(!p.includes('- "scenario"'), 'non-core types must not appear by default');
  assert.ok(p.includes('English (UK)'));
  assert.ok(p.includes('about 8 activities'));
});
test('prompt embeds contracts only for chosen types', () => {
  const p = buildPrompt({ ...goodSpec, activityTypes: ['flashdeck', 'scenario'] });
  assert.ok(p.includes('"type": "flashdeck"'));
  assert.ok(p.includes('"type": "scenario"'));
  assert.ok(!p.includes('"type": "crossword"'));
});
test('buildPrompt throws on an invalid spec', () => {
  assert.throws(() => buildPrompt({ subject: 'x' }), /Invalid spec/);
});
test('CONTRACTS text agrees with validator/schema limits (#59)', () => {
  // single-choice-set: vMcqCore allows 2–6 options; CONTRACTS used to say 2–3.
  assert.ok(CONTRACTS['single-choice-set'].includes('2–6 options'));
  // survey: validator/schema allow 1–8 items; CONTRACTS used to say "≤6 items".
  assert.ok(CONTRACTS['survey'].includes('1–8 items'));
  // gap-fill: validator now enforces the documented 1–5 gap cap.
  assert.ok(CONTRACTS['gap-fill'].includes('1–5 gaps'));
});

console.log('\n4) Worksheet validator rejects bad input with readable messages');

const validMcq = { type: 'mcq', question: 'Q?', options: ['a', 'b'], answer: 0 };
function ws(activities) {
  return { title: 't', subject: 's', audience: 'a', language: 'en', sections: [{ title: 'sec', activities }] };
}

test('rejects non-object input', () => {
  assert.ok(validateWorksheet('nope').length === 1);
  assert.ok(validateWorksheet([1]).length === 1);
});
test('rejects missing top-level fields', () => {
  const errs = validateWorksheet({ sections: [{ title: 'x', activities: [validMcq] }] });
  assert.equal(errs.length, 4);
});
test('rejects unknown activity type', () => {
  const errs = validateWorksheet(ws([{ type: 'karaoke' }]));
  assert.ok(errs[0].includes('karaoke'));
});
test('rejects mcq with out-of-range answer', () => {
  assert.ok(validateWorksheet(ws([{ ...validMcq, answer: 5 }])).length === 1);
});
test('rejects mcq with duplicate options in validator AND schema (#60)', () => {
  // Case/whitespace-only duplicates are indistinguishable to a learner —
  // validator.js catches these via trim+lowercase; plain JSON Schema
  // uniqueItems can only catch byte-identical duplicates, so it's checked
  // separately with an exact-duplicate case.
  const caseDupe = { type: 'mcq', question: 'Capital of France?', options: ['Paris', ' paris ', 'Rome'], answer: 0 };
  assert.ok(validateActivity(caseDupe).some((e) => /unique/.test(e)), 'validator must reject case/whitespace-only duplicate options');
  const exactDupe = { type: 'mcq', question: 'Capital of France?', options: ['Paris', 'Paris', 'Rome'], answer: 0 };
  assert.ok(validateActivity(exactDupe).some((e) => /unique/.test(e)), 'validator must reject exact-duplicate options');
  assert.ok(!validateSchema(ws([exactDupe])), 'schema must reject exact-duplicate options via uniqueItems');
  const unique = { type: 'mcq', question: 'Capital of France?', options: ['Paris', 'Rome', 'Berlin'], answer: 0 };
  assert.deepEqual(validateActivity(unique), []);
});
test('rejects true-false with string answer', () => {
  assert.ok(validateActivity({ type: 'true-false', statement: 's', answer: 'true' }).length === 1);
});
test('rejects gap-fill without gaps', () => {
  assert.ok(validateActivity({ type: 'gap-fill', text: 'no gaps here' }).length === 1);
});
test('gap-fill: rejects more than 5 gaps in validator AND schema (#59)', () => {
  const many = { type: 'gap-fill', text: '{{a}} {{b}} {{c}} {{d}} {{e}} {{f}}' };
  assert.ok(validateActivity(many).some((e) => /at most 5 gaps/.test(e)), 'validator must reject a 6-gap text');
  assert.ok(!validateSchema(ws([many])), 'schema must reject a 6-gap text');
  const five = { type: 'gap-fill', text: '{{a}} {{b}} {{c}} {{d}} {{e}}' };
  assert.deepEqual(validateActivity(five), []);
  assert.ok(validateSchema(ws([five])), JSON.stringify(validateSchema.errors));
});
test('validator is not stateful across gap-fill calls (regex lastIndex)', () => {
  const a = { type: 'gap-fill', text: 'a {{b}} c' };
  assert.deepEqual(validateActivity(a), []);
  assert.deepEqual(validateActivity(a), []);
  assert.deepEqual(validateActivity(a), []);
});
test('rejects matching with duplicate right values', () => {
  const a = { type: 'matching', prompt: 'p', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'x' }] };
  assert.ok(validateActivity(a).some((e) => e.includes('unique')));
});
test('rejects ordering with fewer than 3 items', () => {
  assert.ok(validateActivity({ type: 'ordering', prompt: 'p', items: ['a', 'b'] }).length === 1);
});
test('grammar-forms/tense-shift: rejects sentences with no **emphasis** span, in validator AND schema (#61)', () => {
  const flatForm = { type: 'grammar-forms', grammar: 'negation', forms: [
    { label: 'Positive', sentence: 'I like tea.' },
    { label: 'Negative', sentence: 'I do not like tea.' },
  ] };
  assert.ok(validateActivity(flatForm).some((e) => /\*\*double asterisks\*\*/.test(e)), 'validator must reject a form sentence with no bold span');
  assert.ok(!validateSchema(ws([flatForm])), 'schema must reject a form sentence with no bold span');
  const boldForm = { type: 'grammar-forms', grammar: 'negation', forms: [
    { label: 'Positive', sentence: 'I **like** tea.' },
    { label: 'Negative', sentence: 'I **do not like** tea.' },
  ] };
  assert.deepEqual(validateActivity(boldForm), []);

  const flatTense = { type: 'tense-shift', verb: 'to work', tenses: [
    { label: 'Present', sentence: 'I work every day.' },
    { label: 'Past', sentence: 'I worked yesterday.' },
  ] };
  assert.ok(validateActivity(flatTense).some((e) => /\*\*double asterisks\*\*/.test(e)), 'validator must reject a tense sentence with no bold span');
  assert.ok(!validateSchema(ws([flatTense])), 'schema must reject a tense sentence with no bold span');
  const boldTense = { type: 'tense-shift', verb: 'to work', tenses: [
    { label: 'Present', sentence: 'I **work** every day.' },
    { label: 'Past', sentence: 'I **worked** yesterday.' },
  ] };
  assert.deepEqual(validateActivity(boldTense), []);
});
test('schema also rejects the same bad cases (spot check)', () => {
  assert.ok(!validateSchema(ws([{ type: 'gap-fill', text: 'no gaps' }])));
  assert.ok(!validateSchema(ws([{ type: 'ordering', prompt: 'p', items: ['a', 'b'] }])));
  assert.ok(!validateSchema({ title: 't', sections: [] }));
});

console.log('\n5) Gap parsing');

test('parseGaps splits text and gaps with alternatives', () => {
  const segs = parseGaps('Water boils at {{100|one hundred}} degrees.');
  assert.deepEqual(segs, [
    { kind: 'text', value: 'Water boils at ' },
    { kind: 'gap', answers: ['100', 'one hundred'] },
    { kind: 'text', value: ' degrees.' },
  ]);
});
test('parseGaps handles adjacent gaps and gap at string edges', () => {
  const segs = parseGaps('{{a}}{{b}}');
  assert.deepEqual(segs, [
    { kind: 'gap', answers: ['a'] },
    { kind: 'gap', answers: ['b'] },
  ]);
});

console.log('\n6) Docs integrity');

const slugs = new Set(
  docFiles.map((f) => f.slice(join(ROOT, 'docs').length + 1).replace(/\\/g, '/').replace(/\.md$/, ''))
);

test('all expected doc pages exist', () => {
  for (const slug of [
    'overview', 'getting-started', 'prompt-template', 'worksheet-schema',
    'rendering-and-embedding', 'obsidian-vault',
    ...KNOWN_TYPES.map((t) => `activities/${t}`),
  ]) {
    assert.ok(slugs.has(slug), `missing docs/${slug}.md`);
  }
});
test('every doc page has YAML frontmatter with a title', () => {
  for (const [file, text] of docTexts) {
    assert.ok(/^---\r?\n[\s\S]*?title:/.test(text), `${file} lacks frontmatter title`);
  }
});
test('every wikilink target resolves to an existing doc page', () => {
  for (const [file, text] of docTexts) {
    for (const m of text.matchAll(/\[\[([^\[\]|]+)(?:\|[^\[\]]+)?\]\]/g)) {
      const target = m[1].trim().replace(/\\$/, '').replace(/\.md$/i, '');
      assert.ok(slugs.has(target), `${file}: broken wikilink [[${m[1]}]]`);
    }
  }
});
test('no hint text appears to quote its own answer (embedded examples)', () => {
  for (const { file, json } of embedded) {
    const wsObj = toWorksheet(JSON.parse(json));
    for (const section of wsObj.sections) {
      for (const a of section.activities) {
        if (!a.hint) continue;
        const hint = a.hint.toLowerCase();
        const answers = [];
        if (a.type === 'mcq') answers.push(a.options[a.answer]);
        if (a.type === 'gap-fill') for (const seg of parseGaps(a.text)) if (seg.kind === 'gap') answers.push(...seg.answers);
        for (const ans of answers) {
          if (ans.length < 3) continue; // short answers like "0" collide with normal prose
          assert.ok(!hint.includes(ans.toLowerCase()), `${file}: hint reveals answer "${ans}"`);
        }
      }
    }
  }
});

console.log('\n7) v2 catalogue coverage — every type wired end to end');

test('validator, renderer, analog emitter and prompt contracts cover the same types', () => {
  const known = [...KNOWN_TYPES].sort();
  assert.deepEqual(Object.keys(RENDERERS).sort(), known, 'renderer registry mismatch');
  assert.deepEqual(Object.keys(ANALOG_EMITTERS).sort(), known, 'analog emitter registry mismatch');
  assert.deepEqual(Object.keys(CONTRACTS).sort(), known, 'prompt contracts mismatch');
  assert.deepEqual(ACTIVITY_TYPES.map((t) => t.id).sort(), known, 'creator form type list mismatch');
});
test('JSON Schema enum matches the validator type list', () => {
  const enumTypes = schema.$defs.activity.properties.type.enum;
  assert.deepEqual([...enumTypes].sort(), [...KNOWN_TYPES].sort());
});
test('every activity type has a live docs example of that exact type', () => {
  const exampleTypes = new Set();
  for (const { json } of embedded) {
    const parsed = JSON.parse(json);
    if (parsed.sections && !parsed.type) parsed.sections.forEach((s) => s.activities.forEach((a) => exampleTypes.add(a.type)));
    else exampleTypes.add(parsed.type);
  }
  for (const t of KNOWN_TYPES) assert.ok(exampleTypes.has(t), `no live docs example for type "${t}"`);
});

console.log('\n8) v2 validators — graph and geometry checks');

test('scenario: rejects a choice pointing at a missing node', () => {
  const a = { type: 'scenario', startNode: 'n1', nodes: [
    { id: 'n1', speaker: 'W', text: 't', choices: [{ text: 'x', nextNode: 'ghost' }] },
    { id: 'n2', speaker: 'W', text: 't', isEnd: true },
  ] };
  assert.ok(validateActivity(a).some((e) => e.includes('ghost')));
});
test('scenario: requires an end node', () => {
  const a = { type: 'scenario', startNode: 'n1', nodes: [
    { id: 'n1', speaker: 'W', text: 't', choices: [{ text: 'x', nextNode: 'n2' }] },
    { id: 'n2', speaker: 'W', text: 't', choices: [{ text: 'y', nextNode: 'n1' }] },
  ] };
  assert.ok(validateActivity(a).some((e) => e.includes('isEnd')));
});
test('lesson: rejects unknown page references', () => {
  const a = { type: 'lesson', startPage: 'p1', pages: [
    { id: 'p1', pageType: 'content', body: 'b', nextPage: 'nowhere' },
    { id: 'p2', pageType: 'content', body: 'b', nextPage: null },
  ] };
  assert.ok(validateActivity(a).some((e) => e.includes('nowhere')));
});
test('scenario: rejects an orphan node unreachable from the start (#53)', () => {
  const a = { type: 'scenario', startNode: 'n1', nodes: [
    { id: 'n1', speaker: 'W', text: 't', choices: [{ text: 'x', nextNode: 'end' }] },
    { id: 'orphan', speaker: 'W', text: 't', isEnd: true },
    { id: 'end', speaker: 'W', text: 't', isEnd: true },
  ] };
  const errs = validateActivity(a);
  assert.ok(errs.some((e) => /node "orphan" can never be reached from the start/.test(e)), JSON.stringify(errs));
});
test('scenario: rejects a cycle with no exit, even when an unrelated isEnd node exists (#53)', () => {
  const a = { type: 'scenario', startNode: 'n1', nodes: [
    { id: 'n1', speaker: 'W', text: 't', choices: [{ text: 'x', nextNode: 'n2' }] },
    { id: 'n2', speaker: 'W', text: 't', choices: [{ text: 'y', nextNode: 'n1' }] },
    { id: 'end', speaker: 'W', text: 't', isEnd: true },
  ] };
  const errs = validateActivity(a);
  assert.ok(errs.some((e) => /node "n1" can never reach an ending/.test(e)), JSON.stringify(errs));
  assert.ok(errs.some((e) => /node "n2" can never reach an ending/.test(e)), JSON.stringify(errs));
});
test('scenario: a well-formed branching graph with every path reaching an end passes (#53)', () => {
  const a = { type: 'scenario', startNode: 'n1', nodes: [
    { id: 'n1', speaker: 'W', text: 't', choices: [{ text: 'a', nextNode: 'n2' }, { text: 'b', nextNode: 'n3' }] },
    { id: 'n2', speaker: 'W', text: 't', choices: [{ text: 'c', nextNode: 'end' }] },
    { id: 'n3', speaker: 'W', text: 't', choices: [{ text: 'd', nextNode: 'end' }] },
    { id: 'end', speaker: 'W', text: 't', isEnd: true },
  ] };
  assert.deepEqual(validateActivity(a), []);
});
test('lesson: rejects an orphan page and a dead-end loop (#53)', () => {
  const orphan = { type: 'lesson', startPage: 'p1', pages: [
    { id: 'p1', pageType: 'content', body: 'b', nextPage: null },
    { id: 'p2', pageType: 'content', body: 'b', nextPage: null },
  ] };
  assert.ok(validateActivity(orphan).some((e) => /page "p2" can never be reached from the start/.test(e)));
  const looped = { type: 'lesson', startPage: 'p1', pages: [
    { id: 'p1', pageType: 'question', question: 'q', options: ['a', 'b'], answer: 0, onCorrect: 'p2', onWrong: 'p2' },
    { id: 'p2', pageType: 'question', question: 'q', options: ['a', 'b'], answer: 0, onCorrect: 'p1', onWrong: 'p1' },
  ] };
  const errs = validateActivity(looped);
  assert.ok(errs.some((e) => /page "p1" can never reach an ending/.test(e)), JSON.stringify(errs));
  assert.ok(errs.some((e) => /page "p2" can never reach an ending/.test(e)), JSON.stringify(errs));
});
test('lesson: a valid content->question->re-teach->rejoin graph passes (#53)', () => {
  const a = { type: 'lesson', startPage: 'p1', pages: [
    { id: 'p1', pageType: 'content', body: 'b', nextPage: 'p2' },
    { id: 'p2', pageType: 'question', question: 'q', options: ['a', 'b'], answer: 0, onCorrect: 'p4', onWrong: 'p3' },
    { id: 'p3', pageType: 'content', body: 're-teach', nextPage: 'p4' },
    { id: 'p4', pageType: 'content', body: 'done', nextPage: null },
  ] };
  assert.deepEqual(validateActivity(a), []);
});
test('crossword: rejects clashing crossings, accepts consistent ones', () => {
  const bad = { type: 'crossword', clues: { across: [{ number: 1, clue: 'c', answer: 'SUN', row: 0, col: 0 }], down: [{ number: 1, clue: 'c', answer: 'MOON', row: 0, col: 0 }] } };
  assert.ok(validateActivity(bad).some((e) => e.includes('clash')));
  const good = { type: 'crossword', clues: { across: [{ number: 1, clue: 'c', answer: 'SUN', row: 0, col: 0 }], down: [{ number: 1, clue: 'c', answer: 'SEA', row: 0, col: 0 }] } };
  assert.deepEqual(validateActivity(good), []);
});
test('crossword: rejects out-of-bounds row/col (renderer freeze guard) in validator AND schema', () => {
  const huge = { type: 'crossword', clues: { across: [{ number: 1, clue: 'c', answer: 'SUN', row: 9999, col: 0 }], down: [{ number: 1, clue: 'c', answer: 'SEA', row: 0, col: 0 }] } };
  assert.ok(validateActivity(huge).some((e) => /row\/col/.test(e)), 'validator must reject row: 9999');
  assert.ok(!validateSchema(ws([huge])), 'JSON Schema must reject row: 9999');
});
test('crossword: rejects an over-long answer in validator AND schema', () => {
  const long = { type: 'crossword', clues: { across: [{ number: 1, clue: 'c', answer: 'A'.repeat(16), row: 0, col: 0 }], down: [{ number: 1, clue: 'c', answer: 'SEA', row: 0, col: 0 }] } };
  assert.ok(validateActivity(long).some((e) => /too long/.test(e)), 'validator must reject a 16-letter answer');
  assert.ok(!validateSchema(ws([long])), 'JSON Schema must reject a 16-letter answer');
});
test('mark-words: rejects targets that are not in the text', () => {
  const a = { type: 'mark-words', instruction: 'i', text: 'the cat sat', targets: ['dog'] };
  assert.ok(validateActivity(a).some((e) => e.includes('dog')));
});
test('image-hotspot: rejects scripts and external references in the svg', () => {
  const a = { type: 'image-hotspot', svg: '<svg onload="x()"></svg>', hotspots: [{ label: 'a', x: 1, y: 1 }, { label: 'b', x: 2, y: 2 }] };
  assert.ok(validateActivity(a).length >= 1);
});
test('reading-comp: rejects questions without a type discriminator', () => {
  const a = { type: 'reading-comp', passage: 'p', questions: [{ question: 'q', options: ['a', 'b'], answer: 0 }] };
  assert.ok(validateActivity(a).some((e) => e.includes('type')));
});
test('question-set: rejects items without a subtype', () => {
  const a = { type: 'question-set', questions: [{ question: 'q', options: ['a', 'b'], answer: 0 }, { subtype: 'true-false', statement: 's', answer: true }] };
  assert.ok(validateActivity(a).some((e) => e.includes('subtype')));
});
test('question-set: rejects a bad passMark in validator AND schema (#6)', () => {
  const items = [{ subtype: 'mcq', question: 'q', options: ['a', 'b'], answer: 0 }, { subtype: 'true-false', statement: 's', answer: true }];
  const bad = { type: 'question-set', questions: items, passMark: 'high' };
  assert.ok(validateActivity(bad).some((e) => /passMark/.test(e)), 'validator must reject passMark: "high"');
  assert.ok(!validateSchema(ws([bad])), 'schema must reject passMark: "high"');
  const tooHigh = { type: 'question-set', questions: items, passMark: 5 };
  assert.ok(validateActivity(tooHigh).some((e) => /passMark/.test(e)), 'validator must reject passMark > question count');
});
test('scenario/lesson: enforce the documented upper bound (#8)', () => {
  const node = (i) => ({ id: `n${i}`, speaker: 'W', text: 't', choices: [{ text: 'x', nextNode: 'end' }] });
  const nodes = [...Array(21)].map((_, i) => node(i + 1)); nodes.push({ id: 'end', speaker: 'W', text: 't', isEnd: true });
  const scenario = { type: 'scenario', startNode: 'n1', nodes };
  assert.ok(validateActivity(scenario).some((e) => /2–20 nodes/.test(e)), 'validator must reject a 22-node scenario');
  assert.ok(!validateSchema(ws([scenario])), 'schema must reject an over-cap scenario');
  const pages = [...Array(21)].map((_, i) => ({ id: `p${i}`, pageType: 'content', body: 'b', nextPage: null }));
  const lesson = { type: 'lesson', startPage: 'p0', pages };
  assert.ok(validateActivity(lesson).some((e) => /2–20 pages/.test(e)), 'validator must reject a 21-page lesson');
  assert.ok(!validateSchema(ws([lesson])), 'schema must reject an over-cap lesson');
});
test('word-search: rejects multi-word entries and too-long words', () => {
  assert.ok(validateActivity({ type: 'word-search', words: ['two words', 'ok', 'fine', 'good'] }).length >= 1);
  assert.ok(validateActivity({ type: 'word-search', words: ['extraordinarily', 'ok', 'fine', 'good'], gridSize: 8 }).length >= 1);
});
test('word-search: rejects a set that cannot all fit the grid together (#5)', () => {
  // Eight 6-letter words fill a 6×6 grid's rows; the rest cannot be placed.
  const words = ['PLANET', 'ROCKET', 'GALAXY', 'METEOR', 'COMETS', 'ORBITS', 'SATURN', 'URANUS'];
  const errs = validateActivity({ type: 'word-search', words, gridSize: 6 });
  assert.ok(errs.some((e) => /fit a 6×6 grid together/.test(e)), 'must reject an overpacked grid: ' + JSON.stringify(errs));
  // And the renderer's builder agrees — some words genuinely don't place.
  assert.ok(buildWordSearch(words, 6).unplaced.length > 0);
});
test('buildWordSearch places every word of an accepted worksheet, deterministically (#5)', () => {
  const words = ['apple', 'pear', 'plum', 'fig', 'grape'];
  assert.deepEqual(validateActivity({ type: 'word-search', words, gridSize: 10 }), []);
  const a = buildWordSearch(words, 10);
  const b = buildWordSearch(words, 10);
  assert.equal(a.placed.length, words.length);
  assert.equal(a.unplaced.length, 0, 'an accepted worksheet must leave nothing unplaced');
  assert.deepEqual(a.grid, b.grid);
});

console.log('\n9) Analog (Markdown) emitter');

const analogWs = {
  title: 'Analog test', subject: 'Science', audience: 'Year 6', language: 'en-GB',
  sections: [{
    title: 'Mixed',
    activities: [
      { type: 'flashdeck', cards: [
        { front: 'sun', back: 'sol', pronunciation: 'sʌn', example: 'The sun is hot.' },
        { front: 'moon', back: 'lua' }, { front: 'star', back: 'estrela' },
      ] },
      { type: 'scenario', startNode: 's1', nodes: [
        { id: 's1', speaker: 'Guide', text: 'Shall we look at the moon or the sun?', choices: [
          { text: 'The moon', nextNode: 's2', isCorrect: true },
        ] },
        { id: 's2', speaker: 'Guide', text: 'Great choice.', isEnd: true, endMessage: 'Done.' },
      ] },
      { type: 'memory-game', pairs: [{ left: 'sun', right: 'sol' }, { left: 'moon', right: 'lua' }, { left: 'star', right: 'estrela' }] },
    ],
  }],
};

test('emitAnalog produces a complete Markdown document', () => {
  assert.deepEqual(validateWorksheet(analogWs), []);
  const md = emitAnalog(analogWs);
  assert.ok(md.startsWith('---\ntitle: "Analog test"'), 'frontmatter');
  assert.ok(md.includes('# Analog test'));
  assert.ok(md.includes('# Answer key & teacher page'));
});
test('flashdeck emits a Markdown vocabulary table', () => {
  const md = emitAnalog(analogWs);
  assert.ok(md.includes('| # | Word | Pronunciation | Meaning | Example |'));
  assert.ok(md.includes('| 1 | sun | /sʌn/ | sol | The sun is hot. |'));
});
test('analog output references no audio files', () => {
  const md = emitAnalog(analogWs);
  assert.ok(!md.toLowerCase().includes('audiofile'));
});
test('scenario emits choose-your-path boxes with a best path', () => {
  const md = emitAnalog(analogWs);
  assert.ok(md.includes('**Box 1**'));
  assert.ok(/go to box \d/.test(md));
  assert.ok(/Best path: box 1 → box \d/.test(md));
});
test('memory game emits a cut-out card sheet with the pair key', () => {
  const md = emitAnalog(analogWs);
  assert.ok(md.includes('✂'));
  assert.ok(md.includes('sun ↔ sol'));
});
test('every embedded docs example emits analog Markdown without throwing', () => {
  for (const { file, json } of embedded) {
    const wsObj = toWorksheet(JSON.parse(json));
    const md = emitAnalog(wsObj);
    assert.ok(md.length > 100, `${file}: empty analog output`);
  }
});
test('crossword: printed grid carries every clue number, so the paper puzzle is solvable (#50)', () => {
  const a = {
    type: 'crossword',
    clues: {
      across: [{ number: 1, clue: 'star of the solar system', answer: 'SUN', row: 0, col: 0 }],
      down: [
        { number: 1, clue: 'not down', answer: 'SEA', row: 0, col: 0 },
        { number: 12, clue: 'high double-digit clue', answer: 'AB', row: 0, col: 5 },
      ],
    },
  };
  assert.deepEqual(validateActivity(a, 0), []);
  const { body, key } = ANALOG_EMITTERS['crossword'](a, 1);
  // Every clue number must appear in the body, and single-digit ones must
  // appear inline inside the grid code block (not just the clue list).
  const gridBlock = body.match(/```\n([\s\S]*?)\n```/)[1];
  assert.ok(/\b1\b/.test(gridBlock), 'clue 1 should be inlined into the grid');
  assert.ok(body.includes('12 → row 1, col 6'), 'clue numbers ≥10 get a coordinates legend');
  assert.ok(body.includes('1. star of the solar system'));
  assert.ok(body.includes('12. high double-digit clue'));
  // Answer-key grid is unaffected — still letters/■ only.
  assert.ok(key.includes('S E A') || key.includes('S U N'), 'answer key grid still shows letters, not clue numbers');
});
test('translation-compare: a token in multiple links keeps every superscript mark (#58)', () => {
  const a = {
    type: 'translation-compare',
    pairs: [{
      sourceTokens: ['the', 'big', 'dog'],
      targetTokens: ['o', 'cão', 'grande'],
      links: [
        { s: 2, t: 1 }, // dog -> cão  (mark 1)
        { s: 1, t: 2 }, // big -> grande (mark 2)
        { s: 2, t: 2, note: 'word order differs' }, // dog also aligns to grande (mark 3)
      ],
    }],
  };
  assert.deepEqual(validateActivity(a, 0), []);
  const { body } = ANALOG_EMITTERS['translation-compare'](a, 1);
  // "dog" participates in links 1 and 3 — both marks must survive.
  assert.ok(body.includes('dog⁽1,3⁾'), `expected both marks on "dog", got: ${body}`);
  assert.ok(body.includes('grande⁽2,3⁾'), `expected both marks on "grande", got: ${body}`);
});
test('emitAnalog escapes hostile YAML frontmatter values (#56)', () => {
  const hostileWs = {
    title: 'Fractions: a "first" look\nwith a newline and a \\backslash',
    subject: 'Maths: intro',
    audience: 'Year 6', language: 'en-GB',
    sections: [{ title: 'Warm-up', activities: [
      { type: 'true-false', statement: '1/2 is a fraction.', answer: true },
    ] }],
  };
  const md = emitAnalog(hostileWs);
  const frontmatter = md.slice(0, md.indexOf('\n---\n', 4) + 5);
  const titleLine = frontmatter.split('\n').find((l) => l.startsWith('title:'));
  assert.ok(titleLine, 'title line present');
  assert.ok(!/\r|\n/.test(titleLine.slice(6)), 'no raw newline in the title value');
  assert.ok(titleLine.startsWith('title: "') && titleLine.endsWith('"'), 'title value is quoted');
  // The YAML value itself must be parseable as valid double-quoted YAML: no
  // unescaped quote or backslash breaks the string early.
  assert.doesNotThrow(() => {
    // crude but sufficient sanity check: every quote inside must be escaped
    const inner = titleLine.slice('title: "'.length, -1);
    assert.ok(!/(^|[^\\])"/.test(inner), 'unescaped double quote inside the value');
  });
});
test('scenario without isCorrect must not emit a false "Best path" claim (#52)', () => {
  const a = {
    type: 'scenario',
    startNode: 's1',
    nodes: [
      { id: 's1', speaker: 'Guide', text: 'Pick one.', choices: [
        { text: 'A', nextNode: 's2' }, { text: 'B', nextNode: 's2' },
      ] },
      { id: 's2', speaker: 'Guide', text: 'Done.', isEnd: true, endMessage: 'Bye.' },
    ],
  };
  assert.deepEqual(validateActivity(a, 0), []);
  const { key } = ANALOG_EMITTERS['scenario'](a, 1);
  assert.ok(!/Best path/.test(key), 'no isCorrect choices anywhere — must not assert a best path');
});
test('scenario with a fully-marked isCorrect path still emits a confident "Best path" (#52)', () => {
  const a = {
    type: 'scenario',
    startNode: 's1',
    nodes: [
      { id: 's1', speaker: 'Guide', text: 'Pick one.', choices: [
        { text: 'A', nextNode: 's2', isCorrect: true }, { text: 'B', nextNode: 's2' },
      ] },
      { id: 's2', speaker: 'Guide', text: 'Done.', isEnd: true, endMessage: 'Bye.' },
    ],
  };
  const { key } = ANALOG_EMITTERS['scenario'](a, 1);
  assert.ok(/Best path/.test(key));
});
test('image-hotspot: analog emits the scene as a data-URI image with one marker per hotspot (#51)', () => {
  const a = {
    type: 'image-hotspot',
    instruction: 'Label the parts.',
    svg: '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="#eee"/></svg>',
    hotspots: [
      { label: 'nose', x: 10, y: 20 },
      { label: 'eye', x: 50, y: 50 },
      { label: 'tail', x: 90, y: 80 },
    ],
  };
  assert.deepEqual(validateActivity(a, 0), []);
  const { body } = ANALOG_EMITTERS['image-hotspot'](a, 1);
  assert.ok(body.includes('data:image/svg+xml'), 'body should embed the scene as a data-URI image');
  const dataUri = body.match(/data:image\/svg\+xml[^)]+/)[0];
  const svg = decodeURIComponent(dataUri.replace(/^data:image\/svg\+xml;utf8,/, ''));
  assert.ok(svg.includes('</svg>'), 'composited SVG must still be well-formed');
  const markerCount = (svg.match(/<circle /g) || []).length;
  assert.equal(markerCount, a.hotspots.length, 'one marker per hotspot');
  const textCount = (svg.match(/<text /g) || []).length;
  assert.equal(textCount, a.hotspots.length, 'one number label per hotspot');
});

console.log('\n9b) Moodle XML exporter');

const moodleWs = {
  title: 'Moodle test', subject: 'Reading', audience: 'Year 6', language: 'en-GB',
  sections: [{
    title: 'Comprehension',
    activities: [{
      type: 'reading-comp',
      passage: 'The sun is a star. It gives us light and heat.',
      questions: [
        { type: 'mcq', question: 'What is the sun?', options: ['A planet', 'A star', 'A moon'], answer: 1 },
        { type: 'true-false', statement: 'The sun gives us light.', answer: true },
        { type: 'gap-fill', text: 'The sun gives us {{light|heat}}.' },
        { type: 'matching', prompt: 'Match the words to their meaning.', pairs: [{ left: 'sun', right: 'a star' }, { left: 'light', right: 'brightness' }] },
      ],
    }],
  }],
};

test('toMoodleXML prepends the reading-comp passage for all four question kinds (#57)', () => {
  assert.deepEqual(validateWorksheet(moodleWs), []);
  const xml = toMoodleXML(moodleWs);
  const passageNeedle = 'The sun is a star. It gives us light and heat.';
  const blocks = xml.split('<question ').slice(1); // one chunk per <question> element
  assert.equal(blocks.length, 4, 'expected 4 Moodle questions (mcq, tf, gap, matching)');
  for (const [i, block] of blocks.entries()) {
    assert.ok(block.includes(passageNeedle), `question ${i + 1} (${['mcq', 'tf', 'gap', 'matching'][i]}) is missing the passage`);
  }
});
test('toMoodleXML never runs the passage text through gap substitution (#57)', () => {
  const wsWithBraceyPassage = {
    ...moodleWs,
    sections: [{
      title: 'Comprehension',
      activities: [{
        type: 'reading-comp',
        passage: 'A passage that mentions {{not a real gap}} literally.',
        questions: [{ type: 'gap-fill', text: 'The sun gives us {{light|heat}}.' }],
      }],
    }],
  };
  const xml = toMoodleXML(wsWithBraceyPassage);
  // The passage's own "{{...}}" must survive untouched — only the question's
  // own gap should become a cloze SHORTANSWER field.
  assert.ok(xml.includes('{{not a real gap}}'), 'passage braces must not be substituted as a cloze gap');
  assert.ok(xml.includes('{1:SHORTANSWER:=light~=heat}'), 'the real gap-fill answer must still become a cloze field');
});

console.log('\n9c) Exporters: deferred revocation & Blob-URL popup (#70)');

await test('download() defers URL.revokeObjectURL instead of calling it synchronously (#70)', async () => {
  const { download } = await import(new URL('../site/assets/js/exporters.js', import.meta.url));
  const created = [];
  const revoked = [];
  const clicked = [];
  let capturedTimeoutFn = null;
  const origDoc = globalThis.document;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;
  const origTimeout = globalThis.setTimeout;
  globalThis.document = {
    createElement: () => ({
      set href(v) { this._href = v; },
      get href() { return this._href; },
      click() { clicked.push(this.href); },
      remove() {},
    }),
    body: { appendChild() {} },
  };
  URL.createObjectURL = () => { const u = `blob:fake-${created.length}`; created.push(u); return u; };
  URL.revokeObjectURL = (u) => revoked.push(u);
  globalThis.setTimeout = (fn) => { capturedTimeoutFn = fn; return 0; };
  try {
    download('x.json', '{}', 'application/json');
    assert.equal(clicked.length, 1, 'anchor was clicked');
    assert.equal(revoked.length, 0, 'must NOT revoke synchronously — that races the browser download fetch');
    assert.ok(typeof capturedTimeoutFn === 'function', 'a deferred revoke was scheduled');
    capturedTimeoutFn(); // simulate the timer firing
    assert.deepEqual(revoked, created, 'the deferred callback revokes the same URL it created');
  } finally {
    globalThis.document = origDoc;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    globalThis.setTimeout = origTimeout;
  }
});

console.log('\n10) Animation layer');

test('animation layer has no vendored engine (native Web Animations API only)', () => {
  assert.ok(
    !existsSync(join(ROOT, 'site', 'assets', 'vendor', 'anime.esm.min.js')),
    'a vendored Anime.js should not exist — the animation layer runs on the native Web Animations API',
  );
});
await test('anim.js imports and exposes graceful helpers (no DOM needed to load)', async () => {
  const anim = await import(new URL('../site/assets/js/anim.js', import.meta.url));
  for (const fn of ['warmAnime', 'enterTiles', 'exitTiles', 'popTiles', 'pulseWave', 'flyInMorphemes', 'drawPaths']) {
    assert.equal(typeof anim[fn], 'function', `anim.${fn} missing`);
  }
  // Helpers must be safe to call with no nodes and resolve without throwing.
  await anim.enterTiles([]);
  await anim.exitTiles([]);
  await anim.drawPaths([]);
});
await test('no site source references an external CDN (self-contained rule)', async () => {
  const files = ['renderer.js', 'anim.js', 'validator.js', 'analog.js', 'prompt-builder.js', 'app.js', 'docs.js', 'md.js'];
  for (const f of files) {
    const src = await readFile(join(ROOT, 'site', 'assets', 'js', f), 'utf8');
    assert.ok(!/https?:\/\/(cdn|unpkg|jsdelivr|cdnjs)/i.test(src), `${f} references a CDN`);
  }
});

console.log('\n11) MCP function copies stay in sync with their canonical source');

await test('supabase/functions/mcp/validator.js matches site/assets/js/validator.js (modulo EOL)', async () => {
  const a = (await readFile(join(ROOT, 'supabase', 'functions', 'mcp', 'validator.js'), 'utf8')).replace(/\r\n/g, '\n');
  const b = (await readFile(join(ROOT, 'site', 'assets', 'js', 'validator.js'), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(a, b, 'mcp/validator.js has drifted from site/assets/js/validator.js — re-read both fresh and redeploy (see HANDOFF.md §10)');
});
await test('supabase/functions/mcp/prompt-builder.js matches site/assets/js/prompt-builder.js (modulo EOL)', async () => {
  const a = (await readFile(join(ROOT, 'supabase', 'functions', 'mcp', 'prompt-builder.js'), 'utf8')).replace(/\r\n/g, '\n');
  const b = (await readFile(join(ROOT, 'site', 'assets', 'js', 'prompt-builder.js'), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(a, b, 'mcp/prompt-builder.js has drifted from site/assets/js/prompt-builder.js — re-read both fresh and redeploy (see HANDOFF.md §10)');
});

console.log('\n12) Renderer pure-logic helpers');

await test('normAccentless matches accented/unaccented spellings for translation scoring (#55)', async () => {
  const { normAccentless } = await import(new URL('../site/assets/js/renderer.js', import.meta.url));
  assert.equal(normAccentless('café'), normAccentless('cafe'));
  assert.equal(normAccentless('está'), normAccentless('esta'));
  assert.equal(normAccentless('Café!'), normAccentless('cafe'), 'strips punctuation/case too (normLoose tier)');
  assert.notEqual(normAccentless('café'), normAccentless('cafes'), 'still distinguishes genuinely different words');
});

/* ---------- summary ---------- */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
