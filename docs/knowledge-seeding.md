---
title: Seeding the knowledge base
description: Bulk-add files or import Google Classroom, and let your local agent write front-facing summary notes.
---

# Seeding the knowledge base

Your EnsinoLibre workspace is a **linked knowledge base**: classrooms, students, worksheets and resources, each backed by a markdown note, connected by [[wikilinks]], visualised in the knowledge graph and exportable as an Obsidian vault.

Seeding follows the same copy-paste mechanic as the worksheet generator — EnsinoLibre writes the prompt, **your own AI agent** does the heavy reading, and you paste the result back. No files are uploaded to our servers.

## The philosophy: llm.wiki

We follow the *llm.wiki* idea (after Andrej Karpathy): knowledge meant for AI consumption should live as **front-facing summarizing markdown**. Instead of storing raw PDFs, slide decks and scans, the knowledge base stores one small, dense markdown note per artefact:

- a ~200-word factual summary an LLM can read instead of the original,
- a **Key points** bullet list,
- `[[wikilinks]]` to the classrooms, students and resources it relates to.

The raw files stay on *your* machine, where your local agent can always re-read them. The workspace stays token-efficient: an agent handed your vault export gets the whole picture in a few thousand tokens.

## Seed from files (bulk)

Found in **Profile → Seed knowledge base**, on the **Resources** page, and on every resource subcategory (Teaching materials, Guidelines, External resources, Context — each is an upload surface with its own scoped flow):

1. **Add files** — drop or pick any number of files. They never leave your browser; only names and short text excerpts go into the prompt.
2. **Copy the prompt** — hand it to the agent running on the machine where the files live (Claude Code, or any capable assistant with file access). The prompt carries your workspace context, so the agent can link notes to the right classes and students.
3. **Paste the JSON reply** — EnsinoLibre validates it and creates one linked note per file, filed under the right subcategory. Seeding from a subcategory fixes the kind; seeding from a class fixes the class link.

If you want to skip the agent step, **Add names only** registers placeholder notes you can enrich later.

## Import from Google Classroom

Found in **Profile → Import from Google Classroom** and on the **Classrooms** page. Same mechanic:

1. Copy the prompt. Your agent gathers the data — browsing classroom.google.com in your logged-in browser, reading a Google Takeout export, or from what you paste to it.
2. The agent replies with strict JSON: each class with a front-facing context note, its roster, and its materials each with their own summary note.
3. Paste it back. Existing classrooms (matched by name) are merged, not duplicated: missing students are enrolled, new materials are filed as notes tagged `google-classroom`.

## Where the notes go

Seeded notes are ordinary resources: they appear in **Resources** under their subcategory, as nodes in the **knowledge graph** (with wiki edges for every resolved link), in each entity's content panel, and in the **Obsidian vault export** — so the next agent you hand your vault to already knows everything the last one summarized.
