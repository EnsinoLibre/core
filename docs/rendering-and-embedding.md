---
title: Rendering & embedding
tags: ensinolibre, docs, reference, developers
audience: technical
---

# Rendering & embedding

The EnsinoLibre renderer is a small, dependency-free ES module. Everything on this site — including the live examples in these docs — uses it. This page is for anyone who wants worksheets on their **own** site.

## The modules

| Module | Exports | Depends on |
|--------|---------|-----------|
| `assets/js/validator.js` | `validateWorksheet(ws)`, `validateActivity(a)`, `parseGaps(text)`, `KNOWN_TYPES` | nothing |
| `assets/js/renderer.js` | `renderWorksheet(ws, container)`, `RENDERERS`, `buildWordSearch(...)` | `validator.js`, `anim.js` |
| `assets/js/analog.js` | `emitAnalog(ws)`, `ANALOG_EMITTERS` | `validator.js`, `renderer.js` |
| `assets/js/anim.js` | `warmAnime`, `enterTiles`, `exitTiles`, `popTiles`, `pulseWave`, `flyInMorphemes`, `drawPaths` (native Web Animations API) | nothing (browser-only) |
| `assets/js/prompt-builder.js` | `buildPrompt(spec)`, `validateSpec(spec)`, `ACTIVITY_TYPES`, `CONTRACTS` | nothing |

`validator.js`, `analog.js` and `prompt-builder.js` are pure (no DOM) and run in Node as well as the browser — the test suite imports them directly.

The renderer registers **no `window`-level side effects**: any layout that must react to size changes uses a `ResizeObserver` scoped to the activity's own node (so it stops and is garbage-collected when the node is detached), never a `window` `resize` listener. Keep it that way — the renderer is mounted and unmounted repeatedly from React (the teacher platform), where a per-render global listener would leak.

## Animation

The four visual-grammar types ([[activities/grammar-forms|grammar-forms]], [[activities/tense-shift|tense-shift]], [[activities/word-transform|word-transform]], [[activities/translation-compare|translation-compare]]) are animated on the browser's **native Web Animations API** — no animation engine, nothing vendored, no CDN (`anim.js`'s docstring is the source of truth; the test suite even asserts the old vendored `anime.esm.min.js` no longer exists). `anim.js` exposes a small set of helpers over `Element.animate()`:

- **`EASE` presets** — `cubic-bezier` curves mirroring the source PWA (`outBack`/`outBackStrong` overshoots, `inSine`, `inOutSine`, `inOutQuad`).
- **`enterTiles` / `exitTiles` / `popTiles`** — staggered enter with a back-out overshoot, quick centre-out exit, elastic-style emphasis pop.
- **`flyInMorphemes`** — word-building affixes fly in from their prefix/suffix side.
- **`pulseWave`** — a travelling highlight across a row of tiles.
- **`drawPaths`** — translation-compare's SVG connector curves draw themselves in.
- **`flipCard`** — a 3D card flip (`rotateY` to edge-on, swap the content at the invisible midpoint, rotate the new face back to flat) used by [[activities/flashdeck|flashcards]] (tap-to-flip and prev/next) and [[activities/memory-game|memory game]] (reveal).
- **`flashCorrect`** — a soft scale-pop affirming a correct answer.
- **`shakeTiles`** — a quick horizontal shake to signal a wrong/mismatched action (memory-game mismatch; the shared wrong-answer feedback).
- **`warmAnime`** — a cheap warm-up so the first real animation doesn't jank.

Beyond the four visual-grammar types, the **flashcard** deck and the **memory game** are animated too: cards flip on reveal, matched pairs `popTiles`, and a mismatch `shakeTiles` before flipping back.

**Check feedback is animated engine-wide.** The shared `makeFeedback()` control point calls `flashCorrect` on a correct answer and `shakeTiles` on a wrong one, so all thirteen check-based types (mcq, true-false, gap-fill, matching, ordering, quiz, single-choice-set, question-set, reading-comp, translation, summary, crossword, mark-words) get the same distinct correct-pop / wrong-shake for free.

**Micro-interactions** across the remaining types get a short `popTiles` pulse at their single interactive moment: a found word in the **word search**, the tapped dot in a **picture-labelling** (image-hotspot) activity, a picked **poll**/**survey** option, and the **open-writing** word counter the moment it first crosses `minWords`.

Every helper is a **graceful no-op** under `prefers-reduced-motion` (or where `Element.animate` is unavailable), so animation is never required for correctness. Enter animations fill **backwards only**, so elements always come to rest at their stylesheet state — content is never left invisible. A `settle()` safety net force-finishes animations after a capped timeout, so a throttled/backgrounded tab (where `requestAnimationFrame` stalls at 0) can't leave tiles stuck hidden.


## Minimal embed

```html
<link rel="stylesheet" href="assets/styles.css" />
<div id="worksheet"></div>
<script type="module">
  import { validateWorksheet } from './assets/js/validator.js';
  import { renderWorksheet } from './assets/js/renderer.js';

  const ws = await (await fetch('my-worksheet.json')).json();
  const problems = validateWorksheet(ws);
  if (problems.length) {
    document.getElementById('worksheet').textContent = problems.join('\n');
  } else {
    renderWorksheet(ws, document.getElementById('worksheet'));
  }
</script>
```

That's the whole integration. The renderer:

- builds all DOM with `textContent` (no `innerHTML` for worksheet data — worksheet JSON can be untrusted);
- shuffles `matching` right-hand columns and `ordering` items on every render;
- implements tiered feedback (hint → hint → reveal on the third wrong attempt);
- accepts answers case-insensitively and whitespace-insensitively for gap-fills.

> [!tip] Printing
> The stylesheet contains a `@media print` block that hides buttons and feedback and restyles activities for paper. `window.print()` on a page with a rendered worksheet produces a usable handout.

## Live example

This block below is a `worksheet` fenced code block in the Markdown source of this very page — the docs viewer extracts it and mounts the renderer in its place:

```worksheet
{
  "type": "mcq",
  "question": "Which DOM API does the renderer use for all worksheet text?",
  "options": ["innerHTML", "textContent", "document.write", "eval"],
  "answer": 1,
  "hint": "It is the one that cannot execute or inject markup.",
  "explanation": "textContent — worksheet JSON may come from an AI, so it is treated as untrusted data."
}
```

## Styling and theming

All visual styling lives in CSS custom properties on `:root` (`--oc-bg`, `--oc-accent`, `--oc-green`, …). Override them to match your site; no JavaScript changes needed. All renderer class names are prefixed `oc-`.

## Validating server-side

For pipelines and CI, validate against the JSON Schema instead of the lightweight browser validator:

```js
import Ajv from 'ajv';
import schema from './schema/worksheet.schema.json' with { type: 'json' };

const validate = new Ajv({ allErrors: true }).compile(schema);
if (!validate(worksheet)) console.error(validate.errors);
```

The project's own test suite (`ensinolibre/tests/run-tests.mjs`) does exactly this for every example worksheet, and additionally checks that the browser validator and the JSON Schema agree.

## Related

- [[worksheet-schema]] — the format being rendered
- [[obsidian-vault]] — how these docs themselves are structured
