---
title: Live classroom
description: Deploy worksheets to a class as a live session, watch progress in real time, and validate student work.
---

# Live classroom

**Live classroom** in the [[platform-overview|teacher platform]] is where a saved [[worksheets-library|worksheet]] becomes something students actually do, live, with progress streaming back to you.

## Deploying

**◉ Deploy a class** (or **◉ Deploy** from a single worksheet card) opens a short form: pick a **class**, an optional session title, and which worksheets to include. This creates a live deployment ("aula") with its own short **join code** — students open the separate student page and enter the code; they never see the teacher platform itself.

## The monitor

Each deployed session shows its join code, a live/closed status toggle, and three stats (students joined, worksheets complete, average score), followed by a table: one row per student, one column per worksheet, each cell a progress bar with the running score. Click a cell to validate that specific attempt, or click a student's name for a full drilldown across every worksheet in the session.

**Validating** an attempt marks it **✓ Validated** or **⚑ Needs review** (or clears the mark) — a teacher-only annotation students never see, useful for flagging work you want to look at more closely or confirming grades.

## Importing offline work

A worksheet's **Interactive (offline)** export is a self-contained HTML file a student can complete without any connection, producing an `ensinolibre-answers` file when they're done. **⬆ Import answers** on a live session reads that file back in and enrols the student (by name) so their progress shows up in the monitor exactly as if they'd joined online.

## Exporting and closing

**⬇ CSV / ⬇ JSON** export the full progress table for your records. **Close class** stops new joins/submissions (**Reopen** to resume); **Remove** deletes the deployment and its progress entirely — worksheets themselves stay in your library either way.

Further down, **Deployed worksheets** repeats the same PDF/Moodle/Markdown export buttons from the [[worksheets-library|library]], scoped to just this session's materials.
