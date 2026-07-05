---
title: Self-assessment survey (survey)
tags: ensinolibre, docs, activity-type
type-id: survey
analog-strategy: transform
---

# Self-assessment survey — `survey`

An unscored form of scales, choices and open questions — lesson feedback or "how confident do you feel?" self-assessment. Responses stay on the learner's device (EnsinoLibre has no backend). Keep to ≤6 items.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"survey"` | **yes** |
| `items` | `[{ question, itemType: "scale"\|"choice"\|"opentext", scale?, labels?, options? }]` (1–8) | **yes** |

`labels` names the *ends* of a scale, not every point.

**Analog version:** transform — a printed survey form: circles to ring for scales, tick boxes for choices, ruled lines for open text. No answer key — there are no answers.

```worksheet
{
  "type": "survey",
  "items": [
    { "question": "How confident do you feel about today's topic?", "itemType": "scale", "scale": 5, "labels": ["Not at all", "Very confident"] },
    { "question": "Which part would you like to practise more?", "itemType": "choice", "options": ["Vocabulary", "Grammar", "Listening"] },
    { "question": "One thing I will remember from this worksheet is…", "itemType": "opentext" }
  ]
}
```

Related: [[activities/poll|Poll]] · [[worksheet-schema]]
