---
title: Import from Google Classroom
description: Step-by-step, no-technical-background walkthrough — export your data from Google Classroom with Google Takeout, then bring it into EnsinoLibre.
---

# Import from Google Classroom

Bring your existing classes, rosters and materials into EnsinoLibre in one pass. You don't need to be technical — you need two things: a few minutes with Google Takeout, and an AI assistant that can read files on your computer (Claude Code, Claude Desktop, or similar — see Step 3 if you're not sure what that means).

Nothing you export ever leaves your machine or goes to an EnsinoLibre server: your AI reads the files locally and only sends back the short summary notes you paste in yourself.

## Step 1 — Export your data from Google Classroom

Google's own bulk-export tool for all your Google data is called **Takeout**. This is the official way to get everything out of Classroom at once, instead of opening each class by hand.

1. Go to **[takeout.google.com](https://takeout.google.com)** and sign in with the Google account you teach with.
2. You'll see a long list of Google products, all selected by default. Click **Deselect all**, then scroll down and tick just **Classroom**.
3. Click **Next step**.
4. Under **Delivery method**, the simplest option is *"Send download link via email"* — Google emails you when your archive is ready.
5. Under **File type & size**, choose **.zip** (the standard option — every computer can open it).
6. Click **Create export**.

Google now builds your archive in the background. For a handful of classes this is usually quick; if you teach many classes with lots of materials it can take a while — you'll get an email either way. When it arrives, click the download link and **unzip the file** (double-click it on Mac, or right-click → *Extract All* on Windows). You should end up with a folder that has one subfolder per class, each containing that class's coursework, announcements and roster.

> **What's actually in the archive:** for every class — the title, description and section/level, the full roster (teachers, students, guardians), and every piece of Classwork (announcements, assignments, questions, materials) together with student submissions, grades and comments where they exist.

## Step 2 — Select the exported folder in EnsinoLibre

In EnsinoLibre, go to **Profile → Import from Google Classroom** (or the same button on the **Classrooms** page). In the modal:

1. **Step 1** in the modal just links back here — you've already done it.
2. **Step 2**, click to choose a folder and pick the folder you just unzipped. EnsinoLibre stages every file's name and a short text excerpt (for orientation only) — nothing is uploaded anywhere.

## Step 3 — Hand the prompt to your AI agent

Click **Generate prompt**, then **Copy**. This prompt needs to go to an AI that can read the files on your computer — not a plain chat window in a browser tab, which can't see your files at all. If you already use **Claude Code** or **Claude Desktop** with file access, paste the prompt straight in and tell it where you unzipped the folder.

If you don't have one of those set up yet, that's the one prerequisite here — ask whoever helps you with computer things to set up Claude Code, or paste your roster and class list directly into the modal's reply box by hand instead (slower, but works with any chat AI).

The agent reads every file, groups them by class (Takeout gives you one folder per class), and writes back a short **front-facing summary** for each class and each piece of classwork worth keeping — the same llm.wiki-style notes used everywhere else in EnsinoLibre (see [[knowledge-seeding]]).

## Step 4 — Paste the reply back

Paste the agent's JSON reply into the last box and click **Import into workspace**. EnsinoLibre matches classes by name against what you already have:

- A class that doesn't exist yet is **created**.
- A class with the same name is **merged** — its context is filled in if it was empty, and only students/materials it doesn't already have are added. Nothing is duplicated if you run the import again later.
- Every material is filed as a resource tagged `google-classroom`, linked to its class, and shows up in **Resources**, the **knowledge graph** and the **Obsidian vault export**.

## Good to know

- **Privacy**: the Takeout archive and its contents never leave your computer except as the short summaries you choose to paste back.
- **Re-running the import is safe**: matching is by class name, so importing the same Takeout export twice won't create duplicates. The same is true on the MCP path — `upsert_classroom`/`upsert_student` match-or-create by name, and `add_resource` matches by (title, classroom, student) scope, so a re-run updates what's already there instead of duplicating it. It's also the only way to *revise* imported context later: by default these tools only fill in what was empty, so ask your agent to pass `overwrite: true` when you want it to actually update stale context, not just top it up.
- **No agent yet?** You can still use this flow by typing your class/roster details directly into the reply box in the shape shown in the placeholder text — it's just more typing than letting an agent read the files for you.

## Related

- [[knowledge-seeding]] — the same copy-paste mechanic, for bulk-seeding any files (not just Google Classroom)
- [[obsidian-vault]] — what happens to imported classes and materials when you export your whole workspace
