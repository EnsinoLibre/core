---
title: Crossword (crossword)
tags: ensinolibre, docs, activity-type
type-id: crossword
analog-strategy: direct
---

# Crossword — `crossword`

A clue-driven grid. High engagement, high authoring risk: **the validator reconstructs the grid from `row`/`col`/`answer` and rejects any puzzle whose crossing cells disagree** — the most common AI failure for this type. Coordinates are 0-based; answers letters-only.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"crossword"` | **yes** |
| `clues.across` / `clues.down` | `[{ number, clue, answer, row, col }]` | **yes** |

**Analog version:** direct — the classic paper puzzle: grid with blocked squares, clue lists, solved grid on the key.

```worksheet
{
  "type": "crossword",
  "clues": {
    "across": [
      { "number": 1, "clue": "The star our planet orbits", "answer": "SUN", "row": 0, "col": 0 },
      { "number": 3, "clue": "The best card in the pack", "answer": "ACE", "row": 2, "col": 0 }
    ],
    "down": [
      { "number": 1, "clue": "Large body of salt water", "answer": "SEA", "row": 0, "col": 0 },
      { "number": 2, "clue": "Opposite of yes", "answer": "NO", "row": 0, "col": 2 }
    ]
  }
}
```

> [!warning] Check every intersection
> When authoring (or prompting an AI), verify letter-by-letter that each crossing cell holds the same letter in both words. The example above crosses SUN/SEA at (0,0) = S and ICE/NO at (2,2)… — the validator will tell you exactly which cell clashes if you get it wrong.

Related: [[activities/word-search|Word search]] · [[worksheet-schema]]
