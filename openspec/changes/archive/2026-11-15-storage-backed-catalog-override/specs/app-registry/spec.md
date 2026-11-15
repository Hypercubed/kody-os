## MODIFIED Requirements

### Requirement: Catalog source is declared by the caller

The catalog fetch functions SHALL take the catalog base URL as a
parameter: the base URL of the catalog directory (the directory
containing `catalog.json`). The manifest SHALL be fetched at
`<base>catalog.json`, a definition at `<base><id>/definition.json`,
a bundle file at `<base><id>/<file>`, and a recipe at
`<base><id>/RECIPE.md`. The base SHALL be validated on every use:
HTTPS-only, or loopback `http` for local dev (the override below,
kept as-is). A non-HTTPS, non-loopback base SHALL be
refused before any fetch. The in-memory manifest cache SHALL be
keyed by base, so different callers with different catalogs do not
share a cache entry. `get_catalog_source` SHALL take the base and
report it (plus a label derived from it) for the Store display.

Base precedence SHALL be: an explicitly passed base wins; else the
dev override when set; else the installed Store's declared base for
agent calls (listing base for apps, discovery base for the Store
itself) and the acting Store's declared bases for the browser
management API (which takes no explicit base). The dev override has
two sources, consulted in order: the `KODY_CATALOG_BASE` environment
/ `globalThis` read (kept as-is; unreachable inside mock workerd,
still honored in harnesses and any host that propagates it), then a
durable stored override under the key `kody-os.dev.catalogBase` in
`packageStorage()`. A missing, corrupt, or refused stored value
SHALL read as no override. The resolved base SHALL be passed on
explicitly and used as-is, never re-overridden at fetch time.

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

#### Scenario: Explicit base wins over the stored override
- **WHEN** an agent install supplies a `catalogBase` while a stored
  override is set
- **THEN** the fetch uses the supplied base, not the stored one.

#### Scenario: Stored override beats the Store declaration
- **WHEN** no explicit base is supplied and a valid stored override
  is set while an App Store declaring a different base is installed
- **THEN** the fetch uses the stored override for both agent calls
  and the browser management API.

#### Scenario: Corrupt stored override is ignored
- **WHEN** the stored value is missing, not a string, or fails base
  validation
- **THEN** resolution proceeds as if no override were set.

## ADDED Requirements

### Requirement: Stored catalog override is dev data, never install data

The stored catalog override SHALL live under exactly one key,
`kody-os.dev.catalogBase`, holding a bare base URL string. It SHALL
NOT be part of any install payload: `export_install` SHALL NOT
include it, `import_install` SHALL NOT read it, `backup` SHALL NOT
capture it, and `restore` SHALL neither wipe it (it is not an
install key) nor restore it (backups never hold it). A stored value
SHALL survive `restore` unchanged.

#### Scenario: Override survives restore
- **WHEN** a stored override is set and a backup is restored
- **THEN** the override still holds its previous value afterwards.

#### Scenario: Override is not backed up
- **WHEN** an install with a stored override set is backed up and
  the backup entry is inspected
- **THEN** the backup holds no `kody-os.dev.catalogBase` key.

### Requirement: Stored catalog override has an agent set/clear path

An agent SHALL be able to set the stored catalog override to a base
URL (validated with the same base allowlist; a refused base writes
nothing and reports the refusal) and to clear it. There SHALL be no
browser one-tap control for it: the Store page and Apps Edit SHALL
NOT offer to set or clear the override.

#### Scenario: Valid base is stored
- **WHEN** an agent sets the override to a loopback `http` base
- **THEN** subsequent catalog fetches with no explicit base use it.

#### Scenario: Refused base writes nothing
- **WHEN** an agent sets the override to a non-HTTPS,
  non-loopback base
- **THEN** the call reports the refusal and the stored value is
  unchanged.

#### Scenario: Clear restores Store-declared behavior
- **WHEN** an agent clears a set override
- **THEN** subsequent catalog fetches resolve from the installed
  Store's declared base (or refuse with no catalog source when no
  Store is installed).
