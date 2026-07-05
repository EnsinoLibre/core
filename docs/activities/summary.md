---
title: Summary builder (summary)
tags: ensinolibre, docs, activity-type
type-id: summary
analog-strategy: direct
---

# Summary builder — `summary`

End-of-unit consolidation: a bank of statements, some correct and some near-misses; the learner selects the true ones to build the accurate summary. The correct statements, read in order, must form a coherent paragraph. Aim for roughly half correct.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"summary"` | **yes** |
| `intro` | context paragraph | no |
| `statements` | `[{ text, correct, explanation? }]` (4–12) | **yes** |

**Analog version:** direct — "Tick the true statements, then copy them below as a summary paragraph", with writing lines.

```worksheet
{
  "type": "summary",
  "intro": "What did we learn about the water cycle?",
  "statements": [
    { "text": "The sun's heat evaporates water from the sea.", "correct": true },
    { "text": "Water vapour condenses into clouds as it cools.", "correct": true },
    { "text": "Clouds are made of smoke.", "correct": false, "explanation": "Clouds are tiny droplets of condensed water, not smoke." },
    { "text": "Rain and snow return the water to the land and sea.", "correct": true },
    { "text": "The cycle happens only once a year.", "correct": false, "explanation": "The water cycle is continuous — it never stops." }
  ],
  "hint": "Three of the statements together tell the story of one drop of water."
}
```

Related: [[activities/quiz|Quiz]] · [[worksheet-schema]]
