---
title: Reading content (content)
tags: ensinolibre, docs, activity-type
type-id: content
analog-strategy: direct
---

# Reading content — `content`

Static instructional input: headed sections of text with light formatting (`**bold**`, `*italic*`, `` `code` ``). The reading matter that precedes practice activities.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"content"` | **yes** |
| `sections` | `[{ heading, body }]` | **yes** |

**Analog version:** direct — sections print as headed text blocks; this type is already Markdown-shaped.

> [!tip] Keep sections short
> Under ~150 words each, and always follow content with at least one practice activity on the same material.

```worksheet
{
  "type": "content",
  "sections": [
    { "heading": "What is a habitat?", "body": "A habitat is the natural home of a plant or animal. It provides **food**, **water** and **shelter** — everything a living thing needs to survive." },
    { "heading": "Habitats can change", "body": "Seasons, weather and human activity all change habitats. When a habitat changes *faster than its animals can adapt*, they must move or they will struggle." }
  ]
}
```

Related: [[activities/course-presentation|Slides]] · [[worksheet-schema]]
