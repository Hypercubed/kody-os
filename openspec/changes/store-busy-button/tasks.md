# Tasks: Store buttons show a busy state while an async action runs

## 1. Busy-button helper

- [x] 1.1 Add a busy-button helper to `catalog/app-store/store.js`: on click, disable the button, swap its label to the working label, run the action, and restore the button (enabled, original label) when the action's promise settles. A click while disabled is ignored. Use the working labels from the design (Adding…, Updating…, Overwriting…, Restoring…, Removing…, Updating all…, Confirming…).

## 2. Apply it

- [x] 2.1 Row action buttons: refactor `mutate` in `render()` to use the busy helper and return the `storeApi` promise chain (Add, Update, Overwrite, Restore, Remove).
- [x] 2.2 "Update All" button (`updateAllNow`): disabled with "Updating all…" while the sequential updates run, restored when the run finishes.
- [x] 2.3 Confirm dialog's Confirm button (`showConfirm`): disabled with "Confirming…" while the confirmed call runs, restored on error.
- [x] 2.4 Bump app-store `catalogVersion` 19 → 20 in `catalog/app-store/definition.json` and regenerate `catalog/catalog.json` (bundle changed).

## 3. Specs

- [x] 3.1 Sync the canonical shell spec (delta in this change): busy-button rule on the "App Store page is a data app" requirement.

## 4. Verify

- [x] 4.1 Catalog harness and store harness pass; add store-harness checks that a row Add disables its button with label "Adding…", that a failed install re-enables it with its original label, and that a second click while disabled fires no second request.
- [x] 4.2 `bun build` passes; ES2019 clean.
- [x] 4.3 `openspec validate --changes` passes for this change.
- [x] 4.4 On a mock Store page, pressing Add shows the button disabled with "Adding…" until the install completes or fails.

## 5. Version

- [x] 5.1 Bump the package PATCH 4.1.2 → 4.1.3, build 37 → 38, in the same commit as the change (`pkg/package.json`, `pkg/AGENTS.md`, `pkg/README.md`, root `README.md`), per the version policy.

## Verification note

- 4.4 was verified via the jsdom app-store bundle harness (`catalog/tests/app-store-tests.cjs`, mocked management API), which is the established mock Store page test — not a live `kody dev` browser, which cannot run in this VM (no kody CLI here). The new busy-button checks in that harness assert the button state on a mock Store page directly.
