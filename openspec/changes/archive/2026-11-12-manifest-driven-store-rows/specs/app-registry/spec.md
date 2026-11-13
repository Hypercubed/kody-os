# app-registry — delta

## MODIFIED Requirements

### Requirement: Shipped catalog

The Store's catalog SHALL be the manifest
(`catalog/catalog.json`) and definitions fetched
server-side from a catalog source declared by the
calling Store, not from definitions shipped in `pkg/`,
and not from a catalog source hardcoded in the shell.
The shell SHALL hold no catalog source of its own: no
repo, release, or base URL is a constant in the shell
source. The Store SHALL display the declared catalog
source it is reading. The manifest's `installMode`
SHALL drive the Store row: a `recipe-only` row shows
the agent prompt instead of one-tap install. Fetching
SHALL be HTTPS-only with an 8,000 ms timeout; the
definition fetch SHALL allow at least 256 KiB;
definition and recipe paths SHALL come from the
manifest entry only, never from a request parameter.
Install snapshots SHALL continue to record
install-time `catalogVersion` plus a content-only
fingerprint, and Store status classification SHALL
continue to compare installed definitions and
snapshots against the remote definitions with no
change to the status set or its rules. If the catalog
manifest fetch fails, the Store SHALL show installed
apps with their known status plus an honest catalog
error with retry, and SHALL NOT show a blank Store;
any cached manifest used as fallback SHALL be labeled
as cached with its source. `list_catalog` and
`get_catalog_definition` are async (the remote fetch
is necessarily async); MCP catalog tools keep their
shapes.

**Amendment (manifest-driven-store-rows):** the Store
listing SHALL be built from the manifest alone.
`list_catalog` SHALL build each `CatalogSummary` from
its manifest entry with no definition fetch; Store rows
and the Store self-update check SHALL read
`minPackageVersion`, `schemaVersion`, and the
capabilities summary from the manifest entry, never
from a fetched definition. `CatalogSummary` gains one
additive field, `capabilities` (the manifest entry's
capabilities summary); MCP `list_catalog` responses
carry it, and no other MCP shape changes. Definitions SHALL be fetched
only by `get_catalog_definition` (install, update,
restore, absorb — definition plus bundle files) and by
`get_catalog_definition_meta` (single-app agent reads).
The manifest `capabilities` summary is display-only:
the update-confirmation gate SHALL still compare full
definitions fetched by `get_catalog_definition`. A
manifest entry missing a required display field SHALL
fail validation like one missing `bundleFiles` today,
and the Store SHALL fall back to installed apps plus
a catalog error. Old shells SHALL keep listing from an
enriched manifest, ignoring the new fields and
fetching definitions as before.

#### Scenario: Store open fetches manifests only
- **WHEN** the Store loads its rows
- **THEN** it performs 2 outbound fetches (the listing
  manifest and the discovery manifest) and 0
  definition fetches, and the rows render with names,
  icons, categories, descriptions, version gates, and
  capability disclosures identical to before.

#### Scenario: Old shell ignores the new fields
- **WHEN** a shell from before this change reads an
  enriched manifest
- **THEN** it lists the same apps, ignores the new
  entry fields, and fetches definitions per row as
  before — no line advance, tag freeze, or Store
  update is needed to ship the enriched manifest.

#### Scenario: Manifest missing a display field fails
- **WHEN** a manifest entry lacks a required display
  field (`name`, `icon`, `category`, `description`,
  `schemaVersion`, or `capabilities`)
- **THEN** manifest validation fails and the rows call
  falls back to a cached manifest when one exists
  (rows render, labeled cached); with no cached
  manifest the rows call rejects, the Store page shows
  its error state with Retry, and installed apps remain
  visible on Home — the shell is never blank.

### Requirement: Catalog index

The repo SHALL carry a generated catalog index at
`catalog/catalog.json`, listing every catalog app
sorted by id. Each entry SHALL carry: id, label,
catalogVersion, fingerprint, installMode,
definitionPath, recipePath, bundleFiles (the bundle
file paths, sorted, relative to the app directory).
definitionPath and recipePath are relative to
`catalog/` (for example `app-store/definition.json`,
`app-store/RECIPE.md`). The index SHALL be generated
by `scripts/build-catalog-index.ts` from the app
directories, never hand-written; the generator SHALL
assemble each definition's bundle files from disk
before fingerprinting (failing on a missing or
unresolvable bundle file), compute each fingerprint
with the existing `fingerprintDefinition`, and SHALL
read installMode from the definition (absent means
`json`). Regenerating the index from unchanged
definitions SHALL produce byte-identical output. The
catalog harness SHALL fail if the index does not match
the directories and the definitions (ids, alphabetical
order, catalogVersions, fingerprints, install modes,
bundle files).

**Amendment (manifest-driven-store-rows):** each entry
SHALL also carry `name`, `icon`, `category`,
`description`, `schemaVersion`, and `capabilities`
(the `summarizeCapabilities` shape: `manageApps`,
`feedHosts`, `proxyHosts`, `themeView`, `themeSet`,
computed by the generator with the existing
`summarizeCapabilities`), plus `minPackageVersion`
when the definition carries one (omitted otherwise).
The generator SHALL copy these fields from the
definition it already reads; the fingerprint SHALL
still hash the assembled definition only, so enriching
the index changes no fingerprint and no installed
app's status, and no definition change (and therefore
no `catalogVersion` bump) is needed to enrich the
index. The catalog harness SHALL fail if the new
fields do not match the definitions.

#### Scenario: Index carries the display fields
- **WHEN** the generator runs over the app directories
- **THEN** `catalog/catalog.json` has one entry per app
  directory, sorted by id, each with id, label,
  catalogVersion, fingerprint, installMode,
  definitionPath, recipePath, bundleFiles, name, icon,
  category, description, schemaVersion, capabilities,
  and `minPackageVersion` exactly when its definition
  carries one.

#### Scenario: Generator is idempotent
- **WHEN** the generator runs twice over unchanged
  definitions
- **THEN** both outputs are byte-identical.

#### Scenario: Harness fails on a mismatched display field
- **WHEN** an index entry's `description` (or any
  other new field) does not match its definition
- **THEN** the catalog harness fails.
