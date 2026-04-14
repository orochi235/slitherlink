# Diagram Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a visual editor page where users click on a grid to build `<sl-diagram>` markup, with live code generation and preview.

**Architecture:** Single HTML file (`editor.html`) with inline CSS and JS. The editor maintains grid state (edge types, cell clues) in Maps, renders an interactive SVG, and generates `<sl-diagram>` attribute strings from that state. The existing `sl-diagram.js` web component is loaded for live preview only — not modified.

**Tech Stack:** Vanilla HTML/CSS/JS, SVG for the interactive grid, `sl-diagram.js` web component for preview.

---

## File Structure

- **Create:** `editor.html` — the entire editor (HTML structure, CSS, JS all inline)
- **Existing:** `sl-diagram.js` — loaded via `<script>` tag, not modified

Everything lives in one file since the editor is a self-contained tool page with no shared logic.

---

### Task 1: Page scaffold and toolbar

**Files:**
- Create: `editor.html`

- [ ] **Step 1: Create the HTML skeleton with toolbar**

Create `editor.html` with the page structure: toolbar on top, two panels below.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Slitherlink Diagram Editor</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #f4f5f7;
    color: #1a1a2e;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    background: white;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    flex-wrap: wrap;
  }
  .toolbar label {
    font-size: .85em;
    font-weight: 600;
    color: #1a1a6e;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .toolbar input[type="number"] {
    width: 56px;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: .85em;
  }
  .toolbar .separator {
    width: 1px;
    height: 24px;
    background: #ddd;
  }
  .toolbar .continue-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toolbar .continue-group span {
    font-size: .85em;
    font-weight: 600;
    color: #1a1a6e;
  }
  .toolbar .continue-group label {
    font-weight: 400;
    font-size: .82em;
    gap: 3px;
    cursor: pointer;
  }
  .toolbar button {
    margin-left: auto;
    padding: 6px 14px;
    background: #1a1a6e;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: .82em;
    font-weight: 600;
    cursor: pointer;
  }
  .toolbar button:hover { background: #2a2a8e; }
  .toolbar button:active { background: #0e0e4e; }

  .panels {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .grid-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    padding: 24px;
  }
  .code-panel {
    width: 400px;
    min-width: 300px;
    background: white;
    border-left: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 20px;
    gap: 16px;
  }
  .code-panel h3 {
    font-size: .9em;
    color: #1a1a6e;
    margin: 0;
  }
  .code-block {
    background: #f8f8fa;
    border: 1px solid #e8e8ec;
    border-radius: 8px;
    padding: 14px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: .78em;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    color: #333;
  }
  .preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
</head>
<body>

<div class="toolbar">
  <label>W <input type="number" id="grid-w" value="3" min="1"></label>
  <label>H <input type="number" id="grid-h" value="3" min="1"></label>
  <div class="separator"></div>
  <div class="continue-group">
    <span>Fade:</span>
    <label><input type="checkbox" id="cont-top" checked> Top</label>
    <label><input type="checkbox" id="cont-bottom" checked> Bottom</label>
    <label><input type="checkbox" id="cont-left" checked> Left</label>
    <label><input type="checkbox" id="cont-right" checked> Right</label>
  </div>
  <button id="copy-btn">Copy</button>
</div>

<div class="panels">
  <div class="grid-panel">
    <svg id="editor-svg"></svg>
  </div>
  <div class="code-panel">
    <h3>Generated Code</h3>
    <pre class="code-block" id="code-output"></pre>
    <h3>Preview</h3>
    <div class="preview-section" id="preview-container"></div>
  </div>
</div>

<script src="sl-diagram.js"></script>
<script>
// Editor logic will go here
</script>
</body>
</html>
```

- [ ] **Step 2: Verify the page loads**

Open `editor.html` in a browser. Confirm: toolbar with W/H inputs, four fade checkboxes (all checked), Copy button, empty left panel, right panel with "Generated Code" and "Preview" headings.

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "Add editor page scaffold with toolbar and panel layout"
```

---

### Task 2: SVG grid rendering

**Files:**
- Modify: `editor.html` (the `<script>` block)

- [ ] **Step 1: Add state and grid rendering**

Replace the `// Editor logic will go here` comment in the `<script>` block with:

```javascript
const CELL = 48;
const DOT_R = 5;
const LINE_W = 5;
const EDGE_HIT = 12; // half-width of click target for edges

// State
let gridW = 3, gridH = 3;
let edgeStates = new Map();  // edgeKey -> 'line'|'emphasis'|'putative'|'xmark'  (absent = undetermined)
let clueStates = new Map();  // "cx,cy" -> 0|1|2|3  (absent = blank)

const EDGE_TYPES = ['undetermined', 'line', 'emphasis', 'putative', 'xmark'];

function edgeKey(x1, y1, x2, y2) {
  if (x1 < x2 || (x1 === x2 && y1 < y2)) return `${x1},${y1}|${x2},${y2}`;
  return `${x2},${y2}|${x1},${y1}`;
}

function resetState() {
  edgeStates = new Map();
  clueStates = new Map();
}

function buildSVG() {
  const svg = document.getElementById('editor-svg');
  const pad = CELL;
  const w = gridW * CELL + pad * 2;
  const h = gridH * CELL + pad * 2;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.cursor = 'default';

  const vx = (gx) => pad + gx * CELL;
  const vy = (gy) => pad + gy * CELL;

  let content = '';

  // Undetermined grid edges
  for (let y = 0; y <= gridH; y++) {
    for (let x = 0; x <= gridW; x++) {
      // Horizontal edge to the right
      if (x < gridW) {
        const key = edgeKey(x, y, x + 1, y);
        const state = edgeStates.get(key) || 'undetermined';
        content += renderEdge(key, vx(x), vy(y), vx(x + 1), vy(y), state);
      }
      // Vertical edge downward
      if (y < gridH) {
        const key = edgeKey(x, y, x, y + 1);
        const state = edgeStates.get(key) || 'undetermined';
        content += renderEdge(key, vx(x), vy(y), vx(x), vy(y + 1), state);
      }
    }
  }

  // Dots
  for (let y = 0; y <= gridH; y++) {
    for (let x = 0; x <= gridW; x++) {
      content += `<circle cx="${vx(x)}" cy="${vy(y)}" r="${DOT_R}" fill="#000" style="pointer-events:none;"/>`;
    }
  }

  // Cell clue targets and numbers
  for (let cy = 1; cy <= gridH; cy++) {
    for (let cx = 1; cx <= gridW; cx++) {
      const px = (vx(cx - 1) + vx(cx)) / 2;
      const py = (vy(cy - 1) + vy(cy)) / 2;
      const clue = clueStates.get(`${cx},${cy}`);
      const clueText = clue !== undefined ? clue : '';
      const fontSize = Math.round(CELL * 0.625);
      // Invisible click target
      const half = CELL / 2 - 6;
      content += `<rect x="${px - half}" y="${py - half}" width="${half * 2}" height="${half * 2}" fill="transparent" style="cursor:pointer;" data-cell="${cx},${cy}" class="cell-target"/>`;
      // Clue text
      if (clueText !== '') {
        content += `<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="#000" style="pointer-events:none;">${clueText}</text>`;
      }
    }
  }

  svg.innerHTML = content;
}

function renderEdge(key, x1, y1, x2, y2, state) {
  let edgeSvg = '';
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const isHoriz = y1 === y2;

  // Visual edge
  if (state === 'undetermined') {
    edgeSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e0e0e0" stroke-width="${LINE_W}" stroke-linecap="round" style="pointer-events:none;"/>`;
  } else if (state === 'line') {
    edgeSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${LINE_W}" stroke-linecap="round" style="pointer-events:none;"/>`;
  } else if (state === 'emphasis') {
    edgeSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#daa520" stroke-width="${LINE_W}" stroke-linecap="round" style="pointer-events:none;"/>`;
  } else if (state === 'putative') {
    const dash = Math.round(CELL * 0.12);
    const gap = Math.round(CELL * 0.10);
    edgeSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c0f" stroke-width="${LINE_W}" stroke-linecap="butt" stroke-dasharray="${dash} ${gap}" style="pointer-events:none;"/>`;
  } else if (state === 'xmark') {
    // Show gray line + X marker
    edgeSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e0e0e0" stroke-width="${LINE_W}" stroke-linecap="round" style="pointer-events:none;"/>`;
    const r = CELL * 0.12;
    edgeSvg += `<line x1="${mx - r}" y1="${my - r}" x2="${mx + r}" y2="${my + r}" stroke="#c00" stroke-width="2" stroke-linecap="round" style="pointer-events:none;"/>`;
    edgeSvg += `<line x1="${mx - r}" y1="${my + r}" x2="${mx + r}" y2="${my - r}" stroke="#c00" stroke-width="2" stroke-linecap="round" style="pointer-events:none;"/>`;
  }

  // Invisible click target (wider than visual line)
  if (isHoriz) {
    edgeSvg += `<rect x="${x1}" y="${my - EDGE_HIT}" width="${x2 - x1}" height="${EDGE_HIT * 2}" fill="transparent" style="cursor:pointer;" data-edge="${key}" class="edge-target"/>`;
  } else {
    edgeSvg += `<rect x="${mx - EDGE_HIT}" y="${y1}" width="${EDGE_HIT * 2}" height="${y2 - y1}" fill="transparent" style="cursor:pointer;" data-edge="${key}" class="edge-target"/>`;
  }

  return edgeSvg;
}

