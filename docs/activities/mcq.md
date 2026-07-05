---
title: Multiple choice (mcq)
tags: ensinolibre, docs, activity-type
type-id: mcq
---

# Multiple choice — `mcq`

A question with 2–6 options and exactly one correct answer. The workhorse of quick comprehension checks.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"mcq"` | **yes** | |
| `question` | string | **yes** | The question stem |
| `options` | string[] | **yes** | 2–6 options; order is preserved |
| `answer` | integer | **yes** | **Zero-based** index into `options` |
| `hint` | string | no | Never names the answer or any option |
| `explanation` | string | no | Shown once answered |

> [!warning] The classic authoring mistake
> `answer` is a zero-based index: `"answer": 1` means the **second** option. Validators catch out-of-range indices, but they cannot catch off-by-one meaning errors — always re-read which option your index selects.

## Authoring tips

- Make distractors plausible: common misconceptions make the best wrong options.
- Keep options parallel in length and grammar — the odd one out is often a giveaway.
- Avoid "all of the above"; it breaks the exactly-one-correct contract.

## Live example

```worksheet
{
  "type": "mcq",
  "question": "Which planet has the shortest day?",
  "options": ["Mercury", "Venus", "Jupiter", "Mars"],
  "answer": 2,
  "hint": "The biggest planets spin surprisingly fast.",
  "explanation": "Jupiter rotates once in just under 10 hours — the shortest day in the solar system."
}
```

## Related

- [[activities/true-false|True or false]] — when you only need a binary judgement
- [[worksheet-schema]] — full format reference
