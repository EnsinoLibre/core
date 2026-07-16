---
title: Contributor architecture guide
---

# Contributor architecture guide

How EnsinoLibre fits together, for people changing the code. For using the
product, start at [[overview]] instead.

> [!note]
> An earlier plan described a drag-and-drop **Palette → Canvas → Inspector**
> builder. That is **not** what shipped. Authoring happens through the
> prompt-based generator and the [[mcp-connect|MCP agent path]]; this guide
> documents the architecture that actually exists.

## Two surfaces, one engine

EnsinoLibre is split into two deliberately separate surfaces that share one
worksheet engine:

- **Public site** — zero-build, dependency-free: plain HTML, CSS and ES
  modules with no build step. The landing page, the worksheet **generator**,
  the docs viewer, and the student **aula** page. This is the surface the
  build-free philosophy protects — no bundler, no framework, inline
  dependencies only, animation on the native Web Animations API.
- **Teacher platform** — a real built app (Vite + React + TypeScript) behind
  login: workspace, classrooms, students, worksheets, live classroom, the
  knowledge graph. See [[platform-overview]].

Both render worksheets with the **same engine modules**, so a worksheet looks
and behaves identically in the public generator preview, the student aula, and
the teacher platform.

## The worksheet engine (the shared core)

The engine is a handful of pure-ish ES modules. Each activity type is defined
in four places that must stay in agreement:

| Module | Responsibility | Environment |
|--------|----------------|-------------|
| `prompt-builder.js` | Turns an author's spec into an LLM prompt; holds the per-type JSON **contract** | pure (Node + browser) |
| `validator.js` | Runtime guard returning plain-language problems for bad worksheet data | pure (Node + browser) |
| `renderer.js` | Builds the interactive DOM widget for each activity | browser only |
| `analog.js` | Emits a print/Markdown version of every activity (the analog principle) | pure (Node + browser) |
| `anim.js` | Native Web Animations API motion layer; graceful no-op under reduced motion | browser only |
| `exporters.js` | JSON / Markdown / print-PDF / Moodle XML export | browser only |

The authoritative data contract is [[worksheet-schema|the JSON Schema]]; the
validator and schema are kept in agreement by the test suite. See
[[rendering-and-embedding]] for how a rendered worksheet is embedded.

> [!tip]
> When you add or change an activity type, update its contract
> (`prompt-builder.js`), its guard (`validator.js`), its JSON Schema entry,
> its renderer (`renderer.js`), and its analog emitter (`analog.js`) together.
> The test suite fails if these registries disagree.

## Data flow: from intent to rendered worksheet

```
author spec ──▶ buildPrompt() ──▶ [ AI assistant ] ──▶ worksheet JSON
                                                            │
                                              validateWorksheet()
                                                            │
                                     ┌──────────────────────┼───────────────────────┐
                                     ▼                      ▼                       ▼
                              renderWorksheet()        emitAnalog()          exporters
                              (interactive DOM)        (print Markdown)      (JSON / Moodle …)
```

The generator never trusts model output blindly: JSON is run through
`validateWorksheet()` before anything is rendered, and the renderer builds
every node with `textContent` (untrusted input), the one audited exception
being `image-hotspot`'s inline SVG, which the validator sanitises and the
renderer mounts as a non-scripting `data:` image.

The [[mcp-connect|MCP server]] is a second entry into the same pipeline: an AI
agent calls tools that construct worksheet JSON, which passes through the
identical validator before being stored.

## Keyboard navigation and accessibility

Every worksheet activity must be fully operable with a keyboard and a screen
reader — this is a hard baseline, not a nice-to-have, because worksheets are
used by learners on whatever device and assistive tech they have. It mirrors
the block-authoring baseline in the
[blocks CONTRIBUTING guide](https://github.com/EnsinoLibre/blocks/blob/main/CONTRIBUTING.md#accessibility--keyboard-navigation).

**Focus order.** Activities render in document order (section by section,
activity by activity, in the order the worksheet JSON lists them), so the
natural Tab order already matches reading order. Don't override `tabindex`
with positive values — keep interactive controls in DOM order and let the
browser sequence them.

**Per-widget expectations** (the shipped renderers set the bar — match them
when adding or changing a type):

- **Simple inputs** (mcq, true-false, gap-fill, matching, summary, survey,
  poll): native `<input>`/`<select>`/`<button>` elements, each with a label
  or `aria-label`. Tab moves between them; Space/Enter activates; radios and
  selects use their native arrow-key behaviour.
- **Composite widgets** navigate *within* themselves with arrow keys:
  - **crossword** — arrow keys move between cells; typing a letter advances to
    the next cell in the active direction.
  - **word-search** — cells are buttons; the current selection is announced
    via an `aria-live` status region.
  - **grammar-forms / tense-shift** — the form/tense switch is a
    `role="tablist"` with `role="tab"` buttons, roving `tabindex`, and
    left/right arrow navigation; the stage is a `role="tabpanel"`.
- **Staged widgets** (course-presentation, lesson, single-choice-set,
  scenario) swap content inside a container marked `aria-live="polite"` so the
  new slide/page/turn is announced; Previous/Next are real buttons.
- **Dynamic feedback** (correct/incorrect messages, poll and survey
  confirmations, hotspot labels) lands in an `aria-live` region so it is heard,
  not just seen.
- **Motion** is decorative only. Everything works with
  `prefers-reduced-motion: reduce`, where the animation layer becomes a no-op
  and content lands directly in its resting state — never hidden.

**Before opening a PR** that touches a renderer, keyboard-walk a worksheet
containing your activity — Tab / Shift-Tab / arrows only — then once more with
a screen reader running. If you can't reach a control, activate it, or hear
its result, it isn't done.

## Where things live

- Public site + engine: `core/site/` (engine modules in
  `core/site/assets/js/`).
- Teacher platform: `core/platform/` (builds into `core/site/app/`).
- Docs (this vault): `core/docs/` — the working copy; the `EnsinoLibre/docs`
  repo is a periodic mirror.
- Schema: `core/schema/worksheet.schema.json`.
- Backend (Supabase RPCs + MCP edge function): `core/supabase/`.

See [[getting-started]] for running any of these locally.
