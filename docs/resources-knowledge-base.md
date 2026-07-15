---
title: Resources
description: The linked knowledge repository — teaching materials, guidelines, external links and captured context — entered by hand or seeded from files.
---

# Resources

The **Resources** page in the [[platform-overview|teacher platform]] is "a linked knowledge repository" — everything that isn't a classroom, student or worksheet, organised into five kinds: **Worksheets**, **Teaching materials**, **Guidelines**, **External resources** and **Context**.

## Layout

Each kind is its own collapsible section (short "Title, Title, +N more" preview when collapsed, full card grid when expanded). A filter bar above them searches title/subject/note/tags and narrows by **subject** and **classroom** — filtering re-collapses counts per section so you can see at a glance which kinds have matches.

## Adding a resource by hand

**+ Add resource** asks for a title, a kind, subject, an optional link, optional **classroom** and **student** (both notion-style pickers — search existing entities or type a new name to create one on the spot), comma-separated tags, and a markdown note. This is the direct route for something you just want to jot down yourself, no AI involved.

## Seeding from files

Every seedable kind (Teaching materials, Guidelines, External resources, Context) is also an upload surface: its section header carries its own **"⬆ Add files"** button, scoped to that kind, alongside the page-level **"🌱 Seed knowledge base"** button for unscoped bulk seeding. Both follow the same mechanic — stage files, hand a generated prompt to your local AI agent, paste its reply back — described in full in [[knowledge-seeding]].

## Opening a resource

Clicking a card opens the shared content panel: class/student context line, the resource's note (rendered as markdown, including any wikilinks to other entities), its link if it has one, and its tags. Seeded resources show the AI-written front-facing summary here directly — the same note is what an [[mcp-connect|MCP agent]]'s `add_resource` tool writes, and what ends up in the [[obsidian-vault|Obsidian vault export]] and the [[knowledge-graph|knowledge graph]].

## Revising a note later

Notes aren't write-once. A connected agent can search the knowledge base (`search_resources`), pull one up in full (`get_resource`), and either rewrite it (`update_resource`) or tack on a dated addendum (`append_resource_note`) — see [[mcp-connect]] for the full read/write loop. Re-seeding the same source (same title, same classroom/student scope) also updates the existing note in place rather than filing a duplicate.
