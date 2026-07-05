---
title: Picture labelling (image-hotspot)
tags: ensinolibre, docs, activity-type
type-id: image-hotspot
analog-strategy: transform
---

# Picture labelling — `image-hotspot`

Numbered markers on a picture; tapping a marker reveals its label. Because worksheets are self-contained, the picture is an **inline SVG scene** in the JSON (no external image paths, no scripts or links — the validator rejects them). `x`/`y` are percentages.

| Field | Type | Required |
|-------|------|----------|
| `type` | `"image-hotspot"` | **yes** |
| `svg` | inline `<svg>` scene | **yes** |
| `hotspots` | `[{ label, x, y, description? }]` (2–10) | **yes** |

**Analog version:** transform — the picture prints with the numbered markers and a blank label list (`1 ______`); the key pairs numbers and labels.

```worksheet
{
  "type": "image-hotspot",
  "instruction": "Tap the numbers to learn the parts of the house.",
  "svg": "<svg viewBox='0 0 400 260' xmlns='http://www.w3.org/2000/svg'><rect width='400' height='260' fill='#87ceeb'/><rect x='60' y='120' width='280' height='120' fill='#e8d3a9'/><polygon points='40,120 200,30 360,120' fill='#b5533c'/><rect x='180' y='170' width='45' height='70' fill='#6b4226'/><rect x='90' y='150' width='50' height='40' fill='#bfe6f5' stroke='#555'/><rect x='260' y='150' width='50' height='40' fill='#bfe6f5' stroke='#555'/><rect x='285' y='45' width='24' height='50' fill='#8a8a8a'/></svg>",
  "hotspots": [
    { "label": "roof", "x": 50, "y": 25, "description": "It keeps the rain out." },
    { "label": "door", "x": 50, "y": 78 },
    { "label": "window", "x": 28, "y": 65 },
    { "label": "chimney", "x": 74, "y": 22 }
  ]
}
```

Related: [[activities/content|Reading content]] · [[worksheet-schema]]
