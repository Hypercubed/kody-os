# Design

## Context
See proposal.md Why. Current state: `resolveTheme` (`pkg/src/app.ts:101`) maps the closed `desk`/`paper` tokens to CSS values via `THEME_BACKGROUNDS`; `icon` is a raw string rendered as glyph text (`os-mark-glyph`). The shell already inlines SVG-tile backgrounds as data URIs (`--stripes`, `--checker`).

## Goals / Non-Goals
- Goals: grid-object background + SVG-string icon through the existing theme file, invalid-input fallback to today, zero external assets.
- Non-Goals: no image URLs, no colors beyond black-on-paper, no per-app theming.

## Decisions
1. **Grid as 8 row-bytes, rendered server-side to a data-URI SVG tile** — `resolveTheme` builds the same `url("data:image/svg+xml,...")` shape the theme already uses. Why: identical delivery path to the proven stripes/checker; the Scribe never fetches anything.
2. **Reuse the app-icon SVG sanitizer for the theme icon** — Why: one allowlist, one audit surface; the brand mark gets the same Scribe-safe guarantees as tile icons.
3. **Validate-then-fallback, never 500** — non-object grids, wrong lengths, out-of-range bytes, hostile SVG all resolve to today's defaults. Why: `os-theme.json` is fork-hand-edited; a typo must never white-screen the OS.

## Risks / Trade-offs
- [Risk] 8×8 tile at large viewports moirés on e-ink → Mitigation: static geometry, no animation; cell size chosen at implementation (task verifies on device).
- [Risk] SVG icon with color slips through → Mitigation: sanitizer strips color/fill attributes to monochrome, same as tile icons.

## Migration Plan
1. Land resolver + renderer + docs; ship a default `os-theme.json` example (commented grid + note).
2. Verify byte-identical fallback (absent/invalid file) plus custom grid + SVG on preview and Scribe.
3. Rollback: republish prior commit.

## Open Questions
- None.
