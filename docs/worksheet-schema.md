---
title: Worksheet schema
tags: ensinolibre, docs, reference
schema-version: "1.0"
---

# Worksheet schema

A worksheet is a single JSON object. The authoritative definition is [`schema/worksheet.schema.json`](https://github.com/EnsinoLibre/blob/main/ensinolibre/schema/worksheet.schema.json) (JSON Schema draft 2020-12); this page is the human-readable version.

## Top level

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `$schemaVersion` | string | no | Currently `"1.0"` |
| `title` | string | **yes** | Worksheet title |
| `subject` | string | **yes** | e.g. `"Biology"` |
| `topic` | string | no | e.g. `"Photosynthesis"` |
| `audience` | string | **yes** | e.g. `"Year 8 pupils"` |
| `language` | string | **yes** | BCP-47 tag, e.g. `"en-GB"`, `"pt-PT"` |
| `estimatedMinutes` | integer | no | Rough completion time |
| `instructions` | string | no | Shown under the title |
| `sections` | array | **yes** | 1+ sections |

## Sections

Each section groups related activities:

```json
{
  "title": "Warm-up",
  "instructions": "Optional guidance for this section.",
  "activities": [ { "type": "mcq", "…": "…" } ]
}
```

## Activities

Every activity object has a `type` field that selects its shape. Schema **v2** covers the full EnsinoLibre component catalogue — 32 types. Each has its own doc page with a live example; find them all in the sidebar. Every type also defines an **analog strategy**: how it translates to paper/Markdown (`direct`, `transform`, or `teacher-audio` — see [[rendering-and-embedding]]).

The six **core** types:

| `type` | Required fields | Page |
|--------|-----------------|------|
| `mcq` | `question`, `options` (2–6), `answer` (index) | [[activities/mcq\|Multiple choice]] |
| `true-false` | `statement`, `answer` (boolean) | [[activities/true-false\|True or false]] |
| `gap-fill` | `text` with `{{answer}}` gaps | [[activities/gap-fill\|Fill in the gaps]] |
| `matching` | `prompt`, `pairs` (2–8 of `{left, right}`) | [[activities/matching\|Matching]] |
| `ordering` | `prompt`, `items` (3–8, in correct order) | [[activities/ordering\|Put in order]] |
| `open-response` | `prompt` | [[activities/open-response\|Open writing]] |

The extended catalogue, by group:

- **Input** — [[activities/content\|content]], [[activities/course-presentation\|course-presentation]], [[activities/timeline\|timeline]], [[activities/dialogue\|dialogue]], [[activities/grammar-forms\|grammar-forms]], [[activities/tense-shift\|tense-shift]], [[activities/word-transform\|word-transform]], [[activities/translation-compare\|translation-compare]]
- **Vocabulary** — [[activities/flashdeck\|flashdeck]], [[activities/memory-game\|memory-game]], [[activities/word-search\|word-search]]
- **Listening** — [[activities/dictation\|dictation]], [[activities/listen-mcq\|listen-mcq]] (browser read-aloud digitally; teacher scripts on paper)
- **Practice sets** — [[activities/quiz\|quiz]], [[activities/single-choice-set\|single-choice-set]], [[activities/question-set\|question-set]], [[activities/mark-words\|mark-words]]
- **Contextualised** — [[activities/reading-comp\|reading-comp]], [[activities/translation\|translation]], [[activities/scenario\|scenario]], [[activities/lesson\|lesson]], [[activities/crossword\|crossword]], [[activities/image-hotspot\|image-hotspot]]
- **Checks & forms** — [[activities/summary\|summary]], [[activities/survey\|survey]], [[activities/poll\|poll]]

All types also accept two optional fields:

- **`hint`** — shown after a wrong attempt. Must *never* quote, name, or point directly at the answer or any option.
- **`explanation`** — shown after a correct answer (or after the answer is revealed on the third wrong attempt). May state the answer and say why.

> [!note] Tiered feedback
> Renderers implement a three-strike pattern: wrong attempt 1 → hint, wrong attempt 2 → hint again, wrong attempt 3 → answer revealed with the explanation. This is why the hint/answer separation is a hard rule, not a style preference.

## A worksheet that uses every type

```worksheet
{
  "title": "Schema tour",
  "subject": "Meta",
  "topic": "The EnsinoLibre format",
  "audience": "Documentation readers",
  "language": "en-GB",
  "estimatedMinutes": 6,
  "instructions": "One activity of each of the six types.",
  "sections": [
    {
      "title": "All six types",
      "activities": [
        {
          "type": "mcq",
          "question": "Which field selects an activity's shape?",
          "options": ["\"kind\"", "\"type\"", "\"shape\"", "\"format\""],
          "answer": 1,
          "hint": "It is the one field every activity object is required to have.",
          "explanation": "Every activity carries a \"type\" field; renderers dispatch on it."
        },
        {
          "type": "true-false",
          "statement": "A hint is allowed to name the correct option as long as it is polite about it.",
          "answer": false,
          "hint": "Re-read the tiered feedback callout above.",
          "explanation": "False — hints must never reveal the answer; that is what the third-attempt reveal is for."
        },
        {
          "type": "gap-fill",
          "text": "Gaps are written in double curly braces, and alternative answers are separated by a {{pipe|vertical bar}} character.",
          "hint": "The character sits above the backslash on most keyboards.",
          "explanation": "{{pipe|vertical bar}} means both \"pipe\" and \"vertical bar\" are accepted."
        },
        {
          "type": "matching",
          "prompt": "Match each field to the activity type that requires it.",
          "pairs": [
            { "left": "options", "right": "mcq" },
            { "left": "statement", "right": "true-false" },
            { "left": "pairs", "right": "matching" },
            { "left": "items", "right": "ordering" }
          ],
          "hint": "Each field name echoes what the learner interacts with.",
          "explanation": "options→mcq, statement→true-false, pairs→matching, items→ordering."
        },
        {
          "type": "ordering",
          "prompt": "Order the three steps of the EnsinoLibre workflow.",
          "items": ["Describe the worksheet in the form", "Paste the prompt into an AI assistant", "Paste the JSON back and render it"],
          "hint": "You cannot render something that has not been generated yet.",
          "explanation": "Form → assistant → render: the same three steps as the creator page."
        },
        {
          "type": "open-response",
          "prompt": "In one or two sentences, describe a worksheet you would like to create.",
          "minWords": 10,
          "sampleAnswer": "A ten-activity worksheet on fractions for Year 5, mixing gap-fills for vocabulary with ordering tasks for the steps of adding fractions with unlike denominators."
        }
      ]
    }
  ]
}
```

## Validation

- In the browser, Step 3 of the [creator page](index.html) validates on paste and lists problems in plain English.
- In tooling, validate against `schema/worksheet.schema.json` with any JSON Schema validator (the project's test suite uses [Ajv](https://ajv.js.org/)).

## Related

- [[prompt-template]] — how the schema is communicated to AI assistants
- [[rendering-and-embedding]] — consuming this format in your own pages
