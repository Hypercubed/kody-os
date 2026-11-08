# app-registry

## ADDED Requirements

### Requirement: Gated installed rows keep Remove

A Store row for an **installed** app whose catalog entry fails an install gate (`minPackageVersion` newer than the running shell, or `schemaVersion` below `MIN_SUPPORTED_SCHEMA_VERSION`) SHALL show the requirement note instead of an Install/Update control, and SHALL keep its Remove control. Removal does not depend on the catalog (it deletes the installed definition, state, snapshot, and references), so there is no reason to gate it. `safeUpdatable()` / Update All SHALL still skip gated rows (Remove is not an update).

#### Scenario: Gated installed row shows the requirement and Remove

- **WHEN** an installed app's catalog entry raises `minPackageVersion` above the running shell version (so the update path refuses)
- **THEN** its Store row shows the "Requires shell v<min> (running v<run>)" note **and** a Remove control, and no Install or Update control, and Update All skips it.

#### Scenario: Removing a gated installed app works

- **WHEN** the user activates Remove on a gated installed row
- **THEN** the app is removed (definition, state, snapshot, and references deleted) exactly as for an up-to-date row.

### Requirement: Agent update accepts a catalog base

Agent `update_from_catalog` SHALL accept the same optional `catalogBase` parameter as `install_from_catalog` / `store_install_from_catalog`, resolved the same way (`resolveAgentCatalogBase`: explicit base > dev override > installed Store's declared base). With no Store installed and no base given (and no override set), it SHALL refuse with the no-source error naming that no catalog source was given, writing nothing. `pkg/scripts/catalog.ts` `update` SHALL forward its `base` input as `catalogBase` the same way `install` does (or the `base` field SHALL be dropped from the `update` Input variant — it SHALL NOT be declared and ignored).

#### Scenario: Update with an explicit base and no Store installed

- **WHEN** an agent calls `update_from_catalog` with an explicit `catalogBase` and no App Store is installed
- **THEN** the update proceeds from that base (it does not refuse with "no catalog source").

#### Scenario: Script update forwards its base

- **WHEN** `pkg/scripts/catalog.ts` `update` is called with a `base`
- **THEN** the update runs from that base (the base is not silently ignored).

### Requirement: Catalog-fetch failures carry a typed error

`get_catalog_definition` / `get_catalog_entry` / `get_catalog_recipe` SHALL distinguish at least three failure kinds instead of collapsing every failure to `null`: **refused base** (the base failed validation), **fetch failed** (manifest/definition/recipe fetch or validation failed), and **unknown id** (the manifest has no such entry). The registry SHALL surface the right error in install/update/status: a refused base names the base problem; a fetch failure names the catalog as unreachable (and is retryable); only a genuinely absent id says "unknown catalog app". `get_app_status` SHALL distinguish a transient catalog failure (the catalog is reported as unreachable, not `storage-only`) from a genuinely absent catalog entry.

#### Scenario: Refused base, failed fetch, and unknown id are distinct

- **WHEN** an install is attempted with a refused base, with a manifest fetch that fails, and with an unknown id
- **THEN** the three attempts return three distinct errors (base problem, catalog unreachable, unknown catalog app), not the same "unknown catalog app" for all three.

#### Scenario: Transient catalog failure does not report storage-only

- **WHEN** the manifest fetch fails transiently for an installed catalog app
- **THEN** `get_app_status` reports the catalog as unreachable (not `inCatalog: false` / `storage-only`), and `manage_update` does not refuse with "not an installed catalog app".

### Requirement: Fetched definition is verified against its manifest fingerprint

`get_catalog_definition` (or the install path) SHALL compare `fingerprintDefinition(def)` to the manifest entry's `fingerprint` and refuse on mismatch, with an error naming the app and that the fetched definition does not match the manifest. The check SHALL run before any write. The fetched bundle files SHALL also be cross-checked against the manifest entry's `bundleFiles` whitelist (the definition's own `bundle.files` list is not trusted alone). Installs remain backstopped by `validateBundleManifest`.

#### Scenario: Fingerprint mismatch is refused

- **WHEN** a fetched definition's fingerprint does not match its manifest entry's fingerprint
- **THEN** the install is refused naming the app and the mismatch, writing nothing.

### Requirement: Fetch caps abort on timeout and enforce on bytes

The catalog fetch SHALL abort on timeout (`AbortController`), and the size cap SHALL be enforced on streamed bytes (or at least on `TextEncoder` byte length / `Content-Length`), not after a full download measured in UTF-16 code units (`body.length`). Cap values are unchanged (8000 ms; 64 KiB manifest / 512 KiB definition / 256 KiB bundle file / 64 KiB recipe).

#### Scenario: Slow fetch is aborted

- **WHEN** a catalog fetch exceeds the 8000 ms timeout
- **THEN** the fetch is aborted (the underlying download stops), not merely out-raced.

#### Scenario: Non-ASCII body over the byte cap is refused

- **WHEN** a fetched body exceeds its cap in bytes (even if its UTF-16 code-unit length is within the cap)
- **THEN** the fetch is refused with the cap error.

### Requirement: `add_app` returns `{ ok: false }` for a null or non-object definition

`add_app` SHALL return `{ ok: false }` (writing nothing) for a null or non-object definition, exactly as `validateDefinition` already does for a non-object (`'definition must be an object'`). The schema-floor gate SHALL NOT dereference `definition.schemaVersion` before that check, and the floor-gate error SHALL name the app id only when a valid id is present.

#### Scenario: `add_app(null)` returns `{ ok: false }`

- **WHEN** `add_app(null)` is called
- **THEN** it returns `{ ok: false }` and writes nothing (it does not throw a `TypeError`).

### Requirement: No-source refusal precedes the status check in `manage_update_with_status`

In `manage_update_with_status`, the no-source refusal (no catalog source was given) SHALL be checked **before** calling `get_app_status`, so a caller with no catalog source gets the no-source error, not "not an installed catalog app".

#### Scenario: Update with no catalog source returns the no-source error

- **WHEN** `manage_update_with_status` is called with no catalog source
- **THEN** it returns the no-source error naming that no catalog source was given (not "not an installed catalog app").

### Requirement: `MIN_SUPPORTED_SCHEMA_VERSION` is derived from `SUPPORTED_SCHEMA_VERSIONS`

`MIN_SUPPORTED_SCHEMA_VERSION` SHALL be derived from `SUPPORTED_SCHEMA_VERSIONS` (for example `Math.min.apply(null, SUPPORTED_SCHEMA_VERSIONS)`), or the list SHALL be defined from the constant. There SHALL be one source of truth; the value is 3 today.

#### Scenario: The floor follows the list

- **WHEN** `SUPPORTED_SCHEMA_VERSIONS` changes (for example the minimum is raised)
- **THEN** `MIN_SUPPORTED_SCHEMA_VERSION` follows it (the two cannot diverge).
