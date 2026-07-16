---
name: progress-report
description: Turn raw EnsinoLibre progress data into a teacher-facing weekly review over MCP — pull results per aula/classroom, summarize per student (completion, correctness, score), file one dated context note per class into the knowledge base, and print the report to the teacher. Use when the user asks for a weekly review, a progress report, "how is my class doing", or wants a summary of a live deployment's results.
license: MIT
metadata:
  author: EnsinoLibre
  version: "1.0.0"
  homepage: https://ensinolibre-app.netlify.app
  source: https://github.com/EnsinoLibre/core
  requires: EnsinoLibre MCP connection (agent key) — see docs/mcp-connect.md
---

# EnsinoLibre progress report

`get_progress` returns raw per-student, per-worksheet rows. This skill's job
is to turn that into something a teacher can act on in thirty seconds — who's
stuck, who's done, what's worth reteaching — and to leave a dated note behind
so the next review (or the next agent) has a baseline to compare against. It
is the *llm.wiki* memory loop applied to progress data: numbers in, a small
front-facing summary note out.

Requires the EnsinoLibre MCP server connected (`get_progress`,
`add_resource`, `get_workspace_context`). If it isn't connected, tell the
user to follow [[mcp-connect]] first.

## Procedure

1. **Ground yourself.** Call `get_workspace_context` once, or ask the user
   directly, to confirm which classroom(s) or aula code(s) the report should
   cover — don't guess scope silently if the request is ambiguous.

2. **Pull the data.** Call `get_progress`, filtered by `classroom` and/or
   `aula_code` per step 1. If it returns "No progress recorded yet," say so
   plainly and stop — don't write a note about a review that has no data.

3. **Summarize per student.** For each student in the results, report:
   - completion (`attempted`/`total`, and `done` status),
   - score (`scorePct`),
   - anything flagged (`validated` field, if a teacher already marked it).

   Group by worksheet or by student, whichever the teacher's request implies.
   Call out real anomalies worth a teacher's attention — e.g. a student who
   started but never finished, or a worksheet where most of the class scored
   far below the rest — but **only from the numbers you were given**.

4. **Never fabricate reasons for low scores.** Report what happened
   (attempted X of Y, scored Z%), not why. If asked to speculate, decline and
   suggest the teacher add their own observation instead (`add_student_note`
   is the right tool for that, not this skill).

5. **File one dated note per class reviewed.** Call `add_resource` with:
   - `title` — e.g. `"Weekly review — <classroom> — <date>"`.
   - `kind` — `"context"`.
   - `note` — the same summary you gave the teacher, condensed to the
     llm.wiki shape: a short factual paragraph plus a **Key points** bullet
     list (per-student or per-worksheet, whichever you grouped by).
   - `classroom` — the class name.
   - `tags` — `["weekly-review"]`.

   This makes each review a comparison point for the next one — a future
   agent (or you, next week) can `search_resources` for `weekly-review` notes
   on this classroom to see the trend, not just a single snapshot.

6. **Print the report to the teacher.** Show the same summary inline in the
   conversation — don't make them go read the note back out of the app.

## Notes

- One note per classroom reviewed, not one giant note across every class —
  keeps each note scoped and comparable over time.
- If the teacher asks for a report scoped to a single student, skip step 5
  (filing a class-wide note) unless they ask for it — a single-student
  question is better answered inline than filed as a permanent note.
- Numbers only. If a score looks wrong (e.g. suspiciously low across an
  entire class), flag it as worth checking rather than explaining it away.
