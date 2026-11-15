# TODO

- **Diagrams have no text alternative.** `sl-diagram.js` (`SLDiagram.render`, `SLSequence.render`) draws
  each board as a bare SVG with no `role`, `aria-label`, or description, so a screen reader gets nothing for
  the deductions the pages are about. Each board wants a summary (size, clues, which lines are drawn or
  crossed), and a sequence one that reads its steps in order. The wording is the open part. (filed
  2026-11-15 from automated review)
- **Attribute parsing still has no bounds or structured diagnostics.** `sl-diagram.js` (`parseSize`,
  `parsePaths`, `parseClues`) now drops malformed sizes and path segments with a console warning, but
  coordinates outside the board, huge sizes, and clue values other than 0 to 3 pass through, and the parsers
  live as statics on the element, so they can only be exercised in a browser. Extracting them as pure
  functions with a test page would let an authoring mistake show up as an error rather than a plausible
  diagram. (filed 2026-11-15 from automated review)
