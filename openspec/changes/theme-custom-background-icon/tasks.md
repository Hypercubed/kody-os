# Tasks

## 1. Grid background and SVG icon

- [ ] 1.1 Extend `resolveTheme` in `pkg/src/app.ts` for the grid-object background (row-byte validation, data-URI tile renderer, fallback to `desk`) and verify absent/invalid grids render byte-identical to today
- [ ] 1.2 Accept sanitized inline SVG in the theme `icon` via the shared allowlist and verify the header brand mark renders monochrome with no external assets
- [ ] 1.3 Document both shapes in `pkg/os-theme.json` (commented example) and verify `node --experimental-strip-types --check` plus ES2019 grep zero hits, `openspec validate --changes` passes, and preview + Scribe show the custom grid and mark
