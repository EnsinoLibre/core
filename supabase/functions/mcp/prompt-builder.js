/**
 * EnsinoLibre — generalised prompt template (schema v2).
 *
 * buildPrompt(spec) turns a plain-language form submission into a complete,
 * copy-and-paste prompt for any capable AI assistant. The reply is worksheet
 * JSON conforming to worksheet.schema.json (full activity catalogue).
 * The format contract embeds ONLY the shapes of the activity types the
 * author ticked, keeping prompts short and reliable.
 *
 * Pure module: no DOM, no globals — importable from Node for testing.
 */

export const ACTIVITY_TYPES = [
  /* core six */
  { id: 'mcq', group: 'Core', label: 'Multiple choice', blurb: 'a question with 2–6 options, exactly one correct' },
  { id: 'true-false', group: 'Core', label: 'True or false', blurb: 'a statement the learner judges as true or false' },
  { id: 'gap-fill', group: 'Core', label: 'Fill in the gaps', blurb: 'prose with missing words the learner types in' },
  { id: 'matching', group: 'Core', label: 'Matching', blurb: 'two columns of items the learner pairs up' },
  { id: 'ordering', group: 'Core', label: 'Put in order', blurb: 'shuffled steps or events the learner sequences' },
  { id: 'open-response', group: 'Core', label: 'Open writing', blurb: 'a free-writing prompt with an optional model answer' },
  /* input */
  { id: 'content', group: 'Input', label: 'Reading content', blurb: 'headed sections of instructional text (no questions)' },
  { id: 'course-presentation', group: 'Input', label: 'Slides', blurb: 'short slides with optional quick-check questions' },
  { id: 'timeline', group: 'Input', label: 'Timeline', blurb: 'dated events in chronological order' },
  { id: 'dialogue', group: 'Input', label: 'Dialogue', blurb: 'a two-speaker model conversation' },
  { id: 'grammar-forms', group: 'Input', label: 'Grammar forms', blurb: 'one sentence shown across positive/negative/question forms' },
  { id: 'tense-shift', group: 'Input', label: 'Tense shift', blurb: 'one sentence shown across tenses' },
  { id: 'word-transform', group: 'Input', label: 'Word building', blurb: 'a base word and its derived forms with prefixes/suffixes' },
  { id: 'translation-compare', group: 'Input', label: 'Translation compare', blurb: 'aligned source/target sentences showing structure differences' },
  /* vocabulary */
  { id: 'flashdeck', group: 'Vocabulary', label: 'Flashcards', blurb: 'flip cards: word on the front, meaning on the back' },
  { id: 'memory-game', group: 'Vocabulary', label: 'Memory game', blurb: 'matching pairs played as a memory game' },
  { id: 'word-search', group: 'Vocabulary', label: 'Word search', blurb: 'a letter grid hiding themed words' },
  /* listening (dictation, listen-mcq) is out of scope until browser TTS lands — see EnsinoLibre/core#2 */
  /* practice sets */
  { id: 'quiz', group: 'Practice sets', label: 'Quiz (scored)', blurb: 'a scored set of multiple-choice questions with a pass mark' },
  { id: 'single-choice-set', group: 'Practice sets', label: 'Rapid-fire set', blurb: 'quick one-answer questions for fluency' },
  { id: 'question-set', group: 'Practice sets', label: 'Mixed question set', blurb: 'one set mixing mcq, true/false and gap-fill items' },
  { id: 'mark-words', group: 'Practice sets', label: 'Mark the words', blurb: 'a text where the learner marks all words matching a criterion' },
  /* contextualised */
  { id: 'reading-comp', group: 'Contextualised', label: 'Reading comprehension', blurb: 'a passage followed by mixed questions' },
  { id: 'translation', group: 'Contextualised', label: 'Translation drill', blurb: 'sentences translated one by one' },
  { id: 'scenario', group: 'Contextualised', label: 'Branching scenario', blurb: 'a conversation where choices steer the outcome' },
  { id: 'lesson', group: 'Contextualised', label: 'Adaptive lesson', blurb: 'linked pages where wrong answers get re-teaching' },
  { id: 'crossword', group: 'Contextualised', label: 'Crossword', blurb: 'a clue-driven crossword grid' },
  { id: 'image-hotspot', group: 'Contextualised', label: 'Picture labelling', blurb: 'a self-contained SVG scene with labelled hotspots' },
  /* checks & forms */
  { id: 'summary', group: 'Checks & forms', label: 'Summary builder', blurb: 'tick the true statements to build a summary' },
  { id: 'survey', group: 'Checks & forms', label: 'Self-assessment survey', blurb: 'scales, choices and open questions (no wrong answers)' },
  { id: 'poll', group: 'Checks & forms', label: 'Poll', blurb: 'one preference question with guidance per choice' },
];

