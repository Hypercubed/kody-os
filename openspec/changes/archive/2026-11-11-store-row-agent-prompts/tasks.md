# Store row agent prompts, including absorb — tasks

No task in this file commits, pushes, or publishes anything. No
release/publish steps. No verify-on-Scribe task: `<details>` /
`<summary>` need no Scribe-specific verification (supported since
Chrome 12, far below the shell ceiling), and the absorb work is
agent + export logic, not rendering. No App Store seed or
live-browser check is required beyond the harnesses named below.

## 1. Snapshot: optional `catalogFingerprint`

- [x] 1.1 Add optional `catalogFingerprint?: string` to
  `InstallSnapshot` in `pkg/src/apps/registry.ts`. Old snapshots
  without the field keep working; no migration.
- [x] 1.2 `writeInstallSnapshot` / `readInstallSnapshot` pass the
  field through unchanged. `remove_app` still deletes the whole
  snapshot with the app. Exports still never carry the snapshot.

## 2. Status derivation: `absorbed` and `absorbed-behind`

- [x] 2.1 Add `'absorbed' | 'absorbed-behind'` to `AppStoreStatus`
  in `pkg/src/apps/registry.ts`.
- [x] 2.2 In `get_app_status`, before the existing branches, when
  the snapshot carries `catalogFingerprint`: I == S and the field
  equals the current catalog fingerprint yields `absorbed`; I == S
  and the field differs yields `absorbed-behind`. I != S falls
  through to the existing modified statuses.
- [x] 2.3 Confirm: a snapshot without `catalogFingerprint` derives
  exactly as today (no behavior change for existing installs).
- [x] 2.4 Confirm: an `absorbed` row whose catalog then changes
  (new fingerprint, with or without a version bump) derives
  `absorbed-behind`, not `behind-clean` / `catalog-differing`.

## 3. New MCP export `absorb_from_catalog`

- [x] 3.1 Add `absorb_from_catalog(id, definition, catalogBase?)`
  to `pkg/src/apps/registry.ts`, per design.md Decision 4:
  refuses unless installed, in catalog, and status is
  `behind-modified`, `modified-current`, or `absorbed-behind`;
  refuses unless the merged definition's `catalogVersion` equals
  the catalog's; validates and writes through `add_app`; records
  a new snapshot at the catalog version with `catalogFingerprint`
  set to the catalog definition's fingerprint. Nothing is written
  on any refusal.
- [x] 3.2 Export it from `pkg/src/apps/index.ts` (function + type
  where applicable) and add it to the MCP export list in
  `pkg/src/index.ts` with the `useWhen` from design.md
  Decision 4.
- [ ] 3.3 Confirm the absorb path preserves state for surviving
  fields and leaves pins, hidden flags, homepage placement, and
  recency untouched, like `update_from_catalog`.

## 4. Management API gating for the new statuses

- [ ] 4.1 In `manage_update_with_status` (`pkg/src/apps/registry.ts`):
  kind `update` refuses `absorbed` ("has no update available")
  and accepts `absorbed-behind` as a confirmed-overwrite case
  (same confirmation gate as `behind-modified`).
