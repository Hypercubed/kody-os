# Tasks: store-latest-schema-floor

## 1. Store follows the latest catalog; schema floor gate

- [x] 1.1 `catalog/app-store/definition.json`: change the
  `capabilities.proxy` entry named `catalog` so its `url` is the
  `main` branch catalog base
  (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`).
  Bump app-store `catalogVersion` 16 -> 17 by the existing rule and
  regenerate `catalog/catalog.json` (18 apps). Also update the
  `remove-catalog-pin` change's authoring spec scenario that names
  the `v4.1.0` base URL, so the open change no longer states the
  fixed tag (that change is still open; amend its scenario text to
  the `main` base).
- [x] 1.2 `pkg/src/apps/registry.ts`: name the shell's minimum
  supported schema version as `MIN_SUPPORTED_SCHEMA_VERSION`
  (currently 3, the minimum of `SUPPORTED_SCHEMA_VERSIONS`), next
  to `SUPPORTED_SCHEMA_VERSIONS` and `DEFINITION_SCHEMA_VERSION`.
  Enforce it in `add_app` as an install gate alongside the
  `minPackageVersion` gate: when `definition.schemaVersion` is below
  the floor, return `{ ok: false, error }` naming the app, its
  schema version, and the minimum supported schema version, and
  write nothing. The gate covers install and update, Store and
  agent. Equal to the floor is compatible.
- [x] 1.3 Store: do not offer a one-tap install or update for an app
  whose `schemaVersion` is below the shell's floor; show the schema
  requirement instead. An update to a definition whose schema is
  below the floor is refused the same way. (`StoreRow` gains the
  schema fields it needs, mirroring the `minPackageVersion` fields
  from handoff 10.)

## 2. Verify

- [x] 2.1 Harness checks: the App Store's declared catalog base is
  the `main` branch URL; a Store definition with a fixed-tag base is
  no longer the shipped default; an app with `schemaVersion` below
  the floor (e.g. 2) is refused by `add_app` with the app, its
  schema, and the floor named; an app with `schemaVersion` equal to
  the floor (3) installs; an app with a current schema (4 or 5)
  installs; an update to a definition with a below-floor schema is
  refused, installed definition unchanged.
- [x] 2.2 Verify in `kody dev` (mock target): install an app with a
  below-floor schema and confirm the refusal and its error text;
  install one at the floor and confirm it installs; confirm the
  Store row for a below-floor app shows the schema requirement
  instead of an install control. Substitute only with a recorded
  reason if a step cannot run as written.
- [x] 2.3 Bundle constraints and build: ES2019 scan clean;
  `bun build pkg/src/app.ts --target=browser --external 'kody:*'`
  succeeds.

## 3. Sync and archive

- [x] 3.1 `openspec validate --changes` shows no new failures (the 3
  pre-existing failures — email-client, f-flat-minor-calculator,
  generic-rss-feed — are expected; name them if they appear).
- [x] 3.2 Sync the canonical specs: the app-registry and authoring
  deltas in this change become canonical.
- [x] 3.3 Archive with a close-out note recording what was verified
  and what was left open.
