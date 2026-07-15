---
title: Mixed question set (question-set)
tags: ensinolibre, docs, activity-type
type-id: question-set
analog-strategy: direct
---

# Mixed question set — `question-set`

One scored set mixing `mcq`, `true-false` and `gap-fill` items. **Every item must carry its `subtype`** — an item without one renders blank. Alternate the subtypes rather than blocking them.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"question-set"` | **yes** |
| `questions` | `[{ subtype, …that shape… }]` (2–12) | **yes** |
| `passMark` | integer (1 … number of questions) | no |

**Analog version:** direct — numbered items, each printed in its subtype's paper form; the mixed rhythm prevents answer-pattern guessing.

```worksheet
{
  "type": "question-set",
  "passMark": 2,
  "questions": [
    { "subtype": "mcq", "question": "Which is the largest ocean?", "options": ["Atlantic", "Pacific", "Indian"], "answer": 1, "hint": "It borders Asia and the Americas.", "explanation": "The Pacific covers about a third of the Earth's surface." },
    { "subtype": "true-false", "statement": "Rivers always flow from north to south.", "answer": false, "hint": "Think about what actually pulls water along.", "explanation": "False — rivers flow downhill, whatever the compass direction." },
    { "subtype": "gap-fill", "text": "The line of 0° latitude is called the {{equator|Equator}}.", "hint": "It divides the northern and southern hemispheres.", "explanation": "The equator sits at 0° latitude." }
  ]
}
```

Related: [[activities/quiz|Quiz]] · [[activities/reading-comp|Reading comprehension]] · [[worksheet-schema]]
