---
title: Listening comprehension (listen-mcq)
tags: ensinolibre, docs, activity-type
type-id: listen-mcq
analog-strategy: teacher-audio
---

# Listening comprehension — `listen-mcq`

The learner listens to a short text (browser read-aloud) and answers multiple-choice questions about it. Every question must be answerable from the transcript alone; mix gist and detail questions.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"listen-mcq"` | **yes** |
| `transcript` | the spoken text (≤120 words, role speakers only) | **yes** |
| `questions` | mcq-shaped items (1–8) | **yes** |
| `showTranscriptAfter` | reveal transcript once answered | no |

**Analog version:** teacher-audio — the questions print for the learner; the transcript prints as a boxed **teacher read-aloud script** ("read twice") with the answers.

```worksheet
{
  "type": "listen-mcq",
  "transcript": "Attention passengers. The 10:15 service to Manchester is delayed by twenty minutes. It will now depart from platform six, not platform two. We apologise for the inconvenience.",
  "showTranscriptAfter": true,
  "questions": [
    { "question": "How long is the delay?", "options": ["Ten minutes", "Twenty minutes", "An hour"], "answer": 1, "hint": "Listen for the number straight after the word 'delayed'.", "explanation": "The announcement says the train is delayed by twenty minutes." },
    { "question": "Which platform does the train now leave from?", "options": ["Platform two", "Platform six", "Platform ten"], "answer": 1, "hint": "Two platforms are mentioned — you need the new one.", "explanation": "It departs from platform six; platform two was the original." }
  ]
}
```

Related: [[activities/dictation|Dictation]] · [[worksheet-schema]]
