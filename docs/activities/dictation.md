---
title: Dictation (dictation)
tags: ensinolibre, docs, activity-type
type-id: dictation
analog-strategy: teacher-audio
---

# Dictation — `dictation`

The learner hears a sentence (browser read-aloud — no audio files) and types it in full. Trains listening, spelling and word segmentation at once. Sentences of 5–12 words, one difficulty each.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"dictation"` | **yes** |
| `items` | `[{ text, hint? }]` (1–8) | **yes** |

**Analog version:** teacher-audio — the learner page prints numbered writing lines; the teacher page prints a boxed **dictation script** ("read three times: natural, slow, natural").

```worksheet
{
  "type": "dictation",
  "items": [
    { "text": "The train leaves at half past seven.", "hint": "Listen carefully for the time expression." },
    { "text": "She doesn't work on Saturdays.", "hint": "There is a contraction in this sentence." }
  ]
}
```

Related: [[activities/listen-mcq|Listening comprehension]] · [[activities/gap-fill|Fill in the gaps]] · [[worksheet-schema]]
