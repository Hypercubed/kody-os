# Proposal

## Why

Tile and in-app icons are fragmented across `kody-os`:
- Catalog apps inline hand-drawn 24×24 SVG strings inside their bundle `definition.json` files (11 SVG icons with wandering stroke widths of 1.6, 1.7, and 1.8, plus 7 plain-text glyph icons), with no shared source folder, single spec, or sync check.
- Dynamically added apps stored in `packageStorage` cannot easily reuse shared or external icons without pasting raw SVG strings into JSON, and the shell lacks a unified icon abstraction that decouples apps from how icons are delivered.
- Earlier design drafts avoided external assets and `<img>` tags out of concern for Kindle's "Disable Images" browser setting and external fetches. Like the no-JS fallback (dropped Oct 29–30, 2026), Kindle's "Disable Images" mode is explicitly out of scope, and on-demand CDN fetches (such as Iconify's CORS-enabled JSON API) are acceptable when wrapped behind a shell-owned custom element.

This change establishes a cohesive, two-tier icon architecture:
1. A curated, normalized local SVG source folder (`pkg/icons/`) for custom `kody-os` icons—usable both inlined (for `currentColor` inheritance) and served as static `/icons/<name>.svg` assets (for `<img>` tags).
2. A shell-owned Light-DOM custom element (`<os-icon name="...">`) that gives both the shell and `packageStorage` apps a single, provider-agnostic icon interface—resolving local `kody:*` icons from the bundled `pkg/icons/` registry and fetching external icon sets (such as `lucide:*`) on demand from Iconify's CORS-enabled CDN API with browser caching, without bloating the Scribe's upfront JS memory.

## What Changes

- **Authoring & Static Icon Folder (`pkg/icons/`):**
  - Create `pkg/icons/` with one kebab-case SVG file per custom icon (starting with the 11 migrated catalog tile icons: `calculator`, `calendar`, `clock`, `counter`, `daily-feed`, `eight-ball`, `hoodie-weather`, `link-drop`, `mac-puzzle`, `news`, `probe`) plus `pkg/icons/README.md` defining the file spec.
  - Expose `pkg/icons/*.svg` both as an inlined/compiled registry for `currentColor` usage and as static `/icons/<name>.svg` endpoints so apps can load them via `<img>` when theme color inheritance is not needed.
  - Add a harness validation and sync check ensuring every file in `pkg/icons/` conforms to the spec and matches any migrated catalog bundle's inline SVG string (after whitespace normalization).
- **Shell-Owned `<os-icon>` Wrapper Element (`pkg/src/client/os-icon.ts`):**
  - Register `<os-icon>` in `pkg/src/client/os-elements.ts` using `KodyLit` in Light DOM (`createRenderRoot() { return this; }`) within the ES2019 ceiling so CSS `currentColor` and `1em` / `1.5rem` sizing apply directly.
  - Support `kody:<name>` (resolved immediately from the local `pkg/icons/` registry with zero network calls), external prefixes like `lucide:<name>` (fetched on demand via Iconify's CORS-enabled JSON API with `localStorage` + in-memory caching and SVG allowlist sanitization), and unprefixed `<name>` (local `kody:` first, falling back to `lucide:`).
  - Decouple all shell UIs and `packageStorage` apps from the underlying icon provider so the backend/CDN can be swapped later without rewriting app definitions.
- **Tile `icon` Reference Support:**
  - Extend `definition.icon` (and `registry.ts` / `tileItem`) to accept `os-icon` references (`kody:<name>` or `lucide:<name>`) alongside existing inline `<svg>` strings and plain-text glyphs, rendering `<os-icon>` inside `.tile-icon`.
- **Docs & Authoring Guidance:**
  - Document in `pkg/docs/scribe-limitations.md` and `README.md` that Kindle's "Disable Images" browser setting is unsupported.
  - Update `catalog/README.md` and `.agents/skills/adding-an-app/SKILL.md` with guidance on `pkg/icons/`, `<os-icon>`, and `/icons/<name>.svg`.

## Capabilities

### New Capabilities

- `shared-svg-icons`: A shared `pkg/icons/` asset folder (served at `/icons/<name>.svg` and bundled into a local registry) plus a Light-DOM `<os-icon>` wrapper element supporting both local `kody:*` icons and on-demand CDN-backed `lucide:*` icons.

### Modified Capabilities

- `svg-icons`: Tile `icon` validation and rendering gain support for `kody:<name>` and `lucide:<name>` icon references (rendered via `<os-icon>`) in addition to sanitized inline `<svg>` strings (checked against `pkg/icons/` for the 11 migrated catalog apps) and plain-text glyphs.
- `authoring`: App authoring docs and skills gain `<os-icon>`, `pkg/icons/`, and `/icons/<name>.svg` as standard icon mechanisms.

## Impact

- **New:**
  - `pkg/icons/` (11 normalized custom SVGs + `pkg/icons/README.md`)
  - `pkg/src/client/os-icon.ts` (ES2019-safe Light-DOM `<os-icon>` element + Iconify JSON fetcher/sanitizer/cache)
  - Generated/bundled local icon registry mapping `pkg/icons/*.svg` for `kody:*` lookups and static `/icons/<name>.svg` route handling in `pkg/src/app.ts`
  - Harness validation and catalog sync checks in `tests/`
- **Changed:**
  - `pkg/src/client/os-elements.ts` (registers `defineOsIcon`)
  - `pkg/src/apps/registry.ts` & `pkg/src/apps/render.ts` / `pkg/src/app.ts` (accepts `kody:<name>` / `lucide:<name>` in `definition.icon` and renders `<os-icon>`)
  - The 11 migrated catalog bundles in `catalog/` (normalized inline SVGs or `kody:<app-id>` references; counter uses `kody:counter`, each incrementing `catalogVersion` by 1)
  - `pkg/docs/scribe-limitations.md`, `README.md`, `catalog/README.md`, and `.agents/skills/adding-an-app/SKILL.md`
- **Unchanged:**
  - Existing inline `<svg>` and 7 plain-text glyph tile icons remain backward-compatible.
  - Sanitization allowlist (`svg, path, circle, rect, line, polyline, polygon, g, title`) continues to guard both stored inline SVGs and fetched Iconify SVG bodies.
