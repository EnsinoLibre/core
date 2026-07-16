# EnsinoLibre — developer handoff

Last updated: 2026‑07‑16. This file is the single source of truth for picking up
development. Read it fully before touching code. For what's next specifically,
see **[ROADMAP.md](ROADMAP.md)** and the pinned tracking epic
(github.com/EnsinoLibre/core/issues/49) — this file covers the codebase and
backend as they stand, ROADMAP/the epic cover prioritised outstanding work.

---

## 1. What EnsinoLibre is

A free, open worksheet platform for teachers. Two clearly separated surfaces:

- **Public site (zero‑build, dependency‑free)** — landing page, docs, the
  worksheet **generator**, and the **student "aula"** page. Plain HTML + CSS +
  ES modules, no build step. Lives in `core/site/`.
- **Teacher platform (a real built app)** — everything behind teacher login:
  workspace, classrooms, students, worksheets, live classroom, knowledge graph.
  **Vite + React + TypeScript**, free to use dependencies. Lives in
  `core/platform/`; builds to `core/site/app/`.

> Golden rule: keep the public site zero‑build; do all app work in `platform/`.

---

## 2. Where things live

Everything active is in **one repo: `EnsinoLibre/core`** (this repo). Other org
repos (`blocks`, `docs`, `examples`, `design-system`, `assets`, `website`) exist
but `core` is where the product is built and deployed from.

```
core/
├── site/                      ← PUBLIC, zero-build (deploy this whole dir)
│   ├── index.html             ← landing + worksheet generator
│   ├── docs.html              ← docs viewer (Obsidian markdown in core/docs)
│   ├── aula.html              ← STUDENT page (Supabase-backed, code-gated)
│   ├── app/                   ← BUILT platform output (gitignored; copied from platform/dist)
│   └── assets/
│       ├── styles.css         ← public site styles (bridged onto design tokens)
│       ├── app.css            ← shared app-chrome styles
│       ├── brand/             ← wordmark + favicon (theme-adaptive)
│       ├── vendor/            ← tokens.css, primitives/, marked, supabase.esm.js
│       └── js/
│           ├── prompt-builder / validator / renderer / anim / analog / exporters  ← the worksheet "blocks" engine (canonical here — supabase/functions/mcp/{validator,prompt-builder}.js are verbatim copies, see §10)
│           ├── nav.js, theme.js, md.js, docs.js, app.js  ← public site wiring
│           ├── app/           ← util.js, router.js, track.js, vault.js, zip.js (still used); store.js, graph.js removed as dead (zero importers, superseded by platform/src/lib/*); seed-worksheets.js also unused but kept as a content reference for platform/src/lib/seed-worksheets.js
│           └── aula/          ← STUDENT app: api.js (Supabase), views.js, main.js
├── platform/                  ← THE BUILT TEACHER APP (Vite/React/TS)
│   ├── src/
│   │   ├── main.tsx, App.tsx  ← entry + router + RequireAuth
│   │   ├── components/        ← Shell, ErrorBoundary, KnowledgeGraph, DeployModal, bits.tsx
│   │   ├── views/             ← Login, Dashboard, Knowledge, Classrooms, Students, Resources, Worksheets, Live, Profile
│   │   ├── lib/               ← api.ts (facade), store.js, graph.js, seed-worksheets.js (all canonical here — no site equivalent), validator/analog/exporters/vault/zip/wordsearch, theme.ts
│   │   └── styles/            ← index.css, tokens.css, primitives/, app.css, graph.css
│   ├── package.json, vite.config.ts, tsconfig.json, index.html
│   └── dist/                  ← build output (gitignored)
├── docs/                      ← Obsidian markdown docs (served by docs.html; mirror of EnsinoLibre/docs)
├── schema/worksheet.schema.json
├── tests/run-tests.mjs        ← 128 tests for the worksheet engine (node), incl. an MCP-copy drift check (§10)
├── server.mjs                 ← tiny static dev server (serves directory indexes)
└── netlify.toml
```

