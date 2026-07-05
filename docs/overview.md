---
title: Overview
tags: ensinolibre, docs
status: stable
---

# EnsinoLibre

**EnsinoLibre** is an open worksheet format and toolkit for teachers, tutors and course authors. It grew out of the [EnsinoLibre](https://github.com/EnsinoLibre) project, where AI agents author complete language courses; EnsinoLibre generalises that pipeline so *anyone* — with no technical skills — can generate an interactive digital worksheet on any subject.

> [!note] The core idea
> You describe your lesson in a simple form. The form produces a **prompt** you paste into any AI assistant (Claude, ChatGPT, Gemini…). The assistant replies with worksheet **JSON** in the EnsinoLibre format. You paste that back and get an interactive worksheet you can use on screen or print on paper.

## The three pieces

1. **The worksheet format** — a small, strict JSON shape with six activity types. See [[worksheet-schema]].
2. **The prompt template** — a generalised, battle-tested prompt that makes any capable AI produce valid worksheets. See [[prompt-template]].
3. **The renderer** — a dependency-free JavaScript component that turns worksheet JSON into interactive activities with tiered hints, or into clean printable handouts. See [[rendering-and-embedding]].

## Activity types at a glance

Schema v2 covers **30 activity types** — a broad teaching-block catalogue generalised for any subject. The six **core** types cover most worksheets:

| Type | Doc page | Best for |
|------|----------|----------|
| `mcq` | [[activities/mcq\|Multiple choice]] | Checking understanding quickly |
| `true-false` | [[activities/true-false\|True or false]] | Tackling misconceptions |
| `gap-fill` | [[activities/gap-fill\|Fill in the gaps]] | Vocabulary and recall |
| `matching` | [[activities/matching\|Matching]] | Terms and definitions |
| `ordering` | [[activities/ordering\|Put in order]] | Processes and timelines |
| `open-response` | [[activities/open-response\|Open writing]] | Free production and reflection |

Beyond the core: slides, timelines, dialogues and grammar visualisers for **input**; flashcards, memory games and word searches for **vocabulary**; scored quizzes and mixed sets for **practice**; reading comprehension, translation drills, branching scenarios, adaptive lessons, crosswords and picture labelling for **context**; and summaries, surveys and polls for **checks**. The full list is in [[worksheet-schema]] and the sidebar.

**Every type degrades to paper.** Each defines an analog translation — flashcards become a Markdown vocabulary table, a memory game becomes a cut-out card sheet, a branching scenario becomes numbered choose-your-path boxes. The *Download analog version* button on the [creator page](index.html) emits the whole worksheet as an Obsidian-ready Markdown file with an answer key.

Here is a complete micro-worksheet, rendered live by the same component that powers the [creator page](index.html):

```worksheet
{
  "title": "Welcome to EnsinoLibre",
  "subject": "Meta",
  "topic": "How this works",
  "audience": "Curious teachers",
  "language": "en-GB",
  "instructions": "Answer the two questions below to see the interactive worksheet experience.",
  "sections": [
    {
      "title": "A tiny demo",
      "activities": [
        {
          "type": "mcq",
          "question": "What does an AI assistant return when you use an EnsinoLibre prompt?",
          "options": ["A Word document", "Worksheet JSON", "A PowerPoint file", "An email"],
          "answer": 1,
          "hint": "It is a structured text format that this website can render.",
          "explanation": "The assistant replies with JSON that any EnsinoLibre renderer can display."
        },
        {
          "type": "true-false",
          "statement": "You need a developer account and an API key to create a worksheet.",
          "answer": false,
          "hint": "Think about what the creator form actually produces.",
          "explanation": "False — the form produces a prompt you paste into whichever assistant you already use."
        }
      ]
    }
  ]
}
```

## Design principles

- **Self-contained.** A worksheet is pure text. No images, audio or external links — nothing to break, nothing to host.
- **Model-agnostic.** The prompt works with any capable assistant; the format has no vendor fingerprints.
- **Pedagogically opinionated.** Hints never reveal answers; feedback is tiered (hint → hint → reveal); distractors must be plausible.
- **Obsidian-native docs.** Every page in this documentation is a plain Markdown file with frontmatter, wikilinks and callouts — see [[obsidian-vault]].

## Where next?

- New here? Start with [[getting-started]].
- Want the exact format? Read [[worksheet-schema]].
- Building your own tools on top? See [[rendering-and-embedding]].
