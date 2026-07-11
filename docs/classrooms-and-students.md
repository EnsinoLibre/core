---
title: Classrooms & Students
description: Rosters and per-class/per-student context, manual entry with notion-style relation pickers, and Google Classroom import.
---

# Classrooms & Students

Two pages in the [[platform-overview|teacher platform]] that work the same way: a filter bar, a **+ Add** form for entering things by hand, and cards that open the shared content panel with that entity's full note.

## Classrooms

**+ Add classroom** opens a short form — name, subject, level, term, description — and creates the classroom immediately. No relation fields here (a classroom is the top of the hierarchy), so it's the simplest of the add-forms.

The filter bar searches by name/description and narrows by **subject** and **level** (the dropdowns fill themselves from whatever values already exist in your workspace).

Each classroom card shows its level badge, description, a quoted excerpt of its captured **context** (the free-text notes that flow into worksheet prompts — see the "For class" picker in [[worksheets-library|the worksheet builder tab]]), roster size and term. Click a card to open the full classroom note in the content panel: context, student list, linked resources and any live classes.

**Import from Google Classroom** on this page brings in existing classes, rosters and materials from a real Google Takeout export — see [[google-classroom-import]] for the full walkthrough.

## Students

Students are grouped into a collapsible section per classroom — each section shows a short "Name, Name, +N more" preview when collapsed, and expands to the full roster. The filter bar searches by name/goals/needs and narrows by **classroom** and **level**.

**+ Add student** asks for a name and a **classroom** — the classroom field is a notion-style picker: search existing classrooms, or type a name that doesn't exist yet and a **"+ Create …"** option creates it inline without leaving the student form. Pronouns, level, goals and needs-and-context are optional and can be filled in later from the student's own content panel.

Each student card shows an avatar, pronouns, level badge and a preview of their goals. Opening a card shows the full note: class link, goals, needs & context, a running log of observations, and any resources filed as context for that specific student.

## Where this data goes

Classroom `context` and student `goals`/`needs` aren't just notes — they're exactly what flows into the [[worksheets-library|worksheet builder]]'s "For class" auto-fill, into [[mcp-connect|an MCP agent]]'s `get_workspace_context`, and into the [[obsidian-vault|Obsidian vault export]]. Writing a real sentence or two here (not leaving it blank) is what makes generated material actually fit the class.