**Copy-ownership, per shared file (see #32):**
- `prompt-builder.js` / `validator.js` — canonical in `site/assets/js/`;
  `supabase/functions/mcp/{validator,prompt-builder}.js` are verbatim copies
  the MCP server needs bundled into its own function dir. **Always re-read
  both fresh before every `deploy_edge_function` call** — see §10.
- `store.js` / `graph.js` / `seed-worksheets.js` — canonical in
  `platform/src/lib/`. The old `site/assets/js/app/*` copies these used to
  shadow were dead (zero importers, superseded once the teacher platform
  moved off localStorage) and were deleted in #32 — there is no site-side
  copy left to keep in sync.

---

## 3. Local dev (Windows, no global node/npm)

There is **no node/npm on PATH**. Use the runtime bundled with the sibling PWA:

```
NODE = C:\Users\User\Documents\Claude\english-with-sara-pwa\.runtime\node.exe
NPM  = C:\Users\User\Documents\Claude\english-with-sara-pwa\.runtime\npm.cmd
```

- **Run the public site / student page / built platform:** `node core/server.mjs`
  → http://localhost:3210 (or use the `ensinolibre-core` launch config, port 3215).
- **Platform dev:** `cd platform && <NPM> run dev` (Vite, port 4180).
- **Platform build:** `cd platform && <NPM> run build`, then copy `platform/dist`
  → `core/site/app` (both gitignored; the deploy ships them from disk).
- **Worksheet engine tests:** `node core/tests/run-tests.mjs` (should be 121/0).

---

## 4. Deploy

Netlify site **`ensinolibre-app`** (project id `d0da070a-0639-404e-9f7a-2b9fa62ff370`,
team viansara). Live at **https://ensinolibre-app.netlify.app**. The paths are
under `/site/...` (landing at `/site/index.html`, platform at `/site/app/`,
student at `/site/aula.html`).

**CI gate:** `.github/workflows/ci.yml` runs on every push/PR to `main` — the
worksheet-engine test suite (`npm test`, 128 tests) and the platform's
`typecheck` + `vite build`, on GitHub's own Ubuntu runners with a real `npm`
(no `<NPM>`/`<NETLIFY>` runtime-path workarounds needed there — those are
only for this Windows dev box). It does **not** deploy: that needs a
`NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID` repo secret nobody has added yet, so
CI is a build/test gate only, not an auto-deploy pipeline. Deploy is still
one of the two paths below.

**Manual deploy:**
```
cd platform && <NPM> run build
# copy platform/dist -> site/app
cd core && <NETLIFY> deploy --prod --dir . --site d0da070a-0639-404e-9f7a-2b9fa62ff370
```
`NETLIFY = ...\.runtime\netlify.cmd`. netlify CLI needs `dangerouslyDisableSandbox`
for network in this environment.

`netlify.toml`'s own `[build] command` (`npm --prefix platform ci && npm --prefix
platform run build && node scripts/sync-app.mjs`) is git-buildable — if the
Netlify site has its git integration enabled in the dashboard, pushing to
`main` deploys automatically without the manual CLI steps above. Not
confirmed either way from this dev box (no dashboard access); check the
Netlify site's **Site settings → Build & deploy** before assuming which path
is actually live.

> **Always check the DEPLOYED version after deploying**, not just localhost.
> Two things bit us before:
> 1. A leftover `site/app.html` file collided with the built `site/app/` dir —
>    Netlify served the old file for `/site/app/`. Don't create `*.html` files
>    whose name matches a directory.
> 2. Browsers cache the old hashed bundle. Load with a cache‑buster query
>    (`/site/app/?cb=<timestamp>`) to confirm the new `index-*.js` is served.

---

## 5. Backend — Supabase (the important part)

Dedicated project **EnsinoLibre** (separate from the English‑with‑Sara DB):

- Project id: **`edgdxuvzyhwqidjjbidq`** · org **PHD** (`xtnuilslvhhzaqavccul`) · region eu‑west‑2 · $0/mo
- URL: **`https://edgdxuvzyhwqidjjbidq.supabase.co`**
- Publishable key (safe in client): **`sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063`**
- Demo teacher login: **teacher@ensinolibre.org / ensinolibre**
- The Supabase MCP is available to you — use it for migrations (`apply_migration`),
  SQL (`execute_sql`), advisors (`get_advisors`), keys, etc.

**Schema** (migration `ensinolibre_core_schema` plus everything under
`supabase/migrations/`): `profiles`, `classrooms`, `students`, `student_notes`,
`worksheets(doc jsonb, created_by_agent_key_id)`, `resources(…, search_vector
generated tsvector, created_by_agent_key_id)`, `aulas` (deployments; `code`
unique; `class_id` nullable for public/class‑less links; `password_hash`,
`failed_attempts`, `locked_until`), `aula_worksheets`, `enrollments`
(name‑based, unique per aula via a generated `name_key`), `progress`,
`agent_keys` (`elk_…` bearer tokens, `expires_at` nullable = never expires),
`agent_activity` (per‑tool‑call audit log: `status`, `summary`,
`target_node_id`; 30‑day retention, swept per call — see §10). `progress` and
`enrollments` are also added to the `supabase_realtime` publication (see #33)
so the teacher platform's Live monitor can subscribe instead of polling.

**Security model:**
- **RLS on every table.** Teacher tables use `teacher_id = auth.uid()`. Teachers
  can also *read* `enrollments`/`progress` of their own aulas, and *insert*
  their own `agent_activity` rows (used only for teacher-initiated reverts of
  agent writes — see §10). Realtime Postgres Changes honours these same SELECT
  policies, so a teacher's realtime subscription only ever receives events for
  their own aulas' rows — no separate authorization layer needed.
- **Public/student access is ONLY through code‑gated `SECURITY DEFINER` RPCs** —
  anon never selects tables directly (verified: anon `students` select → `[]`):
  - `get_aula(p_code)` → deployment + class + worksheets (live only) + `has_password`
  - `join_aula(p_code, p_name, p_password default null)` → verifies the
    password if one is set (bcrypt via `extensions.crypt`, with a legacy‑sha256
    read/upgrade path), locks the code for 15 minutes after 5 wrong guesses,
    upserts the enrollment, returns aula + worksheets + `enrollment_id`
  - `set_aula_password(p_aula_id, p_password)` → teacher‑only (checks
    `auth.uid()`), hashes server‑side; the client never computes or uploads a hash
  - `bcrypt_hash_service(p_plain)` → service‑role‑only primitive the `mcp`
    edge function uses to hash a `deploy_worksheets` password
  - `get_my_progress(p_enrollment_id)` → this student's rows
  - `save_progress(p_enrollment_id, p_worksheet_id, total, attempted, correct, done, score)`
- `handle_new_user` trigger auto‑creates a `profiles` row on signup.

**Client note for the teacher migration:** RLS auto‑scopes `select` to
`auth.uid()`, but **inserts must set `teacher_id = session.user.id`** (there is no
default). Either pass it explicitly or add a column default / before‑insert
trigger (`teacher_id := auth.uid()`).

---

## 6. Data layer

| Area | Data source |
|------|-------------------|
| **Student aula** (`site/…/aula/*`) | **Supabase** (RPCs). Public link `aula.html?code=<CODE>`. Progress in Postgres. Session marker in `sessionStorage` (a login token, not coursework). |
| **Teacher platform** (`platform/`) | **Supabase**, real auth (Tasks A/B/C below shipped). `platform/src/lib/store.js` is a synchronous in‑memory cache hydrated once after login, writes fire‑and‑forget to Postgres. |

The teacher store shape (what the views expect) is an in‑memory object:
`{ teacher, classrooms[], students[] (each with notes[]), resources[]
(kind/type/classId/studentId/url/note/tags/links), worksheets[] ({id,title,subject,doc}),
aulas[] ({classId,title,code,status,worksheetIds[]}), enrollments[] ({id,aulaId,name}),
progress{} keyed "aulaId:enrollmentId:worksheetId" }`.
All `store.*` reads are **synchronous**; the views mutate then re‑render via a
local `force`/`useState` counter. `api.ts` re‑exports `store`, `auth`,
`onLiveUpdate`, `refresh`, `validateWorksheet`, the exporters, `buildVault`,
`makeZip`, and the graph helpers.

**Public generator save (issue #18).** The zero-build generator's "Save to my
library" now writes to the real `worksheets` table via
`site/assets/js/app/supabase-save.js` — a Supabase client that reuses the
platform's persisted session (same `storageKey: 'ensinolibre.teacher.auth'`,
same origin in production). Signed in → real insert scoped to `teacher_id`;
signed out → honest message + JSON download (no more misleading "saved" into a
localStorage store the platform never read). `app.js` no longer imports the
`app/store.js` localStorage boilerplate. (The topbar avatar in `nav.js` still
reads the old fake session — separate boilerplate, out of scope for #18.)

**Write-error surfacing (issue #17).** `store.js` writes mutate in-memory state
first, then fire the Supabase write. A failed write (RLS, network, FK) no longer
just `console.error`s — `fire()` calls `reportWriteError()`, which increments a
counter and notifies `onWriteError(handler)` subscribers. `api.ts` re-exports
`onWriteError` / `writeErrorTotal`; `Shell.tsx`'s `WriteErrorBanner` subscribes
and shows a persistent banner with **Reload from server** (`store.reset()` →
`location.reload()`), reconciling optimistic state with DB truth. Known gap left
for a follow-up: plain `UPDATE`s in `setValidation`/`setProgress` that match **0
rows** return no error, so they aren't caught by this hook (they'd need a
`.select()` + row-count check per call site).

---

## 7. Foundational tasks (shipped)

The original three foundational tasks that took the teacher platform off
localStorage are done — kept here as a record of what "done" looked like, not
as a to‑do list. For what's actually next, see **[ROADMAP.md](ROADMAP.md)**
and the tracking epic (github.com/EnsinoLibre/core/issues/49).

- **Task A — Teacher Supabase Auth.** `platform/src/lib/supabase.ts` +
  `Login.tsx` on `supabase.auth.signInWithPassword`/`signUp`; `App.tsx`
  `RequireAuth` gates on `supabase.auth.getSession()` and subscribes to
  `onAuthStateChange`; `Shell` sign‑out calls `supabase.auth.signOut()`.
- **Task B — Teacher store on Supabase.** `store.js` hydrates a synchronous
  in‑memory cache once after login (`store.hydrate()`), reads stay synchronous,
  writes are client‑uuid'd and fire‑and‑forget to Postgres (`fire()` /
  `fireTracked()` for writes a dependent insert must wait on — see
  `whenReady()`). Live monitor subscribes to **Supabase Realtime** on
  `progress`/`enrollments` (RLS-scoped, so each teacher only receives their
  own aulas' events), with a poll fallback scoped to live aulas only, paused
  on `document.hidden` — see #33 and migration
  `20260716140000_realtime_progress_enrollments.sql`. Replaces the original
  4s unscoped poll, itself a replacement for the old localStorage
  `BroadcastChannel`.
- **Task C — Clickable worksheets → detail + progress dashboard.**
  `/worksheets/:id` renders the actual worksheet (via the shared
  `site/assets/js/renderer.js`) read‑only plus a cross‑deployment progress
  dashboard; classroom/student cards and Live monitor rows drill down to
  per‑entity panels.

**Definition of done (met):** teacher logs in with real auth, sees their real
data from Supabase, deploys a worksheet, a student joins by code and works
through it, and the teacher's Live monitor + the worksheet's progress
dashboard show that progress — all with no localStorage for data.

---

## 8. Gotchas (learned the hard way)

- **PowerShell here‑strings mangle multiline git messages** — commit with `git
  commit -F <file>` (write the message to a file first), not inline `-m`.
- **`store.js` writes are fire-and-forget by design** (`fire()`, optimistic UI)
  — fine for independent rows, but a child insert that references a row
  *just* created inline (e.g. a classroom created from a student/resource
  "+ Create" relation picker) can race the parent's own insert and fail its
  FK/RLS check silently. Use `fireTracked(builder, label, id)` for the parent
  write and `await store.whenReady(id)` before firing the dependent child
  write — see `addClassroom`/`AddEntity.tsx`'s `save()` handlers.
- **LF→CRLF warnings** on commit are noise (the repo is fine).
- **esbuild needs node on PATH**: to re‑bundle the vendored supabase client,
  `node platform/node_modules/esbuild/bin/esbuild <entry> --bundle --format=esm
  --minify --outfile=site/assets/vendor/supabase.esm.js` with the runtime dir on PATH.
- **Sigma / KnowledgeGraph**: Sigma throws "container has no height" if inited
  before layout — the component defers init until the container is measured.
  graphology rejects duplicate/bidirectional edges — dedupe both directions.
  The preview screenshot tool times out on the WebGL page (harmless); verify via
  DOM `eval` instead.
- **Worksheet engine** is schema v2, **30 activity types, audio types removed**
  (dictation/listen‑mcq). Speech buttons are hidden behind `AUDIO_ENABLED=false`
  in `renderer.js`. Don't reintroduce audio without the browser‑TTS work
  (tracked in issue EnsinoLibre/core#2).
- **Design system is the source of truth** for styling: use the `el-*` primitives
  and `--color-*/--space-*/--font-*` tokens (light + `[data-theme="dark"]`).
  Never hardcode colours.

---

## 9. Key references

- Live: https://ensinolibre-app.netlify.app · Platform: `/site/app/` · Student: `/site/aula.html?code=A2LIVE`
- Repo: https://github.com/EnsinoLibre/core
- Supabase project `edgdxuvzyhwqidjjbidq` (org PHD)
- Worksheet format: `schema/worksheet.schema.json` + `docs/` (Obsidian)

---

## 10. MCP backend (agent integration)

The teacher app's "Create worksheet -> Connect via MCP" tab talks to a
Supabase Edge Function that implements the Model Context Protocol
(streamable HTTP): `supabase/functions/mcp/` + migration
`supabase/migrations/20260710120000_agent_keys.sql`.

- Auth: personal agent keys (`elk_...`) generated in the app; only SHA-256
  hashes stored in `agent_keys` (RLS teacher-scoped), with an optional
  `expires_at` (30d/90d/1y/never, picked at generation — see #47). The
  function maps key -> teacher_id and writes with the service role, always
  teacher-scoped. Requests are also rate-limited to 60/min per key (429 past
  that), tracked by reusing `agent_activity` rather than a separate counter
  table — see #47.
- Tools (17): get_workspace_context, get_worksheet_contract, create_worksheet
  (validated with the shared validator), update_worksheet, delete_worksheet
  (refuses if deployed), list_worksheets, add_resource (idempotent by
  title+scope, with a soft llm.wiki style-check nudge in the response text —
  see #40), get_resource, search_resources (full-text via a `search_vector`
  generated column + GIN index on `resources`), update_resource,
  append_resource_note, upsert_classroom, upsert_student, add_student_note,
  deploy_worksheets, set_aula_status, get_progress.
  get_workspace_context previews recent notes only and says so once there
  are more — search_resources/get_resource are the read path past that.
  Full per-tool table: [[mcp-connect]].
- Every call (success or failure) is logged to `agent_activity` with a
  one-line summary and status, retained 30 days, and surfaced live in the
  Knowledge graph's agent node plus a Profile "Agent activity" card with
  per-item Revert (deletes the item, logs the revert as its own entry) — see
  #29/#38.
- `validator.js` / `prompt-builder.js` inside the function dir are verbatim
  copies of `site/assets/js/*` - keep in sync (CI enforces this: `tests/run-tests.mjs`
  §11 fails the build if either copy drifts, modulo line endings — see #32),
  and **always re-read both files fresh before every `deploy_edge_function`
  call** — reconstructing their content from memory has caused a real
  deploy-breaking syntax error before (mismatched `prompt-builder.js` tail);
  never assume "same as last deploy" without reading them again.
- Deploy (needs a Supabase access token for project edgdxuvzyhwqidjjbidq):
    supabase link --project-ref edgdxuvzyhwqidjjbidq
    supabase db push
    supabase functions deploy mcp --no-verify-jwt
  (`--no-verify-jwt` is required: the function does its own key auth.)
- Live aula passwords (`join_aula`) are bcrypt-hashed server-side
  (`set_aula_password` RPC, teacher-owned) with a 5-attempt/15-minute
  lockout inside `join_aula` itself — see [[live-classroom]] and
  `supabase/migrations/20260715130000_aula_password_bcrypt_rate_limit.sql`.
- **Keeping this file in sync:** whenever a migration touches `agent_keys`,
  `agent_activity`, `aulas`, or any RPC signature listed in §5, update this
  section and §5 in the same commit — that drift (stale tool list, stale RPC
  signatures) is exactly what issue #48 fixed.
