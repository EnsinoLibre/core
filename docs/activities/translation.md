---
title: Translation drill (translation)
tags: ensinolibre, docs, activity-type
type-id: translation
analog-strategy: direct
---

# Translation drill — `translation`

Sentence-by-sentence translation: the source sentence is shown, the learner types the target-language version. Checking is case/punctuation-tolerant and accepts every phrasing listed in `alternatives` — include them generously, a drill that rejects correct answers destroys trust.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"translation"` | **yes** |
| `sentences` | `[{ source, target, alternatives?, hint? }]` (1–10) | **yes** |

**Analog version:** direct — numbered source sentences with writing lines; model answers (and alternatives) on the key.

```worksheet
{
  "type": "translation",
  "sentences": [
    { "source": "Eu gosto de café.", "target": "I like coffee.", "hint": "Subject + verb + object — no extra words needed." },
    { "source": "Ela não fala inglês.", "target": "She does not speak English.", "alternatives": ["She doesn't speak English."], "hint": "Remember the auxiliary verb in the negative." }
  ]
}
```

Related: [[activities/translation-compare|Translation compare]] · [[activities/open-response|Open writing]] · [[worksheet-schema]]
