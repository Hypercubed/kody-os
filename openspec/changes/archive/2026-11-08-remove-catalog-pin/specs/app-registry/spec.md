# app-registry Specification Delta

## MODIFIED Requirements

### Requirement: Shipped catalog

The Store's catalog SHALL be the manifest (`catalog/catalog.json`)
and definitions fetched server-side from a catalog source declared
by the calling Store, not from definitions shipped in `pkg/`, not
from `main` HEAD by default, and not from a catalog source hardcoded
in the shell. The shell SHALL hold no catalog source of its own: no
repo, release, or base URL is a constant in the shell source. The
Store SHALL display the declared catalog source it is reading. The
manifest's `installMode` SHALL drive the Store row: a `recipe-only`
row shows the agent prompt instead of one-tap install. Fetching
SHALL be HTTPS-only with an 8,000 ms timeout; the definition fetch
SHALL allow at least 256 KiB; definition and recipe paths SHALL come
from the manifest entry only, never from a request parameter.
Install snapshots SHALL continue to record install-time
`catalogVersion` plus a content-only fingerprint, and Store status
classification SHALL continue to compare installed definitions and
snapshots against the remote definitions with no change to the status
set or its rules. If the catalog manifest fetch fails, the Store
SHALL show installed apps with their known status plus an honest
catalog error with retry, and SHALL NOT show a blank Store; any
cached manifest used as fallback SHALL be labeled as cached with its
source. `list_catalog` and `get_catalog_definition` are async (the
remote fetch is necessarily async); MCP catalog tools keep their
shapes.

#### Scenario: Declared catalog source is used
- **WHEN** the calling Store declares a catalog base of
  `https://raw.githubusercontent.com/Hypercubed/kody-os/v4.1.0/catalog/`
- **THEN** the manifest and definitions are fetched from under that
  base.

#### Scenario: No hardcoded catalog source
- **WHEN** the shell source is searched for a catalog repo, release,
  or base URL constant
- **THEN** none is found.

#### Scenario: Every catalog file validates and installs
- **WHEN** each `definition.json` in `catalog/<id>/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** an app directory exists in `catalog/` with no manifest entry
- **THEN** the App Store listing omits it and the catalog harness fails.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in manifest order (alphabetical by id).

#### Scenario: On-disk layout
- **WHEN** an agent opens a catalog app directory
- **THEN** it holds `definition.json`, `RECIPE.md`, and `index.html`.

#### Scenario: Assembled definition installs
- **WHEN** a catalog definition with on-disk bundle files is submitted to `add_app` in a blank store
- **THEN** it returns `{ ok: true, id }` and the bundle renders with its referenced files inlined.

## ADDED Requirements

### Requirement: Catalog source is declared by the caller

The catalog fetch functions SHALL take the catalog base URL as a
parameter: the base URL of the catalog directory (the directory
containing `catalog.json`). The manifest SHALL be fetched at
`<base>catalog.json`, a definition at `<base><id>/definition.json`,
a bundle file at `<base><id>/<file>`, and a recipe at
`<base><id>/RECIPE.md`. The base SHALL be validated on every use:
HTTPS-only, or loopback `http` for local dev (the `KODY_CATALOG_BASE`
override, kept as-is). A non-HTTPS, non-loopback base SHALL be
refused before any fetch. The in-memory manifest cache SHALL be
keyed by base, so different callers with different catalogs do not
share a cache entry. `get_catalog_source` SHALL take the base and
report it (plus a label derived from it) for the Store display.

#### Scenario: Base parameter drives the fetch
- **WHEN** the catalog is fetched with base
  `https://example.com/catalog/`
- **THEN** the manifest is requested at
  `https://example.com/catalog/catalog.json`.

#### Scenario: Non-HTTPS base is refused
- **WHEN** the catalog is fetched with base
  `http://example.com/catalog/`
- **THEN** the fetch is refused before any network request.

#### Scenario: Cache is keyed by base
- **WHEN** two different bases are fetched
- **THEN** each has its own manifest cache entry.

### Requirement: Agent install supplies its catalog source

`install_from_catalog` SHALL accept an optional `catalogBase`
parameter. When the agent supplies it, that base SHALL be used.
When omitted, the registry SHALL use the installed App Store's
declared base if an App Store is installed. When neither a parameter
nor an installed Store base exists, the call SHALL be refused with a
clear error naming that no catalog source was given, and nothing
SHALL be written. The refusal SHALL name the app id.

#### Scenario: Explicit base is used
- **WHEN** `install_from_catalog` is called with a `catalogBase`
  pointing at a catalog containing the app
- **THEN** the app installs from that catalog.

#### Scenario: No source is refused
- **WHEN** `install_from_catalog` is called with no `catalogBase`
  and no App Store is installed
- **THEN** it returns `{ ok: false }` with an error naming that no
  catalog source was given, and nothing is written.
