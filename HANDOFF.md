# EnsinoLibre — developer handoff

Last updated: 2026‑07‑07. This file is the single source of truth for picking up
development. Read it fully before touching code.

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
│           ├── prompt-builder / validator / renderer / anim / analog / exporters  ← the worksheet "blocks" engine (shared)
│           ├── nav.js, theme.js, md.js, docs.js, app.js  ← public site wiring
│           ├── app/           ← shared logic: store.js (localStorage), graph.js, seed-worksheets.js, util.js, router.js, track.js, vault.js, zip.js
│           └── aula/          ← STUDENT app: api.js (Supabase), views.js, main.js
├── platform/                  ← THE BUILT TEACHER APP (Vite/React/TS)
│   ├── src/
│   │   ├── main.tsx, App.tsx  ← entry + router + RequireAuth
│   │   ├── components/        ← Shell, ErrorBoundary, KnowledgeGraph, DeployModal, bits.tsx
│   │   ├── views/             ← Login, Dashboard, Knowledge, Classrooms, Students, Resources, Worksheets, Live, Profile
│   │   ├── lib/               ← api.ts (facade), store.js*, graph.js*, seed-worksheets.js*, validator/analog/exporters/vault/zip/wordsearch, theme.ts
│   │   └── styles/            ← index.css, tokens.css, primitives/, app.css, graph.css
│   ├── package.json, vite.config.ts, tsconfig.json, index.html
│   └── dist/                  ← build output (gitignored)
├── docs/                      ← Obsidian markdown docs (served by docs.html; mirror of EnsinoLibre/docs)
├── schema/worksheet.schema.json
├── tests/run-tests.mjs        ← 121 tests for the worksheet engine (node)
├── server.mjs                 ← tiny static dev server (serves directory indexes)
└── netlify.toml

