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
│   ├── index.html            ← generator: form → prompt → paste JSON → render (the public taster)
│   ├── app.html              ← teacher workspace + live classroom monitor (see below)
│   ├── aula.html             ← student page: join a class by code, do the worksheets
│   ├── docs.html             ← in-app documentation viewer
│   └── assets/
│       ├── styles.css        ← generator styling, bridged onto the design system
│       ├── app.css           ← teacher-workspace styling (design-system tokens + primitives)
│       ├── brand/            ← wordmark + favicon (from EnsinoLibre/assets)
│       ├── vendor/           ← tokens.css + primitives (design-system), marked
│       └── js/
│           ├── prompt-builder.js   ← builds the AI prompt from a form spec
│           ├── validator.js        ← worksheet + per-block validation (pure)
│           ├── renderer.js         ← interactive DOM renderers for every block
│           ├── anim.js             ← Anime.js v4 animation layer (visual grammar)
│           ├── analog.js           ← Markdown/print emitter (pure)
│           ├── md.js / docs.js     ← Obsidian-flavoured docs viewer
│           ├── app/                ← teacher workspace SPA (store, router, views, live monitor)
│           └── aula/               ← student SPA (join → do deployed worksheets)
│           └── app.js              ← page wiring
├── docs/                     ← documentation content (synced from EnsinoLibre/docs)
├── skills/                   ← agentic skills for Claude Code / MCP clients (see below)
├── supabase/functions/mcp/   ← MCP server: real tools inside a teacher's workspace
├── schema/worksheet.schema.json    ← the worksheet format (JSON Schema 2020-12)
├── tests/run-tests.mjs       ← 125 tests, zero-framework
├── server.mjs                ← tiny static dev server
└── netlify.toml              ← deploy config
```

## Three surfaces

- **The generator** (`index.html`) is the public taster: describe a lesson, get a prompt for any AI assistant, paste the result back, render or print it. No account, nothing stored.
- **The teacher workspace** (`app.html`) is where the product's real value lives: teachers keep **classrooms**, **students**, **resources**, and persistent **per-class and per-student context** that an AI teaching assistant will read and write. Each classroom and student view carries an *Assistant* panel primed with that context (a UI stub today).
- **The live classroom / aula** — teachers *deploy* a set of worksheets to a class (with a join **code**); students open `aula.html`, join with the code and their name, and work through the worksheets (rendered by the same engine as the generator). The teacher's **Live classroom** dashboard (`app.html#/aula`) shows every student's progress and score **in real time**, lets the teacher **validate** each submission (validated / needs review), and **exports** the results as **CSV or JSON**.

> **Status: boilerplate, front-end only.** No backend yet. Teacher auth is faked (any credentials); student "auth" is just a class code + name. All data lives in `localStorage`, seeded on first run (including one live aula with two worksheets and enrolled students so the monitor looks alive immediately). "Live" updates use `BroadcastChannel`, so a student working in one tab updates the teacher's monitor in another — no server involved. The data layer is isolated in `assets/js/app/store.js`; wiring a real backend later means swapping that module's read/write helpers — the views don't change. Reset from **Profile → Reset demo data**. Demo class code: **A2LIVE**.

## How it relates to the other repos

- **[design-system](https://github.com/EnsinoLibre/design-system)** and **[assets](https://github.com/EnsinoLibre/assets)** are the source of truth for branding. `core` vendors `tokens.css` and the wordmark/favicon, and its `--oc-*` style variables bridge onto the design-system's semantic tokens (`--color-primary`, `--space-*`, the Newsreader / Atkinson Hyperlegible / IBM Plex Mono fonts). Add `data-theme="dark"` to `<html>` for dark mode.
- **[blocks](https://github.com/EnsinoLibre/blocks)** is the canonical library of the 30 activity types (contracts, digital + analog behaviour). The modules in `site/assets/js/` are the reference implementation that library documents; `core` bundles them so it stays a self-contained static site.
- **[docs](https://github.com/EnsinoLibre/docs)** is the canonical documentation vault. `core/docs/` is a bundled copy so the in-app viewer works offline.

## Agentic skills

`core` also exposes an MCP server (`supabase/functions/mcp/`) that gives a connected
AI agent real tools inside a teacher's workspace — no copy-paste. [`skills/`](skills/)
packages that as installable skills for Claude Code and similar clients:

```
npx skills add EnsinoLibre/core
```

See [`skills/README.md`](skills/README.md) for the list and [docs/mcp-connect.md](docs/mcp-connect.md)
for the full tool reference.

## The worksheet format

A worksheet is one JSON object: metadata plus titled sections of activities. Thirty activity types are supported, from multiple choice and gap-fill to flashcards, crosswords, branching scenarios and animated grammar visualisers — every one with a defined **analog** translation so it also works on paper. See [`schema/worksheet.schema.json`](schema/worksheet.schema.json) and the [docs](https://github.com/EnsinoLibre/docs).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Code is MIT; worksheets shared to [examples](https://github.com/EnsinoLibre/examples) are CC BY-SA.

<div align="center">
<sub>Made in the open by teachers, for teachers.</sub>
</div>
