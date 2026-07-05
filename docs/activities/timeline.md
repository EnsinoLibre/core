---
title: Timeline (timeline)
tags: ensinolibre, docs, activity-type
type-id: timeline
analog-strategy: transform
---

# Timeline — `timeline`

Dated events in chronological order. Input, not assessment — pair it with [[activities/ordering|Put in order]] on the same events to test the sequence afterwards.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"timeline"` | **yes** |
| `items` | `[{ date, headline, text? }]` (3–12, in order) | **yes** |

**Analog version:** transform — prints as a chronology table (Date · Event · Details). `date` is a display string, so timelines work for daily routines ("07:00") as well as history ("1969").

```worksheet
{
  "type": "timeline",
  "items": [
    { "date": "1957", "headline": "Sputnik 1", "text": "The first artificial satellite orbits Earth." },
    { "date": "1961", "headline": "First human in space", "text": "Yuri Gagarin completes one orbit of Earth." },
    { "date": "1969", "headline": "Moon landing", "text": "Apollo 11 lands two astronauts on the Moon." },
    { "date": "1998", "headline": "ISS assembly begins", "text": "The first module of the International Space Station launches." }
  ]
}
```

Related: [[activities/ordering|Put in order]] · [[worksheet-schema]]
