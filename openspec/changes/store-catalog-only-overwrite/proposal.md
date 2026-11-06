# Proposal

## Status note

This change is a record of work directed by the owner on 2026-11-05,
implemented in the VM working tree (main at 5bbefe40, uncommitted).
The tasks in tasks.md are marked done where they are done; the only
open tasks are review and ship decisions, which belong to the owner.
Nothing in this change commits, pushes, or publishes anything.

## Why

Three owner observations after the v2.6.0 build 31 publish, all about
the Store telling the truth about what it manages:

1. The Store still lists every installed app, including custom
   storage-only apps that have no catalog entry. Since Apps Edit was
   restored on the Apps page, installed apps are managed there; the
   Store's job is the catalog. A storage-only app in the Store list
   can neither be installed nor updated from it, so its row is noise.
2. A behind-modified app's button says "Update…", which reads as a
   routine update. It is not routine: confirming it replaces the
   installed definition with the catalog copy and destroys the
   user's definition changes. The button should say what it does:
   Overwrite. The confirmation modal behind it stays exactly as it
   is.
3. An installed catalog app with no snapshot — every app installed
   by an agent via `add_app` — gets no Store control at all, so
   there is no browser path to bring it under Store management.
   The same Overwrite, always confirmed, gives it one: the
   overwrite replaces the definition with the catalog copy and
   records a snapshot, so the app is managed afterwards.

## What changes

- `get_store_rows` returns catalog ids only. Installed apps with
  no catalog entry no longer appear in the Store list.
- The Store bundle's behind-modified button label changes from
  "Update…" to "Overwrite". Behind-clean and catalog-differing
  rows keep the plain "Update" label. Modified-current and
  modified-ahead rows keep "Restore".
- Snapshot-less installed catalog apps get an Overwrite button.
- The management API accepts `snapshot-less` for update and
  always requires confirmation for it, like behind-modified.
  A successful store update records a snapshot.
- App-store bundle `catalogVersion` 8 → 9. Package MINOR
  2.6.0 → 2.7.0, build stays 31 until publish.

## What does not change

- The confirmation modal: same UI, same loss and
  state-preservation wording, same API kind (`update`).
- State preservation on update, pins/hidden/homepage untouched,
  no auto-update.
- The agent path: `update_from_catalog` works on any installed
  app, snapshot or not, unchanged.
- Apps Edit: still the place for pin, hide, and home, including
  for apps the Store no longer lists.
