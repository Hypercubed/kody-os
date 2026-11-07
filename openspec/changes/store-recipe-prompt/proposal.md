# Store recipe prompt rendering

## Why

`catalog-restructure` defined `installMode` and the Store behavior for
`recipe-only` rows — list them, show the recipe prompt in place of
one-tap Install — but deferred the rendering itself as a follow-up
(`openspec/changes/catalog-restructure/design.md`, Decision 3; proposal
Impact). The data it reads is in place: `installMode` lives in
definitions and in the catalog index (fingerprint-excluded), and the
listing summaries carry it (`CatalogSummary.installMode`,
`pkg/src/apps/catalog.ts`). This change IS that follow-up: it renders
the prompt.

No app is `recipe-only` today (`app-store`, `daily-feed`, and
`generic-feed` are `recipe-or-json`; the other 17 are `json`), so there
is no live row to show it on yet. The rendering is therefore specified
and tested with a fixture row, ready for the first `recipe-only` app.

## What Changes

- The manage rows carry `installMode`, copied by the row assembly from
  the catalog definition (default `json` when the definition carries
  none). The bundle treats a missing `installMode` as `json`.
- The App Store bundle renders a recipe prompt in place of the Add
  button on not-installed `recipe-only` rows: selectable text in a
  `<code>` element, no copy button, no Clipboard API (the shell's
  established pattern for agent prompts). The prompt is a short
  instruction naming the app and its recipe file, not the full recipe
  text — the agent reads the recipe file itself.
- `recipe-or-json` and `json` not-installed rows keep one-tap Add, with
  no prompt. Installed rows keep their existing controls; the prompt
  never appears on an installed row.
- `app-store-tests.cjs` gains fixture checks for all three modes (the
  `recipe-only` fixture is test-only, not a catalog app).
- App Store bundle `catalogVersion` 13 to 14 (the bundle changes); the
  catalog index regenerates.

## Capabilities

- app-registry

## Impact

- App Store bundle only (`store.js` row rendering + a `store.css` rule),
  one field on the manage rows, and the app-store tests. No change to
  `installMode` semantics, the index, the generator, or the agent
  install path.
- Builds on `catalog-restructure` (staged, uncommitted on `main`). It
  is independent of the concurrent Help/About built-in change: that
  change removes `help` and `about` from the catalog, which only means
  fewer rows in the Store listing; it does not touch row rendering.
- No Kody publish in this change.
