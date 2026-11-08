# Tasks: App Catalog intro points to Help; Help gains a remove-app prompt

## 1. Store intro

- [x] 1.1 Shorten the first paragraph of `catalog/app-store/index.html` to: "Install and update apps from the catalog, right here in the browser — no agent needed. Updates never run on their own. For adding or removing apps, see Help." Leave the no-JavaScript note untouched.
- [x] 1.2 Bump app-store `catalogVersion` 18 → 19 in `catalog/app-store/definition.json` and regenerate `catalog/catalog.json` (bundle changed).

## 2. Help block

- [x] 2.1 Add a "Remove an app" section to `renderEmptyHelp` in `pkg/src/apps/client.ts`, after "Add your own apps" and before "Install the App Catalog", in the existing `h3` + `gate-hint` copy-prompt shape, with the exact prompt text from the design.
- [x] 2.2 Confirm the section appears identically on the Help page, the empty Home page, and the empty Apps page, and that the Help page still omits the empty-state closing line.

## 3. Specs

- [x] 3.1 Sync the canonical help-page spec (delta in this change): three prompts, "App Catalog" name.

## 4. Verify

- [x] 4.1 Catalog harness and store harness pass; update any test asserting the old intro wording or a two-prompt help block to the new text.
- [x] 4.2 `bun build` passes; ES2019 clean.
- [x] 4.3 `openspec validate --changes` passes for this change.

## 5. Version

- [x] 5.1 Bump the package PATCH 4.1.1 → 4.1.2, build 36 → 37, in the same commit as the change (`pkg/package.json`, `pkg/AGENTS.md`, `pkg/README.md`, root `README.md`), per the version policy.
