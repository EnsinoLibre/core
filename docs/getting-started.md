---
title: Getting started
tags: ensinolibre, docs, tutorial
audience: non-technical
---

# Getting started

This walkthrough takes about five minutes and needs nothing but a web browser and access to any AI assistant.

## Step 1 — Describe your worksheet

Open the [creator page](index.html) and fill in the form:

- **Subject** — the school subject or knowledge domain, e.g. *Biology*.
- **Topic** — the specific thing you're teaching, e.g. *Photosynthesis*.
- **Who is it for?** — be concrete: *Year 8 pupils* beats *students*.
- **Language** — the language the worksheet itself should be written in.
- **Difficulty** and **how many activities** — sensible defaults are pre-filled.
- **Activity types** — untick anything you don't want; see the [[overview]] table for what each type is good at.

> [!tip] Be specific in "Anything else?"
> The free-text box is passed straight to the AI. "Focus on daily life rather than battles" or "include one short reading passage before the questions" work wonderfully.

## Step 2 — Copy the prompt into your AI assistant

Click **Generate my prompt**, then **Copy prompt**. Paste it into a fresh conversation with Claude, ChatGPT, Gemini, or any other capable assistant. The prompt contains everything the model needs: your lesson details, quality rules, and the exact JSON format to reply in — see [[prompt-template]] for how it works.

## Step 3 — Paste the answer back

The assistant replies with a block of JSON (text starting with `{`). Copy its whole reply, paste it into **Step 3** on the creator page, and click **Render worksheet**.

- If something is wrong with the JSON, you get a plain-English list of problems — usually pasting the message *"please fix these issues: …"* back to the assistant sorts it out.
- If all is well, your interactive worksheet appears, and the **Print / save as PDF** button gives you a paper version.
- If you have a teacher account, **Save to my library** puts the worksheet straight into your [[worksheets-library|platform library]] to deploy to a class. Signed out, it offers a JSON download to import later instead — it won't silently lose your work.

Try it right now with this ready-made activity:

```worksheet
{
  "type": "gap-fill",
  "text": "Plants make their own food through a process called {{photosynthesis}}, using light, water and carbon {{dioxide}}.",
  "hint": "Both words appear in the topic of this very walkthrough.",
  "explanation": "Photosynthesis converts light energy, water and carbon dioxide into glucose and oxygen."
}
```

## What learners see

- Each activity has a **Check** button with instant feedback.
- Wrong answers get a **hint** on the first two tries and the **answer with an explanation** on the third — hints are written so they never give the answer away.
- Open-writing tasks show a live word count and an optional model answer behind a click.

## Next steps

- Understand the format: [[worksheet-schema]]
- Put worksheets on your own website: [[rendering-and-embedding]]
- Keep these docs in your notes app: [[obsidian-vault]]
