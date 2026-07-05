---
title: Rapid-fire set (single-choice-set)
tags: ensinolibre, docs, activity-type
type-id: single-choice-set
analog-strategy: direct
---

# Rapid-fire set — `single-choice-set`

Quick one-answer questions with auto-advance — fluency, not testing. Same data shape as [[activities/quiz|quiz]] but no pass mark: drill ONE narrow pattern with short stems and 2–3 options.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"single-choice-set"` | **yes** |
| `questions` | mcq-shaped items (3–12) | **yes** |

**Analog version:** direct — prints like a quiz with the header note "Work quickly — first instinct."

```worksheet
{
  "type": "single-choice-set",
  "questions": [
    { "question": "___ apple", "options": ["a", "an"], "answer": 1 },
    { "question": "___ university", "options": ["a", "an"], "answer": 0 },
    { "question": "___ hour", "options": ["a", "an"], "answer": 1 },
    { "question": "___ house", "options": ["a", "an"], "answer": 0 }
  ]
}
```

Related: [[activities/quiz|Quiz]] · [[worksheet-schema]]
