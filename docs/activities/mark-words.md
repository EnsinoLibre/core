---
title: Mark the words (mark-words)
tags: ensinolibre, docs, activity-type
type-id: mark-words
analog-strategy: direct
---

# Mark the words — `mark-words`

A text in which the learner taps every word matching a stated criterion (all verbs, all animals…). The criterion must be unambiguous, and every target must appear verbatim in the text — the validator checks.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"mark-words"` | **yes** |
| `instruction` | states the criterion | **yes** |
| `text` | 30–80 words of prose | **yes** |
| `targets` | words to find | **yes** |

**Analog version:** direct — "Underline every …"; the key reprints the text with targets in bold.

```worksheet
{
  "type": "mark-words",
  "instruction": "Tap every animal in the story.",
  "text": "The fox crossed the field at dawn. A rabbit froze near the hedge, and two crows watched from the fence while a dog barked far away.",
  "targets": ["fox", "rabbit", "crows", "dog"],
  "hint": "There are four of them — one is watching from above.",
  "explanation": "The animals are the fox, the rabbit, the crows and the dog."
}
```

Related: [[activities/gap-fill|Fill in the gaps]] · [[worksheet-schema]]
