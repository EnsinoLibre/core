---
title: Word building (word-transform)
tags: ensinolibre, docs, activity-type
type-id: word-transform
analog-strategy: transform
---

# Word building — `word-transform`

Morphology made visible: a base word plus prefix/suffix pieces build derived forms, each tagged with its word class and an example. One word family per activity, ordered simple → complex.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"word-transform"` | **yes** |
| `baseWord` | the root, e.g. `"happy"` | **yes** |
| `steps` | `[{ derived, pos, morphemes: [{text, role}], gloss?, example? }]` (2–8) | **yes** |

**Analog version:** transform — a word-family table with affixes in bold (`**un** + happi + **ness**`).

```worksheet
{
  "type": "word-transform",
  "baseWord": "happy",
  "steps": [
    { "derived": "unhappy", "pos": "adjective", "morphemes": [ { "text": "un", "role": "prefix" }, { "text": "happy", "role": "root" } ], "gloss": "infeliz", "example": "He was unhappy with the result." },
    { "derived": "happiness", "pos": "noun", "morphemes": [ { "text": "happi", "role": "root" }, { "text": "ness", "role": "suffix" } ], "gloss": "felicidade", "example": "Money cannot buy happiness." },
    { "derived": "unhappiness", "pos": "noun", "morphemes": [ { "text": "un", "role": "prefix" }, { "text": "happi", "role": "root" }, { "text": "ness", "role": "suffix" } ], "gloss": "infelicidade", "example": "Her unhappiness was hard to hide." }
  ]
}
```

Related: [[activities/grammar-forms|Grammar forms]] · [[worksheet-schema]]
