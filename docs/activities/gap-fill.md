---
title: Fill in the gaps (gap-fill)
tags: ensinolibre, docs, activity-type
type-id: gap-fill
---

# Fill in the gaps — `gap-fill`

Prose with missing words the learner types in. The strongest type for vocabulary, terminology and precise recall.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"gap-fill"` | **yes** | |
| `text` | string | **yes** | Prose with 1+ gaps written as `{{answer}}` |
| `hint` | string | no | Never contains a gap's answer |
| `explanation` | string | no | Shown once all gaps are correct |

## Gap syntax

- A gap is the answer wrapped in double curly braces: `The capital of Portugal is {{Lisbon}}.`
- Alternative accepted answers are separated by `|`: `{{colour|color}}` accepts both spellings.
- Checking is **case-insensitive** and ignores surrounding/extra whitespace; everything else must match exactly.

> [!tip] Keep gaps meaningful
> Gap the *concept word*, not grammar glue. "Plants absorb {{carbon dioxide}} through their leaves" tests understanding; "Plants absorb carbon dioxide {{through}} their leaves" tests guessing. Use 1–5 gaps per activity — beyond that, learners lose the thread of the sentence.

## Live example

```worksheet
{
  "type": "gap-fill",
  "text": "Water freezes at {{0|zero}} degrees Celsius and boils at {{100|one hundred}} degrees Celsius at sea level.",
  "hint": "Both numbers are the anchor points of the Celsius scale itself.",
  "explanation": "The Celsius scale was defined around the freezing (0°) and boiling (100°) points of water."
}
```

## Related

- [[activities/open-response|Open writing]] — when there is no single right word
- [[worksheet-schema]] — full format reference
