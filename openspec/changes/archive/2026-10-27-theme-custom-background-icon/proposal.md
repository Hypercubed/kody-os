# Proposal

## Why

The theme file (`pkg/os-theme.json`) only allows closed background tokens (`desk`/`paper`) and a short text glyph for the header mark. Owners want a custom look — a ReKindle-style 8×8 black-and-white grid background and a real SVG brand mark — without forking code.

## What Changes

- `background` accepts the existing closed tokens plus a custom 8×8 monochrome grid: `{ "grid": [r0..r7] }` (eight integers 0–255, MSB left), rendered as a repeating inline-SVG tile (black squares on paper, same data-URI technique as the existing stripes/checker). Invalid grids fall back to `desk`.
- `icon` accepts plain-text glyph (unchanged) plus an inline SVG string sanitized with the app-icon allowlist, rendered as the header mark (upper left) in monochrome.
- Missing file / missing fields / invalid values all fall back to today's rendering, byte-identical.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `os-theme`: background gains the 8×8 grid variant; icon gains the sanitized-SVG variant.

## Impact

- `pkg/os-theme.json` (documented shapes), `pkg/src/app.ts` (`resolveTheme` + grid-to-SVG-tile renderer + icon branch), `pkg/public/styles.css` + `src/shell-css.ts` regen only if the tile needs CSS-side rules (preferred: inline style, no theme edit).
- No storage change, no MCP surface change, no export format change. Scribe-safe: no external assets, no color, no animation; grid is static geometry.
