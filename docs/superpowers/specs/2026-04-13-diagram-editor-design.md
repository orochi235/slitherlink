# Diagram Editor

A visual editor page for creating `<sl-diagram>` markup by clicking on a grid.

## Page structure

Single HTML file `editor.html` at the project root, alongside `index.html` and `sl-diagram-test.html`. Loads `sl-diagram.js` for the live preview.

### Layout

Controls in a horizontal toolbar at top. Below: interactive grid (left) and code output (right) side-by-side.

### Toolbar

- **Width** and **Height** number inputs (min 1, max ~10). Changing these resets the grid state.
- **Continue checkboxes**: four checkboxes labeled Top, Bottom, Left, Right. All checked by default (matching the `continue="all"` convention).
- **Copy button**: copies the generated `<sl-diagram>` code to clipboard.

## Interactive grid (left panel)

Rendered as an SVG sized to the grid dimensions.

### Edge interaction

Each edge between two adjacent vertices is a click target. Left-click cycles through five states in order:

1. **undetermined** — gray grid line (default)
2. **line** — black active loop edge
3. **emphasis** — goldenrod forced edge
4. **putative** — dashed magenta edge
5. **x-mark** — red X marker

After x-mark, wraps back to undetermined.

### Cell interaction

Each cell (the area between four vertices) is a click target.

- **Left-click** cycles: blank → 0 → 1 → 2 → 3 → blank
- **Right-click** decrements: blank → 3 → 2 → 1 → 0 → blank (context menu suppressed)

### Visual feedback

- Hover highlight on edges and cells to indicate clickability
- Cursor changes to pointer on hover

### Grid resize

Changing width or height inputs resets all edge states and clue values to defaults (undetermined edges, no clues).

## Code panel (right panel)

### Generated code

A read-only `<pre>` block showing the `<sl-diagram>` element. Updates live as the user clicks edges/cells or changes toolbar settings.

Only attributes with values are included — no empty attributes like `lines=""`.

The `size` attribute is always present. `continue` is generated from the checkbox state: all checked = `continue="all"`, none checked = `continue="none"`, partial = space-separated side names.

### Path chaining

Edges of the same type that form a connected path are chained into the compact path notation used by the component: `0,0->RRDD` rather than `0,0->R; 1,0->R; 2,0->D; 2,1->D`.

Algorithm: for each edge type (lines, emphasis, putative, x-marks), collect all edges of that type, then greedily chain them into paths. Each path starts at a vertex and follows consecutive edges of the same type using direction letters (U/D/L/R). Multiple disconnected paths for the same type are separated by semicolons.

### Live preview

Below the code block, a live-rendered `<sl-diagram>` element shows the actual visual result using the generated attributes. This element updates in sync with the code.

## Styling

Match the existing page styles: `#f4f5f7` background, `Segoe UI`/`system-ui` font family, white card panels with rounded corners and subtle shadows. The toolbar and panels should feel consistent with `sl-diagram-test.html`.

## Files

- `editor.html` — the editor page (new file)
- `sl-diagram.js` — existing component, loaded but not modified
