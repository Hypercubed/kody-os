# Tasks

Phases land in order: 1, then 2, then 3. Each phase's
verification must pass before the next phase starts. No
task in this file commits, pushes, or publishes anything.

## 1. Declare, validate, store

- [x] 1.1 Extend `AppCapabilities` in
  `pkg/src/apps/types.ts` with `manageApps?: boolean`
  and `proxy?: ProxyDecl[]` (name, HTTPS URL, TTL,
  maxBytes, shaped like `FeedDecl`), and settle the
  feeds-vs-proxy question from design.md Decision 2
  without breaking any existing feed declaration.
- [x] 1.2 Extend `validateCapabilities` and
  `sanitizeCapabilities` in `pkg/src/apps/registry.ts`:
  unknown capability keys fail validation with no
  write; proxy entries follow the feeds limits
  (HTTPS bare URLs, TTL, size cap); sanitization
  stores the canonical, defaults-applied form.
- [x] 1.3 Verify against a blank store: a definition
  with valid new capabilities installs and round-trips
  through export/import with capabilities intact; a
  definition with an unknown key or a non-HTTPS proxy
  URL fails with no write; a definition with no new
  fields behaves exactly as today.

## 2. Disclose and gate expansion

- [x] 2.1 Render capability disclosure for the Store
  (and document the agent `add_app` verification
  wording): `manageApps` in plain words, proxy hosts
  listed, feeds shown as today or under the merged
  wording if applicable. No capability may be
  installable without being shown.
- [x] 2.2 Add the capability-expansion confirm gate:
  a Store update or `add_app` overwrite that adds
  `manageApps`, a new proxy host, or any new
  capability key does not apply until the installer
  confirms a prompt naming exactly what is new.
  Removing a capability or changing only TTL/size
  parameters does not trigger the gate.
- [x] 2.3 Verify: installing an app shows its
  capabilities; updating it to a version with a new
  proxy host is blocked until confirmed and then
  applies; declining the confirm changes nothing.

## 3. Enforce the server allowlist

- [x] 3.1 Wire the management API (see
  `data-only-app-store`) to require declared
  `manageApps` in the acting app's stored definition,
  and wire the proxy route to require a declared
  proxy/feed name, both returning the feed-style
  plain 404 on failure with no write and no
  capability detail. If the management API lands
  after this change, this task moves with it and
  must not be marked done until the API check
  exists.
- [x] 3.2 Sync the canonical specs: update
  `openspec/specs/authoring` (capability authoring
  rules) and `openspec/specs/app-registry`
  (validation, storage, update-confirm rules), and
  update `pkg/catalog/README.md` and
  `pkg/docs/adding-an-app.md`. Record the version
  decision in the implementation commit (MINOR per
  proposal.md, build +1 on publish).

## Close-out (2026-11-03)
Closed out at the user's direction. All tasks were done in Entire 60e76b7 (v2.3.0); no kody-dev leg was left open for this change. Catalog, store, and app-store harnesses pass at close-out.