/** Per-type JSON shape, embedded in the prompt only when the type is chosen. */
export const CONTRACTS = {
  'mcq': `{ "type": "mcq", "question": "...", "options": ["...", "..."], "answer": <zero-based index of the correct option>, "hint": "...", "explanation": "..." } — 2–6 options, exactly one correct.`,
  'true-false': `{ "type": "true-false", "statement": "...", "answer": true, "hint": "...", "explanation": "..." } — answer is a JSON boolean.`,
  'gap-fill': `{ "type": "gap-fill", "text": "Prose with each answer in double curly braces, e.g. Water boils at {{100}} degrees. Alternatives separated by |, e.g. {{colour|color}}.", "hint": "...", "explanation": "..." } — 1–5 gaps.`,
  'matching': `{ "type": "matching", "prompt": "...", "pairs": [ { "left": "...", "right": "..." } ], "hint": "...", "explanation": "..." } — 2–8 pairs, every "right" unique.`,
  'ordering': `{ "type": "ordering", "prompt": "...", "items": ["first", "second", "third"], "hint": "...", "explanation": "..." } — 3–8 items in the CORRECT order (the renderer shuffles them).`,
  'open-response': `{ "type": "open-response", "prompt": "...", "minWords": <integer>, "sampleAnswer": "<model answer>" }`,
  'content': `{ "type": "content", "sections": [ { "heading": "...", "body": "Text; **bold**, *italic* allowed." } ] }`,
  'course-presentation': `{ "type": "course-presentation", "slides": [ { "title": "...", "body": "...", "activity": { "subtype": "mcq"|"true-false", ...that shape's fields... } } ] } — 2–12 slides; "activity" optional per slide; a quick check every 2–3 slides.`,
  'timeline': `{ "type": "timeline", "items": [ { "date": "...", "headline": "...", "text": "..." } ] } — 3–12 items in chronological order.`,
  'dialogue': `{ "type": "dialogue", "context": "one-line scene", "speakerA": "<role name>", "speakerB": "<role name>", "lines": [ { "speaker": "a"|"b", "text": "...", "gloss": "optional translation" } ] } — 2–16 short natural turns; speakers are roles, never real personal names.`,
  'grammar-forms': `{ "type": "grammar-forms", "grammar": "<the grammar point>", "forms": [ { "label": "Positive", "sentence": "Sentence with the changing part in **bold**.", "gloss": "optional translation" } ] } — 2–6 forms using the same vocabulary, only the structure changes.`,
  'tense-shift': `{ "type": "tense-shift", "verb": "to work", "context": "optional", "tenses": [ { "label": "Past simple", "sentence": "I **worked** yesterday.", "gloss": "optional" } ] } — 2–6 tenses, same subject and complement throughout; bold the tense-bearing words; include a natural time expression per tense.`,
  'word-transform': `{ "type": "word-transform", "baseWord": "happy", "steps": [ { "derived": "unhappiness", "pos": "noun", "morphemes": [ { "text": "un", "role": "prefix" }, { "text": "happi", "role": "root" }, { "text": "ness", "role": "suffix" } ], "gloss": "optional", "example": "optional sentence" } ] } — 2–8 steps, one word family, simple → complex.`,
  'translation-compare': `{ "type": "translation-compare", "pairs": [ { "headline": "optional", "sourceTokens": ["Tenho", "fome"], "targetTokens": ["I", "am", "hungry"], "links": [ { "s": 0, "t": 1, "note": "optional structural note" }, { "s": 1, "t": 2 } ] } ] } — link indices are zero-based into the token arrays.`,
  'flashdeck': `{ "type": "flashdeck", "cards": [ { "front": "<target word>", "back": "<meaning/translation>", "pronunciation": "optional", "example": "optional sentence", "emoji": "optional" } ] } — 3–20 cards, one concept each.`,
  'memory-game': `{ "type": "memory-game", "pairs": [ { "left": "...", "right": "..." } ] } — 3–8 pairs; texts 1–3 words; every "right" unique.`,
  'word-search': `{ "type": "word-search", "words": ["...", "..."], "gridSize": 12 } — 4–14 themed words, letters only, each shorter than gridSize.`,
  'quiz': `{ "type": "quiz", "questions": [ { "question": "...", "options": [...], "answer": <index>, "hint": "...", "explanation": "..." } ], "passMark": <integer ≈ 70% of questions> } — 2–12 questions.`,
  'single-choice-set': `{ "type": "single-choice-set", "questions": [ { "question": "...", "options": [...], "answer": <index> } ] } — 3–12 short questions drilling ONE narrow pattern; 2–6 options each.`,
  'question-set': `{ "type": "question-set", "questions": [ { "subtype": "mcq", "question": "...", "options": [...], "answer": <index> }, { "subtype": "true-false", "statement": "...", "answer": false }, { "subtype": "gap-fill", "text": "... {{answer}} ..." } ], "passMark": <integer> } — every item MUST carry "subtype"; alternate the subtypes.`,
  'mark-words': `{ "type": "mark-words", "instruction": "Underline every <criterion>", "text": "30–80 words of prose", "targets": ["word1", "word2"] } — every target must appear verbatim as a word in the text; the criterion must be unambiguous. Scoring is per occurrence: if a target word appears more than once in the text, the learner must mark every occurrence — marking only one instance leaves the others as misses.`,
  'reading-comp': `{ "type": "reading-comp", "passage": "<the text>", "questions": [ ...objects of type mcq / true-false / gap-fill / matching, EACH with its "type" field... ] } — all questions answerable from the passage, ordered by where their evidence appears.`,
  'translation': `{ "type": "translation", "sentences": [ { "source": "<sentence in the learner's language>", "target": "<expected translation>", "alternatives": ["other correct phrasings"], "hint": "optional structural nudge" } ] } — 1–10 sentences; include every natural phrasing in alternatives.`,
  'scenario': `{ "type": "scenario", "instruction": "...", "startNode": "n1", "nodes": [ { "id": "n1", "speaker": "<role>", "text": "...", "choices": [ { "text": "...", "nextNode": "n2", "isCorrect": true } ] }, { "id": "n2", "speaker": "<role>", "text": "...", "isEnd": true, "endMessage": "..." } ] } — 2–20 nodes (aim for 5–10); every path must reach a node with "isEnd": true; wrong choices lead somewhere instructive; speakers are roles, never real personal names.`,
  'lesson': `{ "type": "lesson", "startPage": "p1", "pages": [ { "id": "p1", "pageType": "content", "title": "...", "body": "...", "nextPage": "p2" }, { "id": "p2", "pageType": "question", "question": "...", "options": [...], "answer": <index>, "onCorrect": "p4", "onWrong": "p3", "explanation": "..." } ] } — 2–20 pages (aim for 4–8); onWrong pages re-teach differently, then rejoin; final page's nextPage is null.`,
  'crossword': `{ "type": "crossword", "clues": { "across": [ { "number": 1, "clue": "...", "answer": "WORD", "row": 0, "col": 0 } ], "down": [...] } } — row/col are 0-based; CROSSING CELLS MUST SHARE THE SAME LETTER (check every intersection letter by letter before answering); answers letters-only.`,
  'image-hotspot': `{ "type": "image-hotspot", "instruction": "...", "svg": "<svg viewBox=\\"0 0 400 300\\" xmlns=\\"http://www.w3.org/2000/svg\\">...simple flat shapes, no scripts/links...</svg>", "hotspots": [ { "label": "...", "x": <0–100>, "y": <0–100>, "description": "optional" } ] } — draw a simple self-contained SVG scene; x/y are percentages matching where each labelled thing is in the SVG.`,
  'summary': `{ "type": "summary", "intro": "optional context", "statements": [ { "text": "...", "correct": true, "explanation": "..." } ] } — 4–12 statements, roughly half correct; incorrect ones are near-misses; the correct ones read in order must form a coherent summary.`,
  'survey': `{ "type": "survey", "items": [ { "question": "...", "itemType": "scale", "scale": 5, "labels": ["low end", "high end"] }, { "question": "...", "itemType": "choice", "options": [...] }, { "question": "...", "itemType": "opentext" } ] } — 1–8 items, no right answers.`,
  'poll': `{ "type": "poll", "question": "...", "options": [ { "text": "...", "followUp": "guidance shown for this choice" } ] } — 2–5 options, no wrong answers.`,
};

