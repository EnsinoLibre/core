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

## Password protection

A deployment can require a password to join — required for class deployments, optional for public links (see [[worksheets-library|Deploy]]). The password is set once, server-side: the teacher's plaintext never leaves the request that creates or changes it, and it's hashed with bcrypt in Postgres (`set_aula_password`), never computed or uploaded as a hash by the client.

Joining checks the password inside `join_aula` itself — the same function students call directly (no app server sits in front of it) — and rate-limits: **5 wrong guesses lock the join code for 15 minutes**, after which it self-heals on the next attempt. A locked code returns `locked` (with the unlock time) to every attempt, correct password or not, so the lockout can't be probed around. Codes created before this hardening carry an older hash format that upgrades to bcrypt automatically the first time someone joins with the correct password — nothing to migrate by hand.

## Deploying via an agent

An [[mcp-connect|MCP agent]] can finish the job itself rather than dead-ending at a saved worksheet: `deploy_worksheets` creates the live session (class-gated or a public link, password included if asked) and returns the join code; `set_aula_status` opens or closes it; `get_progress` reads results back — student, worksheet, score, status — filterable by join code, classroom or student name, scoped strictly to that teacher's own deployments.

## Importing offline work

A worksheet's **Interactive (offline)** export is a self-contained HTML file a student can complete without any connection, producing an `ensinolibre-answers` file when they're done. **⬆ Import answers** on a live session reads that file back in and enrols the student (by name) so their progress shows up in the monitor exactly as if they'd joined online.

## Exporting and closing

**⬇ CSV / ⬇ JSON** export the full progress table for your records. **Close class** stops new joins/submissions (**Reopen** to resume); **Remove** deletes the deployment and its progress entirely — worksheets themselves stay in your library either way.

Further down, **Deployed worksheets** repeats the same PDF/Moodle/Markdown export buttons from the [[worksheets-library|library]], scoped to just this session's materials.
