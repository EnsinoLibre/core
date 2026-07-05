---
title: Using with Obsidian
tags: ensinolibre, docs, obsidian
audience: everyone
---

# Using these docs with Obsidian

Every page of this documentation is a plain Markdown file in `ensinolibre/docs/`. They are written to be **Obsidian-native**: copy the folder into any vault and everything just works.

## What "Obsidian-native" means here

- **YAML frontmatter** on every page (`title`, `tags`, …) — Obsidian shows these as Properties; this site shows them as a properties strip at the top of each page.
- **Wikilinks** — pages link to each other with `[[worksheet-schema]]` / `[[activities/mcq|Multiple choice]]` syntax. Obsidian resolves them natively; the docs viewer rewrites them to `docs.html?page=…` links.
- **Callouts** — notes, tips and warnings use Obsidian's `> [!note]` blockquote syntax, so they render as proper callouts in both places.
- **Fenced examples** — live examples are ```worksheet fenced code blocks. Obsidian shows them as code (the JSON is the documentation); this site's viewer mounts an interactive renderer in their place.

> [!tip] Adding the docs to your vault
> Copy the whole `ensinolibre/docs/` folder into your vault (or clone the repo and add the folder to your vault's file list). Wikilinks, tags and callouts resolve with zero configuration. If you keep the folder under version control, `git pull` updates your vault's copy.

## Suggested vault structure

```
MyVault/
└── EnsinoLibre/          ← the docs folder, renamed as you like
    ├── overview.md
    ├── getting-started.md
    ├── prompt-template.md
    ├── worksheet-schema.md
    ├── rendering-and-embedding.md
    ├── obsidian-vault.md      ← this page
    └── activities/
        ├── mcq.md
        ├── true-false.md
        ├── gap-fill.md
        ├── matching.md
        ├── ordering.md
        └── open-response.md
```

## Keeping worksheets in your vault too

Worksheet JSON files are just text — many teachers keep them next to their lesson notes:

```
EnsinoLibre/
└── my-worksheets/
    ├── romans-year7.worksheet.json
    └── photosynthesis-year8.worksheet.json
```

A note can link to a worksheet file, and you can paste its contents into the [creator page](index.html) Step 3 whenever you need the interactive or printed version.

## Check your understanding

```worksheet
{
  "type": "mcq",
  "question": "What happens to a worksheet-fenced code block (like this one) when this docs folder is opened in Obsidian?",
  "options": [
    "Obsidian renders it as an interactive worksheet",
    "Obsidian shows it as a plain code block with the JSON",
    "Obsidian deletes it",
    "It breaks the note"
  ],
  "answer": 1,
  "hint": "Obsidian treats unknown fence languages the standard Markdown way.",
  "explanation": "In Obsidian it stays a readable code block — the JSON is the documentation. Only this website's viewer mounts the interactive renderer in its place."
}
```

> [!note] Why Markdown-first documentation?
> Teaching materials outlive tools. Markdown files with standard syntax remain readable in any editor, forever — the same philosophy behind the worksheet format itself being plain JSON.

## Related

- [[overview]] — the project at a glance
- [[worksheet-schema]] — the format your worksheet files follow
