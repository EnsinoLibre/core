# Road to v1.0 — agent-native production

> The operating plan for taking EnsinoLibre from working prototype to
> production: **100% stable, fully animated component engine** + **agent-native
> teacher platform** with **persistent llm.wiki memory**. This file is the
> orchestration contract for every working session — human or agent fleet.
> Issue tracker: [milestone v1.0](https://github.com/EnsinoLibre/core/milestone/1).

## 1. The production thesis

The copy-paste prompt loop was designed for AIs without hands. It stays as the
zero-setup fallback, but the product's real path is **agent-native**:

- **The platform owns** state, validation, UI, and the student experience.
- **A connected agent owns the labor** — ingestion, summarization, worksheet
  generation, reporting — through the MCP server (`supabase/functions/mcp/`)
  and the installable skills in [`skills/`](skills/).
- **The memory is llm.wiki** (after Karpathy): one small, dense, front-facing
  markdown note per artefact, wikilinked, in `resources` + the `docs/` vault.
  Agents must be able to *retrieve* the right note and *update* it — memory
  that can't be searched or revised isn't memory.

v1.0 is done when a teacher can: connect an agent once, import their whole
Google Classroom, seed a term of materials, generate class-fitted worksheets,
deploy them live, and get progress reports — with every worksheet component
stable and animated, and every fact the agent learns persisted as a note the
next agent can find.

## 2. Workstreams

| # | Workstream | Label query | v1 bar |
|---|---|---|---|
| A | **Component engine** | `area:components` | All 30 activity types stable (validator ⇄ renderer ⇄ analog parity, tested) and animated (`anim` label = the burn-down list), `prefers-reduced-motion` respected. |
| B | **Agent-native platform** | `area:platform`, `area:mcp`, `agent-native` | Every teacher capability reachable by an agent tool; skills for the top workflows; agent activity visible and trustworthy in the UI. |
| C | **Persistent memory** | `area:kb`, `memory` | Agents can search, read-full, and append/revise notes; agent-written notes carry wikilinks (graph edges); vault export is complete; docs vault link-consistent. |
| D | **Infra & hardening** | `area:infra` | CI builds + tests + deploys on push; MCP endpoint rate-limited; Supabase advisors clean or consciously waived. |

Priorities: `P0` = production blocker, fix before anything else. `P1` = the
v1.0 bar. `P2` = post-v1. Every issue carries exactly one priority label.

## 3. The issue protocol (how the fleet stays coherent)

Every issue in the tracker follows one template — this is what lets a fresh
agent pick one up with zero conversation context:

- **Context** — why it matters on the agent-native path.
- **Current state** — `file:line`-cited evidence. No speculation.
- **Definition of done** — verifiable bullets, tests included.
- **Knowledge base** — which `docs/` pages to **read** before starting
  (context retrieval) and which to **update** when done (context write-back).
  This is the llm.wiki discipline applied to our own development: the docs
  vault is the project's persistent memory, and an issue isn't done until the
  memory reflects the change.

## 4. Fleet orchestration

Small Sonnet fleet, dispatched from one orchestrator session (this pattern).
Roles:

- **Auditors** (read-only, parallel) — sweep a scope, emit issues in the
  template above. Run when entering a new phase or after a big merge.
- **Builders** (one issue or one tight label-cluster each, isolated worktrees)
  — implement to the issue's Definition of done. A builder's prompt is just:
  the issue body + the repo conventions (HANDOFF.md §8 gotchas, design-token
  rule, textContent-only rule) + "run `node tests/run-tests.mjs` and
  `tsc --noEmit` before reporting".
- **Verifier** (one per wave) — pulls the builders' branches, runs the full
  test suite + platform build, drives the preview browser through the touched
  flows, rejects anything that doesn't meet the issue's DoD.
- **Librarian** (one per wave, last) — updates the `docs/` pages named in each
  merged issue's Knowledge-base section, checks wikilink integrity, syncs the
  sibling `EnsinoLibre/docs` repo.

**Session recipe** (fits a constrained usage budget):

1. Orchestrator picks the next wave: `gh issue list -m 1 -l P0` first, then
   one workstream's P1s — 3-6 issues that don't touch the same files.
2. Spawn builders in parallel (Sonnet, worktree isolation), one issue each.
   Animation issues batch well: 3-4 `anim:` issues per builder since they all
   touch only `anim.js` + `renderer.js` hooks — but then ONE builder owns
   those files for the wave.
3. Verifier pass → orchestrator merges what passes, reopens what doesn't with
   a comment saying exactly what failed.
4. Librarian pass → docs updated, issues closed with a comment linking the
   commit.
5. Orchestrator pushes, deploys (until CI lands — see `area:infra`), checks
   the deployed URL with a cache-buster, updates this file's §5 checkboxes.

**Budget rules:** auditors and builders are Sonnet; the orchestrator stays in
one session per wave; never spawn an agent to do what a label query answers;
builders get the issue body verbatim, not the conversation history.

## 5. Phase sequence

- [ ] **Phase 0 — stabilize**: all P0s, CI pipeline (build + tests + deploy),
      so every later wave lands on green.
- [ ] **Phase 1 — memory loop**: the `memory` P1s — search/read-full/append
      tools, wikilinks on the agentic write path, vault completeness. (First
      because every other agentic feature compounds on reliable memory.)
- [ ] **Phase 2 — agent reach**: remaining `agent-native` P1s — missing MCP
      tools, the skills library, agent activity trust UX.
- [ ] **Phase 3 — all components animated**: burn down the `anim` label;
      cross-cutting reduced-motion support; stability fixes as encountered.
- [ ] **Phase 4 — production cut**: advisors clean, docs vault synced, deploy
      verified, HANDOFF.md rewritten for the v1.0 state, tag `v1.0`.

## 6. Standing conventions (every builder inherits these)

- Design tokens only (`--color-*`, `--space-*`, `el-*` primitives); never
  hardcode colours. Public site stays zero-build; app work in `platform/`.
- Worksheet data is untrusted: `textContent`, never `innerHTML` (audited
  exception: image-hotspot SVG via data URI).
- `validator.js` / `prompt-builder.js` in the MCP function are verbatim copies
  of `site/assets/js/*` — change canonically, copy, note in commit.
- Commit style: imperative subject, body says why;
  `git commit -F <file>` for multiline (PowerShell mangles `-m`).
- Verify on the **deployed** URL with a cache-buster after deploying.
