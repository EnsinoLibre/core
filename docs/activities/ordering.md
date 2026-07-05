---
title: Put in order (ordering)
tags: ensinolibre, docs, activity-type
type-id: ordering
---

# Put in order — `ordering`

Shuffled items the learner arranges into the correct sequence. Made for processes, timelines, instructions and story beats.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"ordering"` | **yes** | |
| `prompt` | string | **yes** | What order to put things in |
| `items` | string[] | **yes** | 3–8 items **in the correct order** |
| `hint` | string | no | Never reveals a position |
| `explanation` | string | no | Shown once the order is correct |

> [!note] Authors write the answer; the renderer makes the puzzle
> `items` is always written in the correct order — the renderer shuffles it for each learner (and re-shuffles if a lucky shuffle comes out already solved). Never pre-shuffle in the JSON, or the "correct" order becomes your shuffle.

## Authoring tips

- Every adjacent pair must have a defensible order — if two steps could genuinely swap, merge or reword them.
- Anchor the sequence with a clearly-first and clearly-last item; ambiguity in the middle is where the thinking happens.
- Date-based timelines work well, but avoid items so close together that ordering becomes trivia rather than understanding.

## Live example

```worksheet
{
  "type": "ordering",
  "prompt": "Put the stages of the water cycle in order, starting from the ocean.",
  "items": ["Evaporation from the ocean", "Condensation into clouds", "Precipitation as rain or snow", "Collection in rivers and lakes"],
  "hint": "Follow one drop of water: it has to go up before it can come down.",
  "explanation": "Water evaporates, condenses into clouds, falls as precipitation, and collects — then the cycle repeats."
}
```

## Related

- [[activities/matching|Matching]] — when the relationship is a pairing, not a sequence
- [[worksheet-schema]] — full format reference