const PEDAGOGY_RULES = `Quality rules — follow every one:
1. Every answer must be factually correct and unambiguous.
2. "hint" is optional and must NEVER quote, name, or point directly at the answer or any option — it nudges the learner towards the reasoning, nothing more.
3. "explanation" is shown after answering; it may state the answer and say why.
4. Distractors (wrong options) must be plausible but clearly wrong to someone who knows the material.
5. Order activities from easier to harder within each section; production/writing tasks come last.
6. Keep language age-appropriate and pitched at the stated audience level.
7. Write all learner-facing text in the requested language.
8. The worksheet must be entirely self-contained — no external images, audio files, video or links. Spoken texts go in "transcript"/"text" fields (read aloud by the browser or a teacher); pictures are inline SVG only where the shape explicitly allows it.
9. Speakers and characters are roles or invented names — never real people's names.`;

function pluralise(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['spec must be an object'];
  for (const field of ['subject', 'topic', 'audience']) {
    if (!spec[field] || !String(spec[field]).trim()) errors.push(`${field} is required`);
  }
  if (spec.activityCount != null) {
    const n = Number(spec.activityCount);
    if (!Number.isInteger(n) || n < 1 || n > 30) errors.push('activityCount must be a whole number between 1 and 30');
  }
  if (spec.activityTypes) {
    const known = new Set(ACTIVITY_TYPES.map((t) => t.id));
    for (const t of spec.activityTypes) {
      if (!known.has(t)) errors.push(`unknown activity type: ${t}`);
    }
  }
  if (spec.difficulty && !['introductory', 'intermediate', 'advanced'].includes(spec.difficulty)) {
    errors.push('difficulty must be introductory, intermediate or advanced');
  }
  return errors;
}

