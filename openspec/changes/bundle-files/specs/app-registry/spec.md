# app-registry Specification Delta

## ADDED Requirements

### Requirement: Bundle files on disk

A catalog app's bundle files SHALL live on disk as real files in the app directory: `index.html` (required, the entry) plus zero or more `.js` / `.css` files, flat next to `definition.json` and `RECIPE.md`. `definition.json`'s `bundle` SHALL be a manifest `{ entry: "index.html", files: [...] }` listing the file paths; the loader SHALL assemble the runtime files map from disk. The inline form (`files` as a map of contents) SHALL stay valid for `add_app` transport and stored definitions; a definition carrying both forms is an error. The fingerprint SHALL hash the assembled canonical form, unchanged.

#### Scenario: Manifest assembles to the runtime map
- **WHEN** a definition carries a manifest listing `index.html` and `app.js`
- **THEN** the assembled files map holds both contents and validates.

#### Scenario: Inline form still validates
- **WHEN** a definition carries `files` as an inline map of contents
- **THEN** it validates and installs unchanged.

#### Scenario: Both forms is an error
- **WHEN** a definition carries both a file list and a files map
- **THEN** validation rejects it as ambiguous.

#### Scenario: Fingerprint is content-based
- **WHEN** the same bundle content is extracted from inline to on-disk form
- **THEN** the assembled fingerprint is unchanged.

### Requirement: Bundle references resolve by inlining

The entry HTML SHALL reference its JS/CSS files explicitly by relative path (`<script src="app.js">`, `<link rel="stylesheet" href="style.css">`). The loader SHALL inline each referenced file at serve time, so the served document is a single self-contained HTML document. A reference that does not resolve to a manifest file is an error; an unreferenced `.js` / `.css` file is an error; an unreferenced `.html` file other than the entry is ignored. The append fallback (executing unreferenced files) is removed; only referenced assets execute.

#### Scenario: Script reference inlines
- **WHEN** the entry has `<script src="app.js"></script>` and the manifest lists `app.js`
- **THEN** the served document carries the script inline with no `src` attribute.

#### Scenario: Stylesheet reference inlines
- **WHEN** the entry has `<link rel="stylesheet" href="style.css">` and the manifest lists `style.css`
- **THEN** the served document carries the style inline.

#### Scenario: Dangling reference is an error
- **WHEN** the entry references `app.js` and the manifest does not list it
- **THEN** validation rejects the definition.

#### Scenario: Dead file is an error
- **WHEN** the manifest lists `app.js` and the entry does not reference it
- **THEN** validation rejects the definition.

#### Scenario: Unreferenced HTML is ignored
- **WHEN** the manifest lists an extra `.html` file
- **THEN** it is not served and validation passes.

#### Scenario: Absolute URL is rejected
- **WHEN** a reference uses an absolute or external URL
- **THEN** validation rejects the definition.

## MODIFIED Requirements

### Requirement: Shipped catalog

The package SHALL ship a catalog: every `pkg/catalog/<id>/definition.json` file is an app definition the user can install from the browser, and every `pkg/catalog/<id>/` directory also carries a `RECIPE.md` (see App recipe), an `index.html` entry file, and any optional `.js` / `.css` bundle files (see Bundle files on disk). The catalog SHALL be enumerated by an explicit import list in package code (alphabetical by id), not by runtime directory listing; a directory in `pkg/catalog/` without an import entry SHALL NOT be listed. The listing summaries SHALL be driven by the generated index at `pkg/catalog/catalog.json` (see Catalog index); the full definitions SHALL still be statically imported for install; the loader assembles each definition's bundle files from static text imports at bundle time (see Bundle files on disk). Every catalog definition SHALL validate through `validateDefinition` and install through `add_app`, satisfying the bundle manifest shape (entry `index.html`, relative `.html`/`.js`/`.css` only, within the 256 KiB cap) and the 16 MiB storage budget. Catalog definitions are publisher-shipped and trusted like any `add_app` definition: installing one trusts its bundle code, which runs same-origin with session authority.

#### Scenario: Every catalog file validates and installs
- **WHEN** each `definition.json` in `pkg/catalog/<id>/` is submitted to `add_app` in a blank store
- **THEN** each returns `{ ok: true, id }` and appears in `list_apps()`.

#### Scenario: Unimported file is not listed
- **WHEN** an app directory exists in `pkg/catalog/` with no import-list entry
- **THEN** the App Store listing omits it.

#### Scenario: Catalog listing order is deterministic
- **WHEN** the catalog is listed
- **THEN** entries appear in import-list order (alphabetical by id).

#### Scenario: On-disk layout
- **WHEN** an agent opens a catalog app directory
- **THEN** it holds `definition.json`, `RECIPE.md`, and `index.html`.

