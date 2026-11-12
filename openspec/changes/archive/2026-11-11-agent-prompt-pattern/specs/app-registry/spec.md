# app-registry

## MODIFIED Requirements

### Requirement: Store row agent-prompt details

Every App Store row SHALL carry a copyable agent prompt for the action that row is about, inside a collapsed `<details class="store-details">` element at the bottom of the row's description (after badge, description, and capabilities), holding a `<summary>` naming the action and a `<code>` element with the prompt text. The prompt SHALL be plain selectable text, set via `textContent` (never `innerHTML` for text built from a row id or label), with no copy button and no Clipboard API use. The one-tap buttons stay as they are; the details element is an additional path, never a replacement.

The prompt is a one-liner naming the operations file and the app's catalog folder; the procedure lives in the file, not in the prompt. With `<ops>` the reference `Read package:<slug>#OPERATIONS.md` (the slug derived at render time from the running package's own mount, falling back to `kody-os`) and `<folder>` the row's `folderUrl`, the prompt per row status SHALL be:

- Not installed: `Read <ops>, then install this app: <folder>`.
- Behind-clean or catalog-differing: `Read <ops>, then update this app to the latest catalog version: <folder>`.
- Behind-modified, modified-current, or absorbed-behind: `Read <ops>, then absorb the catalog changes into this app, keeping my local customizations: <folder>` (see "Absorb a modified catalog app").
- Modified-ahead: `Read <ops>, then restore this app to the catalog copy: <folder>`.
- Snapshot-less: `Read <ops>, then overwrite this app with the catalog copy: <folder>`.
- Up-to-date or absorbed: `Read <ops>, then remove this app: <folder>`.

No prompt SHALL name a label, an id, or an MCP call. A row without a `folderUrl` (no catalog entry) SHALL show no Install details.

No details element SHALL appear on a row blocked by a requirement (`needsNewerShell` / `needsNewerSchema`, which show the requirement instead of any control) or on a `storage-only` / `storage-only-formerly` row. A not-installed `recipe-only` row SHALL show the Install details like any other not-installed row (the recipe prompt is the Install one-liner; the controls span explaining that there is no Add button stays).


#### Scenario: Not-installed row shows the install one-liner

- **WHEN** a Store row is not installed
- **THEN** the row offers one-tap Add (or, when `recipe-only`, the recipe span in place of Add) and also shows a collapsed details element whose prompt is `Read package:<slug>#OPERATIONS.md, then install this app: <folder>`, with no label, id, or MCP call named.

#### Scenario: Behind-clean row shows the update one-liner

- **WHEN** a Store row is behind-clean
- **THEN** the row offers Update and also shows a collapsed details element whose prompt is the update one-liner, with no MCP call named.

#### Scenario: Behind-modified row shows the absorb one-liner, not an overwrite prompt

- **WHEN** a Store row is behind-modified
- **THEN** the row offers confirmed Overwrite and shows a collapsed details element whose prompt is the absorb one-liner, and shows no overwrite prompt.

#### Scenario: Up-to-date row shows the remove one-liner

- **WHEN** a Store row is up-to-date
- **THEN** the row offers Remove and also shows a collapsed details element whose prompt is `Read package:<slug>#OPERATIONS.md, then remove this app: <folder>`.

#### Scenario: Requirement-blocked row shows no details element

- **WHEN** a Store row needs a newer shell or schema
- **THEN** the row shows the requirement instead of any control and shows no details element.

#### Scenario: Recipe-only not-installed row shows the Install details

- **WHEN** a Store row is not installed and its `installMode` is `recipe-only`
- **THEN** the row shows the recipe span in place of Add and also shows a collapsed details element with the Install one-liner.

#### Scenario: Prompt is selectable text, no copy button, no Clipboard API

- **WHEN** a Store row renders its details prompt
- **THEN** the prompt is selectable text in a `<code>` element, the row has no copy button for it, and the bundle uses no Clipboard API for it.


### Requirement: Absorb a modified catalog app

An installed catalog app modified in both places (its installed definition differs from its snapshot, and the catalog has moved) SHALL be absorbable by an agent: the agent merges the catalog changes into the installed definition, keeping the user's local customizations, and finishes with the new MCP export `absorb_from_catalog`. The absorb is a two-way merge — the stored snapshot holds only a fingerprint, never the base definition, so there is no base to diff against — and the agent SHALL work from the installed definition (`export_app`) and the catalog definition (`get_catalog_definition`), following the procedure in `pkg/OPERATIONS.md` (backup first, field-by-field compare, merge plan, ask before writing, verify by re-exporting). The prompt itself SHALL be the Absorb one-liner; the procedure SHALL NOT be inlined in the prompt.

