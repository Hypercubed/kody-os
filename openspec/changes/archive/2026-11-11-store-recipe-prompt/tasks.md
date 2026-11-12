# Store recipe prompt rendering — tasks

## Sync note — 2026-11-11 (close-out)

This change is closed without being implemented as written. Section 0 shipped in public v4.1.11 (commit 5283ca6, Nov 7): 0.1, 0.2, 0.3, 0.5 checked after verification on branch 'next' (HEAD a7943cc). 0.4 is NOT checked: its literal wording ('no recipe-or-json remains anywhere in the tree except the archived catalog-restructure change') is not met — the string still appears in prose in openspec/changes/generic-rss-feed/design.md and tasks.md (describing this removal) and in the archived record; live code and data are clean (type is 'json' | 'recipe-only', no installMode on the two definitions, catalog entries all 'json', catalog harness ALL PASSED, 18 apps).

Section 1 verified and checked (1.1, 1.2, 1.3): StoreRow.installMode exists and the row assembly copies it (registry.ts:1691 catalog rows, :1745 installed rows, default 'json'); the bundle fixture (app-store-tests.cjs:313 daily-feed 'recipe-only') and checks (:378-380) treat a recipe-only row as recipe-only. Note: the temp-definition live check in 1.2's text was not run as a separate procedure; verification is by code reading plus the bundle fixture. 1.3 verified by reading store.js:297 — a missing installMode is undefined, !== 'recipe-only', so the row takes the Add branch.

Section 2 SUPERSEDED by the v27 agent-prompt pattern (tasks 2.1-2.5, not completed): recipe-only rows now get the same one-liner Install prompt as any not-installed row ('Read package:<slug>#OPERATIONS.md, then install this app: <folder URL>'); the span element with class store-recipe-prompt and its scoped CSS were never added (grep: no occurrence in store.js/store.css), and the recipe-only early return was removed. The properties 2.4/2.5 name hold under the pattern — the replacement prompt has no copy button and no Clipboard API use (0 occurrences in store.js), and the Install one-liner appears only on not-installed rows — but the tasks as written are superseded, not done. No live app is 'recipe-only' (all 18 catalog apps are 'json'), so the recipe-only behavior is bundle-test-only, not visible live in the mock.

Section 3 SUPERSEDED by events (3.1, 3.2): the Store is v28; the 13-to-14 step is moot. Section 4 SUPERSEDED by the pattern's bundle tests (4.1-4.4): the span-prompt fixtures were never added; the current app-store tests (138 checks, all pass under node) cover recipe-only rows gaining Install details instead. Section 5: 5.2, 5.4, 5.5 checked (catalog harness ALL PASSED; agent-tools exactly the one expected pre-existing FAIL 'list_catalog returns 16 apps — got 18'; bun build succeeds, 258.48 KB). 5.1 NOT checked: the store harness has 1 FAIL, the pre-existing stale 4.1.3 version check — the task expects all pass. 5.3 NOT checked: the open-mode harness has 12 FAILED (first: 'modal-default app renders full-page section — install failed') and tests/owner-check-harness.ts does not exist in the tree. 5.6 NOT checked: the branch diff is the whole 4.2.0 batch (v4 tail + Phase 1), not only this change's files.

Section 6 SUPERSEDED (6.1, 6.2): the canonical app-registry spec now carries the pattern form, not this change's recipe-prompt form; the two-state 'Recipe install mode' sync 6.1's second half called for has landed (no 'recipe-or-json' remains in openspec/specs/app-registry/spec.md). 6.2 is moot (Store v28; the version decision lives in the agent-prompt-pattern and v4-tail close-outs).

## 0. Remove `recipe-or-json` from the installMode model

- [x] 0.1 Remove `'recipe-or-json'` from the `installMode` type in `pkg/src/apps/types.ts` (line 252) and from the registry validation in `pkg/src/apps/registry.ts` (lines 600-603), so the model is `installMode?: 'json' | 'recipe-only'` (absent means `json`).
- [x] 0.2 Remove the `installMode` field from `pkg/catalog/daily-feed/definition.json` and `pkg/catalog/generic-feed/definition.json` (the field carried no information — absent is the default). No `catalogVersion` bump for either app: the fingerprint excludes `installMode`, so no installed app changes status.
- [x] 0.3 Regenerate `pkg/catalog/catalog.json` with `scripts/build-catalog-index.ts` and confirm the `daily-feed` and `generic-feed` entries carry no `installMode`; run the generator twice and confirm byte-identical output.
- [ ] 0.4 Confirm no `recipe-or-json` remains anywhere in the tree except the archived `catalog-restructure` change (a record, not edited — its mapping is superseded, noted in design.md Decision 6).
- [x] 0.5 Run `bun tests/catalog-harness.ts` — all pass (the two definitions still validate and install; the harness count is unchanged).

## 1. Rows carry installMode

