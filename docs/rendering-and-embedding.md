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
| `assets/js/anim.js` | animation helpers (Anime.js v4) | vendored `anime.esm.min.js` |
| `assets/js/prompt-builder.js` | `buildPrompt(spec)`, `validateSpec(spec)`, `ACTIVITY_TYPES`, `CONTRACTS` | nothing |

`validator.js`, `analog.js` and `prompt-builder.js` are pure (no DOM) and run in Node as well as the browser — the test suite imports them directly.

## Animation

The four visual-grammar types ([[activities/grammar-forms|grammar-forms]], [[activities/tense-shift|tense-shift]], [[activities/word-transform|word-transform]], [[activities/translation-compare|translation-compare]]) are animated with **Anime.js v4**, vendored locally at `assets/vendor/anime.esm.min.js` (no CDN). `anim.js` loads it lazily and every helper is a graceful no-op under `prefers-reduced-motion` or if the library fails to load — so animation is never required for correctness. A `setTimeout` safety net always settles tiles to their visible resting state even if `requestAnimationFrame` is throttled (e.g. a background tab). Word tiles stagger in with an `outBack` ease, morphemes fly in from their affix side, and translation links draw in as SVG curves.


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
