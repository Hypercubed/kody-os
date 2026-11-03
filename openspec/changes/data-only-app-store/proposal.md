# Proposal

## Why

The App Store is the one page in kody-os that is not an
app. Its bundle (`pkg/catalog/app-store.bundle.json`) is
static intro text with no actions, while the real Store —
the combined catalog-plus-installed list, install, update,
restore, and confirmation — is a special case in
`pkg/src/app.ts` that intercepts `GET /apps/app-store`
before the generic app route. That split is why the
question "why is the Store not just an app?" keeps
coming up, and why replacing the store definition via
`add_app` changes nothing about the Store page today.

Under the accepted trust model, this split is no longer
needed for safety: an installed app is already trusted
with same-origin session authority, and the Store's job
can be done by a data app that calls a shell management
API, with its abilities declared in `capabilities`
(see `bundle-capabilities`). Making the Store a real
data app also makes the later public-catalog change
cleaner: the Store's catalog source can change without
changing shell page code.

This change assumes `apps-edit-and-store-split` and
`bundle-capabilities` are in place first. After the
split, the Store's job is catalog work only (install,
update, restore); launcher work (pin, hide, home) lives
on Apps Edit and is out of scope here.

## What Changes

- The shell gains a management API for bundles: read
  store rows (catalog plus installed, with status and
  modified flags, as `get_store_rows()` computes them
  today) and write install, update, and restore,
  reusing `store_install_from_catalog`,
  `store_update_from_catalog`, and the install-snapshot
  logic. The API checks declared `manageApps` in the
  acting app's stored definition (see
  `bundle-capabilities`) and returns the feed-style
  plain 404 for undeclared callers.
- The App Store bundle is rewritten from static intro
  text to a real JS bundle: it fetches store rows on
  load, renders the list, handles loading, error, and
  empty states, and implements the modified-app
  confirmation UI itself. It stays within the bundle
  contract: ES2019, system fonts, zero emojis, under
  the 256 KiB cap, inlined assets only.
- The `app.ts` Store special case is deleted: no
  intercept before the generic app route, no
  shell-rendered combined list, no shell confirmation
  page for the Store. `get_store_rows()` and the
  registry install/update logic stay server-side and
  are exposed through the API instead of through page
  rendering.
- Seeding and recovery are kept as shell concerns, not
  bundle concerns: `ensure_app_store_seeded` still
  installs the Store tile on first shell use against
  an empty registry, and agent `install_from_catalog`
  remains the recovery path if the Store is removed.
  What happens when the Store is not installed and a
  user opens `/apps/app-store` is settled in design.md.

## Capabilities

### New Capabilities

- `app-registry`: a bundle management API (read store
  rows, install, update, restore from a catalog) for
  apps declaring `manageApps`.

### Modified Capabilities

- `shell`: the Store page stops being a shell-rendered
  special case and becomes a generic app page. No new
  route family beyond the management API routes, which
  follow the existing GET-mutation and session-gate
  rules.
- `authoring`: the App Store bundle becomes the
  reference for a managing data app, alongside the
  counter as the reference for a stateful bundle.

## Impact

- `pkg/src/app.ts`: Store intercept, store page builder,
  and Store confirmation page deleted; management API
  routes added (dispatched after the `/apps/` branches
  and alongside the `/feed/` route, so they inherit
  the device gate).
- `pkg/src/apps/registry.ts`: `get_store_rows`,
  install/update snapshot logic reused, not rewritten;
  a management-API entry point is added over them.
- `pkg/src/apps/client.ts`: `renderCombinedList` is
  retired or moved to the bundle's rendering (the
  implementation decides, and records it); shell
  rendering of the Store list goes away.
- `pkg/src/bridge/bridge.js` and/or
  `pkg/src/client/index.ts`: the management API is
  exposed to bundles through the bridge or through
  documented same-origin routes — settled in design.md.
- `pkg/catalog/app-store.bundle.json`: rewritten as a
  managing bundle declaring `manageApps`.
- BREAKING: the shell-rendered Store page and its
  `?install=` / `?update=` / `?restore=` query
  handling on `/apps/app-store` go away; the same
  operations move to the management API. Bookmarks
  to those query URLs stop working as Store actions
  (see design.md for the fallback). No installed app,
  definition, or agent script breaks: MCP catalog
  tools are unchanged. Version: MINOR at
  implementation (new API and bundle, existing
  registry behavior unchanged) — this spec draft
  itself, outside `pkg/`, bumps nothing.