- [x] 1.1 Add `installMode` to the manage-row assembly in
  `get_store_rows` (`pkg/src/apps/registry.ts`): copy it from the
  catalog definition for the row's id, defaulting to `json` when the
  definition carries none. Add it to the row type.
- [x] 1.2 Confirm a row for a `recipe-only` app reports `recipe-only`
  and a row for a `json` app reports `json` (small check against a
  blank store with the catalog loaded, using a temporary recipe-only
  definition — no catalog app carries the mode today; remove the
  temporary definition afterwards).
- [x] 1.3 The bundle treats a missing `installMode` on a row as
  `json` (defensive default, so older rows and hand-written fixtures
  without the field still render Add).

## 2. Bundle rendering

- [ ] 2.1 In `store.js`, branch the not-installed case: when [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  `row.installMode === 'recipe-only'`, render the prompt element
  instead of the Add button. `json`
  not-installed rows keep one-tap Add, with no prompt.
- [ ] 2.2 Prompt element: `<span class="store-recipe-prompt">` with [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  a `<code>` child holding the prompt text, set via `textContent`
  (escape-first — never `innerHTML` for text built from a row id or
  label). Prompt form: `Install <label> using its recipe: read
  pkg/docs/install-guide.md, then follow pkg/catalog/<id>/RECIPE.md.` (exact string finalized here; tests assert the parts.)
- [ ] 2.3 `store.css`: add a scoped rule for the prompt element [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  (selectable text, readable on the Scribe).
- [ ] 2.4 No copy button and no Clipboard API use for the prompt [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  (confirm by grep: no `navigator.clipboard` and no copy button in
  the bundle for this element).
- [ ] 2.5 Installed rows unchanged: the prompt never appears on an [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  installed row, whatever its `installMode`; installed rows keep
  their existing controls per status.

## 3. Version

- [ ] 3.1 App Store `catalogVersion` 13 to 14 (the bundle changed). [SUPERSEDED 2026-11-11 - see sync note; not completed.]
- [ ] 3.2 Regenerate the index with `scripts/build-catalog-index.ts` [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  and confirm the App Store entry carries the new version and
  fingerprint.

## 4. Tests

- [ ] 4.1 Add fixture rows to `pkg/catalog/tests/app-store-tests.cjs` [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  (test-only fixtures, not catalog apps): `recipe-only`
  not-installed; `json` not-installed; `recipe-only` installed and
  up-to-date.
- [ ] 4.2 Checks: `recipe-only` not-installed row shows the prompt [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  (a `<code>` element naming the app, its recipe file, and the
  verify step) and offers no Add button; `json`
  not-installed rows offer Add and show no prompt; installed
  `recipe-only` row shows its normal Remove control and no prompt;
  the prompt has no copy button and the bundle uses no Clipboard API
  for it.
- [ ] 4.3 Update the test file header comment to document the new [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  checks.
- [ ] 4.4 Run `node pkg/catalog/tests/app-store-tests.cjs` (under [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  node, not bun) — all checks pass.

## 5. Verification

- [ ] 5.1 Run `bun tests/store-harness.ts` — all pass.
- [x] 5.2 Run `bun tests/catalog-harness.ts` — all pass.
- [ ] 5.3 Run `bun tests/open-mode-harness.ts` and
  `bun tests/owner-check-harness.ts` — all pass.
- [x] 5.4 Run `bun tests/agent-tools-harness.ts` — expect exactly
  the one pre-existing FAIL (`list_catalog returns 16 apps — got
  18`); any other FAIL is a finding, not background.
- [x] 5.5 Run `bun build pkg/src/app.ts --target=browser --external
  'kody:*' --outfile /tmp/store-recipe-prompt-build-check.js` —
  succeeds (never print the bundle to stdout).
- [ ] 5.6 Review `git diff` / `git status`: only the Store bundle,
  the row assembly, the `installMode` type and validation, the two
  definitions, the tests, the index, and this change are
  touched; no scope creep.

## 6. Docs, specs, version

- [ ] 6.1 Sync the canonical `app-registry` spec with the new [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  "Store recipe prompt rendering" requirement at implementation
  time. Check first whether it is already present — the validate
  INFO about an ADDED delta colliding with an already-present
  requirement applies here too; reconcile, do not duplicate. Also sync the canonical `Recipe install mode` requirement to the two-state model at the same time (body + scenarios, dropping the `recipe-or-json` scenario and updating the mapping to all-`json`): the code removal in section 0 deletes the value, so the canonical spec must lose it here. `generic-rss-feed`'s MODIFIED delta is written against the two-state text and only validates once this sync has landed — the validator refuses a MODIFIED delta that drops a scenario the canonical spec still has.
- [ ] 6.2 Record the version decision (App Store 13 to 14) in the [SUPERSEDED 2026-11-11 - see sync note; not completed.]
  implementation commit. No commit unless the user directs it.