#### Scenario: Assembled definition installs
- **WHEN** a catalog definition with on-disk bundle files is submitted to `add_app` in a blank store
- **THEN** it returns `{ ok: true, id }` and the bundle renders with its referenced files inlined.

### Requirement: Catalog index

The package SHALL ship a generated catalog index at `pkg/catalog/catalog.json`, listing every catalog app sorted by id. Each entry SHALL carry: id, label, catalogVersion, fingerprint, installMode, definitionPath, recipePath. Each entry SHALL also carry `bundleFiles`: the bundle file paths sorted, relative to the app directory (for example `app-store` carries `["index.html", "store.css", "store.js"]`). definitionPath and recipePath are relative to `pkg/catalog/` (for example `app-store/definition.json`, `app-store/RECIPE.md`). The index SHALL also carry a `collections` section listing collection recipes: each entry SHALL carry id, recipePath, and the apps it installs in order (for example id `starter`, recipePath `collections/starter/RECIPE.md`, apps `["app-store", "help", "about"]`). A collection entry has no definition, fingerprint, or catalogVersion. The index SHALL be generated by `scripts/build-catalog-index.ts` from the app directories, never hand-written; the generator SHALL compute each fingerprint with the existing `fingerprintDefinition` and SHALL read installMode from the definition (absent means `json`). The generator SHALL assemble each definition's bundle files from disk before fingerprinting and SHALL fail on a missing bundle file. Regenerating the index from unchanged definitions SHALL produce byte-identical output. The catalog harness SHALL fail if the index does not match the directories and the definitions (ids, alphabetical order, catalogVersions, fingerprints, install modes, bundle files), or if the `collections` section does not match the collections directories.

#### Scenario: Index lists every app once, sorted
- **WHEN** the generator runs over the app directories
- **THEN** `pkg/catalog/catalog.json` has one entry per app directory, sorted by id, each with id, label, catalogVersion, fingerprint, installMode, definitionPath, and recipePath.

#### Scenario: Generator is idempotent
- **WHEN** the generator runs twice over unchanged definitions
- **THEN** both outputs are byte-identical.

#### Scenario: Stale index fails the harness
- **WHEN** a definition changes without re-running the generator (or an app directory is added without an index entry)
- **THEN** the catalog harness reports the index mismatch and fails.

#### Scenario: Index lists collection recipes
- **WHEN** the generator runs over the collections directories
- **THEN** the index has a `collections` section with one entry per collection, each with id, recipePath, and apps.

#### Scenario: Index records bundle files
- **WHEN** the generator runs over the app directories
- **THEN** each entry carries `bundleFiles` listing the manifest files, sorted.

#### Scenario: Missing bundle file fails generation
- **WHEN** a manifest lists a file that is not on disk
- **THEN** the generator fails and writes no index.

### Requirement: Catalog version

Every catalog definition SHALL carry `catalogVersion`: a positive integer, starting at 1 on that app's first versioned release, incremented by exactly 1 on any change to that app's definition file, never reused, never decreased, and never bumped for an unrelated app or a shell change. `catalogVersion` is distinct from `schemaVersion` (definition format era) and from the shell's package version. A catalog definition without a valid `catalogVersion` SHALL fail catalog validation. The canonical stored definition SHALL preserve `catalogVersion` through `add_app` normalization. Adding `installMode` to a definition SHALL NOT require a `catalogVersion` bump: the field is excluded from the definition fingerprint, so it cannot change any installed app's update status (see Recipe install mode). Extracting bundle files from the inline form to on-disk files SHALL NOT require a `catalogVersion` bump: the assembled canonical definition is byte-identical, so the fingerprint is unchanged and no installed copy is marked as needing an update (see Bundle files on disk).

#### Scenario: Catalog definition carries a version
- **WHEN** a catalog definition is validated
- **THEN** it is rejected if `catalogVersion` is missing, non-integer, or less than 1.

#### Scenario: Installed copy keeps its catalog version
- **WHEN** a catalog app is installed through `add_app`
- **THEN** the stored definition carries the catalog definition's `catalogVersion`.

#### Scenario: Adding installMode needs no version bump
- **WHEN** `"installMode": "recipe-only"` is added to a catalog definition with no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.

#### Scenario: Removing installMode needs no version bump
- **WHEN** `installMode` is removed from a catalog definition with no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.

#### Scenario: Extraction needs no version bump
- **WHEN** a catalog definition's bundle files are extracted from inline to on-disk form with byte-identical contents and no other change
- **THEN** its `catalogVersion` stays the same, its fingerprint is unchanged, and no installed copy is marked as needing an update.
