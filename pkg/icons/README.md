# Custom SVG Icons (`pkg/icons/`)

This directory contains canonical source files for custom `kody-os` SVG icons.

## File Specification

Every icon file in this directory must meet these requirements:

1. **One file per icon**: named in kebab-case (`<name>.svg`), matching its registered icon ID. No sprite sheets.
2. **ViewBox and Sizing**: `viewBox="0 0 24 24"`. No fixed `width` or `height` attributes on the root `<svg>` tag.
3. **Geometry & Styling**:
   - `fill="none"` line art by default (default-black solid fills only where solid shapes are intended).
   - `stroke="currentColor"`.
   - `stroke-width="1.6"` standard stroke width (unless an exception is explicitly documented below for e-ink legibility).
   - `stroke-linecap="round"` and `stroke-linejoin="round"`.
4. **Accessibility**: A `<title>` element must be present as the first child of `<svg>`, providing a concise text name for the icon.
5. **Sanitizer allowlist strictly enforced**:
   - Elements allowed: `svg`, `path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `g`, `title`.
   - Monochrome `fill` / `stroke` and geometry attributes only.
   - Absolutely no colors, gradients, animations, `<style>`, `<script>`, external references, `xlink:href`, or `<use>`.

## Documented Stroke Width Exceptions

Icons must remain crisp and legible at `1.5rem` on 1-bit and grayscale e-ink displays.
Any icon that requires a heavier stroke width than `1.6` to prevent faintness must be explicitly listed here with rationale:
*(None currently — all 11 migrated icons normalized to 1.6)*

## Consumption Modes

Icons in `pkg/icons/` are consumed in two ways:

1. **Bundled Local Registry (`kody:*`)**:
   Compiled into `pkg/src/icons-registry.ts` at build/codegen time. Used synchronously by `<os-icon name="kody:<name>">` and inline shell templates with full `currentColor` theme inheritance and zero network requests.
2. **Static Route (`GET /icons/<name>.svg`)**:
   Served by the shell HTTP handler in `pkg/src/app.ts` with `Content-Type: image/svg+xml` and cache headers, allowing apps to load icons via `<img src="/icons/<name>.svg">` when theme color inheritance is not required.
