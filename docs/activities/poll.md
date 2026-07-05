---
title: Poll (poll)
tags: ensinolibre, docs, activity-type
type-id: poll
analog-strategy: transform
---

# Poll — `poll`

A single preference question with **no wrong answer**. Each option can carry a `followUp` shown when picked — use it to route learners ("If you chose B, do Section 3 next"). Never mix polls with scored content; learners must trust that polls are safe.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"poll"` | **yes** |
| `question` | the question | **yes** |
| `options` | `[{ text, followUp? }]` (2–5) | **yes** |

**Analog version:** transform — a tick-one form; the follow-up guidance moves to the teacher page as a per-choice table.

```worksheet
{
  "type": "poll",
  "question": "Which topic shall we practise next?",
  "options": [
    { "text": "Talking about the past", "followUp": "Good choice — start with the tense-shift section of the next worksheet." },
    { "text": "Food and restaurants", "followUp": "Tasty! The dialogue and scenario activities will suit you." },
    { "text": "Numbers and prices", "followUp": "Practical — the gap-fill and quiz exercises will help most." }
  ]
}
```

Related: [[activities/survey|Self-assessment survey]] · [[worksheet-schema]]