buildSVG();
```

- [ ] **Step 2: Verify the grid renders**

Open `editor.html` in a browser. Confirm a 3x3 grid of gray lines with black dots at vertices. Nothing is clickable yet.

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "Add SVG grid rendering with state management"
```

---

### Task 3: Edge click cycling

**Files:**
- Modify: `editor.html` (the `<script>` block)

- [ ] **Step 1: Add edge click handler**

Add after the `buildSVG()` call:

```javascript
document.getElementById('editor-svg').addEventListener('click', (e) => {
  const edgeEl = e.target.closest('.edge-target');
  if (edgeEl) {
    const key = edgeEl.dataset.edge;
    const current = edgeStates.get(key) || 'undetermined';
    const idx = EDGE_TYPES.indexOf(current);
    const next = EDGE_TYPES[(idx + 1) % EDGE_TYPES.length];
    if (next === 'undetermined') {
      edgeStates.delete(key);
    } else {
      edgeStates.set(key, next);
    }
    buildSVG();
    updateOutput();
    return;
  }
});
```

Also add a placeholder `updateOutput` function:

```javascript
function updateOutput() {
  // will be implemented in Task 5
}
```

- [ ] **Step 2: Add hover effect**

Add this CSS inside the `<style>` block:

```css
.edge-target:hover + line,
.edge-target:hover {
  filter: brightness(1.3);
}
```

