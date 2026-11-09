# app-registry — delta

## ADDED Requirements

### Requirement: Store row agent-prompt details

Every App Store row SHALL carry a copyable agent prompt for the
action that row is about, inside a collapsed `<details
class="store-details">` element at the bottom of the row's
description (after badge, description, and capabilities), holding
a `<summary>` naming the action and a `<code>` element with the
prompt text. The prompt SHALL be plain selectable text, set via
`textContent` (never `innerHTML` for text built from a row id or
label), with no copy button and no Clipboard API use. The
one-tap buttons stay as they are; the details element is an
additional path, never a replacement.

The prompt per row status SHALL be:

- Not installed, `installMode` `json`: an install prompt naming
  the app and `install_from_catalog`.
- Behind-clean or catalog-differing: an update prompt naming the
  app and `update_from_catalog`.
- Behind-modified or modified-current: the absorb prompt (see
  "Absorb a modified catalog app").
- Modified-ahead: a restore prompt naming the app and
  `update_from_catalog` to the catalog copy.
- Snapshot-less: an overwrite prompt naming the app and
  `update_from_catalog`.
- Up-to-date or absorbed: a remove prompt naming the app id and
  `remove_app` (the Help wording with the id filled in).
- Absorbed-behind: the absorb prompt again.

No details element SHALL appear on a row blocked by a
requirement (`needsNewerShell` / `needsNewerSchema`, which show
the requirement instead of any control) or on a not-installed
`recipe-only` row (whose recipe prompt already shows in place of
Add). No new row fields are needed: the prompt is derived from
the row's existing `id`, `label`, `status`, and `installMode`.

#### Scenario: Not-installed row shows the install prompt

- **WHEN** a Store row is not installed and its `installMode` is `json`
- **THEN** the row offers one-tap Add and also shows a collapsed details element whose prompt names the app and `install_from_catalog`.

#### Scenario: Behind-clean row shows the update prompt

- **WHEN** a Store row is behind-clean
- **THEN** the row offers Update and also shows a collapsed details element whose prompt names the app and `update_from_catalog`.

#### Scenario: Behind-modified row shows the absorb prompt, not an overwrite prompt

- **WHEN** a Store row is behind-modified
- **THEN** the row offers confirmed Overwrite and shows a collapsed details element whose prompt is the absorb prompt, and shows no overwrite prompt.

#### Scenario: Up-to-date row shows the remove prompt

- **WHEN** a Store row is up-to-date
- **THEN** the row offers Remove and also shows a collapsed details element whose prompt names the app id and `remove_app`.

#### Scenario: Requirement-blocked row shows no details element

- **WHEN** a Store row needs a newer shell or schema
- **THEN** the row shows the requirement instead of any control and shows no details element.

#### Scenario: Recipe-only not-installed row shows no details element

- **WHEN** a Store row is not installed and its `installMode` is `recipe-only`
- **THEN** the row shows its recipe prompt in place of Add and shows no details element.

#### Scenario: Prompt is selectable text, no copy button, no Clipboard API

- **WHEN** a Store row renders its details prompt
- **THEN** the prompt is selectable text in a `<code>` element, the row has no copy button for it, and the bundle uses no Clipboard API for it.

### Requirement: Absorb a modified catalog app

An installed catalog app modified in both places (its installed
definition differs from its snapshot, and the catalog has moved)
SHALL be absorbable by an agent: the agent merges the catalog
changes into the installed definition, keeping the user's local
customizations, and finishes with the new MCP export
`absorb_from_catalog`. The absorb is a two-way merge — the stored
snapshot holds only a fingerprint, never the base definition, so
there is no base to diff against — and the agent SHALL work from
the installed definition (`export_app`) and the catalog definition
(`get_catalog_definition`): take a `backup` first so the absorb
can be undone, compare the two definitions field by field, keep
local customizations, take catalog changes, show the user the
merge plan (every field kept, taken, and in conflict) and ask
before writing anything, and ask the user which value to keep for
any field in conflict.

`absorb_from_catalog(id, definition, catalogBase?)` SHALL validate
the agent-supplied merged definition through the `add_app` path,
write it through `add_app` (state preserved by the existing rule;
pins, hidden flags, homepage placement, and recency untouched),
and record a new install snapshot at the catalog version carrying
the catalog fingerprint absorbed from. It SHALL refuse with no
write unless the app is installed, is in the catalog, and its
status is `behind-modified`, `modified-current`, or
`absorbed-behind`, and unless the merged definition's
`catalogVersion` equals the catalog's. It SHALL resolve the
catalog base the same way `install_from_catalog` does, and refuse
with a no-source error when no catalog source exists. It SHALL be
an MCP export (name + `useWhen` in the package export list).

After a successful absorb the row SHALL read `absorbed`, never
still-modified and never `catalog-differing`, and a plain Update
SHALL never be offered for it. A later catalog change SHALL move
the row to `absorbed-behind`, where Absorb is offered again (or a
confirmed Overwrite), never a plain Update.

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

- **WHEN** the catalog changes after an absorb
- **THEN** the row reads `absorbed-behind`, offers Absorb again (and a confirmed Overwrite), and never offers a plain Update.

#### Scenario: Absorb asks before writing

- **WHEN** the absorb prompt is followed
- **THEN** the agent takes a backup first, shows the merge plan, and asks the user before writing anything, and asks which value to keep for any field in conflict.

## MODIFIED Requirements

### Requirement: Install snapshot

A store install or store update of a catalog app SHALL record a snapshot
separate from the definition, containing the `catalogVersion` at install
time and a deterministic fingerprint of the definition as actually stored
(after `add_app` normalization, never of the raw catalog file). Generic
`add_app` and `import_app` SHALL NOT write the snapshot, and the snapshot
SHALL NOT be part of an exported definition. `remove_app` SHALL delete
the snapshot with the app. A store update SHALL replace the snapshot
with the new version and fingerprint after a successful update.

