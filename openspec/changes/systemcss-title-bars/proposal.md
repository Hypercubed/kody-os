# Proposal

## Why

The shell's title bars work, but they are not as nice as
system.css's. The current bars (`.os-titlebar` on the shell
window, `.app-titlebar` on app panels, modals, and widgets)
are 3rem tall with a 0.9375rem bold title on a bordered
plate, a blank close square that only inverts on hover /
press, and corner-bracket expand / collapse glyphs. The
system.css `.title-bar` is slimmer and more convincingly
Mac-like: a thin racing-striped strip, a larger title
sitting on white in the middle of the stripes, and real
close / resize box glyphs drawn in the boxes themselves.
The title bar is the one piece of chrome on every page,
so it carries the whole look more than any other element.

This change imports that title-bar look into the shell
theme — adapted, not copied verbatim. System.css's bar
cannot be pasted in as-is: it is 1.5rem tall with close /
resize buttons that scale down to about 20px, it draws
its stripes and glyphs with `linear-gradient`, and its
title font is a Chicago webfont. Every one of those
breaks a kody-os rule: 48px minimum tap targets, no
gradients (the shell's stripes are an SVG tile, not a
gradient), and system fonts only with all CSS inlined.
The phases below are ordered so each piece can land and
be judged on the Scribe on its own, which is the point:
this is a piece-by-piece change, not a flag day.

## What Changes

- The shell window title bar (`.os-titlebar` / `.os-title`)
  and the app panel title bar (`.app-titlebar` /
  `.app-title-plate`) move toward the system.css look:
  a slimmer visual strip, a larger title relative to the
  bar, denser racing stripes from the shell's existing
  SVG tile, and visible glyphs in the close and
  expand / collapse boxes.
- The 48px hit slots for close, expand, and collapse
  stay 48px, whatever the visual bar height becomes.
  If a phase cannot keep a 48px slot, that phase does
  not land; the visual height and the tap height are
  separate decisions, and the tap height wins.
- Close keeps its current destination semantics
  (back to the opener, Home on a bad / missing `from`,
  omitted on the dashboard) and expand / collapse keep
  theirs (page-mode expand on app pages only, modal
  and widget expand boxes unchanged in meaning).
  Only the look changes, not the navigation.
- An inactive title-bar variant, in the system.css
  sense (title in grey, stripes dropped), is specified
  only if a real use for it is found first (see
  design.md). It is not added speculatively.
- The exactly-one-title rule is unchanged: an app page
  still shows exactly one title header (the shell
  window's), and a modal overlay still keeps the
  panel's own title header, since the underlying page
  chrome does not name the app.

## Capabilities

### New Capabilities

- `systemcss-title-bars`: the adapted system.css title
  bar look, as shell theme styles, in the phases below.

### Modified Capabilities

- `shell`: the title-bar requirements change from the
  current 3rem / 0.9375rem / blank-box look to the
  adapted system.css look. No route, storage, MCP, or
  navigation change. No new capability is offered to
  apps; bundles still must not recreate title bars.

## Impact

- `pkg/public/styles.css` (source of truth) plus the
  regenerated `pkg/src/shell-css.ts`: `.os-titlebar`,
  `.os-title`, `.os-box`, `.os-expand`, `.os-collapse`,
  `.app-titlebar`, `.app-title-plate`, `.modal-expand`,
  `.widget-expand` as each phase touches them.
- `pkg/src/app.ts` / `pkg/src/apps/client.ts` only if
  a phase needs markup for a glyph (for example an
  inline SVG in a box, or an inactive marker). CSS
  pseudo-element glyphs need no markup change and are
  preferred where they read as well.
- `pkg/docs/style-guide.md`: the title-bar section
  (stripes, title size, box glyphs) is updated at
  implementation time to match the landed look, so
  the guide does not describe a bar that no longer
  exists.
- No bundle, catalog, registry, or storage change.
  Bundles are untouched: they render inside a panel
  whose title bar is the shell's, not theirs.
- Version: MINOR at implementation (a visible shell
  change, nothing existing breaks in the registry
  sense) — this spec draft itself, outside `pkg/`,
  bumps nothing, and build increments by one only
  on a Kody publish, per `pkg/AGENTS.md`.
