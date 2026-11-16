# Tasks

Phases land in order: 1, then 2, then 3, then 4. No task in this file commits, pushes, or publishes anything, and no task bumps the package version; catalog changes in Phase 3 increment each touched bundle's own `catalogVersion` by exactly 1, in the implementation commit, per the catalog rules.

## 1. Custom icon folder, local registry, and static route

- [x] 1.1 Create `pkg/icons/` with `pkg/icons/README.md` carrying the file spec from `design.md` Decision 3 in full: one file per icon, kebab-case names, `viewBox="0 0 24 24"`, no `width` / `height` attributes, `fill="none"` line art (default-black solids only where meant), `stroke="currentColor"`, stroke width 1.6, round caps and joins, a `<title>`, and nothing else (no color, gradients, animation, `style`, script, external refs, or `<use>`). Document both consumption modes: bundled into the local `kody:*` registry for `currentColor` rendering and served at `GET /icons/<name>.svg` for `<img>` tags.
- [x] 1.2 Add a build/codegen helper (mirroring `pkg/public/styles.css` -> `pkg/src/shell-css.ts`) that compiles `pkg/icons/*.svg` into `pkg/src/icons-registry.ts`, and wire `GET /icons/<name>.svg` in `pkg/src/app.ts` to serve those SVGs with `Content-Type: image/svg+xml` and cache headers (404 on unknown/invalid names).
- [x] 1.3 Write folder validation in the catalog harness: every file in `pkg/icons/` passes the tile-icon sanitizer allowlist and file spec (viewBox, no fixed width/height, stroke width, round caps/joins, `<title>` present), and `pkg/src/icons-registry.ts` matches `pkg/icons/`.

## 2. `<os-icon>` custom element and tile icon reference support

- [x] 2.1 Implement `pkg/src/client/os-icon.ts` (`defineOsIcon`) and register it in `pkg/src/client/os-elements.ts`: Light-DOM `KodyLit` element (`createRenderRoot() { return this; }`), ES2019-only syntax, resolving `kody:<name>` from the bundled local registry and external `<prefix>:<name>` (defaulting unprefixed non-local names to `lucide:<name>`) on demand via Iconify's CORS-enabled JSON API with in-memory + `localStorage` caching, request deduplication, allowlist SVG sanitization, and `label` / `aria-hidden` accessibility handling.
- [x] 2.2 Add CSS rules in `pkg/public/styles.css` (and regenerate `pkg/src/shell-css.ts`) so `os-icon` displays inline-flex centered at `1em` by default and `1.5rem` inside `.tile-icon`, preserving layout when empty/loading.
- [x] 2.3 Extend `definition.icon` validation in `pkg/src/apps/registry.ts` and tile rendering (`tileItem`) to accept `kody:<name>` and `lucide:<name>` references alongside inline `<svg>` strings and plain-text glyphs, rendering `<os-icon name="...">` inside `.tile-icon`.
- [x] 2.4 Add unit/harness tests covering `<os-icon>` prefix resolution, caching, sanitization of fetched SVG bodies, `definition.icon` reference validation, and `GET /icons/<name>.svg` responses.

## 3. Migrate and normalize the 11 catalog SVG tile icons

- [x] 3.1 Copy, verbatim first, the icon strings of the 11 SVG catalog apps into `pkg/icons/<app-id>.svg`: `calculator`, `calendar`, `clock`, `counter`, `daily-feed`, `eight-ball`, `hoodie-weather`, `link-drop`, `mac-puzzle`, `news`, `probe`.
- [x] 3.2 Normalize each file to the spec: stroke width to `1.6` (from `1.8` on `calculator`, `counter`, `mac-puzzle`; from `1.7` on `link-drop`, `probe`), round caps and joins where missing, `<title>` where missing. Visually verify each icon at `1.5rem` and e-ink resolution; any icon that goes faint keeps its heavier stroke width with an explicit note in `pkg/icons/README.md`.
- [x] 3.3 Write the normalized strings back into their catalog bundles, incrementing each touched bundle's `catalogVersion` by exactly 1 and no other bundle's, regenerate `pkg/src/icons-registry.ts`, and add the catalog sync check ensuring the 11 migrated bundles match `pkg/icons/<app-id>.svg` after whitespace normalization.

## 4. Documentation and full verification

- [x] 4.1 Update `pkg/docs/scribe-limitations.md` and `README.md` to note that Kindle's "Disable Images" browser setting (like disabled JS) is unsupported, so `<img>` tags (including `/icons/<name>.svg`) and on-demand CDN icon fetches are valid.
- [x] 4.2 Update `catalog/README.md` (catalog lives at repo-root `catalog/`, not `pkg/catalog/`) and `pkg/.agents/skills/adding-an-app/SKILL.md` with concise guidance on using `<os-icon name="lucide:...">` / `<os-icon name="kody:...">`, adding custom SVGs to `pkg/icons/`, and loading static icons via `<img src="/icons/<name>.svg">`.
- [x] 4.3 Run the full harness test suite (`bun tests/catalog-harness.ts`, `bun tests/store-harness.ts`, `bun catalog/tests/app-store-tests.cjs`) and ES2019 checks, recording results.

  Verification record (2026-11-16 follow-through, uncommitted working tree):
  - `bun tests/catalog-harness.ts` — PASS (all catalog checks, incl. folder validation, client-mirror match, ES2019 ceiling, 11-bundle sync allowing inline or `kody:<id>`).
  - `node --experimental-strip-types tests/svg-icons-harness.ts` — PASS (validation, tile rendering, `/icons/` routing, DOM: kody/lucide/cache/sanitize/a11y + unprefixed + offline-degrade). `bun tests/svg-icons-harness.ts` runs the non-DOM subset and SKIPs DOM (jsdom 31 incompatible under Bun, same as the Node-only app-store harness).
  - `bun tests/store-harness.ts` — 2 pre-existing FAILs (App Store self-update expectations), identical on clean HEAD `074f70f`, not caused by this change.
  - `node catalog/tests/app-store-tests.cjs` — PASS (`ALL APP STORE BUNDLE CHECKS PASSED`). Under `bun` it fails with `storeInit is not a function`, identical at HEAD — pre-existing Bun/jsdom incompatibility, so Node is the supported runner.
  - `bun run typecheck` in `pkg/` — clean.
  - Both generators produce no unexpected diff after regen (`scripts/build-icons-registry.ts` writes `pkg/src/icons-registry.ts` + `pkg/src/client/icons-data.ts`; `scripts/build-catalog-index.ts` rewrites `catalog/catalog.json`).
  - Version-bump note: repo policy asks a MINOR bump in the same commit, but the header rule of this task file (no task bumps the package version) wins for this working tree — the bump rides with the publish commit, not here.

  Close-out (2026-11-16 archive): deltas for `svg-icons` + `authoring` synced into main specs and verified (all delta requirements/scenarios present; `openspec validate --specs` 21/22 — sole failure is pre-existing `widget-visibility` scenariless requirement, untouched by this change). Harness record: catalog PASS, svg-icons PASS (Node full / Bun subset), typecheck clean, app-store bundle PASS under Node; store-harness 2 FAILs pre-existing at HEAD. Stale-index CRITICAL resolved by re-staging before archive. Version bump deferred to publish commit per task-file rule.