Since SVG ordering makes sibling selectors unreliable here, instead add a hover effect via JS. Add after the click handler:

```javascript
document.getElementById('editor-svg').addEventListener('mouseover', (e) => {
  if (e.target.classList.contains('edge-target')) {
    e.target.style.fill = 'rgba(26, 26, 110, 0.08)';
  }
  if (e.target.classList.contains('cell-target')) {
    e.target.style.fill = 'rgba(26, 26, 110, 0.06)';
  }
});
document.getElementById('editor-svg').addEventListener('mouseout', (e) => {
  if (e.target.classList.contains('edge-target') || e.target.classList.contains('cell-target')) {
    e.target.style.fill = 'transparent';
  }
});
```

Remove the CSS hover rule added above (it doesn't work well with SVG layering).

- [ ] **Step 3: Verify edge cycling**

Open the page, click on edges. Each click should cycle: gray → black → goldenrod → dashed magenta → red X → gray. Hover should show a subtle highlight.

- [ ] **Step 4: Commit**

```bash
git add editor.html
git commit -m "Add edge click cycling through five states with hover feedback"
```

---

### Task 4: Cell click cycling

**Files:**
- Modify: `editor.html` (the `<script>` block)

- [ ] **Step 1: Add cell click and right-click handlers**

Add inside the existing click handler, after the edge check:

```javascript
  const cellEl = e.target.closest('.cell-target');
  if (cellEl) {
    const key = cellEl.dataset.cell;
    const current = clueStates.get(key);
    if (current === undefined) {
      clueStates.set(key, 0);
    } else if (current >= 3) {
      clueStates.delete(key);
    } else {
      clueStates.set(key, current + 1);
    }
    buildSVG();
    updateOutput();
  }
```

Add a contextmenu handler for right-click decrement:

```javascript
document.getElementById('editor-svg').addEventListener('contextmenu', (e) => {
  const cellEl = e.target.closest('.cell-target');
  if (cellEl) {
    e.preventDefault();
    const key = cellEl.dataset.cell;
    const current = clueStates.get(key);
    if (current === undefined) {
      clueStates.set(key, 3);
    } else if (current <= 0) {
      clueStates.delete(key);
    } else {
      clueStates.set(key, current - 1);
    }
    buildSVG();
    updateOutput();
  }
});
```

- [ ] **Step 2: Verify cell cycling**

Open the page. Left-click a cell: blank → 0 → 1 → 2 → 3 → blank. Right-click a cell: blank → 3 → 2 → 1 → 0 → blank. No context menu appears on right-click.

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "Add cell clue cycling with left-click increment and right-click decrement"
```

---

### Task 5: Code generation with path chaining

**Files:**
- Modify: `editor.html` (the `<script>` block)

- [ ] **Step 1: Implement path chaining and code generation**

Replace the placeholder `updateOutput` function with:

```javascript
function directionLetter(x1, y1, x2, y2) {
  if (x2 === x1 + 1) return 'R';
  if (x2 === x1 - 1) return 'L';
  if (y2 === y1 + 1) return 'D';
  if (y2 === y1 - 1) return 'U';
  return null;
}

function chainEdges(edgeKeys) {
  if (edgeKeys.length === 0) return '';

  // Build adjacency: vertex -> list of { neighbor, edgeKey }
  const adj = new Map();
  const addAdj = (vKey, nKey, ek) => {
    if (!adj.has(vKey)) adj.set(vKey, []);
    adj.get(vKey).push({ neighbor: nKey, edgeKey: ek });
  };
  const remaining = new Set(edgeKeys);

  for (const ek of edgeKeys) {
    const [a, b] = ek.split('|');
    addAdj(a, b, ek);
    addAdj(b, a, ek);
  }

  const segments = [];

  while (remaining.size > 0) {
    // Pick a start vertex — prefer endpoints (degree 1) for longer chains
    let startVertex = null;
    for (const ek of remaining) {
      const [a, b] = ek.split('|');
      // Check degree in remaining edges
      const degA = (adj.get(a) || []).filter(e => remaining.has(e.edgeKey)).length;
      const degB = (adj.get(b) || []).filter(e => remaining.has(e.edgeKey)).length;
      if (degA === 1) { startVertex = a; break; }
      if (degB === 1) { startVertex = b; break; }
    }
    // If no endpoint found (cycle), pick any vertex from remaining
    if (!startVertex) {
      const firstEdge = remaining.values().next().value;
      startVertex = firstEdge.split('|')[0];
    }

    // Greedily follow the chain
    let current = startVertex;
    let dirs = '';
    let moved = true;
    while (moved) {
      moved = false;
      const neighbors = adj.get(current) || [];
      for (const { neighbor, edgeKey: ek } of neighbors) {
        if (remaining.has(ek)) {
          const [cx, cy] = current.split(',').map(Number);
          const [nx, ny] = neighbor.split(',').map(Number);
          dirs += directionLetter(cx, cy, nx, ny);
          remaining.delete(ek);
          current = neighbor;
          moved = true;
          break;
        }
      }
    }
    const [sx, sy] = startVertex.split(',');
    segments.push(`${sx},${sy}->${dirs}`);
  }

  return segments.join('; ');
}

function generateCode() {
  const parts = [];
  parts.push(`size="${gridW}x${gridH}"`);

  // Clues
  const clueTokens = [];
  for (let cy = 1; cy <= gridH; cy++) {
    for (let cx = 1; cx <= gridW; cx++) {
      const v = clueStates.get(`${cx},${cy}`);
      if (v !== undefined) clueTokens.push(`${cx},${cy}:${v}`);
    }
  }
  if (clueTokens.length > 0) parts.push(`clues="${clueTokens.join(' ')}"`);

  // Edge types grouped
  const byType = { line: [], emphasis: [], putative: [], xmark: [] };
  for (const [key, type] of edgeStates) {
    byType[type].push(key);
  }

  const attrName = { line: 'lines', emphasis: 'emphasis', putative: 'putative', xmark: 'x-marks' };
  for (const type of ['line', 'emphasis', 'putative', 'xmark']) {
    if (byType[type].length > 0) {
      const chained = chainEdges(byType[type]);
      parts.push(`${attrName[type]}="${chained}"`);
    }
  }

  // Continue
  const sides = [];
  if (document.getElementById('cont-top').checked) sides.push('top');
  if (document.getElementById('cont-bottom').checked) sides.push('bottom');
  if (document.getElementById('cont-left').checked) sides.push('left');
  if (document.getElementById('cont-right').checked) sides.push('right');
  const contValue = sides.length === 4 ? 'all' : sides.length === 0 ? 'none' : sides.join(' ');
  parts.push(`continue="${contValue}"`);

  return `<sl-diagram\n  ${parts.join('\n  ')}\n></sl-diagram>`;
}

function updateOutput() {
  const code = generateCode();
  document.getElementById('code-output').textContent = code;

  // Live preview
  const container = document.getElementById('preview-container');
  container.innerHTML = code;
}

updateOutput();
```

- [ ] **Step 2: Verify code generation**

Open the page. Click some edges and cells. The code panel should update live showing a properly formatted `<sl-diagram>` element. Edges of the same type that are adjacent should be chained (e.g., clicking three horizontal edges in a row produces `0,0->RRR` not three separate segments).

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "Add code generation with greedy path chaining and live preview"
```

---

### Task 6: Toolbar controls wiring

**Files:**
- Modify: `editor.html` (the `<script>` block)

- [ ] **Step 1: Wire up width/height inputs and checkboxes**

Add after the `updateOutput()` call:

```javascript
// Width/height inputs
document.getElementById('grid-w').addEventListener('change', (e) => {
  const v = parseInt(e.target.value, 10);
  if (v >= 1) {
    gridW = v;
    resetState();
    buildSVG();
    updateOutput();
  }
});
document.getElementById('grid-h').addEventListener('change', (e) => {
  const v = parseInt(e.target.value, 10);
  if (v >= 1) {
    gridH = v;
    resetState();
    buildSVG();
    updateOutput();
  }
});

// Continue checkboxes
for (const id of ['cont-top', 'cont-bottom', 'cont-left', 'cont-right']) {
  document.getElementById(id).addEventListener('change', () => updateOutput());
}

// Copy button
document.getElementById('copy-btn').addEventListener('click', () => {
  const code = document.getElementById('code-output').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
});
```

- [ ] **Step 2: Verify toolbar controls**

1. Change width to 5 — grid redraws as 5x3, all state resets.
2. Change height to 2 — grid redraws as 5x2.
3. Uncheck "Top" fade checkbox — code output shows `continue="bottom left right"`.
4. Uncheck all — code shows `continue="none"`.
5. Click Copy — button text changes to "Copied!" briefly.

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "Wire up toolbar controls: grid resize, fade checkboxes, and copy button"
```

---

### Task 7: Final polish and verification

**Files:**
- Modify: `editor.html`

- [ ] **Step 1: End-to-end verification**

Open `editor.html` and perform a complete workflow:

1. Set grid to 2x2
2. Click cell at (1,1) to set clue to 3
3. Click the top edge of that cell to set it as a line
4. Click the left edge to set it as a line
5. Click the right edge to set it as emphasis
6. Click the bottom edge to set it as putative
7. Verify the code output shows all attributes correctly with chained paths
8. Verify the live preview renders the diagram matching the interactive grid
9. Click Copy and paste elsewhere to confirm the markup is correct
10. Change grid size — confirm everything resets

- [ ] **Step 2: Commit**

If any fixes were needed, commit them:

```bash
git add editor.html
git commit -m "Final polish for diagram editor"
```