A snapshot MAY also carry an optional `catalogFingerprint`: the
fingerprint of the catalog definition absorbed from, set only by
`absorb_from_catalog` (see "Absorb a modified catalog app"). A
successful absorb SHALL replace the snapshot with the catalog
version, the fingerprint of the merged definition as actually
stored, and the catalog fingerprint absorbed from. Snapshots
without the field behave exactly as before; no migration is
required.

#### Scenario: Store install records a snapshot
- **WHEN** a catalog app is installed from the store
- **THEN** a snapshot exists recording its `catalogVersion` and the fingerprint of its stored definition.

#### Scenario: Generic re-add does not move the snapshot
- **WHEN** an installed catalog app's definition is replaced through generic `add_app`
- **THEN** the snapshot still records the version and fingerprint from the store install, so the app now differs from its snapshot.

#### Scenario: Export does not carry the snapshot
- **WHEN** an installed catalog app is exported
- **THEN** the export contains its definition and state, but no snapshot, and importing it does not create a snapshot.

#### Scenario: Absorb records a snapshot with the catalog fingerprint
- **WHEN** an absorb succeeds
- **THEN** the snapshot records the catalog version, the fingerprint of the merged definition as stored, and the fingerprint of the catalog definition absorbed from.

### Requirement: Update status and confirmed updates

For an installed catalog app with a snapshot, the store SHALL derive its
status from the installed definition's fingerprint (I), the snapshot
fingerprint (S), the current catalog definition's fingerprint (C,
canonicalized the same way), the installed `catalogVersion` (Iv), and
the catalog `catalogVersion` (Cv):

- I == C: up to date, clean; no update is offered. A Remove control is offered.
- I == S and Iv < Cv: behind, clean; an Update control is offered.
- I == S, Iv == Cv, and I != C: catalog-differing (the catalog changed
  without a version bump); an Update control is offered with no
  modification warning.
- I != S and I != C: modified; behind and modified when Iv < Cv,
  modified at the current version when Iv == Cv, and modified and ahead
  when Iv > Cv. A modified app SHALL never be offered a plain Update
  control; a behind-modified app is offered a confirmed Overwrite
  control instead, and a catalog copy SHALL never be offered as an
  Update to an ahead app.
- No snapshot: no status is claimed, but the store offers a confirmed
  Overwrite control: the installed definition is replaced with the
  catalog copy only after an explicit user confirmation, and a
  successful overwrite records a snapshot, so the app becomes managed
  afterwards.

When the snapshot carries a `catalogFingerprint` (set only by an
absorb), the absorbed cases take precedence over the branches
above: I == S and the snapshot's catalog fingerprint equals C
yields `absorbed` (Remove only, never Update, Overwrite, or
Restore); I == S and the snapshot's catalog fingerprint differs
from C yields `absorbed-behind` (Absorb again, or a confirmed
Overwrite, never a plain Update). I != S falls through to the
modified branches above, so an app edited after absorbing is
treated as modified again.

Updating a modified app SHALL replace its definition with the catalog
copy only after an explicit user confirmation (see the shell spec delta
for the confirmation's required wording). The update SHALL preserve
state by the existing `add_app` rule (fields still declared carry
forward, dropped fields reset to `initial`) and SHALL NOT change pins,
hidden flags, homepage placement, or recency. The store SHALL never
auto-update an installed app.

#### Scenario: Clean behind app can update
- **WHEN** an installed catalog app matches its snapshot and its version is lower than the catalog's
- **THEN** the store offers Update, and updating replaces its definition, preserves state for surviving fields, and records a new snapshot.

#### Scenario: Modified behind app needs confirmation
- **WHEN** an installed catalog app differs from its snapshot and its version is lower than the catalog's
- **THEN** the store does not offer a plain Update control; it offers a confirmed Overwrite control whose confirmation states that definition changes will be lost while state for surviving fields is preserved.

#### Scenario: Modified current app offers restore, not update
- **WHEN** an installed catalog app differs from its snapshot at the catalog's version
- **THEN** the store offers Restore catalog version (with the same confirmation and warning), not Update.

#### Scenario: Ahead app is not offered an update
- **WHEN** an installed catalog app's version is higher than the catalog's
- **THEN** the store does not offer it as an update to the catalog copy.

#### Scenario: Snapshot-less app offers a confirmed Overwrite
- **WHEN** an installed catalog app has no snapshot
- **THEN** the store offers Overwrite, and confirming replaces its definition with the catalog copy, preserves state for surviving fields, and records a snapshot, so the app becomes managed afterwards.

#### Scenario: Update never runs on its own
- **WHEN** a republish ships a newer catalog definition
- **THEN** installed apps keep their stored definitions until the user chooses an update (or restore) from the store.

#### Scenario: Absorbed app reads absorbed, not catalog-differing
- **WHEN** an installed catalog app matches its snapshot at the catalog version, differs from the catalog copy, and its snapshot's catalog fingerprint equals the current catalog fingerprint
- **THEN** the store reads it as `absorbed`, offers Remove only, and never offers Update.

#### Scenario: Absorbed app with a moved catalog reads absorbed-behind
- **WHEN** an absorbed app's catalog definition changes
- **THEN** the store reads it as `absorbed-behind`, offers Absorb again and a confirmed Overwrite, and never offers a plain Update.

#### Scenario: App edited after absorbing reads modified again
- **WHEN** an absorbed app's installed definition is edited so it differs from its snapshot
- **THEN** the store derives its status from the modified branches, not from the absorbed cases.
