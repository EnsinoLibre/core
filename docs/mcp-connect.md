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
| `add_resource` | Files an llm.wiki-style summary note into your knowledge base. |

A typical run: *"Make a B1 worksheet on phrasal verbs for my Tuesday class"* → the agent reads your workspace context, fetches the contract for the activity types it wants, generates the document, and `create_worksheet` validates and files it. Refresh the platform and it's there, ready to deploy.

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