/**
 * @param {object} spec { subject, topic, audience, language?, difficulty?,
 *                        activityTypes?, activityCount?, extras? }
 * @returns {string} the full prompt
 */
export function buildPrompt(spec) {
  const errors = validateSpec(spec);
  if (errors.length) throw new Error('Invalid spec: ' + errors.join('; '));

  const language = (spec.language || '').trim() || 'English (UK)';
  const difficulty = spec.difficulty || 'introductory';
  const count = spec.activityCount || 8;
  const chosen = (spec.activityTypes && spec.activityTypes.length)
    ? ACTIVITY_TYPES.filter((t) => spec.activityTypes.includes(t.id))
    : ACTIVITY_TYPES.filter((t) => t.group === 'Core');

  const typeLines = chosen.map((t) => `- "${t.id}" — ${t.blurb}`).join('\n');
  const shapeLines = chosen.map((t) => `- ${CONTRACTS[t.id]}`).join('\n\n');

  const lines = [
    'You are an experienced teacher and instructional designer creating a digital worksheet.',
    '',
    `Subject: ${spec.subject.trim()}`,
    `Topic: ${spec.topic.trim()}`,
    `Audience: ${spec.audience.trim()}`,
    `Language of the worksheet: ${language}`,
    `Difficulty: ${difficulty}`,
    `Total number of activities: about ${pluralise(count, 'activity').replace('activitys', 'activities')}, grouped into 2–4 titled sections.`,
    '',
    'Use only these activity types, mixing them for variety:',
    typeLines,
  ];

  if (spec.extras && spec.extras.trim()) {
    lines.push('', `Additional requests from the worksheet author: ${spec.extras.trim()}`);
  }

  lines.push(
    '',
    PEDAGOGY_RULES,
    '',
    `Return ONLY a single JSON object (no prose before or after, no markdown fences) with this exact shape:

{
  "$schemaVersion": "2.0",
  "title": "<worksheet title>",
  "subject": "<subject>",
  "topic": "<topic>",
  "audience": "<audience>",
  "language": "<BCP-47 tag, e.g. en-GB>",
  "estimatedMinutes": <integer>,
  "instructions": "<one or two friendly sentences for the learner>",
  "sections": [
    { "title": "<section title>", "instructions": "<optional>", "activities": [ <activity objects> ] }
  ]
}

Activity object shapes (the "type" field selects the shape):

${shapeLines}`,
  );
  return lines.join('\n');
}
