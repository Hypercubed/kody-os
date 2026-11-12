# Store row agent prompts, including absorb for modified apps

## Why

Today a catalog app that has been modified in both places — the
installed definition differs from its snapshot, and the catalog has
moved on — has only one way forward in the App Catalog: Overwrite.
`behind-modified` rows offer a confirmed Overwrite control
(`catalog/app-store/store.js`, `pkg/src/apps/registry.ts`
`manage_update_with_status`), and Overwrite replaces the installed
definition with the catalog copy. The user's local changes are lost.
That is the right shape when the local changes were a mistake, but
not when they were deliberate customizations the user wants to keep
while still taking the catalog's changes — the same situation Kody's
package fork/absorb flow exists for, at package level.

There is no absorb for apps today, and a prompt alone cannot make
one: the merge itself is agent judgment work, but finishing it needs
something no existing MCP export does. `add_app` writes a merged
definition without touching the snapshot, so the row would stay
modified afterwards; `update_from_catalog` overwrites with the
catalog copy, which is the thing absorb is trying to avoid; and the
snapshot is recorded only by a store install or store update. A
prompt that tells the agent to merge and write would land the user
back on a Modified row. This change therefore pairs the prompt with
the one new export that lets the agent finish the job, plus the
status-model piece that keeps an absorbed app from being offered a
plain Update that would silently undo the absorb (design.md,
Decisions 3–5).

The same gap, in smaller form, applies to every other row: the Store
offers one-tap Add / Update / Overwrite / Restore / Remove, but a
user who wants an agent to do the same action — or who is on a
screen without a working button — has no per-row prompt to copy.
The Help page already has copyable prompts for adding and removing
apps, and `recipe-only` rows already show a recipe prompt in place
of Add. This change generalizes that pattern: almost every Store row
gets a `<details>` at the bottom of its description holding a
copyable agent prompt for its action.

## What Changes

- Every Store row except requirement-blocked rows (`needsNewerShell`
  / `needsNewerSchema`) and not-installed `recipe-only` rows (which
  already show their recipe prompt in place of Add) gains a
  `<details>` element at the bottom of the app description, holding
  a selectable-text agent prompt for the row's action, in a `<code>`
  element, with no copy button and no Clipboard API use — the
  shell's established pattern for agent prompts.
- The prompt per row status:
  - not-installed (`json`): install prompt (`install_from_catalog`).
  - behind-clean / catalog-differing: update prompt
    (`update_from_catalog`).
  - behind-modified / modified-current: absorb prompt (new).
  - modified-ahead: restore prompt (`update_from_catalog` to the
    catalog copy).
  - snapshot-less: overwrite prompt (`update_from_catalog`).
  - up-to-date / absorbed: remove prompt (`remove_app`, the Help
    wording with the id filled in).
  - absorbed-behind (new status): absorb prompt again.
- New MCP export `absorb_from_catalog(id, definition)`: validates
  the agent-supplied merged definition, writes it through `add_app`
  (state preserved by the existing rule), and records a new install
  snapshot at the catalog version carrying the catalog fingerprint
  absorbed from — the only new snapshot writer besides store
  install / store update.
- Install snapshots gain an optional `catalogFingerprint` field,
  set only by absorb. Status derivation gains two statuses:
  `absorbed` (merged definition intact, catalog unchanged since the
  absorb: Remove only, never Update) and `absorbed-behind` (catalog
  has moved since the absorb: Absorb again, or confirmed Overwrite,
  never plain Update).
- The absorb prompt itself is a two-way merge, not a three-way one:
  the stored snapshot holds only a fingerprint, not the base
  definition, and `get_app` / `get_app_status` are not MCP exports,
  so the agent compares the installed definition (`export_app`)
  with the catalog definition (`get_catalog_definition`), takes a
  backup first, shows the merge plan, and asks the user before
  writing anything.
- App Store `catalogVersion` 20 to 21 (verify the current number at
  implementation time; the bundle changes). Package version MINOR:
  4.1.11 to 4.2.0 — a new MCP export, nothing existing breaks.
  The catalog index regenerates.

## Capabilities

- app-registry

## Impact

- App Store bundle only for the UI (`catalog/app-store/store.js`
  row rendering + a `store.css` rule for the details element).
- `pkg/src/apps/registry.ts`: `InstallSnapshot` gains the optional
  field, `get_app_status` gains the two statuses, `manage_update`
  accepts the new statuses as absorb/overwrite cases and refuses
  plain Update on them, and the new `absorb_from_catalog` export
  is added.
- `pkg/src/index.ts`: the new export joins the MCP export list
  (name + `useWhen`).
- `catalog/tests/app-store-tests.cjs` gains fixture rows for the
  new statuses and the per-row details prompts; `tests/store-harness.ts`
  gains absorb cases.
- No change to the agent install / update path, the catalog source
  model, the management API's other gates, or the Apps page list —
  the Apps page is explicitly out of scope (design.md, Decision 8).
  No commit, push, or publish in this change.