* store.js / graph.js / seed-worksheets.js are COPIES of the site versions
  (single source of truth is site/assets/js/app/*; keep them in sync).
```

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

**Manual deploy (there is no CI):**
```
cd platform && <NPM> run build
# copy platform/dist -> site/app
cd core && <NETLIFY> deploy --prod --dir . --site d0da070a-0639-404e-9f7a-2b9fa62ff370
```
`NETLIFY = ...\.runtime\netlify.cmd`. netlify CLI needs `dangerouslyDisableSandbox`
for network in this environment.

> **Always check the DEPLOYED version after deploying**, not just localhost.
> Two things bit us before:
> 1. A leftover `site/app.html` file collided with the built `site/app/` dir —
>    Netlify served the old file for `/site/app/`. Don't create `*.html` files
>    whose name matches a directory.
> 2. Browsers cache the old hashed bundle. Load with a cache‑buster query
>    (`/site/app/?cb=<timestamp>`) to confirm the new `index-*.js` is served.

**Consider adding a GitHub Action** that builds the platform, copies to
`site/app`, and deploys on push — this manual flow is the main source of friction.

---

## 5. Backend — Supabase (the important part)

Dedicated project **EnsinoLibre** (separate from the English‑with‑Sara DB):

- Project id: **`edgdxuvzyhwqidjjbidq`** · org **PHD** (`xtnuilslvhhzaqavccul`) · region eu‑west‑2 · $0/mo
- URL: **`https://edgdxuvzyhwqidjjbidq.supabase.co`**
- Publishable key (safe in client): **`sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063`**
- Demo teacher login: **teacher@ensinolibre.org / ensinolibre**
- The Supabase MCP is available to you — use it for migrations (`apply_migration`),
  SQL (`execute_sql`), advisors (`get_advisors`), keys, etc.

**Schema** (migration `ensinolibre_core_schema`): `profiles`, `classrooms`,
`students`, `student_notes`, `worksheets(doc jsonb)`, `resources`, `aulas`
(deployments; `code` unique), `aula_worksheets`, `enrollments` (name‑based,
unique per aula via a generated `name_key`), `progress`.

**Security model:**
- **RLS on every table.** Teacher tables use `teacher_id = auth.uid()`. Teachers
  can also *read* `enrollments`/`progress` of their own aulas.
- **Public/student access is ONLY through code‑gated `SECURITY DEFINER` RPCs** —
  anon never selects tables directly (verified: anon `students` select → `[]`):
  - `get_aula(p_code)` → deployment + class + worksheets (live only)
  - `join_aula(p_code, p_name)` → upserts enrollment, returns aula + worksheets + `enrollment_id`
  - `get_my_progress(p_enrollment_id)` → this student's rows
  - `save_progress(p_enrollment_id, p_worksheet_id, total, attempted, correct, done, score)`
- `handle_new_user` trigger auto‑creates a `profiles` row on signup.

**Client note for the teacher migration:** RLS auto‑scopes `select` to
`auth.uid()`, but **inserts must set `teacher_id = session.user.id`** (there is no
default). Either pass it explicitly or add a column default / before‑insert
trigger (`teacher_id := auth.uid()`).

---

## 6. Current data-layer state (READ THIS)

| Area | Data source today |
|------|-------------------|
| **Student aula** (`site/…/aula/*`) | ✅ **Supabase** (RPCs). Public link `aula.html?code=<CODE>`. Progress in Postgres. Session marker in `sessionStorage` (a login token, not coursework). |
| **Teacher platform** (`platform/`) | ⏳ **still localStorage** via `platform/src/lib/store.js` + fake `auth`. This is what you migrate. |

The teacher store shape (what the views expect) is an in‑memory object:
`{ teacher, classrooms[], students[] (each with notes[]), resources[]
(kind/type/classId/studentId/url/note/tags/links), worksheets[] ({id,title,subject,doc}),
aulas[] ({classId,title,code,status,worksheetIds[]}), enrollments[] ({id,aulaId,name}),
progress{} keyed "aulaId:enrollmentId:worksheetId" }`.
All `store.*` reads are **synchronous**; the views mutate then re‑render via a
local `force`/`useState` counter. `api.ts` re‑exports `store`, `auth`,
`onLiveUpdate`, `refresh`, `validateWorksheet`, the exporters, `buildVault`,
`makeZip`, and the graph helpers.

---

## 7. First tasks (prioritised)

### Task A — Teacher Supabase Auth
Replace the fake login with real Supabase Auth (email/password; the demo teacher
exists). Concretely:
- Add `platform/src/lib/supabase.ts` → `createClient(URL, PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } })`.
- Rewrite `platform/src/views/Login.tsx` to call `supabase.auth.signInWithPassword`.
  Add a sign‑up path (`signUp`) — decide whether to require email confirmation
  (for a smooth demo you may disable confirmation in Auth settings, or use magic
  links). Show real errors.
- `App.tsx` `RequireAuth`: gate on `supabase.auth.getSession()`; subscribe to
  `onAuthStateChange`. Sign‑out in `Shell` calls `supabase.auth.signOut()`.
- The public landing/docs already show an avatar when a session exists — keep
  that working (it reads `localStorage`; you may switch it to the supabase session
  or leave the simple check).

### Task B — Migrate the teacher store to Supabase
Recommended low‑risk approach: **keep the synchronous store API**, back it with an
in‑memory cache hydrated from Supabase.
- `store.hydrate()` (async, run once after login): with the **authenticated**
  client, `select *` from each teacher table (RLS scopes to the teacher),
  plus `enrollments`/`progress` for their aulas, and build the exact `state`
  shape above. Map: `aula.worksheetIds` from `aula_worksheets` (ordered by
  `position`); `student.notes` from `student_notes`; keep `resources.links`/`tags`
  as text[].
- Reads stay synchronous from `state`.
- Writes: **client‑generate a uuid** (`crypto.randomUUID()`), update `state`
  optimistically, and fire the Supabase insert/update/delete (set
  `teacher_id`). Keep method names identical so views don't change
  (`addClassroom`, `updateStudent`, `addWorksheet`, `createAula`, `setValidation`,
  `removeAula`, …). `createAula` should insert the aula + `aula_worksheets`.
- **Live monitor**: `enrollments`/`progress` are written by students via RPC.
  Replace the localStorage `BroadcastChannel` `onLiveUpdate` with **Supabase
  Realtime** on `progress`/`enrollments` (filter to the teacher's aulas) or a
  simple poll (re‑select every ~4s) so the Live view updates as students work.
- Delete the localStorage code paths once done. The student flow already writes
  to the same DB, so the Live monitor will then show real progress.

### Task C — Clickable worksheets / cards → worksheet + progress dashboard
- **Worksheets** (`platform/src/views/Worksheets.tsx`): make each card clickable
  to a new route `/worksheets/:id` — a detail view that (1) **renders the actual
  worksheet** read‑only and (2) shows a **progress dashboard**: across every
  deployment (aula) that includes this worksheet, list students × their
  attempted/score/validated. Reuse `store.exportRows`‑style aggregation.
- **Rendering a worksheet inside React**: the renderer is DOM‑based
  (`site/assets/js/renderer.js`). You can import it into the platform via a
  relative path (`../../site/assets/js/renderer.js`) — Vite bundles it and
  `anim.js` is self-contained (vanilla Web Animations API, no vendored engine).
  Mount it in a `useEffect` into a `ref` div. (Or build a small read‑only preview.)
- Also wire up the obvious drill‑downs the user asked for: **Live** monitor cells
  / student rows → a per‑student progress panel; keep classroom/student cards
  clickable (they already route to details in `Classrooms`/`Students`).

**Definition of done:** teacher logs in with real auth, sees their real data from
Supabase, deploys a worksheet (writes to DB), a student joins by code and works
through it, and the teacher's Live monitor + the worksheet's progress dashboard
show that progress — all with no localStorage for data. Verify on the **deployed**
URL with a cache‑buster, and re‑run `get_advisors` after any DDL.

---

## 8. Gotchas (learned the hard way)

- **PowerShell here‑strings mangle multiline git messages** — commit with `git
  commit -F <file>` (write the message to a file first), not inline `-m`.
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
  hashes stored in `agent_keys` (RLS teacher-scoped). The function maps
  key -> teacher_id and writes with the service role, always teacher-scoped.
- Tools: get_workspace_context, get_worksheet_contract, create_worksheet
  (validated with the shared validator), list_worksheets, add_resource.
- `validator.js` / `prompt-builder.js` inside the function dir are verbatim
  copies of `site/assets/js/*` - keep in sync.
- Deploy (needs a Supabase access token for project edgdxuvzyhwqidjjbidq):
    supabase link --project-ref edgdxuvzyhwqidjjbidq
    supabase db push
    supabase functions deploy mcp --no-verify-jwt
  (`--no-verify-jwt` is required: the function does its own key auth.)
