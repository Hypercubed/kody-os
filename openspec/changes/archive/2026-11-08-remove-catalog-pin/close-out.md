# Close-out: remove-catalog-pin (handoff 11)

Archived 2026-11-08. Implementation and verification done in this handoff;
nothing was committed, pushed, published, or version-bumped
(`pkg/package.json` still v4.0.0 build 34). `minPackageVersion`
(handoff 10) untouched.

## What changed

- `pkg/src/apps/remote-catalog.ts`: `CATALOG_REPO`, `CATALOG_RELEASE`,
  and `catalogReleaseLabel()` deleted. `readCatalogManifest`,
  `list_catalog`, `get_catalog_entry`, `get_catalog_definition`, and
  `get_catalog_recipe` take the catalog base as an (optional) parameter;
  `get_catalog_source` takes the base and reports `{ baseUrl,
  releaseLabel }` with the label derived from the base (no hardcoded
  host). New `normalizeCatalogBase` (HTTPS-only, loopback `http`
  carve-out, throws before any fetch) and exported `devOverrideBase`
  (`KODY_CATALOG_BASE`, kept as-is, wins when set). Manifest cache keyed
  by effective base. Fetch discipline unchanged (8s timeout, same caps,
  manifest/entry validation, paths from the manifest only).
- `catalog/app-store/definition.json`: declares the catalog base as a
  `capabilities.proxy` entry named `catalog`
  (`https://raw.githubusercontent.com/Hypercubed/kody-os/v4.1.0/catalog/`),
  `catalogVersion` 15 -> 16; `catalog/catalog.json` regenerated (18 apps).
- `pkg/src/apps/registry.ts`: base resolved per call — Store management
  calls read it from the calling app's declared `catalog` entry (no entry
  means catalog-unavailable: installed-only rows, never blank);
  `install_from_catalog`/`store_install_from_catalog` accept optional
  `catalogBase`, else the installed App Store's declared base, else refuse
  naming that no catalog source was given (nothing written).
  `update_from_catalog` resolves from the installed Store; `get_app_status`
  and `get_store_rows` take an optional base.
- `pkg/src/app.ts`: the `?install-store=1` one-tap Store install and its
  button are removed (a sourceless install cannot work without a hardcoded
  source, which the spec forbids); the not-installed fallback now points at
  the agent recipe path. Consequential change, flagged: the spec's task list
  did not name this route, but Decision 1 ("a fresh install starts empty...
  no catalog") entails it.
- `catalog/app-store/RECIPE.md`: install step now passes the catalog base.
- `pkg/src/index.ts`: `useWhen` notes for the catalog tools document the base.
- `pkg/.agents/skills/adding-an-app/SKILL.md`: bootstrap sentence corrected
  (fresh shell starts empty, no one-tap browser install) + Store-declares-
  catalog rule.
- `scripts/catalog.ts`: install/list accept an optional `base` (tooling only).
- `tests/store-harness.ts`: existing catalog calls pass an explicit base;
  new 2.1 block (pin-absence scan, base validation, declared-base fetch,
  refusals, no-source error, explicit install, installed-only management,
  per-base cache entries, Store display label, Store install via declared base).

## What was verified (tasks 2.1-2.3)

- 2.1 harness (fresh in-process servers, override cleared where noted):
  no `CATALOG_REPO`/`CATALOG_RELEASE`/`catalogReleaseLabel` in `pkg/src`;
  HTTPS and loopback bases validate, plain-http refused; declared-base fetch
  returns all 18 apps; non-HTTPS base fetches nothing; explicit bad-base
  install refused with nothing written; no-base + no-Store refused with
  `install_from_catalog: no catalog source for "counter" (...)` and nothing
  written; explicit base installs; management from an app with no `catalog`
  entry shows its installed app only with a no-source note; stopped base
  falls back to its own cache entry while a second base reads fresh;
  `manage_rows` reports the read source and `manage_install` installs through
  the declared base. ALL STORE CHECKS PASSED; catalog harness passes (18 apps);
  app-store jsdom bundle checks pass.
- 2.2 `kody execute --target mock` (server stopped): no-base install refused
  with the no-source error text; explicit loopback-base fetch blocked by
  platform policy (`[unmocked_request] Blocked private/local fetch under
  --target mock`), so the explicit/declared-base fetch path is substituted by
  the harness local-server checks above (same fetch code, in-process).
  No live-browser navigation was performed (recorded as substituted).
- 2.3: ES2019 scan clean; `bun build pkg/src/app.ts` succeeds.

## Deviation / substitution log

- `?install-store=1` route + button removed (see above); spec wins over the
  prompt's task list here.
- `normalizeCatalogBase`/`devOverrideBase` are new exported helpers; the spec
  said to read via `getPackageMeta()`-style flow nowhere here — no deviation:
  base plumbing only.
- `catalogLabelForBase` derives the display label from the base with no
  hardcoded host (strictest reading of "no base URL constant").
- Mock-store note: verification removed then restored `counter` (initial
  state) and re-installed `app-store` from the working tree (state preserved,
  definition now carries the `catalog` entry). Pre-existing mock apps
  (calendar, clock, hoodie-weather, news, xkcd, settings) untouched.
- A new change `store-latest-schema-floor` appeared in `validate --changes`
  during this handoff (not mine; passes).

## Live-store state

No behavior to observe live: the default Store still reads the same catalog
URL (now declared, not pinned); rows, statuses, and controls are unchanged.
