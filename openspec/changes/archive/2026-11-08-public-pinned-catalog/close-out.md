# Close-out: public-pinned-catalog

Archived 2026-11-08. The pin this change was designed around was superseded
and removed by `remove-catalog-pin` (archived
`2026-11-08-remove-catalog-pin`); this change is archived as superseded in
its pin model, with its implementation delivered by the coordinated handoffs
below and its real-release verification satisfied in substance by the live
v4.1.1 check. Nothing was committed, pushed, or published by this archive
itself. The `design.md` and `specs/app-registry/spec.md` in this archive
still describe the pin model — do not rewrite them; this note is the record
that the pin was superseded.

## What changed (and where it actually landed)

- **Remote catalog (handoff 09).** `pkg/src/apps/remote-catalog.ts` added:
  manifest + definition fetch (HTTPS-only, 8,000 ms timeout, 64 KiB
  manifest / 512 KiB definition / 256 KiB bundle-file caps), manifest
  validation, cached fallback. Registry rewired to async remote;
  `manage_rows` returns rows + catalog release/cached/error; Store shows
  the catalog source, a catalog error + Retry, and the recipe-only prompt.
  Initially pinned to `Hypercubed/kody-os@v4.1.0`; the pin was then removed
  (see below).
- **Pin removal (handoff 11, `remove-catalog-pin`).** The pin constants
  (`CATALOG_REPO`, `CATALOG_RELEASE`, `catalogReleaseLabel()`) were deleted.
  All fetch functions take the catalog base as a parameter (validated per
  use — HTTPS or loopback). The Store declares its base as a
  `capabilities.proxy` entry named `catalog`; the shell holds no catalog
  source. `install_from_catalog` / `store_install_from_catalog` accept an
  optional `catalogBase`, else the installed Store's declared base, else
  refuse with the no-source error. The `?install-store=1` one-tap path was
  removed (installing the Store is agent-only now).
- **Store base to `main` + schema floor (handoff 12,
  `store-latest-schema-floor`).** The Store's declared base tracks the
  latest commit (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`),
  gated by `minPackageVersion`; `MIN_SUPPORTED_SCHEMA_VERSION` (= 3, the
  minimum of `SUPPORTED_SCHEMA_VERSIONS`) is enforced in `add_app` as a
  second install gate alongside `minPackageVersion`.
- **App-entry MCP re-export (v4.1.1, GitHub main `04243f8`).** Kody
  execute resolves a `kody:` import to the app entry (`pkg/src/app.ts`),
  not the ESM `exports` entry (`pkg/src/index.ts`), so named imports of
  the MCP functions failed with "No matching export" on v4.1.0/v4.1.1
  (the import had worked on Oct 25). `app.ts` now re-exports the MCP
  surface (34 functions) from its source module (`pkg/src/apps/index.ts`,
  avoiding the `index.ts` -> `app.ts` `getTheme` cycle). This is what
  made the live install below work. Published as v4.1.1 build 36
  (Artifacts `ab3b5c41`, published 2026-11-08T05:23Z; package still
  private).

## Task status (tasks.md boxes left as they are — see note)

The `tasks.md` checkboxes in this archive are left unchecked. The pin tasks
(1.1, 1.2, the pin parts of 1.3, 2.2's "rolling the pin back") were
superseded, not completed literally, so marking them done would be
dishonest; this close-out carries the status instead.

- **1.1 / 1.3 (remote catalog module, registry rewire):** Done in
  substance by handoff 09 (remote fetch, manifest validation, on-demand
  definition/recipe by manifest path only, HTTPS-only, 8s timeout, per-
  payload caps, no request-parameter paths), with the pin removed by
  handoff 11.
- **1.2 (pin in one named constant):** Superseded — the pin constant was
  deleted by handoff 11. The Store's catalog source is now its declared
  `catalog` proxy entry, not a constant in the shell.
- **2.1 (failure degradation):** Done (handoff 09 + handoff 13 C3):
  failed manifest fetch shows installed apps plus an honest catalog error
  with retry, never a blank Store; a cached manifest is labeled as cached
  with its source (30s TTL-fresh, age labeled).
- **2.2 (kody dev local override):** Done in substance — the loopback
  `KODY_CATALOG_BASE` override is verified via the mock and
  `scripts/dev-local-catalog.sh` (serves `catalog/` on 127.0.0.1:8901).
  "Rolling the pin back" is moot (no pin).
- **3.1 (real-release verification):** Satisfied in substance by the live
  v4.1.1 check (see below). The full Store-UI round-trip was NOT run live
  (see "Left open").
- **3.2 (release-cutting procedure in `catalog/README.md`):** Done. The
  procedure (regenerate manifest, run the catalog harness, commit, tag,
  publish; Store reads from `main`, tag is the first catalog-release
  snapshot) is documented at `catalog/README.md:59`.
- **3.3 (sync canonical specs):** Done. The canonical `app-registry`
  spec ("The Store's catalog SHALL be ... from a catalog source declared
  by the calling Store ... The shell SHALL hold no catalog source") and
  the canonical `shell` spec ("The Store SHALL display the declared
  catalog source it is reading") already reflect the declared-source
  model (synced by handoffs 09–12). No further sync was needed for this
  archive.

## Verification (live, Nov 8, v4.1.1 build 36)

Against the live published package, via the MCP bridge (cloud execute):

- `install_from_catalog('app-store', undefined,
  'https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/')`
  returned `{ ok: true, id: 'app-store' }` — the manifest and definitions
  fetch from the live `main` catalog base and the install works. This is
  the first live install through the MCP bridge since the v4.1.0 import
  break; it succeeded only because of the v4.1.1 app-entry re-export.
- `list_apps()` returned 18 apps including `app-store` ("App Catalog",
  schemaVersion 5, catalogVersion 18), confirming the installed App
  Catalog matches the live catalog.
- The import check that would have caught the v4.1.0 break is now the
  core of the new `live-integrity-check` spec
  (`openspec/changes/live-integrity-check/`, not yet implemented): a
  namespace import must return the MCP keys, not just `default`.

## Left open

- **Store-UI round-trip (3.1, remainder).** Install / update / restore
  through the App Store UI itself (not the agent `install_from_catalog`
  path), plus snapshots classifying behind / modified correctly against
  the remote definitions, was NOT run against the live instance. This is
  now the browser half of the `live-integrity-check` spec; it remains
  open there and is not closed by this archive.
- **The `v4.1.0` catalog tag** was never cut. The Store reads from
  `main`, so the tag is a snapshot, not a runtime dependency. Cutting it
  remains a separate user decision (it is the first catalog-release
  snapshot named by the release procedure).
- **`catalog-robustness-fixes` (C5–C16)** remains open (implementation
  deferred by the user); C14 (derive `MIN_SUPPORTED_SCHEMA_VERSION`)
  is done. None of C5–C16 breaks a normal install, corrupts state, or
  bypasses either gate.
- **Package visibility:** still private. Making it public remains the
  user's explicit call, gated (per the new `live-integrity-check` spec)
  on the live integrity check passing.

## Version decision

The declared-source model + remote catalog shipped in v4.0.0/v4.1.0; the
app-entry re-export shipped in v4.1.1 build 36. This archive itself is a
specs-only change (no `pkg/` change), so it carries no version bump.
