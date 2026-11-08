# Close-out: store-latest-schema-floor (handoff 12)

Archived 2026-11-08. Implementation and verification done in this handoff;
nothing was committed, pushed, published, or version-bumped
(`pkg/package.json` still v4.0.0 build 34). `minPackageVersion` and the
pin removal are untouched.

## What changed

- `catalog/app-store/definition.json`: `catalog` proxy entry url moved from
  the fixed `v4.1.0` tag to the `main` branch
  (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`),
  `catalogVersion` 16 -> 17; `catalog/catalog.json` regenerated (18 apps).
  `catalog/app-store/RECIPE.md` and the SKILL example base updated to match.
- `pkg/src/apps/registry.ts`: new `MIN_SUPPORTED_SCHEMA_VERSION = 3`
  (minimum of `SUPPORTED_SCHEMA_VERSIONS`, which stays `[3, 4, 5]`),
  exported through `pkg/src/apps/index.ts`. `add_app` enforces it as an
  install gate with the `minPackageVersion` error shape:
  `App "<id>" requires schema version 3 (has <schema>)`, writing nothing.
  Covers install and update, Store and agent.
- `StoreRow` gains `schemaVersion?` / `schemaFloor?` / `needsNewerSchema?`
  (mirroring the handoff-10 fields); both row builders set them.
- `catalog/app-store/store.js`: below-floor rows show
  `Requires schema v3 (app has v2).` instead of any install control; a row
  failing both gates shows both notes; Update All skips both.
- `tests/store-harness.ts`: new 2.1 block (floor constant, below/at/current
  schema installs, refused downgrade leaves the installed definition
  byte-identical, below-floor row fields from a temp schema-2 catalog).

## What was verified (tasks 2.1-2.3)

- 2.1 harness (in-process): floor is 3, the minimum supported; schema 2
  refused with app + schema + floor named and nothing written; schema 5
  installs fresh; schemas 3 and 4 install via re-add restamp; re-add as
  schema 2 refused and the installed bundle is byte-identical; a catalog
  copy with a schema-2 definition yields a row with `needsNewerSchema`
  true, `schemaVersion` 2, `schemaFloor` 3. ALL STORE CHECKS PASSED;
  catalog harness passes (18 apps); app-store jsdom bundle checks pass.
- 2.2 `kody execute --target mock` (server stopped): schema-2 install
  refused with the exact floor error text; schema-5 fresh install ok;
  schema-3 re-add over it ok; probe apps removed afterwards (mock store
  left as found). jsdom over the real `index.html`+`store.js` with a mocked
  below-floor row shows `Requires schema v3 (app has v2).` with 0 control
  buttons. No live-browser navigation was performed (recorded as
  substituted: same substitution as handoffs 10/11, jsdom covers the row
  rendering and the harness covers the row data).
- 2.3: ES2019 scan clean; `bun build pkg/src/app.ts` succeeds.

## Deviation / substitution log

- The prompt asked to also amend the `remove-catalog-pin` change's authoring
  scenario that names the `v4.1.0` base, "since that change is still open".
  It is not open: handoff 11 was archived as
  `openspec/changes/archive/2026-11-08-remove-catalog-pin/` before this
  handoff started. Archives are records and were not edited. The archived
  scenario (a hypothetical declaring the tag base) stays true as written;
  no canonical-spec change was needed for it.
- Gate placement: the floor gate runs BEFORE `validateDefinition` in
  `add_app`, while the `minPackageVersion` gate runs after it. Reason:
  validation's supported-list check rejects schema 2 first, which would mask
  the gate for exactly the case the spec's scenario pins (schema 2, floor 3,
  error naming app+schema+floor). Same error shape as the package gate.
- Fresh installs of schemas 3/4 are still refused by the pre-existing
  "stale for a new app" rule (new ids must be current); the spec's
  "schema 3 / 4 installs" scenarios hold via the re-add restamp path, which
  the harness checks assert. Stored definitions always carry the current
  schema (`canonicalizeDefinition` stamps it), so the floor gate's live
  effect today is refusing schema-2 (and older) submissions.
- The prompt's "do not archive min-package-version" was already satisfied:
  handoff 10b archived it before this handoff started.
