class SLDiagram extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'clues', 'lines', 'erased', 'emphasis', 'putative', 'x-marks', 'caption', 'continue', 'extents', 'baseline'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }

  static parseSize(s) {
    if (!s) return null;
    const [w, h] = s.toLowerCase().split('x').map(Number);
    return { w, h };
  }

  static parseClues(s) {
    const map = new Map();
    if (!s || !s.trim()) return map;
    for (const tok of s.trim().split(/\s+/)) {
      const idx = tok.indexOf(':');
      if (idx === -1) continue;
      const coord = tok.substring(0, idx);
      const val = tok.substring(idx + 1);
      map.set(coord, val);
    }
    return map;
  }

  static parsePaths(s) {
    if (!s || !s.trim()) return [];
    const edges = [];
    for (const segment of s.split(';')) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const arrowIdx = trimmed.indexOf('->');
      if (arrowIdx === -1) continue;
      const coordPart = trimmed.substring(0, arrowIdx).trim();
      const dirPart = trimmed.substring(arrowIdx + 2).trim().toUpperCase();
      const [x, y] = coordPart.split(',').map(Number);
      let cx = x, cy = y;
      for (const ch of dirPart) {
        let nx = cx, ny = cy;
        if (ch === 'U') ny--;
        else if (ch === 'D') ny++;
        else if (ch === 'L') nx--;
        else if (ch === 'R') nx++;
        else continue;
        const key = SLDiagram.edgeKey(cx, cy, nx, ny);
        edges.push(key);
        cx = nx;
        cy = ny;
      }
    }
    return edges;
  }

  static edgeKey(x1, y1, x2, y2) {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) return `${x1},${y1}|${x2},${y2}`;
    return `${x2},${y2}|${x1},${y1}`;
  }

  static parseEdgeEndpoints(key) {
    const [a, b] = key.split('|');
    const [x1, y1] = a.split(',').map(Number);
    const [x2, y2] = b.split(',').map(Number);
    return { x1, y1, x2, y2 };
  }

  static parseStubs(s) {
    if (!s || s.trim() === '' || s.trim() === 'all') return new Set(['top', 'bottom', 'left', 'right']);
    if (s.trim() === 'none') return new Set();
    return new Set(s.trim().split(/[\s,]+/).map(v => v.toLowerCase()));
  }

  render() {
    const cs = getComputedStyle(this);
    const cssVar = (name, fallback) => {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    const cssNum = (name, fallback) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return isNaN(v) ? fallback : v;
    };

    const C = cssNum('--sl-cell-size', 48);
    const LINE_W = cssNum('--sl-line-width', 5);
    const DOT_R = cssNum('--sl-dot-radius', 5);
    const COL = {
      line: cssVar('--sl-line', '#000'),
      emphasis: cssVar('--sl-emphasis', '#daa520'),
      grid: cssVar('--sl-grid', '#e0e0e0'),
      dot: cssVar('--sl-dot', '#000'),
      clue: cssVar('--sl-clue', '#000'),
      putative: cssVar('--sl-putative', '#c0f'),
      cross: cssVar('--sl-cross', '#c00'),
      caption: cssVar('--sl-caption', '#666'),
    };

    const stubSides = SLDiagram.parseStubs(this.getAttribute('continue'));
    const captionText = this.getAttribute('caption') || '';

    // Parse grid size
    const sizeAttr = this.getAttribute('size');
    const clueMap = SLDiagram.parseClues(this.getAttribute('clues'));
    const lineEdges = new Set(SLDiagram.parsePaths(this.getAttribute('lines')));
    const crossEdges = new Set(SLDiagram.parsePaths(this.getAttribute('erased')));
    const emphasisEdges = new Set(SLDiagram.parsePaths(this.getAttribute('emphasis')));
    const putativeEdges = new Set(SLDiagram.parsePaths(this.getAttribute('putative')));
    const xMarkEdges = new Set(SLDiagram.parsePaths(this.getAttribute('x-marks')));

    // Determine grid dimensions from size attribute, clues, or edge data
    let gridW = 0, gridH = 0;
    if (sizeAttr) {
      const sz = SLDiagram.parseSize(sizeAttr);
      if (sz) { gridW = sz.w; gridH = sz.h; }
    }

    // Expand from clues
    for (const k of clueMap.keys()) {
      const [x, y] = k.split(',').map(Number);
      gridW = Math.max(gridW, x);
      gridH = Math.max(gridH, y);
    }

    // Expand from edges
    const allEdgeSets = [lineEdges, crossEdges, emphasisEdges, putativeEdges, xMarkEdges];
    for (const edgeSet of allEdgeSets) {
      for (const ek of edgeSet) {
        const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
        gridW = Math.max(gridW, x1, x2);
        gridH = Math.max(gridH, y1, y2);
      }
    }

    if (gridW === 0 && gridH === 0) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    // Cells: 1..gridW columns, 1..gridH rows
    // Vertices: 0..gridW columns, 0..gridH rows

    // Determine rendering bounds (in cell coordinates)
    let minCX = 1, maxCX = gridW, minCY = 1, maxCY = gridH;

    const extentsAttr = this.getAttribute('extents');
    if (extentsAttr) {
      const [from, to] = extentsAttr.split(':');
      const [ax, ay] = from.split(',').map(Number);
      const [bx, by] = to.split(',').map(Number);
      minCX = Math.min(minCX, ax); maxCX = Math.max(maxCX, bx);
      minCY = Math.min(minCY, ay); maxCY = Math.max(maxCY, by);
    }

    // Vertex bounds (0-indexed)
    const minVX = minCX - 1, maxVX = maxCX;
    const minVY = minCY - 1, maxVY = maxCY;

    // Fade sides
    const fadeSides = new Set();
    for (const side of ['top', 'bottom', 'left', 'right']) {
      if (stubSides.has(side)) fadeSides.add(side);
    }

    // Extended vertex bounds for fade
    const eMinVX = minVX - (fadeSides.has('left') ? 1 : 0);
    const eMaxVX = maxVX + (fadeSides.has('right') ? 1 : 0);
    const eMinVY = minVY - (fadeSides.has('top') ? 1 : 0);
    const eMaxVY = maxVY + (fadeSides.has('bottom') ? 1 : 0);

    const contentCols = maxVX - minVX;
    const contentRows = maxVY - minVY;
    const HC = C / 2;
    const PAD = C;

    // Content pixel dimensions (centered in SVG)
    const contentW = contentCols * C;
    const contentH = contentRows * C;

    // Fade extensions — allocate symmetrically so content stays centered
    const fadeX = (fadeSides.has('left') || fadeSides.has('right')) ? C : 0;
    const fadeY = (fadeSides.has('top') || fadeSides.has('bottom')) ? C : 0;

    // Total SVG: fade space is symmetric; non-fade sides get padding instead
    const spaceL = fadeX > 0 ? fadeX : PAD;
    const spaceR = fadeX > 0 ? fadeX : PAD;
    const spaceT = fadeY > 0 ? fadeY : PAD;
    const spaceB = fadeY > 0 ? fadeY : PAD;
    const svgW = spaceL + contentW + spaceR;
    const svgH = spaceT + contentH + spaceB;

    // Map vertex to pixel — content always centered
    const contentOriginX = spaceL;
    const contentOriginY = spaceT;
    const vx = (gx) => contentOriginX + (gx - minVX) * C;
    const vy = (gy) => contentOriginY + (gy - minVY) * C;

    // Build all possible edges
    const allGridEdges = [];
    for (let y = eMinVY; y <= eMaxVY; y++) {
      for (let x = eMinVX; x <= eMaxVX; x++) {
        if (x < eMaxVX) allGridEdges.push(SLDiagram.edgeKey(x, y, x + 1, y)); // horizontal
        if (y < eMaxVY) allGridEdges.push(SLDiagram.edgeKey(x, y, x, y + 1)); // vertical
      }
    }

    let svg = '';

    // Layer 1: Undetermined edges
    for (const ek of allGridEdges) {
      if (lineEdges.has(ek) || emphasisEdges.has(ek) || putativeEdges.has(ek) || xMarkEdges.has(ek)) continue;
      if (crossEdges.has(ek)) continue; // gap: skip eliminated edges
      const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
      svg += `<line x1="${vx(x1)}" y1="${vy(y1)}" x2="${vx(x2)}" y2="${vy(y2)}" stroke="${COL.grid}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
    }

    // Layer 1b: Puzzle border on non-fade sides (outside the grid)
    const borderW = Math.round(LINE_W * 0.7);
    const borderGap = Math.round(C * 0.7);
    const bLeft = vx(minVX) - borderGap, bRight = vx(maxVX) + borderGap;
    const bTop = vy(minVY) - borderGap, bBottom = vy(maxVY) + borderGap;
    const borderCol = '#999';
    const fT = fadeSides.has('top'), fB = fadeSides.has('bottom'), fL = fadeSides.has('left'), fR = fadeSides.has('right');
    const bw2 = borderW / 2;
    const buid = 'slb' + Math.random().toString(36).slice(2, 9);
    let borderIdx = 0;
    let borderSvg = '';
    let borderDefs = '';
    const borderLine = (x1, y1, x2, y2, fadeStart, fadeEnd, horiz) => {
      let stroke = borderCol;
      if (fadeStart || fadeEnd) {
        const gid = `${buid}${borderIdx++}`;
        const s1 = fadeStart ? 'rgba(153,153,153,0)' : borderCol;
        const s2 = fadeStart ? borderCol : borderCol;
        const s3 = fadeEnd ? 'rgba(153,153,153,0)' : borderCol;
        const fadeLen = HC;
        if (horiz) {
          const total = x2 - x1;
          const f1 = fadeStart ? fadeLen / total : 0;
          const f2 = fadeEnd ? 1 - fadeLen / total : 1;
          borderDefs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${s1}"/><stop offset="${f1}" stop-color="${s2}"/><stop offset="${f2}" stop-color="${borderCol}"/><stop offset="1" stop-color="${s3}"/></linearGradient>`;
        } else {
          const total = y2 - y1;
          const f1 = fadeStart ? fadeLen / total : 0;
          const f2 = fadeEnd ? 1 - fadeLen / total : 1;
          borderDefs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${s1}"/><stop offset="${f1}" stop-color="${s2}"/><stop offset="${f2}" stop-color="${borderCol}"/><stop offset="1" stop-color="${s3}"/></linearGradient>`;
        }
        stroke = `url(#${gid})`;
      }
      borderSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${borderW}" stroke-linecap="butt"/>`;
    };
    if (!fT) borderLine(bLeft - (!fL ? bw2 : 0), bTop, bRight + (!fR ? bw2 : 0), bTop, fL, fR, true);
    if (!fB) borderLine(bLeft - (!fL ? bw2 : 0), bBottom, bRight + (!fR ? bw2 : 0), bBottom, fL, fR, true);
    if (!fL) borderLine(bLeft, bTop - (!fT ? bw2 : 0), bLeft, bBottom + (!fB ? bw2 : 0), fT, fB, false);
    if (!fR) borderLine(bRight, bTop - (!fT ? bw2 : 0), bRight, bBottom + (!fB ? bw2 : 0), fT, fB, false);

    // Layer 3: Vertex dots
    for (let y = eMinVY; y <= eMaxVY; y++) {
      for (let x = eMinVX; x <= eMaxVX; x++) {
        svg += `<circle cx="${vx(x)}" cy="${vy(y)}" r="${DOT_R}" fill="${COL.dot}"/>`;
      }
    }

    // Layer 4: Putative edges (dashed, magenta) — below active lines
    for (const ek of putativeEdges) {
      const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
      const dash = Math.round(C * 0.12);
      const gap = Math.round(C * 0.10);
      svg += `<line x1="${vx(x1)}" y1="${vy(y1)}" x2="${vx(x2)}" y2="${vy(y2)}" stroke="${COL.putative}" stroke-width="${LINE_W}" stroke-linecap="butt" stroke-dasharray="${dash} ${gap}"/>`;
    }

    // Layer 5: Putative endpoint dots (open circle)
    if (putativeEdges.size > 0) {
      const putVerts = new Set();
      for (const ek of putativeEdges) {
        const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
        putVerts.add(`${x1},${y1}`);
        putVerts.add(`${x2},${y2}`);
      }
      for (const v of putVerts) {
        const [x, y] = v.split(',').map(Number);
        svg += `<circle cx="${vx(x)}" cy="${vy(y)}" r="${DOT_R}" fill="white" stroke="${COL.putative}" stroke-width="2"/>`;
      }
    }

    // Layer 6: Active edges (lines)
    for (const ek of lineEdges) {
      const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
      svg += `<line x1="${vx(x1)}" y1="${vy(y1)}" x2="${vx(x2)}" y2="${vy(y2)}" stroke="${COL.line}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
    }

    // Layer 6b: Active endpoint dots
    if (lineEdges.size > 0) {
      const lineVerts = new Set();
      for (const ek of lineEdges) {
        const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
        lineVerts.add(`${x1},${y1}`);
        lineVerts.add(`${x2},${y2}`);
      }
      for (const v of lineVerts) {
        const [x, y] = v.split(',').map(Number);
        svg += `<circle cx="${vx(x)}" cy="${vy(y)}" r="${DOT_R}" fill="${COL.line}"/>`;
      }
    }

    // Layer 7: Emphasized edges
    for (const ek of emphasisEdges) {
      const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
      svg += `<line x1="${vx(x1)}" y1="${vy(y1)}" x2="${vx(x2)}" y2="${vy(y2)}" stroke="${COL.emphasis}" stroke-width="${LINE_W}" stroke-linecap="round"/>`;
    }

    // Layer 8: Emphasized endpoint dots
    if (emphasisEdges.size > 0) {
      const emphVerts = new Set();
      for (const ek of emphasisEdges) {
        const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
        emphVerts.add(`${x1},${y1}`);
        emphVerts.add(`${x2},${y2}`);
      }
      for (const v of emphVerts) {
        const [x, y] = v.split(',').map(Number);
        svg += `<circle cx="${vx(x)}" cy="${vy(y)}" r="${DOT_R}" fill="${COL.emphasis}"/>`;
      }
    }

    // Layer 9: X-mark markers (on top of everything)
    for (const ek of xMarkEdges) {
      const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
      const mx = (vx(x1) + vx(x2)) / 2;
      const my = (vy(y1) + vy(y2)) / 2;
      const r = C * 0.12;
      const xStroke = Math.max(2, Math.round(LINE_W * 0.6));
      const outlineW = xStroke + 3;
      svg += `<line x1="${mx - r}" y1="${my - r}" x2="${mx + r}" y2="${my + r}" stroke="white" stroke-width="${outlineW}" stroke-linecap="round"/>`;
      svg += `<line x1="${mx - r}" y1="${my + r}" x2="${mx + r}" y2="${my - r}" stroke="white" stroke-width="${outlineW}" stroke-linecap="round"/>`;
      svg += `<line x1="${mx - r}" y1="${my - r}" x2="${mx + r}" y2="${my + r}" stroke="${COL.cross}" stroke-width="${xStroke}" stroke-linecap="round"/>`;
      svg += `<line x1="${mx - r}" y1="${my + r}" x2="${mx + r}" y2="${my - r}" stroke="${COL.cross}" stroke-width="${xStroke}" stroke-linecap="round"/>`;
    }

    // Layer 10: Clue numbers
    const fontSize = Math.round(C * 0.625);
    for (const [coord, val] of clueMap) {
      const [cx, cy] = coord.split(',').map(Number);
      // Cell center: between vertices (cx-1,cy-1) and (cx,cy)
      const px = (vx(cx - 1) + vx(cx)) / 2;
      const py = (vy(cy - 1) + vy(cy)) / 2;
      svg += `<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="${COL.clue}">${val}</text>`;
    }

    // Fade mask
    let defsContent = '';
    let body = svg;
    if (fadeSides.size > 0) {
      const uid = 'slfm' + Math.random().toString(36).slice(2, 9);
      const innerLeft = contentOriginX;
      const innerRight = contentOriginX + contentW;
      const innerTop = contentOriginY;
      const innerBottom = contentOriginY + contentH;
      const fadeLen = HC; // half cell of fade strip

      const fT = fadeSides.has('top');
      const fB = fadeSides.has('bottom');
      const fL = fadeSides.has('left');
      const fR = fadeSides.has('right');

      let gradients = '';
      let maskRects = `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white"/>`;

      // Black out beyond fade strips
      if (fT) maskRects += `<rect x="0" y="0" width="${svgW}" height="${innerTop - fadeLen}" fill="black"/>`;
      if (fB) maskRects += `<rect x="0" y="${innerBottom + fadeLen}" width="${svgW}" height="${svgH - (innerBottom + fadeLen)}" fill="black"/>`;
      if (fL) maskRects += `<rect x="0" y="0" width="${innerLeft - fadeLen}" height="${svgH}" fill="black"/>`;
      if (fR) maskRects += `<rect x="${innerRight + fadeLen}" y="0" width="${svgW - (innerRight + fadeLen)}" height="${svgH}" fill="black"/>`;

      // Fade: small fully-visible margin outside content, then aggressive fade
      const margin = 0.25; // fraction of fadeLen that stays fully visible
      if (fT) {
        const x0 = fL ? innerLeft : innerLeft - fadeLen;
        const x1 = fR ? innerRight : innerRight + fadeLen;
        gradients += `<linearGradient id="${uid}t" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="white"/><stop offset="${margin}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>`;
        maskRects += `<rect x="${x0}" y="${innerTop - fadeLen}" width="${x1 - x0}" height="${fadeLen}" fill="url(#${uid}t)"/>`;
      }
      if (fB) {
        const x0 = fL ? innerLeft : innerLeft - fadeLen;
        const x1 = fR ? innerRight : innerRight + fadeLen;
        gradients += `<linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset="${margin}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>`;
        maskRects += `<rect x="${x0}" y="${innerBottom}" width="${x1 - x0}" height="${fadeLen}" fill="url(#${uid}b)"/>`;
      }
      if (fL) {
        const y0 = fT ? innerTop : innerTop - fadeLen;
        const y1 = fB ? innerBottom : innerBottom + fadeLen;
        gradients += `<linearGradient id="${uid}l" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="white"/><stop offset="${margin}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>`;
        maskRects += `<rect x="${innerLeft - fadeLen}" y="${y0}" width="${fadeLen}" height="${y1 - y0}" fill="url(#${uid}l)"/>`;
      }
      if (fR) {
        const y0 = fT ? innerTop : innerTop - fadeLen;
        const y1 = fB ? innerBottom : innerBottom + fadeLen;
        gradients += `<linearGradient id="${uid}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="white"/><stop offset="${margin}" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>`;
        maskRects += `<rect x="${innerRight}" y="${y0}" width="${fadeLen}" height="${y1 - y0}" fill="url(#${uid}r)"/>`;
      }

      // Corner pieces
      const corner = (id, ccx, ccy, rx, ry) => {
        gradients += `<radialGradient id="${id}" cx="${ccx}" cy="${ccy}" r="${fadeLen}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="white"/><stop offset="${margin}" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>`;
        maskRects += `<rect x="${rx}" y="${ry}" width="${fadeLen}" height="${fadeLen}" fill="url(#${id})"/>`;
      };
      if (fT && fL) corner(`${uid}tl`, innerLeft, innerTop, innerLeft - fadeLen, innerTop - fadeLen);
      if (fT && fR) corner(`${uid}tr`, innerRight, innerTop, innerRight, innerTop - fadeLen);
      if (fB && fL) corner(`${uid}bl`, innerLeft, innerBottom, innerLeft - fadeLen, innerBottom);
      if (fB && fR) corner(`${uid}br`, innerRight, innerBottom, innerRight, innerBottom);

      defsContent = `<defs>${gradients}${borderDefs}<mask id="${uid}m" maskUnits="userSpaceOnUse">${maskRects}</mask></defs>`;
      body = `<g mask="url(#${uid}m)">${svg}</g>${borderSvg}`;
    }
    if (!defsContent && borderDefs) {
      defsContent = `<defs>${borderDefs}</defs>`;
    }
    if (!fadeSides.size) body += borderSvg;

    const fullSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${defsContent}${body}</svg>`;

    // Baseline alignment
    const baselineAttr = this.getAttribute('baseline');
    const svgCenter = svgH / 2;
    let baselineY;
    if (baselineAttr) {
      const bRow = parseFloat(baselineAttr);
      baselineY = (vy(bRow - 1) + vy(bRow)) / 2;
    } else {
      baselineY = (vy(minVY) + vy(maxVY)) / 2;
    }
    const offset = svgCenter - baselineY;
    const marginStyle = offset !== 0
      ? `margin-top: ${-offset}px; margin-bottom: ${offset}px;`
      : '';

    const captionHTML = captionText
      ? `<div class="caption">${captionText}</div>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
        .wrap { ${marginStyle} display: flex; justify-content: center; }
        .caption { font-family: 'Segoe UI', system-ui, sans-serif; font-size: .78em; color: ${COL.caption}; font-style: italic; text-align: center; }
      </style>
      <div class="wrap">${fullSVG}</div>
      ${captionHTML}
    `;
  }
}

customElements.define('sl-diagram', SLDiagram);

class SLSequence extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() { this.syncExtents(); this.render(); }

  syncExtents() {
    const diagrams = [...this.querySelectorAll('sl-diagram')];
    if (diagrams.length < 2) return;

    let maxW = 0, maxH = 0;
    for (const d of diagrams) {
      const size = SLDiagram.parseSize(d.getAttribute('size'));
      if (size) {
        maxW = Math.max(maxW, size.w);
        maxH = Math.max(maxH, size.h);
      }
      // Also check clues/edges for implicit size
      const clues = SLDiagram.parseClues(d.getAttribute('clues'));
      for (const k of clues.keys()) {
        const [x, y] = k.split(',').map(Number);
        maxW = Math.max(maxW, x);
        maxH = Math.max(maxH, y);
      }
      for (const attr of ['lines', 'erased', 'emphasis', 'putative', 'x-marks']) {
        const edges = SLDiagram.parsePaths(d.getAttribute(attr));
        for (const ek of edges) {
          const { x1, y1, x2, y2 } = SLDiagram.parseEdgeEndpoints(ek);
          maxW = Math.max(maxW, x1, x2);
          maxH = Math.max(maxH, y1, y2);
        }
      }
    }

    if (maxW === 0 && maxH === 0) return;
    const ext = `1,1:${maxW},${maxH}`;
    for (const d of diagrams) {
      d.setAttribute('extents', ext);
    }
  }

  render() {
    const diagrams = [...this.querySelectorAll('sl-diagram')];
    const n = diagrams.length;
    if (n === 0) return;

    diagrams.forEach((d, i) => d.setAttribute('slot', `d${i}`));

    const colTemplate = Array.from({ length: n }, () => 'auto').join(' auto ');

    let slotsHTML = '';
    let slotStyles = '';

    for (let i = 0; i < n; i++) {
      const col = i * 2 + 1;
      slotsHTML += `<slot name="d${i}"></slot>`;
      slotStyles += `slot[name="d${i}"] { grid-row: 1; grid-column: ${col}; display: flex; justify-content: center; }\n`;

      if (i < n - 1) {
        slotsHTML += `<div class="arrow" style="grid-column: ${col + 1};">→</div>`;
      }
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-grid; grid-template-columns: ${colTemplate}; grid-template-rows: auto; gap: 0 12px; align-items: center; }
        .arrow { font-size: 26px; color: #999; grid-row: 1; text-align: center; align-self: center; }
        ${slotStyles}
      </style>
      ${slotsHTML}
    `;
  }
}

customElements.define('sl-sequence', SLSequence);
