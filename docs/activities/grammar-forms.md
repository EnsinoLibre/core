---
title: Grammar forms (grammar-forms)
tags: ensinolibre, docs, activity-type
type-id: grammar-forms
analog-strategy: transform
---

# Grammar forms — `grammar-forms`

One sentence shown across its forms (positive / negative / question) behind tabs, with the changing part in `**bold**`. Makes the *structure change* visible while the vocabulary stays constant.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"grammar-forms"` | **yes** |
| `grammar` | the grammar point | **yes** |
| `forms` | `[{ label, sentence, gloss? }]` (2–6) | **yes** |

**Analog version:** transform — prints as a structure table (Form · Sentence · Gloss) with the changing morphemes bold.

```worksheet
{
  "type": "grammar-forms",
  "grammar": "Present simple — to like",
  "forms": [
    { "label": "Positive", "sentence": "She **likes** coffee.", "gloss": "Ela gosta de café." },
    { "label": "Negative", "sentence": "She **does not like** coffee.", "gloss": "Ela não gosta de café." },
    { "label": "Question", "sentence": "**Does** she **like** coffee?", "gloss": "Ela gosta de café?" }
  ]
}
```

Related: [[activities/tense-shift|Tense shift]] · [[worksheet-schema]]
