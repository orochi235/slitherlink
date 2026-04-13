# Slitherlink Solving Lemmas — Design Spec

## Overview

A slitherlink lemmas reference page with a custom web component for rendering Slitherlink puzzle diagrams as inline SVGs. Mirrors the structure and visual styling of the [norinori project](../../../norinori/) but adapted for Slitherlink's dot-and-edge grid model.

**Deliverables:**
- `sl-diagram.js` — vanilla JS web component (no dependencies)
- `index.html` — lemmas reference page with placeholder content

## Slitherlink Basics

Slitherlink is a loop-drawing puzzle on a grid of dots. Cells may contain clue numbers (0–3) indicating how many of their four edges are part of a single continuous loop. The loop cannot branch or cross itself.

## `<sl-diagram>` Component

### Attributes

| Attribute | Description |
|-----------|-------------|
| `size` | Grid dimensions as `WxH` (e.g. `3x3` = 3 columns, 3 rows of cells). Determines vertex grid of (W+1)×(H+1). |
| `clues` | Space-separated `x,y:N` pairs for cell clue numbers. Cells are 1-indexed (x=column, y=row). |
| `lines` | Semicolon-separated path segments for active loop edges: `x,y->UDLR...` |
| `crosses` | Same path syntax as `lines`, for eliminated edges. |
| `emphasis` | Same path syntax as `lines`, for highlighted/forced edges. |
| `caption` | Text caption rendered below the diagram. |
| `show-crosses` | Boolean. When present, eliminated edges show red ✕ markers instead of being removed (gaps). Default behavior is gaps. |
| `continue` | Which sides show fade stubs: `"all"` (default), `"none"`, or space-separated subset of `top`, `bottom`, `left`, `right`. |
| `extents` | Force bounding box with `x1,y1:x2,y2`. Used by `<sl-sequence>` to sync diagram sizes. |
| `baseline` | Row number whose center is used for vertical alignment. |

### Path Syntax

Edges are specified as semicolon-separated path segments. Each segment starts at a vertex coordinate and follows a series of cardinal directions:

```
x,y->DIRECTIONS
```

- Vertex coordinates are 0-indexed. A `3x3` grid has vertices from (0,0) to (3,3).
- Directions: `U` (up, y−1), `D` (down, y+1), `L` (left, x−1), `R` (right, x+1).
- Multiple segments separated by semicolons: `1,0->RRDD; 0,2->RR`

Example — a complete loop around the top-left cell:
```
lines="0,0->RDLU"
```

### Coordinate System

- **Cells** are 1-indexed `x,y` where x=column (left to right), y=row (top to bottom). Used in `clues`.
- **Vertices** are 0-indexed. A cell at (x,y) has corners at vertices (x−1,y−1), (x,y−1), (x−1,y), (x,y). Used in path segments.

### Rendering Layers (bottom to top)

1. **Undetermined edges** — all grid edges drawn in `--sl-grid` color (#e0e0e0), `--sl-line-width` (5px). Edges in `lines`, `crosses`, or `emphasis` are excluded from this layer (eliminated edges become gaps by default).
2. **Vertex dots** — circles at each grid vertex in `--sl-dot` color (#666), radius `--sl-dot-radius` (5).
3. **Active edges** — edges from `lines` drawn in `--sl-line` color (#000).
4. **Emphasized edges** — edges from `emphasis` drawn in `--sl-emphasis` color (#daa520).
5. **Emphasized endpoint dots** — vertices at endpoints of `emphasis` paths drawn in `--sl-emphasis` color, on top of regular dots.
6. **Clue numbers** — centered in cells, 30px size (scaled to `--sl-cell-size`), weight 700, `--sl-clue` color (#1a1a6e).
7. **Cross markers** — if `show-crosses` is present, ✕ markers drawn at midpoint of eliminated edges in `--sl-cross` color (#c00).

### Fade Effect

When `continue` specifies sides (default: all), the diagram extends by one extra cell on those sides with content fading to transparent. The fade is aggressive — fully transparent by the halfway point of the extra cell. Implemented via SVG gradient masks, same technique as the norinori component.

### CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--sl-cell-size` | `48` | Cell width/height in pixels |
| `--sl-line-width` | `5` | Edge stroke width |
| `--sl-dot-radius` | `5` | Vertex dot radius |
| `--sl-line` | `#000` | Active edge color |
| `--sl-emphasis` | `#daa520` | Emphasized edge color |
| `--sl-grid` | `#e0e0e0` | Undetermined edge color |
| `--sl-dot` | `#666` | Vertex dot color |
| `--sl-clue` | `#1a1a6e` | Clue number color |
| `--sl-cross` | `#c00` | Cross marker color |
| `--sl-caption` | `#666` | Caption text color |

## `<sl-sequence>` Component

Lays out multiple `<sl-diagram>` elements in a row with arrow separators. Automatically syncs `extents` across all child diagrams so they share a consistent bounding box.

Captions are specified per-diagram via the `caption` attribute on each `<sl-diagram>`, not on the sequence.

### Example

```html
<sl-sequence>
  <sl-diagram
    size="2x2" clues="1,1:3"
    lines="0,0->RDR"
    caption="Given"
  ></sl-diagram>
  <sl-diagram
    size="2x2" clues="1,1:3"
    lines="0,0->RDR"
    emphasis="2,1->DL"
    caption="Forced edges"
  ></sl-diagram>
</sl-sequence>
```

## Page Structure (`index.html`)

Visual styling matches the norinori project:

- **Header** — "Slitherlink Solving Lemmas" with subtitle
- **Rules box** — dark navy (#1a1a6e) card explaining slitherlink rules
- **Lemma cards** — two-column grid layout (text left, diagram right)
  - Numbered badges (LEMMA 1, LEMMA 2, ...)
  - Titles, description paragraphs, corollary callouts
  - Same CSS as norinori (`.lemma`, `.lemma-text`, `.lemma-header`, `.lemma-num`, `.corollary`, `.diagrams`)
- **Axioms section** — collapsible `<details>` block for basic operations
- **Heuristics section** — gold-accented cards for non-deterministic strategies
- **Summary table** — quick-reference card
- **Responsive** — single-column layout below 700px

Content will be placeholder/example lemmas demonstrating component features. The user will replace with real lemma content.

## Files

```
slitherlink/
  sl-diagram.js     # Web component
  index.html         # Lemmas page
```
