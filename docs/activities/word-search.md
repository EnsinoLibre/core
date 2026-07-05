---
title: Word search (word-search)
tags: ensinolibre, docs, activity-type
type-id: word-search
analog-strategy: direct
---

# Word search — `word-search`

A letter grid hiding themed vocabulary. Authors supply only the word list — the grid is generated automatically (and deterministically, so the printed sheet and answer key always match). Tap a word's first letter, then its last.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"word-search"` | **yes** |
| `words` | 4–14 words, letters only | **yes** |
| `gridSize` | 6–16 (default 12) | no |

**Analog version:** direct — the generated grid prints with the word list beneath; the key lists each word's position.

```worksheet
{
  "type": "word-search",
  "words": ["apple", "banana", "cherry", "grape", "lemon", "mango"],
  "gridSize": 10
}
```

Related: [[activities/flashdeck|Flashcards]] · [[worksheet-schema]]
