---
name: seed-knowledge-base
description: Bulk-ingest a folder of teaching files (or a Google Classroom Takeout export) into an EnsinoLibre teacher's workspace over MCP — read each file locally, write one llm.wiki-style front-facing summary note per artefact, and file classrooms/students/resources via the upsert_classroom / upsert_student / add_resource tools. Use when the user asks to import their Google Classroom export, seed their EnsinoLibre knowledge base from a folder, or bulk-add teaching materials to EnsinoLibre.
license: MIT
metadata:
  author: EnsinoLibre
  version: "1.0.0"
  homepage: https://ensinolibre-app.netlify.app
  source: https://github.com/EnsinoLibre/core
  requires: EnsinoLibre MCP connection (agent key) — see docs/mcp-connect.md
---

# Seed the EnsinoLibre knowledge base

EnsinoLibre's knowledge base follows the *llm.wiki* idea (after Andrej Karpathy):
raw files stay on the teacher's machine; the workspace stores one small, dense,
front-facing markdown note per artefact instead. This skill is the agentic
version of that flow — no copy-paste JSON blob, no single-prompt context-window
wall. You read files and write notes one at a time, in as many turns as it
takes.

Requires the EnsinoLibre MCP server connected (`get_workspace_context`,
`upsert_classroom`, `upsert_student`, `add_resource`, `list_worksheets`). If it
isn't connected, tell the user to follow [[mcp-connect]] first.

## Procedure

1. **Ground yourself.** Call `get_workspace_context` once. Note existing
   classroom names, student names per classroom, and knowledge-base note
   titles — this is how you avoid re-summarizing something already there and
   how `upsert_classroom`/`upsert_student` will match by name.

2. **Enumerate the input.** List every file under the folder the user pointed
   you at. For a Google Classroom Takeout export this is one subfolder per
   class, each with roster info and Classwork items. For a generic folder it's
   just files.

3. **Classrooms first.** For each class folder (or, for a generic seed, ask
   the user what classroom/subject scope applies if any — scope is optional),
   call `upsert_classroom` with whatever you can read off the export: name,
   subject, level, term, description, and a real sentence or two of `context`
   (this flows straight into worksheet generation later — don't leave it a
   placeholder).

4. **Students next.** For each roster entry, call `upsert_student` with
   `classroom` set to the class name from step 3. Fill `level`/`goals`/`needs`
   only where the source data actually says something — don't invent content.
   `upsert_classroom`/`upsert_student` merge by name and only fill fields that
   were previously empty, so it's safe to run this skill again later on an
   updated export without creating duplicates or clobbering hand-edited notes.

5. **One note per artefact.** For every remaining file (Classwork item,
   teaching material, guideline, external link, freeform context note): read
   it, then call `add_resource` with:
   - `title` — short, human-readable.
   - `kind` — `material` | `guideline` | `external` | `context` (pick the
     closest fit; default to `context` if unsure).
   - `note` — a ~200-word factual summary **that stands in for the source**,
     plus a short **Key points** bullet list. Write it so a future agent that
     only sees this note (never the original file) has everything it needs.
   - `classroom` / `student` — the name from step 3/4 if this artefact belongs
     to a specific class or student; omit otherwise.
   - `tags` — e.g. `["google-classroom"]` for a Takeout import, plus anything
     topical.

   Do this file-by-file. Don't try to batch multiple files into one tool call
   or hold the whole folder's content in a single prompt — the point of the
   agentic path is that each file gets its own turn, so there's no size wall.

6. **Report back.** Summarize what you created/merged: N classrooms (X new, Y
   merged), N students, N resources by kind. Point out anything you skipped
   (unreadable files, ambiguous roster entries) so the teacher can add them by
   hand from the Resources/Classrooms pages.

## Notes

- Never fabricate student needs/goals or classroom context that isn't in the
  source material — empty is better than invented.
- If a file is genuinely not worth keeping (e.g. a duplicate, an empty
  announcement), skip it rather than filing a low-value note.
- Files never leave the teacher's machine except as the summaries you write
  via `add_resource` — don't upload or paste raw file contents anywhere.
