---
title: Teacher platform
description: The logged-in workspace — classrooms, students, resources, live sessions and the knowledge graph — and how it differs from the public worksheet builder.
---

# Teacher platform

Everything documented under **Start here** and **Reference** is about the **worksheet builder** — the free, zero-account [creator page](index.html) anyone can use to turn a topic into a worksheet. This section is about a different, separate thing: the **teacher platform**, a real logged-in workspace at `/site/app/` where a teacher keeps their classes, students, resources and worksheets persistently, session to session.

> [!note] Two separate surfaces, one shared worksheet format
> The worksheet **builder** needs no account and remembers nothing — describe a lesson, paste a prompt, paste the reply, done. The teacher **platform** is where that same worksheet format lives inside a real workspace: saved, linked to classes, deployable to live sessions, and readable by an AI agent as context. Worksheets move freely between the two — anything the builder produces can be pasted straight into the platform's library.

## Signing in

The platform lives behind a real account (Supabase Auth — email + password, with sign-up available from the login screen). A demo teacher account is preconfigured (`teacher@ensinolibre.org` / `ensinolibre`) so you can explore with realistic data before creating your own account.

## What's in the workspace

| Page | What it's for |
|---|---|
| [[dashboard\|Dashboard]] | Your classes and knowledge base at a glance. |
| [[knowledge-graph\|Knowledge]] | Every classroom, student, worksheet and resource as one connected, filterable graph. |
| Live classroom | Deploy worksheets to a class as a live session; watch progress in real time. See [[live-classroom]]. |
| [[worksheets-library\|Worksheets]] | Your worksheet library — create, deploy, export. |
| [[classrooms-and-students\|Classrooms & Students]] | Rosters and per-class/per-student context your AI can use. |
| [[resources-knowledge-base\|Resources]] | A linked knowledge base of materials, guidelines, external links and captured context. |
| Profile | Your teacher profile, plus workspace-wide exports and imports. See [[profile-and-vault]]. |

## Core ideas that repeat everywhere

**The content panel.** Click almost any card — a classroom, a student, a worksheet, a resource — and a panel slides in (a side panel on desktop, a bottom sheet on mobile) showing that entity's full markdown note, its typed connections to other entities, and a link to jump straight to any of them. This is the same panel everywhere in the platform; learning it once means you know it for every entity type.

**Notion-style relation fields.** Forms that link one entity to another (a student's classroom, a resource's classroom or student) use a searchable picker: start typing to filter existing options, or — if nothing matches — a **"+ Create …"** option appears, creating the new entity on the spot without leaving the form.

**Everything is a linked knowledge base.** Classrooms, students, worksheets and resources are all nodes with markdown notes behind them, connected by explicit wikilinks and structural relationships (a student belongs to a class, a worksheet is deployed to a class, and so on). The [[knowledge-graph|Knowledge view]] visualises this directly; the same graph is what an AI agent gets hold of via [[knowledge-seeding|seeding]], [[mcp-connect|MCP]], or an [[obsidian-vault|Obsidian vault export]].

## Bringing in existing material

- **Bulk-seed from files** — turn any files you already have into linked knowledge-base notes. See [[knowledge-seeding]].
- **Import from Google Classroom** — bring existing classes, rosters and materials in from a real Google Takeout export. See [[google-classroom-import]].
- **Connect an AI agent directly** — skip copy-paste entirely and let an MCP client read your workspace and create worksheets/notes for you. See [[mcp-connect]].
