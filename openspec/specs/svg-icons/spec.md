# SVG Icons

## Purpose

Let app tiles show rich monochrome marks that stay Scribe-safe with no external assets.

## Requirements

### Requirement: Sanitized inline SVG icons

The sanitization rule from the archived `2026-10-27-svg-icons` change is unchanged: validation SHALL allowlist elements `svg, path, circle, rect, line, polyline, polygon, g, title` and geometry plus monochrome fill / stroke attributes only, and SHALL reject `script, foreignObject, use, image, style`, `on*` handlers, external refs, and animations.

In addition:
1. `definition.icon` SHALL accept valid `<os-icon>` icon references (`kody:<kebab-name>` or `lucide:<kebab-name>`) in addition to plain-text glyphs and sanitized inline `<svg>` strings, rendering `<os-icon>` inside `.tile-icon`.
2. For the 11 migrated catalog icons (`calculator`, `calendar`, `clock`, `counter`, `daily-feed`, `eight-ball`, `hoodie-weather`, `link-drop`, `mac-puzzle`, `news`, `probe`), the bundle icon SHALL be either the normalized inline SVG string matching the corresponding file in `pkg/icons/` after whitespace normalization, or a `kody:<app-id>` reference to that file. Glyph icons are unchanged by this requirement.

#### Scenario: Valid SVG installs
- **WHEN** `add_app` receives an icon with allowlisted SVG markup
- **THEN** it returns `{ ok: true, id }` and the tile renders the sanitized SVG.

#### Scenario: Icon reference installs and renders via os-icon
- **WHEN** `add_app` receives `icon: "lucide:compass"` or `icon: "kody:clock"`
- **THEN** validation succeeds and the tile renders `<os-icon name="...">` inside `.tile-icon`.

#### Scenario: Migrated icon matches its file
- **WHEN** the catalog harness checks a migrated app's bundle
- **THEN** its `icon` either matches `pkg/icons/<app-id>.svg` (whitespace normalized) or equals `kody:<app-id>`, and any other value fails the harness.

#### Scenario: Hostile SVG is rejected
- **WHEN** `add_app` receives an icon with script, external ref, or event handler
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

### Requirement: Scribe-safe tile rendering
Tiles SHALL render sanitized SVG unescaped inside `.tile-icon`, constrained to currentColor, 1.5rem box, no color, no gradients, no animation. Plain-text icons SHALL keep the escaped path unchanged.

#### Scenario: SVG tile renders monochrome
- **WHEN** the Apps page renders an app with an SVG icon
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

#### Scenario: Plain-text icon unchanged
- **WHEN** the Apps page renders an app with a plain-text icon
- **THEN** the glyph renders escaped exactly as today.

### Requirement: Shared icon folder and static serving

`pkg/icons/` SHALL contain one file per custom icon, named in kebab-case, each conforming to: `viewBox="0 0 24 24"`, no `width` or `height` attributes, `fill="none"` line art (default-black solids only where meant), `stroke="currentColor"`, stroke width 1.6 (unless explicitly noted in `pkg/icons/README.md` for e-ink legibility), round caps and joins, a `<title>`, and no color, gradients, animation, `style`, script, external refs, or `<use>`.

The folder SHALL carry a `README.md` stating this spec in full, and every file in it SHALL pass the folder validation in the harness. Custom icons from `pkg/icons/` SHALL be compiled into a local registry for synchronous `kody:*` rendering and SHALL also be served at `GET /icons/<name>.svg` with `Content-Type: image/svg+xml` for `<img>` usage.

#### Scenario: A custom icon renders inline and via img
- **WHEN** an icon `pkg/icons/probe.svg` passes folder validation
- **THEN** `<os-icon name="kody:probe">` renders the SVG inline in `currentColor` with zero network requests, and `<img src="/icons/probe.svg">` loads the same SVG from `GET /icons/probe.svg`.

#### Scenario: An out-of-spec file fails
- **WHEN** a file in `pkg/icons/` carries a fixed width, a color, a gradient, or a rejected element
- **THEN** the folder validation fails the harness, naming the file and the rule.

### Requirement: Provider-agnostic os-icon custom element

The shell client SHALL define a Light-DOM custom element `<os-icon>` (ES2019-compatible, `createRenderRoot() { return this; }`) available to both shell views and stored `packageStorage` apps.

`<os-icon>` SHALL:
1. Resolve `kody:<name>` synchronously from the bundled `pkg/icons/` registry.
2. Resolve external `<prefix>:<name>` icons (such as `lucide:<name>`) on demand via Iconify's CORS-enabled JSON API, caching resolved icon data in memory and `localStorage`, and sanitizing SVG markup through the allowlist before DOM insertion.
3. Resolve unprefixed `<name>` values against `kody:<name>` first, falling back to `lucide:<name>`.
4. Inherit `currentColor` and font sizing (`1em` by default, `1.5rem` inside `.tile-icon`), and set `aria-hidden="true"` unless a `label` attribute is provided.

#### Scenario: Dynamic app uses a Lucide icon without shell rebuild
- **WHEN** a stored app in `packageStorage` renders `<os-icon name="lucide:refresh-cw"></os-icon>`
- **THEN** `<os-icon>` fetches the icon JSON on demand (or reads it from `localStorage` cache), sanitizes the SVG, renders it into Light DOM inheriting `currentColor`, and caches it for subsequent renders.

#### Scenario: Offline or unknown icon degrades without layout shift
- **WHEN** `<os-icon name="lucide:nonexistent">` fails to fetch or is offline on first load
- **THEN** it renders an empty sized placeholder without throwing unhandled errors or shifting surrounding layout.

### Requirement: Glyph icons unchanged

The 7 glyph tile icons (`app-store`, `arrow-game`, `cellular-playground`, `generic-feed`, `settings`, `three-bit-art`, `xkcd`) SHALL remain plain-text glyphs in this change. Converting a glyph to SVG or `<os-icon>` is a separate per-icon change with its own `catalogVersion` increment.

#### Scenario: Glyph icon still renders as a glyph
- **WHEN** the Apps page renders an app with a glyph icon after this change
- **THEN** the glyph renders escaped exactly as before, and no folder file is required for it.
