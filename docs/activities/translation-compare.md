---
title: Translation compare (translation-compare)
tags: ensinolibre, docs, activity-type
type-id: translation-compare
analog-strategy: transform
---

# Translation compare — `translation-compare`

Two token rows — source language above, target below — with links between corresponding words. Tap a source word to light up its match; notes flag structural mismatches (idioms, different verbs, word order).

| Field | Type | Required |
|-------|------|----------|
| `type` | `"translation-compare"` | **yes** |
| `pairs` | `[{ headline?, sourceTokens[], targetTokens[], links: [{s, t, note?}] }]` (1–6) | **yes** |

`s`/`t` are zero-based indices into the token arrays.

**Analog version:** transform — the two sentences print with matching superscript numbers on linked words; notes become footnotes.

```worksheet
{
  "type": "translation-compare",
  "pairs": [
    {
      "headline": "Tenho fome → I am hungry",
      "sourceTokens": ["Tenho", "fome"],
      "targetTokens": ["I", "am", "hungry"],
      "links": [
        { "s": 0, "t": 1, "note": "Portuguese uses 'to have' (ter); English uses 'to be'." },
        { "s": 1, "t": 2 }
      ]
    }
  ]
}
```

Related: [[activities/translation|Translation drill]] · [[worksheet-schema]]
