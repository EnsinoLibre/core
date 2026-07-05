---
title: Open writing (open-response)
tags: ensinolibre, docs, activity-type
type-id: open-response
---

# Open writing — `open-response`

A free-writing prompt with a live word counter and an optional model answer. The only type without automatic marking — it's for production, not recognition.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"open-response"` | **yes** | |
| `prompt` | string | **yes** | The writing task |
| `minWords` | integer | no | Target length; the counter turns green when reached |
| `sampleAnswer` | string | no | A model answer, hidden behind a click |
| `hint` | string | no | A nudge for learners who are stuck starting |

> [!note] The model answer is a comparison tool, not a key
> `sampleAnswer` sits behind a "Show a model answer" toggle so learners write first and compare after. In the printed version it is hidden entirely — print a second copy for your answer key if you need one.

## Authoring tips

- Give the prompt a **concrete frame**: "Write three sentences describing your morning routine using the past tense" beats "Write about routines".
- Set `minWords` to a floor, not a target — 10–30 for beginners, more for essay work.
- End a worksheet with one open-response task: recognition activities first, production last.

## Live example

```worksheet
{
  "type": "open-response",
  "prompt": "Describe your favourite meal in two or three sentences. Say what it is, when you usually eat it, and why you like it.",
  "minWords": 15,
  "sampleAnswer": "My favourite meal is caldo verde, a Portuguese soup with kale and chorizo. I usually eat it on cold winter evenings. I like it because it reminds me of dinners at my grandmother's house.",
  "hint": "Start with 'My favourite meal is…' and answer the three questions one at a time."
}
```

## Related

- [[activities/gap-fill|Fill in the gaps]] — when there *is* a single right word
- [[worksheet-schema]] — full format reference
