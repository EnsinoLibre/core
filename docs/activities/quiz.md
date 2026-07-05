---
title: Quiz (quiz)
tags: ensinolibre, docs, activity-type
type-id: quiz
analog-strategy: direct
---

# Quiz — `quiz`

A scored set of multiple-choice questions with a pass mark — the end-of-topic check. Use [[activities/mcq|mcq]] for a single standalone question; use `quiz` when the *set* is the unit and passing matters.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"quiz"` | **yes** |
| `questions` | mcq-shaped items (2–12) | **yes** |
| `passMark` | ≈70% of questions | no |

**Analog version:** direct — numbered questions with lettered tick-box options; "Pass: X of Y" in the header; letter answer key with explanations.

```worksheet
{
  "type": "quiz",
  "passMark": 2,
  "questions": [
    { "question": "Which gas do plants absorb for photosynthesis?", "options": ["Oxygen", "Carbon dioxide", "Nitrogen"], "answer": 1, "hint": "It is the gas we breathe out.", "explanation": "Plants take in carbon dioxide and release oxygen." },
    { "question": "Where does photosynthesis mainly happen?", "options": ["In the roots", "In the leaves", "In the flowers"], "answer": 1, "hint": "Think about which part of the plant catches the light.", "explanation": "The leaves contain chlorophyll, which captures light energy." },
    { "question": "What do plants produce as food?", "options": ["Glucose", "Protein", "Salt"], "answer": 0, "hint": "It is a type of sugar.", "explanation": "Photosynthesis produces glucose (and oxygen as a by-product)." }
  ]
}
```

Related: [[activities/single-choice-set|Rapid-fire set]] · [[activities/question-set|Mixed question set]] · [[worksheet-schema]]
