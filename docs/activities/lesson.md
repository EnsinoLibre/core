---
title: Adaptive lesson (lesson)
tags: ensinolibre, docs, activity-type
type-id: lesson
analog-strategy: transform
---

# Adaptive lesson — `lesson`

Linked pages of content and questions where answers determine the path: correct → onwards, wrong → a remediation page that re-teaches *differently*, then rejoins. 4–8 pages; the final page's `nextPage` is `null`. The validator checks every page reference.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"lesson"` | **yes** |
| `startPage` | id of the first page | **yes** |
| `pages` | content pages `{ id, pageType:"content", title?, body, nextPage }` and question pages `{ id, pageType:"question", question, options, answer, onCorrect, onWrong, explanation? }` | **yes** |

**Analog version:** transform — a programmed-instruction booklet: numbered boxes with "Correct → box 4; wrong → box 3" routing. The 1960s analog ancestor of this component.

```worksheet
{
  "type": "lesson",
  "startPage": "p1",
  "pages": [
    { "id": "p1", "pageType": "content", "title": "Comparatives", "body": "Short adjectives add **-er**: old → older. Long adjectives use **more**: more expensive.", "nextPage": "p2" },
    { "id": "p2", "pageType": "question", "question": "Which is correct?", "options": ["more cheap", "cheaper"], "answer": 1, "onCorrect": "p4", "onWrong": "p3", "explanation": "'Cheap' is short, so it takes -er." },
    { "id": "p3", "pageType": "content", "title": "Another look", "body": "Count the syllables! One syllable (cheap, old, tall) → add **-er**. Three or more (expensive, beautiful) → use **more**.", "nextPage": "p2" },
    { "id": "p4", "pageType": "content", "title": "Well done", "body": "You have got the rule — short adjectives take -er.", "nextPage": null }
  ]
}
```

Related: [[activities/scenario|Branching scenario]] · [[activities/content|Reading content]] · [[worksheet-schema]]
