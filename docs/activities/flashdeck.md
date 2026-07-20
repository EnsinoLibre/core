---
title: Flashcards (flashdeck)
tags: ensinolibre, docs, activity-type
type-id: flashdeck
analog-strategy: transform
---

# Flashcards — `flashdeck`

A flip-card vocabulary deck: target word on the front, meaning on the back, with optional pronunciation, example and emoji. Built-in read-aloud speaks the **word only**.

> [!note] Read-aloud appears only when the device can do it well
> The 🔊 button uses the browser's own speech engine — nothing is downloaded. EnsinoLibre picks the best voice installed for the worksheet's `language` and **hides the button when the device has no voice for that language**. Voice availability varies by device and operating system, so treat read-aloud as an enhancement, not something an activity depends on.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"flashdeck"` | **yes** |
| `cards` | `[{ front, back, pronunciation?, example?, emoji? }]` (3–20) | **yes** |

**Analog version:** transform — the canonical example of the digital→analog principle: the deck becomes a **Markdown vocabulary table** (# · Word · Pronunciation · Meaning · Example).

```worksheet
{
  "type": "flashdeck",
  "cards": [
    { "front": "bakery", "back": "padaria", "pronunciation": "ˈbeɪkəri", "example": "I buy bread at the bakery.", "emoji": "🥖" },
    { "front": "butcher's", "back": "talho", "pronunciation": "ˈbʊtʃəz", "example": "The butcher's sells fresh meat.", "emoji": "🥩" },
    { "front": "greengrocer's", "back": "frutaria", "pronunciation": "ˈɡriːnɡrəʊsəz", "example": "Buy your apples at the greengrocer's.", "emoji": "🍎" },
    { "front": "chemist's", "back": "farmácia", "pronunciation": "ˈkemɪsts", "example": "The chemist's is open until eight.", "emoji": "💊" }
  ]
}
```

Related: [[activities/memory-game|Memory game]] · [[worksheet-schema]]
