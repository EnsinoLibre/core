---
title: Memory game (memory-game)
tags: ensinolibre, docs, activity-type
type-id: memory-game
analog-strategy: transform
---

# Memory game — `memory-game`

Face-down cards flipped two at a time; matching pairs stay open. Vocabulary consolidation disguised as play. Keep card texts short (1–3 words).

| Field | Type | Required |
|-------|------|----------|
| `type` | `"memory-game"` | **yes** |
| `pairs` | `[{ left, right }]` (3–8, rights unique) | **yes** |

**Analog version:** transform — prints as a scissors-marked **cut-out card sheet**: cut the cards out, place them face down, play in pairs. The game mechanic survives to paper.

```worksheet
{
  "type": "memory-game",
  "pairs": [
    { "left": "big", "right": "small" },
    { "left": "hot", "right": "cold" },
    { "left": "fast", "right": "slow" },
    { "left": "early", "right": "late" }
  ]
}
```

Related: [[activities/flashdeck|Flashcards]] · [[activities/matching|Matching]] · [[worksheet-schema]]
