---
title: Knowledge graph
description: Every classroom, student, worksheet and resource as one connected, filterable graph.
---

# Knowledge graph

The **Knowledge** view in the [[platform-overview|teacher platform]] renders your whole workspace — classrooms, students, worksheets and resources — as one graph, plus a second, ghostly "docs" layer of the EnsinoLibre documentation itself, connected to the worksheets that use each activity block.

## Reading the graph

Every node is coloured by type (see the legend), sized by how central it is, and connected by real relationships: a teacher owns classrooms, a classroom has students, a worksheet is deployed to a class, a resource is filed against a class or student, and any explicit wikilink in a note becomes an edge too.

Click a node to **focus** it — the graph reorganises into distance rings around it (direct connections close in, everything else fades back) — and the shared content panel opens with its full note. Click "Clear focus" (or click empty space) to release it.

## The legend is a filter

Each row in the legend is a toggle, not just a key: click a type to hide every node of that type (and its edges) from the graph; click again to bring it back. Use this to declutter a busy graph down to just the entity types you care about right now.

## Toolbar

- **🔍 Search** expands a text box that jumps straight to any node by name.
- **▽ Filter** opens the legend/toggle panel (useful on narrow screens where it isn't always visible).
- **⛶ Fit** reframes the camera around whatever's currently *visible* — respecting your legend filters, so hidden node types don't count towards the framing.
- **Workspace / Docs** switches which layer is in the foreground; the other floats, dimmed, behind it. The docs layer's activity pages connect to every worksheet that uses that specific activity block — a live map of which components are actually in use.

## Watching an agent work

A connected [[mcp-connect|MCP agent]] shows up as a pulsing node while it's active, with edges lighting up to whatever it's currently reading or writing; click it for a popover of its last few tool calls, each with a one-line summary of what actually happened (not just the tool name) and an error mark if a call failed. That popover is a live window — the full, retained history (30 days) lives on the **Profile** page's **Agent activity** card, alongside anything the agent created (worksheets, resources) with a one-click **↩ Revert** if it's not what you wanted.

## Why it exists

The graph is a visualisation of the same linked knowledge base that [[obsidian-vault|the Obsidian vault export]], [[knowledge-seeding|seeded resources]] and an [[mcp-connect|MCP agent's workspace context]] all draw from. If two things feel like they should be connected but aren't showing an edge here, the fix is the same everywhere: add an explicit wikilink to one of their notes, or set the class/student relation on the resource — or, for a note an agent filed, pass `links` (entity names) to `add_resource` and the MCP server resolves them to real edges the same way a wikilink does.
