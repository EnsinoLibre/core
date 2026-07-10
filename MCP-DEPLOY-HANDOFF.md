# Handoff: deploy & verify the EnsinoLibre MCP feature

**For:** an agent authenticated with the EnsinoLibre Supabase project
(`edgdxuvzyhwqidjjbidq`, org PHD) — via the Supabase MCP connector or a
`supabase` CLI login with access to that project.

**State:** all code is written, reviewed, type-checked and merged to `main`.
The teacher app UI ships a "Connect via MCP" tab that currently shows
"MCP backend not deployed yet". Your job is ONLY the backend deploy + an
end-to-end verification. Do not modify the frontend.

---

## 1. What this feature is

The teacher platform (`platform/`, built app at `site/app/`) lets a teacher
generate **agent keys** (`elk_…` bearer tokens) under
*Worksheets → + Create worksheet → Connect via MCP*. Any MCP client
(Claude Code, Claude Desktop, claude.ai connectors) uses such a key against
an MCP server (Supabase Edge Function, streamable HTTP JSON-RPC) to work
directly inside that teacher's workspace:

| Tool | Action |
|---|---|
| `get_workspace_context` | Workspace as markdown: profile, classrooms + context, students, knowledge notes, worksheets |
| `get_worksheet_contract` | Worksheet JSON contract (envelope, quality rules, activity shapes; filter with `types`) |
| `create_worksheet` | Validates a doc with the shared validator, inserts into `worksheets` |
| `list_worksheets` | Library listing |
| `add_resource` | Files an llm.wiki-style markdown note into `resources` |

Auth model: the app stores only SHA-256 hashes of keys in `agent_keys`
(RLS teacher-scoped). The function hashes the incoming bearer, maps it to
`teacher_id`, and performs every read/write with the service role scoped to
that teacher. **Therefore the function must be deployed with JWT
verification OFF** — it does its own auth.

## 2. Files (already in this repo)

- `supabase/migrations/20260710120000_agent_keys.sql` — the one migration
- `supabase/functions/mcp/index.ts` — the MCP server (passes `deno check`)
- `supabase/functions/mcp/validator.js`, `…/prompt-builder.js` — verbatim
  copies of `site/assets/js/*` (keep in sync if those ever change)
- `supabase/config.toml` — sets `[functions.mcp] verify_jwt = false`
- Docs: `docs/mcp-connect.md` · Ops: `HANDOFF.md` §10

## 3. Deploy steps

### A. Migration (creates `public.agent_keys`)

Preferred (Supabase MCP connector): `apply_migration` with name
`agent_keys` and the exact contents of
`supabase/migrations/20260710120000_agent_keys.sql`.

CLI alternative: `supabase link --project-ref edgdxuvzyhwqidjjbidq` then
`supabase db push`. ⚠️ The existing schema (`ensinolibre_core_schema`) was
applied via the Supabase MCP, so local/remote migration histories may
disagree — if `db push` balks, use `--include-all`, or just execute the SQL
directly. The migration is idempotent (`if not exists`) and touches nothing
else.

Sanity check afterwards: `agent_keys` exists, RLS enabled, one policy
(`teacher_id = auth.uid()` for authenticated), unique index on `key_hash`.

### B. Edge function

Preferred (Supabase MCP connector): `deploy_edge_function` with
`name: "mcp"`, `entrypoint_path: "index.ts"`, **`verify_jwt: false`**
(justified: custom bearer-key auth implemented in the function body), and
all three files from `supabase/functions/mcp/` (index.ts, validator.js,
prompt-builder.js) uploaded together.

CLI alternative: `supabase functions deploy mcp --no-verify-jwt`.

No secrets to set — the function only uses the auto-provided
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars.

## 4. Verify (do all of these)

Endpoint: `https://edgdxuvzyhwqidjjbidq.supabase.co/functions/v1/mcp`

1. **Auth rejection:** POST `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`
   with no/bad bearer → expect **401** with a JSON-RPC error mentioning the
   agent key.
2. **Get a real key:** sign in to the app (demo teacher
   `teacher@ensinolibre.org` / `ensinolibre`, dev server: `npm run dev` in
   `platform/`, port 4180; or the live app) → Worksheets → + Create
   worksheet → Connect via MCP → Generate a key. Copy the `elk_…` value.
   (If UI access is impractical: insert a row into `agent_keys` whose
   `key_hash` is the sha256 hex of a key you invent, `teacher_id` = the demo
   teacher's auth uid.)
3. **Protocol:** with `Authorization: Bearer elk_…`:
   - `initialize` → result carries `serverInfo.name: "ensinolibre"`
   - `tools/list` → exactly 5 tools
   - `tools/call get_workspace_context` → markdown mentioning the demo
     teacher's classrooms (e.g. "English A2 — Evening")
4. **Validation loop:** `tools/call create_worksheet` with
   `{"doc": {"title": "x"}}` → `isError: true` listing validator problems
   (NOT an insert).
5. **Happy path:** `create_worksheet` with a valid doc (copy any `doc` from
   the `worksheets` table, retitle it "ZZ MCP smoke test") → success text
   with the new id → row exists in `worksheets` → **delete that row**
   (`title = 'ZZ MCP smoke test'`) when done.
6. **add_resource:** create a note titled "ZZ MCP note" → row in
   `resources` → delete it.
7. **Real client (the point of it all):**
   `claude mcp add --transport http ensinolibre <endpoint> --header "Authorization: Bearer elk_…"`,
   then ask Claude to look at the workspace and create a small worksheet.
   Confirm it appears in the app (Worksheets page, "Check for new
   worksheets" button in the MCP tab). Remove the test worksheet after.
8. **Function logs** (`get_logs`, service `edge-function`): no unexpected
   errors; `agent_keys.last_used_at` was stamped.

## 5. Known follow-ups (do NOT block launch on these)

- v1.1 tools sketched but not built: `get_resource` (full note readback),
  `search_knowledge_base`, `update_resource`, `link_resource`,
  `get_worksheet`. Same table + auth, no schema changes.
- No rate limiting / key expiry yet — keys live until revoked in the UI.
- If you change tool schemas, update `docs/mcp-connect.md` and the tool
  list shown in `platform/src/components/CreateWorksheet.tsx` (McpTab).

## 6. Definition of done

The demo teacher can generate a key in the live app, hand the shown
`claude mcp add` command to Claude Code, and Claude can read the workspace
and create a worksheet that shows up in the library — with all "ZZ" test
rows cleaned up afterwards. When that works, delete this file (its content
is duplicated in HANDOFF.md §10 and docs/mcp-connect.md).
