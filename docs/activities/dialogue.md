---
title: Dialogue (dialogue)
tags: ensinolibre, docs, activity-type
type-id: dialogue
analog-strategy: transform
---

# Dialogue — `dialogue`

A two-speaker model conversation shown as chat bubbles, with optional glosses and built-in read-aloud (browser speech, no audio files). Model the language before productive practice.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"dialogue"` | **yes** |
| `speakerA`, `speakerB` | role names (never real people) | **yes** |
| `lines` | `[{ speaker: "a"\|"b", text, gloss? }]` (2–16) | **yes** |
| `context` | one-line scene setting | no |

**Analog version:** transform — prints as a play script with speaker names in the margin and glosses in italics.

```worksheet
{
  "type": "dialogue",
  "context": "At a café, Saturday morning",
  "speakerA": "Barista",
  "speakerB": "Customer",
  "lines": [
    { "speaker": "a", "text": "Good morning! What can I get you?" },
    { "speaker": "b", "text": "A flat white, please. To take away.", "gloss": "para levar" },
    { "speaker": "a", "text": "Anything to eat with that?" },
    { "speaker": "b", "text": "No, thanks. Just the coffee." }
  ]
}
```

Related: [[activities/scenario|Branching scenario]] · [[worksheet-schema]]
