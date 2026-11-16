# Design: shared-svg-icons

## Context

See `proposal.md` (Why). Key facts from the codebase and recent decisions:
- The archived `2026-10-27-svg-icons` change widened `definition.icon` to accept plain-text glyphs or sanitized inline SVG (allowlist: `svg, path, circle, rect, line, polyline, polygon, g, title`; monochrome `fill` / `stroke` and geometry attributes only; `script, foreignObject, use, image, style`, `on*` handlers, external refs, and animations rejected).
- The current catalog has 11 SVG tile icons (`calculator`, `calendar`, `clock`, `counter`, `daily-feed`, `eight-ball`, `hoodie-weather`, `link-drop`, `mac-puzzle`, `news`, `probe`) with stroke widths varying across `1.6`, `1.7`, and `1.8`, and 7 plain-text glyph icons (`app-store` ⊞, `arrow-game` →, `cellular-playground` ▦, `generic-feed` ≡, `settings` ⚙, `three-bit-art` ◼, `xkcd` X).
- `pkg/src/client/os-elements.ts` and `pkg/src/client/os-stepper.ts` establish the shell's shared custom-element pattern: Light-DOM `KodyLit` components (`createRenderRoot() { return this; }`) written within the ES2019 ceiling so they inherit the shell's CSS theme (`currentColor`) and work inside both shell views and dynamically stored `packageStorage` apps.
- On 2026-11-16, we clarified two architectural bounds:
  1. Kindle's "Disable Images" browser setting (like disabled JS) is explicitly unsupported, so static `<img src="/icons/<name>.svg">` assets are valid alongside inline `<svg>` (`currentColor`) icons.
  2. Apps stored dynamically in `packageStorage` cannot rely solely on build-time files in `pkg/icons/` and should not force the Kindle Scribe to load 1,700+ Lucide icons into browser memory up front. Wrapping on-demand CDN icon resolution inside a shell-owned `<os-icon>` element solves both constraints while keeping the provider swappable.

## Goals / Non-Goals

- **Goals:**
  - Single source of truth (`pkg/icons/`) for custom `kody-os` SVG icons with a written spec and harness validation/sync checks.
  - Dual consumption for custom icons: inlined with `currentColor` (via `<os-icon>` or inline `<svg>`) AND served statically at `/icons/<name>.svg` for `<img>` usage.
  - Provider-agnostic `<os-icon name="...">` Light-DOM element usable by the shell and any `packageStorage` app—supporting local `kody:*` icons and on-demand CDN-fetched `lucide:*` icons without upfront library bloat.
  - Launcher tile support for `kody:<name>` and `lucide:<name>` references in `definition.icon`.
- **Non-Goals:**
  - Bundling the entire Lucide icon set into client JS memory.
  - Icon fonts (rejected due to subpixel anti-aliasing on e-ink, faux-bold distortion, and outline bloat).
  - Converting the 7 existing glyph icons to SVG in this change.
  - Changing the SVG sanitization allowlist.

## Decisions

1. **Dual-Mode Custom Icons: `pkg/icons/` Bundled for `currentColor` + Served at `/icons/<name>.svg` for `<img>`.**
   Custom `kody-os` icons live in `pkg/icons/<name>.svg`. At build/codegen time (mirroring `pkg/public/styles.css` -> `pkg/src/shell-css.ts`), `pkg/icons/*.svg` is compiled into `pkg/src/icons-registry.ts` (BE) and the generated client mirror `pkg/src/client/icons-data.ts` so the shell worker and client `<os-icon>` have immediate access to `kody:*` SVGs with zero network requests and full `currentColor` inheritance. Simultaneously, `pkg/src/app.ts` serves `GET /icons/<name>.svg` from that same registry with `Content-Type: image/svg+xml` and cache headers so apps can use `<img src="/icons/<name>.svg">` whenever theme color inheritance is not needed.

