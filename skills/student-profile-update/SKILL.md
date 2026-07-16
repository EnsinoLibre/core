---
name: student-profile-update
description: Turn a teacher's freeform post-lesson observations ("Ana nailed conditionals, Rui needs pronunciation drills") into per-student EnsinoLibre records over MCP — one dated observation note per student, plus a proposed (never silently applied) needs/goals update. Use when the user dictates or pastes notes about how specific students did in a lesson, or asks to log observations from class.
license: MIT
metadata:
  author: EnsinoLibre
  version: "1.0.0"
  homepage: https://ensinolibre-app.netlify.app
  source: https://github.com/EnsinoLibre/core
  requires: EnsinoLibre MCP connection (agent key) — see docs/mcp-connect.md
---

# EnsinoLibre student profile update

Teachers narrate a lesson in one breath — this skill's job is to split that
into the workspace's actual persistent memory: one dated note per student via
`add_student_note` (the highest-value memory for lesson planning — it
surfaces automatically in `get_workspace_context`), plus a *proposed* update
to a student's standing `needs`/`goals` fields when the observation implies
one. The note is always filed; the profile field change is always proposed
to the teacher first, never applied silently.

Requires the EnsinoLibre MCP server connected (`get_workspace_context`,
`add_student_note`, `upsert_student`). If it isn't connected, tell the user
to follow [[mcp-connect]] first.

## Procedure

1. **Ground yourself.** Call `get_workspace_context` to get the real student
   names (and which classroom each belongs to) — this is how you match names
   in the teacher's freeform text to actual records instead of guessing
   spelling or scope.

2. **Split the input per student.** Parse the teacher's text into one
   observation per student mentioned. If a name is ambiguous (matches
   students in more than one classroom, or doesn't match anyone), ask rather
   than guessing — `add_student_note`'s `classroom` param exists specifically
   to disambiguate a name that exists in more than one class.

3. **File one note per student.** For each match, call `add_student_note`
   with `text` **verbatim or near-verbatim** to what the teacher said — light
   grammar cleanup is fine, adding content is not. Don't merge multiple
   students' observations into one call, and don't split one observation
   across two calls.

4. **Propose, don't apply, standing changes.** If an observation reads like a
   durable fact rather than a one-off note (e.g. "Rui needs pronunciation
   drills" sounds like an ongoing `needs`, not just today's comment), tell the
   teacher you noticed this and ask whether to also update the student's
   `needs`/`goals` via `upsert_student`. Only call `upsert_student` after they
   say yes, and only with `overwrite: true` if they're explicitly replacing
   an existing value — otherwise the default (fill-empty-only) is safer.

5. **Report back.** List which students got a note filed, and which proposed
   profile changes are still awaiting the teacher's yes/no.

## Notes

- **Never invent an assessment.** If the teacher's text doesn't clearly name
  a student or say something about them, leave it out rather than guessing
  who they meant or what they meant.
- A note is a moment-in-time record; a `needs`/`goals` field is a standing
  claim about the student. Keep that distinction — most observations should
  only produce a note, not a profile change.
- If the teacher gives you a single one-liner for the whole class ("good
  lesson today, everyone engaged"), that's not per-student material — say so
  and ask if they want a class-level note instead (via `add_resource`,
  `kind: "context"`, scoped to the classroom), which this skill doesn't file
  on its own.
