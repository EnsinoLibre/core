---
name: make-worksheet
description: Create (and iterate on) an EnsinoLibre worksheet over MCP — ground on the teacher's real classroom/student context, pick activity types that fit the level and purpose, fetch the contract for only those types, validate-and-retry until it's accepted, and offer to deploy it live. Use when the user asks to make/create/generate a worksheet, quiz, or set of exercises "in EnsinoLibre" or "for my class", or to revise/fix/deploy an existing one.
license: MIT
metadata:
  author: EnsinoLibre
  version: "1.0.0"
  homepage: https://ensinolibre-app.netlify.app
  source: https://github.com/EnsinoLibre/core
  requires: EnsinoLibre MCP connection (agent key) — see docs/mcp-connect.md
---

# Make an EnsinoLibre worksheet

Worksheet creation is the core EnsinoLibre workflow. This skill is the
quality discipline behind it: ground on the real class before writing
anything, pick activity types deliberately instead of defaulting to the same
few, and treat a validation rejection as a fix-and-retry signal, not a
failure to report back.

Requires the EnsinoLibre MCP server connected (`get_workspace_context`,
`get_worksheet_contract`, `create_worksheet`, `update_worksheet`,
`list_worksheets`, and — if the teacher wants it live — `deploy_worksheets`).
If it isn't connected, tell the user to follow [[mcp-connect]] first.

## Procedure

1. **Ground yourself.** Call `get_workspace_context` once. If the teacher
   named a class, find it and read its `level`, `subject`, `context`, and
   roster (each student's `needs`/recent observations) — this is what makes
   the worksheet actually fit the class instead of being generic. Also note
   existing worksheet titles so you don't hand back a near-duplicate of
   something already in the library.

2. **Ask only what you can't infer.** Topic and rough activity count usually
   come from the request itself. Audience/level/language come from the
   classroom context if one was named; ask the teacher directly only for
   what's genuinely missing (e.g. no class was named and the request doesn't
   say who it's for).

3. **Choose activity types deliberately.** Don't default to the same handful
   every time — pick the shapes that fit the actual purpose:
   - A vocabulary drill → `flashdeck`, `memory-game`, `gap-fill`.
   - Grammar practice → `grammar-forms`, `tense-shift`, `question-set`.
   - A scored check → `quiz` or `single-choice-set` with a `passMark`.
   - Reading practice → `reading-comp` with mixed embedded question types.
   - A speaking/writing prompt → `open-response`, `dialogue`.
   Mix 2–4 types across 2–4 sections, easier → harder, production/writing
   tasks last. Call `get_worksheet_contract` with `types` set to **only**
   the ones you actually chose — passing every type bloats the contract for
   no benefit.

4. **Write to the contract exactly.** Follow the envelope and each activity
   shape precisely — field names, required lengths (e.g. `mcq` needs 2–6
   options), and the pedagogy rules embedded in the contract: hints must
   never quote or point at the answer; distractors plausible but clearly
   wrong; explanations may state the answer; all learner-facing text in the
   requested language; entirely self-contained (no external images/audio,
   inline SVG only where a shape explicitly allows it); speakers are roles,
   never real people's names.

5. **Create it, and fix-and-retry on rejection.** Call `create_worksheet`.
   If it comes back rejected, the problems are returned verbatim — they are
   specific and actionable (e.g. "mcq: options must be 2–6 non-empty
   strings"). Fix exactly what's named and retry; don't regenerate the whole
   document from scratch. This is expected to happen sometimes — it's not a
   failure, it's the contract doing its job.

6. **Iterating on an existing worksheet.** "Make activity 3 easier" or "add
   a listening warm-up" means `update_worksheet`, not a new
   `create_worksheet` — check `list_worksheets` for the id first if you
   don't already have it from this conversation. Same validate-and-retry
   discipline applies.

7. **Offer to deploy.** Once a worksheet is created or revised, tell the
   teacher it's ready and ask whether they want it live now. If yes, call
   `deploy_worksheets` (classroom name for a roster-gated session, or omit
   it for a public link) and report back the join code plainly — that's
   what they hand to students.

8. **Report back concretely.** Name the worksheet, section/activity count,
   and what you tailored to the class (e.g. "used B1-level vocabulary and
   included a warm-up on question forms since the class context flagged
   *do/does* as shaky"). If you deployed it, lead with the join code.

## Notes

- A worksheet built without reading `get_workspace_context` first is a
  worksheet built blind — always ground first, even for a one-off request.
- Never invent student names, needs, or classroom context that wasn't in the
  workspace data — write generically for anything you don't actually know.
- `get_worksheet_contract` is cheap to call again mid-conversation if the
  teacher asks for a type you didn't originally fetch.
