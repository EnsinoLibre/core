---
title: Connect your AI (MCP)
description: Give Claude — or any MCP client — direct tools inside your EnsinoLibre workspace.
---

# Connect your AI (MCP)

The prompt builder's copy-paste loop works with any AI. But if your AI speaks the **Model Context Protocol**, you can skip the clipboard entirely: EnsinoLibre exposes an MCP server that gives your agent real tools inside your workspace.

## What your agent can do

| Tool | What it does |
|---|---|
| `get_workspace_context` | Your workspace as front-facing markdown — profile, classrooms with context, students, knowledge notes, existing worksheets. |
| `get_worksheet_contract` | The worksheet JSON contract: envelope, quality rules, and the exact shapes of the activity types it plans to use. |
| `create_worksheet` | Validates a worksheet document and adds it straight to your library. Rejections return the validation problems verbatim, so the agent can fix and retry. |
| `list_worksheets` | What's already in the library. |
| `add_resource` | Files an llm.wiki-style summary note into your knowledge base — optionally scoped to a classroom/student by name. Idempotent: re-running it with the same title (and scope) updates that note instead of duplicating it. |
| `get_resource` | Reads one note in FULL, by id or title — `get_workspace_context` and `search_resources` only preview note text. |
| `search_resources` | Full-text search over the knowledge base (title/note/subject), filterable by kind/classroom/student/tags — the targeted alternative to reading everything. |
| `update_resource` | Revises an existing note in place — pass only the fields that changed. |
| `append_resource_note` | Adds a dated addendum to an existing note without touching what's already there. |
| `upsert_classroom` | Create a classroom, or merge into an existing one matched by name. Safe to call repeatedly. `overwrite: true` replaces existing fields instead of only filling gaps — reserved for an explicit teacher instruction to update context. |
| `upsert_student` | Create a student under a classroom (by name), or merge into an existing one. Safe to call repeatedly. Same `overwrite` rule as upsert_classroom. |
| `update_worksheet` | Revises an existing worksheet's content in place — same validation as create_worksheet. |
| `delete_worksheet` | Removes a worksheet from the library. Refuses if it's deployed to a live class. |
| `add_student_note` | Adds a dated observation to a student's record. Recent notes surface automatically in get_workspace_context. |
| `deploy_worksheets` | Deploys one or more worksheets as a live session with a join code — the agent-native last step of create → deploy. |
| `set_aula_status` | Opens or closes a live deployment by its join code. |
| `get_progress` | Reads student results across live deployments, filterable by aula code/classroom/student — the starting point for any progress review or report. |

A typical run: *"Make a B1 worksheet on phrasal verbs for my Tuesday class"* → the agent reads your workspace context, fetches the contract for the activity types it wants, generates the document, `create_worksheet` validates and files it, and — if you ask it to put the sheet in front of the class — `deploy_worksheets` puts a join code in your hands without a trip to the UI.

