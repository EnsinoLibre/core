---
title: True or false (true-false)
tags: ensinolibre, docs, activity-type
type-id: true-false
---

# True or false — `true-false`

A single statement the learner judges as true or false. Ideal for surfacing and tackling misconceptions head-on.

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"true-false"` | **yes** | |
| `statement` | string | **yes** | The claim to judge |
| `answer` | boolean | **yes** | `true` or `false` (JSON booleans, not strings) |
| `hint` | string | no | Never gives the verdict away |
| `explanation` | string | no | Shown once answered |

## Authoring tips

- The best false statements are **popular misconceptions**, not absurdities — "we only use 10% of our brains" teaches more than "the Moon is made of cheese".
- Avoid negations and double negatives in the statement; learners should fail on knowledge, not parsing.
- Aim for a rough balance of true and false answers across a worksheet — learners notice patterns.

> [!note] Booleans, not strings
> `"answer": true` is correct; `"answer": "true"` fails validation. AI assistants get this right when the prompt shows a literal example, which the [[prompt-template]] does.

## Live example

```worksheet
{
  "type": "true-false",
  "statement": "Goldfish have a memory span of only three seconds.",
  "answer": false,
  "hint": "This 'fact' is a popular myth — think about how pets learn feeding routines.",
  "explanation": "False — goldfish can remember things for months and can even be trained to respond to signals."
}
```

## Related

- [[activities/mcq|Multiple choice]] — when there are several plausible answers
- [[worksheet-schema]] — full format reference
