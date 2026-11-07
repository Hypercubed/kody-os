# Store recipe prompt rendering — tasks

## 1. Rows carry installMode

- [ ] 1.1 Add `installMode` to the manage-row assembly in
  `get_store_rows` (`pkg/src/apps/registry.ts`): copy it from the
  catalog definition for the row's id, defaulting to `json` when the
  definition carries none. Add it to the row type.
- [ ] 1.2 Confirm a row for a `recipe-or-json` app reports its mode
  and a row for a `json` app reports `json` (small check against a
  blank store with the catalog loaded).
- [ ] 1.3 The bundle treats a missing `installMode` on a row as
  `json` (defensive default, so older rows and hand-written fixtures
  without the field still render Add).

## 2. Bundle rendering

- [ ] 2.1 In `store.js`, branch the not-installed case: when
  `row.installMode === 'recipe-only'`, render the prompt element
  instead of the Add button. `recipe-or-json` and `json`
  not-installed rows keep one-tap Add, with no prompt.
- [ ] 2.2 Prompt element: `<span class="store-recipe-prompt">` with
  a `<code>` child holding the prompt text, set via `textContent`
  (escape-first — never `innerHTML` for text built from a row id or
  label). Prompt form: `Install <label> using its recipe: ask your
  agent to follow pkg/catalog/<id>/RECIPE.md and verify with
  list_apps.` (exact string finalized here; tests assert the parts.)
- [ ] 2.3 `store.css`: add a scoped rule for the prompt element
  (selectable text, readable on the Scribe).
- [ ] 2.4 No copy button and no Clipboard API use for the prompt
  (confirm by grep: no `navigator.clipboard` and no copy button in
  the bundle for this element).
- [ ] 2.5 Installed rows unchanged: the prompt never appears on an
  installed row, whatever its `installMode`; installed rows keep
  their existing controls per status.

## 3. Version

- [ ] 3.1 App Store `catalogVersion` 13 to 14 (the bundle changed).
- [ ] 3.2 Regenerate the index with `scripts/build-catalog-index.ts`
  and confirm the App Store entry carries the new version and
  fingerprint.

## 4. Tests

- [ ] 4.1 Add fixture rows to `pkg/catalog/tests/app-store-tests.cjs`
  (test-only fixtures, not catalog apps): `recipe-only`
  not-installed; `recipe-or-json` not-installed; `json`
  not-installed; `recipe-only` installed and up-to-date.
- [ ] 4.2 Checks: `recipe-only` not-installed row shows the prompt
  (a `<code>` element naming the app, its recipe file, and the
  verify step) and offers no Add button; `recipe-or-json` and `json`
  not-installed rows offer Add and show no prompt; installed
  `recipe-only` row shows its normal Remove control and no prompt;
  the prompt has no copy button and the bundle uses no Clipboard API
  for it.
- [ ] 4.3 Update the test file header comment to document the new
  checks.
- [ ] 4.4 Run `node pkg/catalog/tests/app-store-tests.cjs` (under
  node, not bun) — all checks pass.

## 5. Verification

- [ ] 5.1 Run `bun tests/store-harness.ts` — all pass.
- [ ] 5.2 Run `bun tests/catalog-harness.ts` — all pass.
- [ ] 5.3 Run `bun tests/open-mode-harness.ts` and
  `bun tests/owner-check-harness.ts` — all pass.
- [ ] 5.4 Run `bun tests/agent-tools-harness.ts` — expect exactly
  the one pre-existing FAIL (`list_catalog returns 16 apps — got
  18`); any other FAIL is a finding, not background.
- [ ] 5.5 Run `bun build pkg/src/app.ts --target=browser --external
  'kody:*' --outfile /tmp/store-recipe-prompt-build-check.js` —
  succeeds (never print the bundle to stdout).
- [ ] 5.6 Review `git diff` / `git status`: only the Store bundle,
  the row assembly, the tests, the index, and this change are
  touched; no scope creep.

## 6. Docs, specs, version

- [ ] 6.1 Sync the canonical `app-registry` spec with the new
  "Store recipe prompt rendering" requirement at implementation
  time. Check first whether it is already present — the validate
  INFO about an ADDED delta colliding with an already-present
  requirement applies here too; reconcile, do not duplicate.
- [ ] 6.2 Record the version decision (App Store 13 to 14) in the
  implementation commit. No commit unless the user directs it.