- [ ] 4.2 `manage_restore` refuses both new statuses ("has
  nothing to restore").
- [x] 4.3 Confirm Update All still only targets `behind-clean`
  and `catalog-differing` rows — `absorbed-behind` is never
  updated by it (its `safeUpdatable` set is unchanged).

## 5. Bundle rendering: `<details>` per row

- [ ] 5.1 In `catalog/app-store/store.js` `render()`, after the
  capabilities element in each row's `.store-body`, append a
  `<details class="store-details">` with a `<summary>` naming
  the action and a `<code>` child holding the prompt, built with
  `textContent` (never `innerHTML` for text built from a row id
  or label). Prompt per row status per design.md Decision 2.
- [ ] 5.2 No details element on `needsNewerShell` /
  `needsNewerSchema` rows, and none on not-installed
  `recipe-only` rows (their recipe prompt already shows).
- [x] 5.3 `storeBadge` gains both statuses: `absorbed` ->
  "Absorbed", `absorbed-behind` -> "Absorbed · update
  available". `absorbed` rows offer Remove only;
  `absorbed-behind` rows offer confirmed Overwrite (existing
  `manage_update` path) plus the Absorb details prompt.
- [x] 5.4 `store.css`: add a scoped `.store-details` rule
  (readable on the Scribe; the summary meets the 48px minimum
  tap target).
- [x] 5.5 Confirm by grep: no copy button and no Clipboard API
  use for the prompt element (no `navigator.clipboard` in the
  bundle for it).

## 6. Tests

- [ ] 6.1 Add fixture rows to `catalog/tests/app-store-tests.cjs`
  for: not-installed `json` (Install details, Add button kept),
  behind-clean (Update details), behind-modified (Absorb details,
  Overwrite button kept), modified-current (Absorb details,
  Restore button kept), modified-ahead (Restore details),
  snapshot-less (Overwrite details), up-to-date (Remove details),
  and the new `absorbed` / `absorbed-behind` statuses (Remove /
  Overwrite controls, Absorb details on `absorbed-behind` only).
  Checks: the details element exists per mapping, is collapsed
  by default, holds a `<code>` element with the prompt naming the
  app id and the export, and has no copy button; requirement
  rows and not-installed `recipe-only` rows have no details
  element.
- [ ] 6.2 Run `node catalog/tests/app-store-tests.cjs` (under
  node, not bun) — all checks pass.
- [x] 6.3 Add absorb cases to `tests/store-harness.ts`: absorb a
  behind-modified fixture and a modified-current fixture via
  `absorb_from_catalog` (merged definition keeps a local field
  change and takes a catalog field change); afterwards the row
  reads `absorbed`, state is preserved, and a further plain
  update is refused; bump the catalog and confirm the row reads
  `absorbed-behind`; absorb again and confirm it reads
  `absorbed`. Refusals write nothing: absorb on an up-to-date
  app, absorb with a mismatched `catalogVersion`, and absorb on
  a snapshot-less app all fail with no write.
- [x] 6.4 Update the test file header comments to document the
  new checks.

## 7. Version

- [x] 7.1 App Store `catalogVersion` 20 to 21 (verify the current
  number first; the bundle changed). Regenerate the index with
  `scripts/build-catalog-index.ts` and confirm the App Store
  entry carries the new version and fingerprint.
- [ ] 7.2 Record the package version decision: MINOR, 4.1.11 to
  4.2.0 (new MCP export), in the implementation commit. No commit
  unless the user directs it.

## 8. Verification

- [x] 8.1 Run `bun tests/store-harness.ts` — all pass.
- [x] 8.2 Run `bun tests/catalog-harness.ts` — all pass.
- [x] 8.3 Run `bun tests/agent-tools-harness.ts` — expect exactly
  the one pre-existing FAIL (`list_catalog returns 16 apps — got
  18`); any other FAIL is a finding, not background.
- [ ] 8.4 Run `bun build pkg/src/app.ts --target=browser --external
  'kody:*' --outfile /tmp/store-row-agent-prompts-build-check.js`
  — succeeds (never print the bundle to stdout).
- [x] 8.5 Run `bun run typecheck` from `pkg/` — no new errors
  beyond the pre-existing set recorded in `pkg/AGENTS.md`.
- [x] 8.6 Review `git diff` / `git status`: only the Store bundle,
  `registry.ts`, the two export lists, the tests, the index, and
  this change are touched; no scope creep.

## 9. Docs and specs

- [x] 9.1 Sync the canonical `app-registry` spec with the new
  "Store row agent-prompt details" and "Absorb a modified
  catalog app" requirements and the MODIFIED "Install snapshot"
  and "Update status and confirmed updates" requirements at
  implementation time. Check first whether any of them is already
  present — reconcile, do not duplicate.

## Sync notes — 2026-11-11

Boxes checked in this sync for work actually completed and verified in
this session; the rest stay unchecked with the reason. Verification
figures are the branch-final run (store harness 187 PASS / 1
pre-existing FAIL for the stale 4.1.3 version check; catalog harness
ALL PASSED, 18 apps; agent-tools harness 40 PASS / 1 pre-existing FAIL
for the 16-apps count; typecheck exit 0; bundle tests 120 ok).

- 3.3 (unchecked): state preservation (count 7 kept) and pins
  untouched are harness-verified. Hidden flags, homepage placement,
  and recency have no dedicated absorb check: the absorb path writes
  only the definition + snapshot via add_app and never touches those
  lists, but that was not asserted.
- 4.1 (unchecked): a plain update is refused for an absorbed app
  (harness, 'has no update available'). Accepting absorbed-behind as
  a confirmed-overwrite case is in the code (registry.ts, the accepted
  status set and the confirmation gate) but has no harness check.
- 4.2 (unchecked): a restore is refused for an absorbed app
  (harness, 'has nothing to restore'). No check covers restore
  refusal for absorbed-behind.
- 5.1 (unchecked): superseded by later changes. The details element
  is now appended to li (store-row-details-layout, v23), not into
  .store-body after the capabilities element, and the prompt text is
  now the one-liner (agent-prompt-pattern, v27). The bundle tests
  assert the final form.
- 5.2 (unchecked): the requirement-row half holds (storeAgentPrompt
  returns null for needsNewerShell / needsNewerSchema; the bundle
  test asserts no details on a needsNewerShell row). The recipe-only
  half was deliberately reversed by agent-prompt-pattern 3.2:
  recipe-only not-installed rows now gain the Install details.
- 6.1 (unchecked): fixture coverage is verified (all statuses, the
  prompt per mapping, no copy button), but the clause 'requirement
  rows and not-installed recipe-only rows have no details element'
  no longer holds for recipe-only rows: the pattern change updated
  the tests to assert recipe-only rows DO show the Install details.
  The current bundle tests assert the new behavior.
- 6.2 (unchecked): the bundle tests pass (120 ok) but under bun with
  the ephemeral jsdom-test fixture (jsdom 26.1.0), not under node as
  written.
- 7.2 (unchecked): the package version decision (MINOR, 4.1.11 to
  4.2.0) is recorded in the close-out, not in an implementation
  commit — no commit was made.
- 8.4 (unchecked): no bun build run is recorded for this change; the
  mock dev server serves the bundle (implying it compiles), which is
  a substitute, not the named check.
