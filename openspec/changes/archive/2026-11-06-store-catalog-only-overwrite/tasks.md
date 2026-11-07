# Tasks

Implementation exists in the working tree (VM clone, main at
5bbefe40, committed as `7582828` and published to Kody as v2.7.0 build 32, 2026-11-05). Tasks are marked done where
they are done; they are recorded here so the change is
reviewable, not so they can be redone. No task in this file
commits, pushes, or publishes anything, and no task after this
point changes the package version; the version decision is
recorded at commit time.

## 1. Shell: catalog-only rows

- [x] 1.1 `get_store_rows` in `pkg/src/apps/registry.ts` builds
  ids from the catalog only; the registry-id union loop and the
  now-unused `readRegistry` call are removed. Row assembly,
  ordering (alphabetical by id), and capability disclosure are
  unchanged.
- [x] 1.2 `manage_update_with_status` admits `snapshot-less`
  for the update kind and always requires confirmation for it
  (`needsConfirm` now includes `snapshot-less`). The
  modified-current/modified-ahead error now says "use Restore,
  not Overwrite" to match the button label.

## 2. Store bundle: Overwrite label

- [x] 2.1 In `pkg/catalog/app-store/definition.json`, the
  behind-modified button changes from "Update…" to "Overwrite",
  and snapshot-less rows get the same Overwrite button. The
  modal, its title, and its wording are untouched; the button
  still calls the `update` management action. Behind-clean and
  catalog-differing keep "Update"; modified-current and
  modified-ahead keep "Restore".
- [x] 2.2 App-store bundle `catalogVersion` 8 → 9. Bundle parses
  after the edit (`json.load`).

## 3. Version

- [x] 3.1 Package MINOR 2.6.0 → 2.7.0 in `pkg/package.json`,
  with `pkg/AGENTS.md`, `pkg/README.md`, and root `README.md`
  headers updated in the same change. Build 32 at publish (v2.7.0 build 32, live). The `pkg/README.md` Current line also names the
  catalog-only Store with confirmed Overwrite.

## 4. Tests

- [x] 4.1 `tests/store-harness.ts`: rows check is now
  catalog-only (expected count computed from
  `list_catalog()`, not hardcoded); a storage-only app is
  asserted to have no Store row; the snapshot-less check now
  proves Overwrite requires confirmation, applies on confirm,
  leaves the app up-to-date, and records a snapshot. Header
  comment updated.
- [x] 4.2 `pkg/catalog/tests/app-store-tests.cjs`: mocked rows
  gain a snapshot-less row; behind-modified and snapshot-less
  rows are asserted to offer Overwrite; a snapshot-less
  Overwrite click is asserted to show the same confirmation.
  The stale `.store-confirm` selectors in this file are fixed
  to `.store-dialog`: the bundle renders its confirmation as
  a `.store-dialog` overlay and `index.html` has no
  `.store-confirm` element, so those checks threw on the clean
  base commit (verified by stash before fixing).
- [x] 4.3 Harnesses run green: catalog harness ALL PASSED
  (18 apps); store harness ALL STORE CHECKS PASSED;
  app-store bundle ALL PASSED; daily-feed, daily-feed-dom,
  link-drop, link-drop-dom all pass. Counter (1 failure) and
  hoodie (2 failures) match the clean-base baseline exactly,
  verified by stash; pre-existing, untouched by this change.

## 5. Specs

- [x] 5.1 Spec deltas in `specs/app-registry/spec.md` and
  `specs/shell/spec.md` in this change folder; canonical specs
  in `openspec/specs/` updated in the same change. (The
  authoring delta for 'Bundle manifest shape' was removed
  Nov 6, 2026 — its content already stands in canonical
  'Catalog apps are installable verbatim'.)

## 6. Ship — removed Nov 6, 2026

Part 6 (6.1 commit scope, 6.2 publish to Kody, 6.3 human-browser / Scribe check) removed at user direction — release is the user's call; no generic Scribe verify. The ship steps themselves happened (committed as `7582828`, published to Kody as v2.7.0 build 32) and are recorded in the proposal.
