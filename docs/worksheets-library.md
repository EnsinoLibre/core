---
title: Worksheets
description: The teacher platform's worksheet library — create in-app, deploy live, export for print or Moodle.
---

# Worksheets

The **Worksheets** page in the [[platform-overview|teacher platform]] is your saved worksheet library, separate from the [creator page](index.html)'s one-off, no-account generator. A filter bar searches by title and narrows by **subject** and **deployment status**.

## Creating a worksheet

**+ Create worksheet** opens a modal with two tabs — both end the same way: a worksheet lands in your library.

**✨ Prompt builder** is the platform's own copy of the worksheet builder's form (topic, subject, audience, difficulty, activity count, activity types, extras), with one edge the public builder doesn't have: pick a **class**, and its level and captured [[classrooms-and-students|context]] flow straight into the audience and the prompt. Generate the prompt, paste it into any capable AI, paste the JSON reply back, and it's validated and added.

**🔌 Connect via MCP** skips the copy-paste: generate a personal agent key and hand it to an MCP client (Claude Code, Claude Desktop, or anything else that speaks MCP), which then reads your workspace and creates worksheets directly. Full walkthrough in [[mcp-connect]]. A **"Check for new worksheets"** button refreshes the library on demand if you're waiting on an agent working outside the page.

## Working with a worksheet

Each card opens the shared content panel (the actual worksheet content — warm-up, activities, answer key — not just a summary) and offers:

- **◉ Deploy** — send this one worksheet straight to [[live-classroom|Live classroom]] deployment.
- **📄 PDF / 🎓 Moodle / ⬇ MD** — export for print, Moodle question import, or a plain Markdown copy.
- **Remove** — delete from the library (blocked while the worksheet is deployed in a live class — undeploy it first).

Cards deployed to a live class show a badge per deployment (a filled dot if it's currently live); clicking one jumps to [[live-classroom|Live classroom]].

**◉ Deploy to a class** (the page-level action) opens the same deploy flow pre-loaded with a multi-select of your whole library, for deploying several worksheets to a class at once.
