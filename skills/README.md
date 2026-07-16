# EnsinoLibre agentic skills

Skills for AI coding/desktop agents (Claude Code, Claude Desktop, or any
client that reads Anthropic-style `SKILL.md` files) that work directly inside
a teacher's EnsinoLibre workspace over [MCP](../docs/mcp-connect.md). Free,
MIT-licensed, and independent of the app itself — you don't need to run
EnsinoLibre locally to use them, just an agent key from your workspace.

## Available skills

| Skill | What it does |
|---|---|
| [`make-worksheet`](make-worksheet/SKILL.md) | Create or revise a worksheet — ground on real classroom/student context, pick activity types deliberately, validate-and-retry, offer to deploy it live. |
| [`seed-knowledge-base`](seed-knowledge-base/SKILL.md) | Bulk-ingest a folder of teaching files, or a Google Classroom Takeout export, file-by-file with no context-window wall — the agentic answer to the platform's copy-paste seeding/import flows. |
| [`progress-report`](progress-report/SKILL.md) | Turn raw progress data into a teacher-facing weekly review — per-student completion/score summary, filed as a dated knowledge-base note, numbers-only (never guesses reasons for low scores). |

## Installing

**Option A — the `skills` CLI** (works for any client that supports it):

```
npx skills add EnsinoLibre/core
```

This copies every skill in this folder into your own project's local skills
directory.

**Option B — by hand.** Copy the skill's folder (e.g. `seed-knowledge-base/`)
into wherever your agent looks for project skills, keeping the folder name
and `SKILL.md` filename as-is.

Either way, you also need an EnsinoLibre **agent key**: in the teacher
platform, go to **Worksheets → + Create worksheet → Connect via MCP** (or the
same tab on **Resources** / **Classrooms**), generate a key, and connect your
agent to the endpoint it shows you. Full details: [Connect your AI (MCP)](../docs/mcp-connect.md).

## Contributing a skill

- One folder per skill under `skills/`, named after the skill, containing a
  single `SKILL.md` with YAML frontmatter (`name`, `description`, and
  optionally `license`/`metadata`). Keep the `description` specific enough
  that an agent can decide when to trigger it without reading the body.
- Skills should only depend on the MCP tools documented in
  [`mcp-connect.md`](../docs/mcp-connect.md) — if a skill needs a tool that
  doesn't exist yet, add the tool to `supabase/functions/mcp/index.ts` first.
- Code is MIT, same as the rest of `core` — see [CONTRIBUTING.md](../CONTRIBUTING.md).
