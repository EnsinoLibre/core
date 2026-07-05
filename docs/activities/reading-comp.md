---
title: Reading comprehension (reading-comp)
tags: ensinolibre, docs, activity-type
type-id: reading-comp
analog-strategy: direct
---

# Reading comprehension — `reading-comp`

A passage followed by mixed questions — the workhorse of text-based worksheets. Questions reuse the core shapes (`mcq`, `true-false`, `gap-fill`, `matching`) and **each must carry its `type` field** (a question without one renders blank). Order questions by where their evidence appears in the passage.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"reading-comp"` | **yes** |
| `passage` | the text (~60 words beginner → ~250 advanced) | **yes** |
| `questions` | core-shaped items with `type` (1–10) | **yes** |

**Analog version:** direct — passage in a bordered box, numbered questions beneath in their paper forms: the classic reading worksheet.

```worksheet
{
  "type": "reading-comp",
  "passage": "Lisbon is the capital of Portugal and one of the oldest cities in western Europe. It sits on seven hills beside the river Tagus. Its famous yellow trams have carried passengers up the steep streets since 1901.",
  "questions": [
    { "type": "true-false", "statement": "Lisbon is one of the newest cities in western Europe.", "answer": false, "hint": "Re-read the first sentence carefully.", "explanation": "False — the passage says it is one of the oldest." },
    { "type": "mcq", "question": "How many hills does Lisbon sit on?", "options": ["Five", "Seven", "Nine"], "answer": 1, "hint": "The number is in the second sentence.", "explanation": "The passage says it sits on seven hills." },
    { "type": "gap-fill", "text": "Lisbon's yellow {{trams}} have run since {{1901}}.", "hint": "Both answers are in the last sentence.", "explanation": "The trams have operated since 1901." }
  ]
}
```

Related: [[activities/question-set|Mixed question set]] · [[worksheet-schema]]
