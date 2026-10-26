# Design

## Context
See proposal.md Why. Current: `icon?: string` escaped via `escapeHtml` in `tileItem` (`pkg/src/apps/client.ts`), CSS `.tile-icon` 2.25rem bordered plate (`pkg/public/styles.css`), validation only checks `typeof string` (`pkg/src/apps/registry.ts:117-118`). No SVG path exists.

## Goals / Non-Goals
- Goals: backward-compatible SVG variant, validation-time sanitization, Scribe-safe render, example updates.
- Non-Goals: no color/gradient/animation support, no external refs, no icon upload UI, no MCP change.

## Decisions
1. **String-union, not new field** — keep `icon?: string`, detect `<svg` prefix. Why: zero storage migration, export format unchanged. Alternative (separate `iconSvg`) rejected: dual fields complicate tiles.
2. **Sanitize at validate, not render** — allowlist strip in `registry.ts`, render trusts stored value. Why: single choke point, render stays fast. Alternative (DOMPurify-style at render) rejected: no DOM on Worker.
3. **Unescaped branch in `tileItem` only** — plain-text keeps `escapeHtml`, SVG path inserts sanitized markup. Why: minimal blast radius.
4. **CSS `currentColor` + fixed box** — `.tile-icon svg { width:1.5rem; height:1.5rem; fill:currentColor; stroke:currentColor }`. Why: inherits monochrome theme, e-ink safe.

## Risks / Trade-offs
- [Risk] Sanitizer bypass via entity/case tricks → Mitigation: lowercase tag/attr compare, strip `on*`, drop whole icon on unknown tag.
- [Risk] Oversized SVG blows 256 KiB budget → Mitigation: existing bundle cap + definition size check covers it; docs cap icons at ~2 KiB.
- [Risk] Scribe old WebKit SVG gaps → Mitigation: restrict to basic shapes, test on device.

## Migration Plan
1. Land types + validator + render + CSS regen.
2. Update `clock`, `eight-ball`, `hello-counter`, `probe` example JSONs with real SVG icons.
3. Verify: `node --check`, ES2019 grep, preview tiles, `openspec validate`.
4. Rollback: re-add prior `icon` strings; no data migration to undo.

## Open Questions
- None.
