---
title: Tense shift (tense-shift)
tags: ensinolibre, docs, activity-type
type-id: tense-shift
analog-strategy: transform
---

# Tense shift — `tense-shift`

Sibling of [[activities/grammar-forms|Grammar forms]]: the tabs morph one sentence between **tenses**. Same subject and complement throughout; only tense-bearing words change (write them in `**bold**`), each with a natural time expression.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"tense-shift"` | **yes** |
| `verb` | the verb being conjugated | **yes** |
| `context` | optional shared context | no |
| `tenses` | `[{ label, sentence, gloss? }]` (2–6) | **yes** |

**Analog version:** transform — a conjugation table with the changing morphemes bold.

```worksheet
{
  "type": "tense-shift",
  "verb": "to work",
  "context": "Maria and her job",
  "tenses": [
    { "label": "Past simple", "sentence": "Maria **worked** late yesterday.", "gloss": "trabalhou" },
    { "label": "Present simple", "sentence": "Maria **works** late every Friday.", "gloss": "trabalha" },
    { "label": "Future", "sentence": "Maria **will work** late tomorrow.", "gloss": "vai trabalhar" }
  ]
}
```

Related: [[activities/grammar-forms|Grammar forms]] · [[worksheet-schema]]
