<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/EnsinoLibre/assets/main/wordmark-primary-dark.svg">
  <img src="https://raw.githubusercontent.com/EnsinoLibre/assets/main/wordmark-primary-light.svg" alt="EnsinoLibre" width="360">
</picture>

# core — the worksheet builder

**Free tools for teachers, made in the open.**

</div>

---

`core` is the EnsinoLibre worksheet builder. A teacher describes a lesson in a simple form; the app produces a ready-to-paste prompt for any AI assistant; the assistant replies with worksheet JSON; the app renders it as an **interactive** worksheet (with tiered hints and instant feedback) or exports it as an **analog** paper/Markdown handout with an answer key.

It ships as a dependency-free static site — plain HTML, CSS and ES modules — so it runs anywhere and has nothing to build.

## Quick start

```
git clone https://github.com/EnsinoLibre/core.git
cd core
npm install        # installs ajv, used only by the test suite
npm run dev        # serves the app at http://localhost:3210/site/index.html
npm test           # runs the full test suite
```

## What's inside

```
core/
├── site/                     ← the app (static; deploy this)
│   ├── index.html            ← creator: form → prompt → paste JSON → render
│   ├── docs.html             ← in-app documentation viewer
│   └── assets/
│       ├── styles.css        ← app styling, bridged onto the design system
│       ├── brand/            ← wordmark + favicon (from EnsinoLibre/assets)
│       ├── vendor/           ← tokens.css (design-system), marked, anime.js
│       └── js/
│           ├── prompt-builder.js   ← builds the AI prompt from a form spec
│           ├── validator.js        ← worksheet + per-block validation (pure)
│           ├── renderer.js         ← interactive DOM renderers for every block
│           ├── anim.js             ← Anime.js v4 animation layer (visual grammar)
│           ├── analog.js           ← Markdown/print emitter (pure)
│           ├── md.js / docs.js     ← Obsidian-flavoured docs viewer
│           └── app.js              ← page wiring
├── docs/                     ← documentation content (synced from EnsinoLibre/docs)
├── schema/worksheet.schema.json    ← the worksheet format (JSON Schema 2020-12)
├── tests/run-tests.mjs       ← 125 tests, zero-framework
├── server.mjs                ← tiny static dev server
└── netlify.toml              ← deploy config
```

## How it relates to the other repos

- **[design-system](https://github.com/EnsinoLibre/design-system)** and **[assets](https://github.com/EnsinoLibre/assets)** are the source of truth for branding. `core` vendors `tokens.css` and the wordmark/favicon, and its `--oc-*` style variables bridge onto the design-system's semantic tokens (`--color-primary`, `--space-*`, the Newsreader / Atkinson Hyperlegible / IBM Plex Mono fonts). Add `data-theme="dark"` to `<html>` for dark mode.
- **[blocks](https://github.com/EnsinoLibre/blocks)** is the canonical library of the 30 activity types (contracts, digital + analog behaviour). The modules in `site/assets/js/` are the reference implementation that library documents; `core` bundles them so it stays a self-contained static site.
- **[docs](https://github.com/EnsinoLibre/docs)** is the canonical documentation vault. `core/docs/` is a bundled copy so the in-app viewer works offline.

## The worksheet format

A worksheet is one JSON object: metadata plus titled sections of activities. Thirty activity types are supported, from multiple choice and gap-fill to flashcards, crosswords, branching scenarios and animated grammar visualisers — every one with a defined **analog** translation so it also works on paper. See [`schema/worksheet.schema.json`](schema/worksheet.schema.json) and the [docs](https://github.com/EnsinoLibre/docs).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Code is MIT; worksheets shared to [examples](https://github.com/EnsinoLibre/examples) are CC BY-SA.

<div align="center">
<sub>Made in the open by teachers, for teachers.</sub>
</div>