Claude Code (or any client that reads Anthropic-style skills) users get this procedure encoded rather than improvised — install the bundled [`make-worksheet`](https://github.com/EnsinoLibre/core/blob/main/skills/make-worksheet/SKILL.md) skill with `npx skills add EnsinoLibre/core` for the grounding → contract → validate-and-retry → deploy discipline on every request, not just the happy path.

## Bulk import (classrooms, rosters, files)

`upsert_classroom`, `upsert_student` and `add_resource` are also the agentic
answer to the copy-paste seeding/import flows described in
[[knowledge-seeding]] and [[google-classroom-import]] — instead of handing your
agent one prompt and pasting back one JSON reply (which hits a wall once a
Takeout export or a folder of files is large), an MCP-connected agent reads
your files locally and calls these tools once per classroom/student/artefact,
across as many turns as it needs. All three match-or-create by name, so
re-running an import never duplicates anything.

Claude Code (or any client that reads Anthropic-style skills) users don't
need to work out the procedure by hand — install the bundled
[`seed-knowledge-base`](https://github.com/EnsinoLibre/core/blob/main/skills/seed-knowledge-base/SKILL.md)
skill with `npx skills add EnsinoLibre/core` and just point it at a folder or
an unzipped Takeout export. See [`skills/`](https://github.com/EnsinoLibre/core/tree/main/skills)
in the repo for the full list and install notes.

## Weekly reviews from progress data

`get_progress` is the read path for turning live-deployment results into a
teacher-facing summary — filterable by aula code, classroom, and/or student.
The bundled [`progress-report`](https://github.com/EnsinoLibre/core/blob/main/skills/progress-report/SKILL.md)
skill encodes the discipline for this: pull the numbers, summarize
per-student completion/score, file one dated `weekly-review`-tagged note per
class via `add_resource` so the next review has a baseline, and report
numbers only — never a fabricated reason for a low score.

## Reading and revising memory at scale

`get_workspace_context` is a **preview**, not the whole knowledge base: it shows your most recent notes (with tags and links) and, once there are more than it can show, says so explicitly and points at `search_resources` instead of silently dropping the rest. That matters once a workspace has hundreds of notes — reading everything on every call doesn't scale, and a truncated dump the agent doesn't know is truncated is worse than no dump at all.

The read/write loop this enables: `search_resources` to find the relevant note(s), `get_resource` to read one in full, then `update_resource` (rewrite) or `append_resource_note` (dated addendum) to revise it — the same tools a teacher's own future agent session uses to keep long-lived context (a classroom's running notes, a student's profile) accurate instead of write-once.

## Connecting

1. In the teacher platform, open **Worksheets → + Create worksheet → Connect via MCP**.
2. Generate an **agent key** (`elk_…`). It is shown once — EnsinoLibre stores only its hash. Revoke it any time from the same key list (a confirm step protects against an accidental click).
3. Point your client at the endpoint with the key as a bearer token. For Claude Code:

```
claude mcp add --transport http ensinolibre \
  "https://<project>.supabase.co/functions/v1/mcp" \
  --header "Authorization: Bearer elk_…"
```

Other clients take the equivalent JSON config (shown in the app when you generate a key).

## Security model

- Keys are personal bearer tokens; only the SHA-256 hash is stored (`agent_keys` table, RLS teacher-scoped).
- The MCP server maps key → teacher and every read/write is scoped to that teacher's rows — the same boundary the app itself has.
- Worksheets are validated with the same validator the platform uses before anything is written.
- **Keys expire.** Pick 30 days, 90 days (default), 1 year, or never when you generate one — a leaked key isn't valid forever. An expired key gets a distinct "expired, generate a new one" error rather than a generic unauthorized, and shows as expired in your key list until you revoke or replace it.
- **Rate limited** to 60 requests/minute per key, so a leaked or misbehaving key can't hammer your workspace unbounded — past that it gets a 429 until the window clears.
- **What a revoked or expired agent sees.** The very next call after a key is revoked (or past its expiry) gets a `401` with a `WWW-Authenticate` header and a plain-language message telling it the key is no longer valid — not a silent failure or a generic error. There's no grace period and no way to un-revoke: reconnecting means generating a fresh key and pointing the client at it again.

## Trust, audit trail & undo

Every tool call — success or failure — is logged with a one-line human summary, visible live as you work (the [[knowledge-graph|Knowledge graph]]'s pulsing agent node) and retained for 30 days on the **Profile** page's **Agent activity** card, so "what did my agent do yesterday" has a real answer, including the calls that failed.

Nothing an agent writes is a silent, unrecoverable change: worksheets and knowledge notes an agent creates carry which key created them, and the same Agent activity card lists them with a one-click **↩ Revert** — deleting the item and logging that as its own audit-trail entry. There's no draft/review gate before a write lands (an agent's `create_worksheet` or `add_resource` is live immediately, the same as a teacher's own edit), so revert is the safety net, not a preview step — review what an agent did after the fact rather than before.

## Deploying the backend (self-hosters)

The server is a Supabase Edge Function in `supabase/functions/mcp/` plus the migrations under `supabase/migrations/`:

```
supabase db push          # creates agent_keys, agent_activity, search_vector, created_by_agent_key_id, etc.
supabase functions deploy mcp --no-verify-jwt
```

`--no-verify-jwt` is required — the function does its own agent-key auth.
