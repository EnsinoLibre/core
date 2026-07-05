---
title: Matching (matching)
tags: ensinolibre, docs, activity-type
type-id: matching
---

# Matching — `matching`

Two columns of items the learner pairs up. Perfect for terms and definitions, words and translations, causes and effects.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"matching"` | **yes** | |
| `prompt` | string | **yes** | What to match with what |
| `pairs` | array | **yes** | 2–8 objects of `{ "left": …, "right": … }` |
| `hint` | string | no | Never states any pairing |
| `explanation` | string | no | Shown once all pairs are correct |

The renderer keeps the left column in order and **shuffles the right-hand values** into dropdowns, so authors always write pairs in their natural, correct pairing.

> [!warning] Right-hand values must be unique
> If two pairs share the same `right` value the learner cannot express a unique matching, so validation rejects it. If two left items genuinely map to the same thing, reword one of them.

## Authoring tips

- Keep the two columns categorically consistent (all definitions, all dates, all translations) — mixed right-hand columns give matches away by elimination of kind.
- 4–6 pairs is the sweet spot; 8 dropdowns get tedious.

## Live example

```worksheet
{
  "type": "matching",
  "prompt": "Match each inventor to their invention.",
  "pairs": [
    { "left": "Tim Berners-Lee", "right": "the World Wide Web" },
    { "left": "Ada Lovelace", "right": "the first published algorithm" },
    { "left": "Johannes Gutenberg", "right": "the movable-type printing press" },
    { "left": "Alexander Graham Bell", "right": "the telephone" }
  ],
  "hint": "Two of these people lived long before electricity was in homes.",
  "explanation": "Berners-Lee (1989, the Web), Lovelace (1843, the algorithm), Gutenberg (c. 1440, printing), Bell (1876, telephone)."
}
```

## Related

- [[activities/ordering|Put in order]] — when the relationship is a sequence, not a pairing
- [[worksheet-schema]] — full format reference
