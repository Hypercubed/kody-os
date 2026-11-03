> Implementation note (v2.3.0): all tasks except the kody-dev leg are done. The kody-dev leg is still open because this environment has no kody CLI; it was substituted with the catalog harness, store harness, and the jsdom app-store harness, which cover the same registry, management-API, and bundle paths. Verify the kody-dev leg in a kody dev preview before calling the change fully verified.

# Tasks

Phases land in order: 1, then 2, then 3, then 4. Each
phase's verification must pass before the next phase
starts. No task in this file commits, pushes, or
publishes anything. This change assumes
`apps-edit-and-store-split` and `bundle-capabilities`
are implemented first.

## 1. Management API

- [x] 1.1 Add management API routes in `pkg/src/app.ts`
  (dispatched after the `/apps/` branches, alongside
  the `/feed/` route, inside the device gate, GET
  only, no POST): read store rows, install, update,
  and restore, reusing `get_store_rows()`,
  `store_install_from_catalog`, and
  `store_update_from_catalog` from
  `pkg/src/apps/registry.ts` with no change to
  snapshot, state-preservation, or status rules.
  Undeclared `manageApps` callers get the feed-style
  plain 404 with no write and no capability detail.
- [x] 1.2 Settle design.md Decision 4 (bridge methods
  vs documented routes) and Decision 6's no-JS
  choice, and record both in the implementation
  commit and in the store bundle's catalog README
  entry. Only one supported bundle path SHALL be
  added.

## 2. Store bundle

- [x] 2.1 Rewrite `pkg/catalog/app-store.bundle.json`
  as a managing bundle declaring `manageApps`: JS
  bundle (ES2019, under the 256 KiB cap, inlined
  assets only) that fetches rows on load, renders
  install/update/restore controls from row status,
  re-renders after each mutation, and implements
  its own modified-app confirmation UI using the
  API's needs-confirmation response. Loading,
  error-with-retry, and empty states are explicit.
- [x] 2.2 Add a jsdom harness for the new bundle
  (same pattern as the existing catalog harnesses):
  row rendering from a mocked management API,
  install/update/restore calls, confirmation flow
  for a modified app, and error/empty states.

## 3. Delete the shell Store

- [x] 3.1 Delete the Store intercept, store page
  builder, and Store confirmation page from
  `pkg/src/app.ts`, and retire or relocate
  `renderCombinedList` from `pkg/src/apps/client.ts`
  (record the choice). Correct the stale "bundle
  panel plus list" comment as part of the deletion.
- [x] 3.2 Implement the not-installed fallback from
  design.md Decision 5: `/apps/app-store` when the
  store app is not installed renders a short note
  plus the Store install path, with no rows and no
  other controls.
- [x] 3.3 Repo-wide grep sweep: no remaining shell
  code, comment, or doc presents the Store list as
  shell-rendered, and no remaining code path renders
  Store rows except through the management API.

## 4. Verify and sync specs

- [ ] 4.1 Verify in `kody dev` (mock store) against
  the shipped catalog: install, update (clean and
  modified-with-confirm), and restore round-trip
  through the data Store bundle; declining a
  modified update changes nothing; the not-installed
  fallback renders; an undeclared app calling the
  management API gets a plain 404.
- [x] 4.2 Sync the canonical specs: update
  `openspec/specs/shell` (Store page no longer a
  special case) and `openspec/specs/app-registry`
  (management API), and update `pkg/catalog/README.md`
  and `pkg/AGENTS.md` for the new store bundle.
  Record the version decision in the implementation
  commit (MINOR per proposal.md, build +1 on publish).
