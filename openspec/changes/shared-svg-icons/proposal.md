# Proposal

## Why

Tile icons are shared in name only today. Each
catalog app's icon is an inline string pasted
into its bundle JSON: 10 apps carry hand-drawn
24×24 stroke SVGs, 6 carry a single glyph
(⊞, →, ▦, ?, ◼, X). The SVGs are close to a
style but not a style: stroke widths wander
between 1.6, 1.7, and 1.8, some have round caps
and joins and some do not, and there is no
file anywhere that is the icon — only the
copies inside the bundles, plus `pkg/icon.svg`
(the package mark, a different thing) and
`pkg/public/favicon.png`. A new app, or a new
agent writing one, has no place to look, no
spec to follow, and no check to fail; it
invents an eleventh variant. The archived
`2026-10-27-svg-icons` change made inline SVG
icons possible (sanitized at validation,
rendered in `.tile-icon`); this change gives
those icons a home they can be shared from.

This is a consideration as much as a plan:
the folder is small and cheap, but the way
apps share from it — a source folder that
catalog strings are checked against, or a
runtime registry the shell resolves — is a
real decision with different migration costs,
and it is left open in design.md rather than
assumed. Phase 1 (the folder, the spec, the
validation) is worth doing on its own even if
the sharing mechanism is decided later; the
later phases are not started until it is.

## What Changes

- A new authoring source folder, `pkg/icons/`,
  one file per icon, with a written spec and a
  validation check. It is not served and not
  shipped as an external asset: tile icons are
  still rendered from the definition string,
  inlined by the shell, exactly as today.
  The folder is where the string comes from,
  not a second place it is fetched from.
- Phase 1 migrates the existing 10 SVG tile
  icons into the folder as files (about,
  calculator, calendar, clock, counter,
  eight-ball, hoodie-weather, puzzle,
  news, probe), then normalizes them to one
  spec (24×24 viewBox, `currentColor` stroke,
  one stroke width, round caps and joins,
  monochrome, no gradients, no animation,
  a `<title>` for accessibility). The 6 glyph
  icons stay glyphs in Phase 1; converting
  them is a per-icon decision later, not a
  bulk rewrite.
- A check (harness, not a hope) that a
  migrated catalog icon's string matches its
  folder file, so the folder and the bundles
  cannot drift apart silently again.
- The adding-an-app skill and the catalog
  README gain one short section: new tile
  icons start in `pkg/icons/`, follow the
  folder spec, and are added to a bundle from
  the folder file, not drawn fresh in JSON.

## Capabilities

### New Capabilities

- `shared-svg-icons`: a shared SVG icon asset
  folder with a file spec, validation, and a
  catalog sync check.

### Modified Capabilities

- `svg-icons`: the tile-icon requirement gains
  a source rule — a catalog app's SVG icon
  SHALL come from `pkg/icons/` (for the 10
  migrated icons; glyph icons are unchanged)
  — on top of the existing sanitization and
  Scribe-safe rendering rules, which are
  unchanged.
- `authoring`: the adding-an-app guidance
  gains the folder as the starting point for
  a new tile icon. No definition field, route,
  storage key, or MCP export changes.

## Impact

- New: `pkg/icons/` (10 SVG files in Phase 1)
  plus `pkg/icons/README.md` (the spec, in
  the folder where an author will look for
  it), plus a validation / sync check in the
  repo harnesses (location decided in Phase 1;
  the catalog harness is the natural home).
- Changed, only in the normalization step:
  the `icon` strings of the 10 migrated
  catalog bundles, each by exactly the stroke
  / cap / join normalization the spec sets —
  and each such bundle change increments its
  own `catalogVersion` by exactly 1, per the
  catalog rules, never for an unrelated app.
  Glyph-icon bundles are untouched.
- Unchanged: tile rendering (`.tile-icon`,
  1.5rem SVG box, `currentColor` strokes),
  the `icon` field's shape (a string, SVG or
  glyph), validation sanitization, live
  installed definitions (a publish changes
  code, not stored app state, so a live
  install keeps its old icon until it is
  re-added or updated from the catalog —
  the same re-add path as any catalog change).
- Out of scope: converting the 6 glyph icons
  to SVG, in-bundle icons (About's QR codes,
  Puzzle's generated digit glyphs — those are
  app content, not shared assets), external
  icon libraries, a runtime icon registry
  (Phase 4 decides whether one is wanted at
  all), and any change to `pkg/icon.svg` or
  `pkg/public/favicon.png`.
- Version: this spec draft itself, outside
  `pkg/`, bumps nothing. When Phases 1–3 land
  as code, the implementation commit records
  the version decision; the expected call is
  MINOR (a new shared folder plus visible
  icon normalization, nothing existing
  breaks), with each touched bundle's
  `catalogVersion` +1 and build +1 on a Kody
  publish, per `pkg/AGENTS.md` — but the
  decision is recorded at implementation
  time, not assumed here, and a phase that
  turns out to be docs-only would take PATCH
  instead under the same policy.
