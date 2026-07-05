---
title: The prompt template
tags: ensinolibre, docs, prompts
status: stable
---

# The prompt template

The heart of EnsinoLibre is a **generalised prompt template**: one prompt structure that reliably turns any capable AI assistant into a worksheet author. The [creator form](index.html) fills it in for you, but understanding its anatomy helps you adapt it.

## Anatomy

Every generated prompt has four blocks, in this order:

### 1. Role and brief

```
You are an experienced teacher and instructional designer creating a digital worksheet.

Subject: History
Topic: The Roman Empire
Audience: Year 7 pupils
Language of the worksheet: English (UK)
Difficulty: introductory
Total number of activities: about 8 activities, grouped into 2–4 titled sections.
```

Concrete audience descriptions matter most here — models pitch vocabulary and complexity from that line.

### 2. Allowed activity types

The prompt lists only the types you ticked, each with a one-line description — and the format contract at the end embeds **only the JSON shapes of those types**, so the prompt stays short however large the catalogue grows. Restricting types is how you shape the worksheet: tick only `gap-fill` and `matching` for a vocabulary drill, only `flashdeck` and `memory-game` for a vocabulary pack, only `open-response` for an essay-prep sheet. The six core types are ticked by default.

### 3. Quality rules

Nine numbered rules the model must follow. The three that do the heaviest lifting:

> [!warning] Hints must never reveal answers
> Rule 2 forbids hints that quote, name, or point at the answer or any option. This is the single most common failure mode of AI-generated exercises — the tiered feedback system (hint → hint → reveal) only works when hints genuinely nudge rather than tell.

- Answers must be **factually correct and unambiguous** — the model is told this explicitly because worksheets get checked automatically, not by the model.
- Worksheets must be **entirely self-contained text** — no images, audio, or external links, so nothing can break.

### 4. The format contract

The prompt ends with the exact JSON shape to return — effectively a compact, prose version of the [[worksheet-schema]] — and the instruction to return *only* the JSON object with no surrounding prose. The renderer is tolerant anyway (it strips markdown fences and surrounding chatter), but a clean contract keeps replies consistent.

## Trying a hand-written spec

You don't have to use the form. Here's a worksheet produced from this template, rendered live:

```worksheet
{
  "title": "The Roman Empire: Daily Life",
  "subject": "History",
  "topic": "The Roman Empire",
  "audience": "Year 7 pupils",
  "language": "en-GB",
  "estimatedMinutes": 10,
  "instructions": "Answer the questions below. Use the Check button to see how you did.",
  "sections": [
    {
      "title": "Life in Rome",
      "activities": [
        {
          "type": "mcq",
          "question": "What was the centre of public life in a Roman town?",
          "options": ["The forum", "The aqueduct", "The villa", "The road"],
          "answer": 0,
          "hint": "It was an open square where markets, courts and speeches all happened.",
          "explanation": "The forum was the main public square — the heart of commerce, politics and daily gossip."
        },
        {
          "type": "ordering",
          "prompt": "Put these stages of a wealthy Roman's day in the usual order.",
          "items": ["Salutatio: greeting clients at dawn", "Business in the forum", "Bathing at the public baths", "Cena: the main evening meal"],
          "hint": "Romans started work very early and ended the day with their biggest meal.",
          "explanation": "The Roman day began at dawn with greetings, moved to business, then relaxation at the baths, and ended with dinner."
        }
      ]
    }
  ]
}
```

## Adapting the template

Fair game to customise:

- **Add subject-specific rules** — e.g. "all chemical formulae must use correct subscripts" — by putting them in the *Anything else?* box.
- **Change the pedagogy** — if you *want* answer-revealing hints for self-study flashcard use, edit rule 2 in your copy of the prompt.
- **Chain worksheets** — ask for "a harder follow-up worksheet on the same topic assuming the first one was completed" in a second turn of the same conversation.

Keep intact: the **format contract**. That block is what makes the output machine-renderable; edit the shape and your JSON will fail validation in Step 3.

## Related

- [[worksheet-schema]] — the formal contract the prompt encodes
- [[getting-started]] — the three-step workflow
