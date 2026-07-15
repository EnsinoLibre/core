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

> [!note] The whole set must fit the grid
> The validator doesn't just check each word is shorter than `gridSize` — it runs the **actual placement** and rejects the worksheet if the words can't all be hidden together (words go left-to-right, top-to-bottom or diagonally down-right, overlapping only on shared letters). If you get a "don't all fit" error, raise `gridSize` or use fewer/shorter words. As a rule of thumb keep the words' total letters well under half the grid's cells (`gridSize²`) so there's room to place them; the default 12×12 comfortably holds the usual 6–10 vocabulary words.

**Analog version:** direct — the generated grid prints with the word list beneath; the key lists each word's position.

```worksheet
{
  "type": "word-search",
  "words": ["apple", "banana", "cherry", "grape", "lemon", "mango"],
  "gridSize": 10
}
```

Related: [[activities/flashdeck|Flashcards]] · [[worksheet-schema]]
