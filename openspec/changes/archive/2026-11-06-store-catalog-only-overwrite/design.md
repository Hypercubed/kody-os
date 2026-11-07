# Design

## Decisions

### 1. Catalog-only rows

`get_store_rows` builds its id list from the catalog alone and no
longer unions in registry ids. The `readRegistry` call is removed
from that function (its only use was the union). Row assembly is
unchanged otherwise: the installed definition's label still wins
for display when an app is installed, capabilities are still
disclosed from the catalog definition when present.

Consequence: an installed app with no catalog entry has no Store
row at all. It is still listed on the Apps page and in Apps Edit,
still launchable, still removable and updatable by an agent. The
Store page intro already says custom apps are added by an agent;
nothing in it promises to list them.

### 2. Overwrite is a label, not a new operation

The behind-modified control keeps calling the management API
`update` action with the existing confirmation flow. Only the
button text changes, from "Update…" to "Overwrite". The modal
title still reads "Confirm update" and the loss wording is
untouched: renaming the modal would have meant touching the
shared confirmation UI for restore as well, and the owner asked
for the modal "like it does now".

Behind-clean and catalog-differing keep the plain "Update"
label: those updates apply with no confirmation and lose
nothing, so "Update" is the honest word for them.

### 3. Snapshot-less Overwrite is always confirmed

The management API update gate now admits the `snapshot-less`
status. Confirmation is always required for it, not only when
capabilities are added: the installed definition's baseline is
unknown, so the overwrite may destroy live definition edits the
Store cannot see. The existing `needsConfirmation` response and
modal cover it with no new UI.

A successful overwrite goes through `store_update_from_catalog`,
which records a snapshot of the new definition. The app therefore
leaves the snapshot-less state on its first Store overwrite and
is managed normally from then on. This is the Store-UI answer to
adopting agent-installed apps; no new "adopt" operation was
added, and no snapshot is ever written without replacing the
definition with the catalog copy.

### 4. What the Store refuses, unchanged

- `modified-current` and `modified-ahead` still get Restore, not
  Overwrite, from the management API (the API error text now
  says "use Restore, not Overwrite" to match the button).
- Storage-only ids are still rejected by update/restore with no
  write; they simply have no row to click anymore.
- An update that adds a capability still requires confirmation
  naming the additions.

## Alternatives considered

- A dedicated "adopt" MCP export that records a snapshot of the
  current installed definition without replacing it. Rejected
  for this change: it would let the Store claim a baseline it
  never installed, and the owner did not ask for a new export.
  The confirmed Overwrite reaches the same managed state with
  the existing operations, at the honest price of replacing the
  definition with the catalog copy.
- Renaming the modal title to "Confirm overwrite". Rejected:
  the owner asked for the modal like it is now, and the title
  is shared with restore-adjacent wording.

## Version

MINOR 2.6.0 → 2.7.0: a behavior change to the Store list and
controls, nothing existing breaks. App-store bundle
`catalogVersion` 8 → 9 (its `store.js` changed). Build went 31 → 32 at publish, per the version policy.
