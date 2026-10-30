# Proposal

## Why

`ui.placements` was designed as an allowlist: which of page, modal, or
widget an app supports. In practice it never restricted anything that
matters, and it misdescribes how the shell actually works:

- Page, modal overlay, and home widget all render the same single view
  through `renderAppSection` (bundle UI + state fields + action forms).
  There is no per-placement template, so there is nothing an app needs
  to "support" to render in another context.
- The only thing `placements` changes today is the Apps-page tile link:
  `modal` makes the tile open an overlay on the Apps page; anything
  else links to the full app page. Direct navigation to `/apps/<id>`
  works for every app regardless of its placements.
- Home widgets are not governed by `placements` at all. Presence on
  the home dashboard is governed by the homepage list ("Add to home"),
  and the shell renders a live widget for every homepage-pinned app.
  The `widget` placements value, meanwhile, validates but renders
  nothing, which is the opposite of a useful allowlist entry.

The definition should therefore say one thing, not three: how the app
opens by default when opened from the Apps page — page or modal. Every
app is allowed in every context; the default is a preference, not a
permission.

## What Changes

- A definition gains `ui.openAs: "page" | "modal"`, defaulting to
  `"page"` when omitted. The Apps-page tile follows it: `page` links
  to the full app page, `modal` links to the inline overlay on the
  Apps page, exactly as the modal tile does today.
- `ui.placements` is deprecated, not hard-removed. Old definitions
  carrying it keep installing and keep opening the way they did (see
  design.md for the derivation rule). `export_app` normalizes to the
  new field, so re-exported definitions migrate on their own.
- Nothing else changes: direct app-page URLs still work for every
  app, home widgets still come from the homepage list, overlay
  rendering still uses the same shared section, and no storage keys,
  MCP surface, or action handling changes.

## Capabilities

### New Capabilities

(none — this replaces a schema field with a simpler one)

### Modified Capabilities

- `app-placements`: the placements allowlist becomes a single
  default-open field; the allowlist requirement is removed and the
  widget statement is corrected (widget presence is homepage-list
  governed, not placements governed).

## Impact

- `pkg/src/apps/types.ts` (`UiDef`, summary type), `pkg/src/apps/registry.ts`
  (validation + normalization), `pkg/src/apps/client.ts` (tile link +
  overlay gating), `pkg/src/app.ts` (modal overlay collection, field
  rename only — same mechanism).
- `pkg/docs/adding-an-app.md` field table and checklist; all
  `pkg/examples/*.bundle.json` (Clock becomes `openAs: "modal"`,
  the rest omit the field and take the page default).
- No storage-key change: the registry stores the normalized
  definition, so old and new definitions round-trip through the same
  shape. No MCP surface change: `add_app`/`export_app` keep their
  signatures; only the accepted definition shape changes.
- Publish as MINOR, not MAJOR: old definitions keep working through
  the derivation rule, so this is a new field plus a deprecation,
  not a break.
