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
| `upsert_classroom` | Create a classroom, or merge into an existing one matched by name. Safe to call repeatedly. |
| `upsert_student` | Create a student under a classroom (by name), or merge into an existing one. Safe to call repeatedly. |

A typical run: *"Make a B1 worksheet on phrasal verbs for my Tuesday class"* → the agent reads your workspace context, fetches the contract for the activity types it wants, generates the document, and `create_worksheet` validates and files it. Refresh the platform and it's there, ready to deploy.

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

## Reading and revising memory at scale

`get_workspace_context` is a **preview**, not the whole knowledge base: it shows your most recent notes (with tags and links) and, once there are more than it can show, says so explicitly and points at `search_resources` instead of silently dropping the rest. That matters once a workspace has hundreds of notes — reading everything on every call doesn't scale, and a truncated dump the agent doesn't know is truncated is worse than no dump at all.

The read/write loop this enables: `search_resources` to find the relevant note(s), `get_resource` to read one in full, then `update_resource` (rewrite) or `append_resource_note` (dated addendum) to revise it — the same tools a teacher's own future agent session uses to keep long-lived context (a classroom's running notes, a student's profile) accurate instead of write-once.

## Connecting

1. In the teacher platform, open **Worksheets → + Create worksheet → Connect via MCP**.
2. Generate an **agent key** (`elk_…`). It is shown once — EnsinoLibre stores only its hash. Revoke it any time.
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

## Deploying the backend (self-hosters)

The server is a Supabase Edge Function in `supabase/functions/mcp/` plus one migration:

```
supabase db push          # creates agent_keys
supabase functions deploy mcp --no-verify-jwt
```

`--no-verify-jwt` is required — the function does its own agent-key auth.