2. **`<os-icon>` Wrapper Element (`pkg/src/client/os-icon.ts`) Decouples Apps from Icon Providers.**
   Apps in `packageStorage` and shell templates write `<os-icon name="lucide:refresh-cw"></os-icon>` or `<os-icon name="kody:clock"></os-icon>` rather than coupling directly to a vendor element (`<iconify-icon>`) or pasting raw SVG markup.
   - **Light DOM:** `OsIcon` extends `window.KodyLit.LitElement` and overrides `createRenderRoot() { return this; }` so `currentColor`, `width: 1em; height: 1em` (or `.tile-icon`'s `1.5rem`), and e-ink contrast rules apply directly.
   - **ES2019 Ceiling:** Written strictly in ES2019 (no `?.`, no `??`, `declare` properties initialized in `constructor()`), matching `os-stepper.ts`.
   - **Prefix Resolution:**
     - `kody:<name>`: Resolved synchronously from the bundled `pkg/icons/` map (zero HTTP calls).
     - `<prefix>:<name>` (e.g., `lucide:arrow-right`): Resolved from an in-memory `Map` or `localStorage` cache (`os-icon:<prefix>:<name>`); on cache miss, fetched on demand from Iconify's CORS-enabled JSON API (`https://api.iconify.design/<prefix>.json?icons=<name>`, with fallback to `https://api.simplesvg.com/<prefix>.json?icons=<name>`), deduplicating concurrent in-flight requests per prefix/icon.
     - Unprefixed `<name>`: Checks local `kody:<name>` first; if absent, defaults to `lucide:<name>`.
   - **Sanitization:** Before rendering any fetched SVG body into Light DOM, `OsIcon` runs it through a client-local mirror of the BE allowlist in `pkg/src/client/icon-sanitize.ts` (same tags `svg, path, circle, rect, line, polyline, polygon, g, title`; monochrome `fill`/`stroke` and geometry attributes only; no `script`, `use`, `style`, `on*`, or external refs). The mirror lives under `pkg/src/client/` to hold the FE/BE boundary (no client import outside `client/` except vendored Lit); `pkg/src/client/icons-data.ts` is the generated client mirror of `pkg/src/icons-registry.ts`, written by the same build script.
   - **Accessibility:** Optional `label` attribute sets `role="img"` and `aria-label`; when omitted, sets `aria-hidden="true"`.

3. **Custom Icon File Spec (`pkg/icons/README.md`).**
   Every file in `pkg/icons/` is kebab-case, single-icon (no sprite sheets), and conforms to:
   - `viewBox="0 0 24 24"`, no fixed `width` or `height` attributes on `<svg>`
   - `fill="none"` line art (default-black fills only where solid shapes are intended)
   - `stroke="currentColor"`, `stroke-width="1.6"` (with documented exceptions in `README.md` if visual e-ink verification requires a heavier stroke)
   - `stroke-linecap="round"` and `stroke-linejoin="round"`
   - A `<title>` element naming the icon
   - Strictly compliant with the sanitizer allowlist (no colors, gradients, animations, `<style>`, `<script>`, external refs, or `<use>`).

4. **Tile `icon` Field Accepts `os-icon` References Alongside Inline SVG & Glyphs.**
   `definition.icon` continues to accept plain-text glyphs and inline `<svg>...</svg>` strings, and now also accepts icon references matching `/^(kody|lucide):[a-z0-9-]+$/`.
   - For `kody:<name>`, the server/client can either inline the SVG directly from the local registry or render `<os-icon name="kody:<name>"></os-icon>`.
   - For `lucide:<name>`, `tileItem` renders `<os-icon name="lucide:<name>"></os-icon>` inside `.tile-icon`.
   - `pkg/src/apps/render.ts` keeps a local copy of the reference regex (mirroring `definition.ts`) because that file allows zero runtime imports; the two must stay in sync and the harness asserts parity via the `registry.ts` re-export.
   - The 11 existing catalog SVG icons are migrated to `pkg/icons/<app-id>.svg`, normalized to the file spec, and kept in sync with their catalog `definition.json` files via a harness check (inline SVG match or `kody:<app-id>` reference).

5. **Glyph Icons Stay Glyphs.**
   The 7 glyph tile icons remain plain-text glyphs in this change; converting any glyph to an SVG or `<os-icon>` reference is a separate per-icon change with its own `catalogVersion` increment.

## Risks / Trade-offs

- **Offline / Sleepy Wi-Fi on Kindle Scribe for Uncached CDN Icons:**
  - *Mitigation:* Custom `kody:*` icons require zero network requests, and fetched `lucide:*` icons are cached in `localStorage` so each icon is fetched once per device. `<os-icon>` renders an empty sized placeholder box (`1em` / `1.5rem`) while loading or if offline so layout never shifts.
- **CDN Availability / Provider Lock-in:**
  - *Mitigation:* Apps only ever write `<os-icon name="...">`. Iconify's primary + fallback hosts (`api.iconify.design`, `api.simplesvg.com`) provide redundancy today, and if we later switch to a self-hosted Worker endpoint (`/api/icons`) or vendored subset, only `pkg/src/client/os-icon.ts` changes.
- **Stroke Width Normalization on E-Ink (1.8 / 1.7 → 1.6):**
  - *Mitigation:* Phase 2 includes a visual check at `1.5rem` and e-ink resolution; any icon that looks faint retains its heavier stroke width with an explicit note in `pkg/icons/README.md`.
- **Catalog Drift:**
  - *Mitigation:* The catalog harness validates every file in `pkg/icons/` against the file spec and fails if any migrated catalog bundle neither matches `pkg/icons/<app-id>.svg` inline nor references it via `kody:<app-id>`.
