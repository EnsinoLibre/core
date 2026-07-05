---
title: Slides (course-presentation)
tags: ensinolibre, docs, activity-type
type-id: course-presentation
analog-strategy: transform
---

# Slides — `course-presentation`

Slide-by-slide input with optional embedded quick checks (an `mcq` or `true-false` on a slide). One idea per slide, a check every 2–3 slides.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"course-presentation"` | **yes** |
| `slides` | `[{ title?, body?, activity? }]` (2–12) | **yes** |
| `slides[].activity` | `{ subtype: "mcq"\|"true-false", …that shape… }` | no |

**Analog version:** transform — each slide becomes a headed handout section; embedded checks print inline as boxed "Quick check" questions.

```worksheet
{
  "type": "course-presentation",
  "slides": [
    { "title": "The water cycle", "body": "Water moves in a never-ending loop between the sea, the sky and the land." },
    { "title": "Evaporation", "body": "The sun heats the sea. Liquid water becomes invisible water vapour and rises into the air." },
    { "title": "Check", "activity": { "subtype": "true-false", "statement": "Evaporation turns water vapour back into liquid water.", "answer": false, "hint": "Which direction does the change go when the sun heats the sea?", "explanation": "False — that is condensation. Evaporation turns liquid water into vapour." } }
  ]
}
```

Related: [[activities/content|Reading content]] · [[worksheet-schema]]
