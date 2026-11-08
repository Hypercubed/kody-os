# Tasks: remove-catalog-pin

## 1. Remove the pin and make the base caller-supplied

- [x] 1.1 `pkg/src/apps/remote-catalog.ts`: delete `CATALOG_REPO` and
  `CATALOG_RELEASE` and `catalogReleaseLabel()`. Change
  `readCatalogManifest`, `list_catalog`, `get_catalog_entry`,
  `get_catalog_definition`, and `get_catalog_recipe` to take the
  catalog base URL as a parameter. Validate the base on every use:
  HTTPS-only, or loopback `http` for dev (the existing
  `KODY_CATALOG_BASE` override, kept as-is). Key the in-memory
  manifest cache by base. Change `get_catalog_source` to take the
  base and report it (plus a label derived from it) for the Store
  display. No catalog source remains hardcoded in the shell. Keep
  the fetch discipline unchanged (8,000 ms timeout, 64 KiB manifest
  / 512 KiB definition / 256 KiB bundle file / 64 KiB recipe caps,
  manifest and entry validation, paths from the manifest entry only).
- [x] 1.2 `catalog/app-store/definition.json`: declare the catalog
  base as a `capabilities.proxy` entry named `catalog` whose `url`
  is the catalog base URL
  (`https://raw.githubusercontent.com/Hypercubed/kody-os/v4.1.0/catalog/`).
  Bump app-store `catalogVersion` 15 -> 16 by the existing rule and
  regenerate `catalog/catalog.json` (18 apps).
- [x] 1.3 `pkg/src/apps/registry.ts`: resolve the catalog base per
  call and pass it to the remote-catalog functions. For the Store's
  management-API calls (`get_store_rows`,
  `store_install_from_catalog`, and the Store listing), read the
  base from the calling app's stored definition (`capabilities.proxy`
  entry named `catalog`); when the calling app declares no `catalog`
  entry, the catalog is unavailable and the Store shows installed
  apps only, never blank. For the agent's `install_from_catalog`,
  accept an optional `catalogBase` parameter: when supplied use it,
  when omitted use the installed App Store's declared base if one is
  installed, and when neither exists refuse with a clear error
  naming that no catalog source was given, writing nothing. The
  Store displays the declared catalog source it is reading (from
  `get_catalog_source`), not a pinned release.

## 2. Verify

- [x] 2.1 Harness checks: no `CATALOG_REPO` / `CATALOG_RELEASE`
  remains in the shell source; a fetch with a declared HTTPS base
  returns the catalog; a non-HTTPS, non-loopback base is refused
  before any fetch; a management-API call from an app with no
  `catalog` entry shows installed-only; `install_from_catalog` with
  an explicit base installs from it; `install_from_catalog` with no
  base and no installed Store refuses with the no-source error and
  writes nothing; two different bases do not share a manifest cache
  entry.
- [x] 2.2 Verify in `kody dev` (mock target): install an app through
  the Store from its declared base and confirm it installs; install
  an app via `install_from_catalog` with an explicit base and
  confirm it installs; call `install_from_catalog` with no base and
  no installed Store and confirm the refusal and its error text;
  confirm the Store row area shows the declared catalog source.
  Substitute only with a recorded reason if a step cannot run as
  written.
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
