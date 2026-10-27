# Proposal

## Why

App tiles currently show a single plain-text glyph (`icon?: string`, escaped on render). Authors want richer monochrome marks (clock face, 8-ball, counter) while keeping the e-ink, system-font, zero-emoji, ES2019 posture. Inline SVG is the Scribe-safe way to do that with no external assets.

## What Changes

- Accept an inline-SVG icon variant on app definitions alongside the existing plain-text `icon` (fully backward compatible; omitted/plain-text behaves exactly as today).
- Sanitize SVG at validation time: allowlist `svg, path, circle, rect, line, polyline, polygon, g, title`, attributes for geometry + monochrome fill/stroke only; strip `script, foreignObject, use, image, style, on*` handlers, external refs, animations.
- Render sanitized SVG unescaped inside `.tile-icon`; plain-text icons keep the current escaped path.
- Constrain rendering via CSS: `currentColor`, 1.5rem box, no color, no gradients, no animation.
- Update all example apps (`clock`, `eight-ball`, `hello-counter`, `probe`) with real monochrome inline SVG icons; no single-char placeholders left.
- Docs: update authoring guide + `app-registry`/`shell` specs for the new variant.

## Capabilities

### New Capabilities

- `svg-icons`: inline SVG tile icons with validation-time sanitization and Scribe-safe render rules.

### Modified Capabilities

- `app-registry`: `icon` requirement changes from "plain-text glyph, never emoji" to "plain-text glyph OR sanitized inline SVG".
- `shell`: tile requirement changes from "show the app's icon glyph" to "show plain-text glyph OR sanitized SVG mark".

## Impact

- `pkg/src/apps/types.ts` (icon type), `pkg/src/apps/registry.ts` (validation + sanitization), `pkg/src/apps/client.ts` (`tileItem` render branch), `pkg/public/styles.css` + regen `src/shell-css.ts` (`.tile-icon svg` sizing).
- No storage migration: SVG lives in the existing definition JSON, within the 16 MiB / 256 KiB budgets.
- No MCP surface change: `add_app`/`list_apps` carry the same `icon` string; only its allowed shape widens.