`absorb_from_catalog(id, definition, catalogBase?)` SHALL validate the agent-supplied merged definition through the `add_app` path, write it through `add_app` (state preserved by the existing rule; pins, hidden flags, homepage placement, and recency untouched), and record a new install snapshot at the catalog version carrying the catalog fingerprint absorbed from. It SHALL refuse with no write unless the app is installed, is in the catalog, and its status is `behind-modified`, `modified-current`, or `absorbed-behind`, and unless the merged definition's `catalogVersion` equals the catalog's. It SHALL resolve the catalog base the same way `install_from_catalog` does, and refuse with a no-source error when no catalog source exists. It SHALL be an MCP export (name + `useWhen` in the package export list).

After a successful absorb the row SHALL read `absorbed`, never still-modified and never `catalog-differing`, and a plain Update SHALL never be offered for it. A later catalog change SHALL move the row to `absorbed-behind`, where Absorb is offered again (or a confirmed Overwrite), never a plain Update.


#### Scenario: Behind-modified app absorbs and reads absorbed

- **WHEN** an agent merges a behind-modified app's installed definition with its catalog definition, keeping a local field change and taking a catalog field change, and calls `absorb_from_catalog` with the merged definition at the catalog version
- **THEN** the stored definition is the merged one, state is preserved for surviving fields, the snapshot records the catalog version and the merged fingerprint, and the row reads `absorbed` with Remove as its only control.

#### Scenario: Absorb refuses a non-absorbable status

- **WHEN** `absorb_from_catalog` is called for an up-to-date app
- **THEN** it returns `{ ok: false }` naming the status and writes nothing.

#### Scenario: Absorb refuses a mismatched catalog version

- **WHEN** `absorb_from_catalog` is called with a merged definition whose `catalogVersion` is not the catalog's
- **THEN** it returns `{ ok: false }` and writes nothing.

#### Scenario: Absorbed app is not offered an update

- **WHEN** an absorbed app's row renders
- **THEN** it offers Remove only, and Update All skips it.

#### Scenario: Catalog moves after absorb

- **WHEN** the catalog changes after absorb
- **THEN** the row reads `absorbed-behind`, offers Absorb again (and a confirmed Overwrite), and never offers a plain Update.

#### Scenario: Absorb asks before writing

- **WHEN** the absorb one-liner is followed
- **THEN** the agent takes a backup first, shows the merge plan, and asks the user before writing anything, and asks which value to keep for any field in conflict, per `pkg/OPERATIONS.md`.


### Requirement: Store row folder URL

`StoreRow` SHALL carry `folderUrl?: string`: the full URL of the app's catalog folder in GitHub tree form (`https://github.com/<owner>/<repo>/tree/<ref>/catalog/<id>`), set when the row came from a catalog entry. `CatalogSummary` SHALL carry `recipePath: string`, the manifest-relative recipe path (for example `app-store/RECIPE.md`); the manifest SHALL require it (a missing or unsafe `recipePath` drops the entry). `folderUrlForBase(base, id)` SHALL derive the folder URL from the resolved catalog base the same way `recipeUrlForBase` derives the recipe URL: a GitHub raw base converts to the tree form with the same ref (a pinned tag lands in it instead of `main`); any other base yields `base + id + '/'`. `buildStoreRows` SHALL set `folderUrl: catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) : undefined`. `recipeUrlForBase` SHALL keep its exact behavior. The previous `StoreRow.recipeUrl` field is removed; it was never documented in this spec.

#### Scenario: Row carries the folder URL

- **WHEN** a Store row is built from a catalog entry resolved against a GitHub raw base
- **THEN** its `folderUrl` is the tree URL for that app's folder at the base's ref.

#### Scenario: Pinned tag lands in the folder URL

- **WHEN** a Store row is built against a catalog base pinned to a tag
- **THEN** its `folderUrl` names that tag, not `main`.

#### Scenario: Non-GitHub base yields the base folder path

- **WHEN** a Store row is built against a loopback base
- **THEN** its `folderUrl` is the base plus the app id plus a trailing slash.
