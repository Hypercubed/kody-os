# Close-out: store-row-agent-prompts (absorb + row agent prompts)

Closed 2026-11-11. Implemented on branch close-v4-tail, uncommitted.
Archived per the repo's archive precedent
(openspec/changes/archive/<date>-<slug>/). App Store catalogVersion
20 to 21; package 4.2.0 / build 46.

## What was implemented

- pkg/src/apps/registry.ts: optional catalogFingerprint on
  InstallSnapshot, passed through by writeInstallSnapshot /
  readInstallSnapshot; 'absorbed' and 'absorbed-behind' added to
  AppStoreStatus; get_app_status derives them from the snapshot's
  catalogFingerprint against the current catalog fingerprint;
  absorb_from_catalog(id, definition, catalogBase?) with the refusal
  rules in design.md Decision 4 (refuses unless installed, in
  catalog, and status behind-modified, modified-current, or
  absorbed-behind; refuses on catalogVersion mismatch; records a new
  snapshot at the catalog version with catalogFingerprint set; writes
  nothing on any refusal); manage_update refuses absorbed ('has no
  update available') and treats absorbed-behind as a
  confirmed-overwrite case; manage_restore refuses absorbed.
- pkg/src/apps/index.ts and pkg/src/index.ts: absorb_from_catalog
  re-exported and added to the MCP export list.
- catalog/app-store/store.js: storeBadge gains 'Absorbed' and
  'Absorbed · update available'; each row gains a <details
  class='store-details'> with a <summary> naming the action and a
  <code> child holding the prompt, built with textContent; prompts
  per design.md Decision 2 (Update, Absorb, Restore, Overwrite,
  Remove, Install). No copy button and no Clipboard API use.
- catalog/app-store/store.css: scoped .store-details rule; the
  summary meets the 48px minimum tap target.
- Tests: fixture rows for every status in
  catalog/tests/app-store-tests.cjs; absorb cases in
  tests/store-harness.ts (absorb behind-modified and modified-current
  fixtures, reads absorbed, state preserved, plain update refused,
  catalog bump to absorbed-behind, absorb again, refusal
  write-nothing for up-to-date / mismatched version / snapshot-less).
- openspec/specs/app-registry/spec.md: synced with the new 'Store row
  agent-prompt details' and 'Absorb a modified catalog app'
  requirements and the MODIFIED 'Install snapshot' and 'Update status
  and confirmed updates' requirements.

## Verification (2026-11-11, branch close-v4-tail, branch-final run)

- bun run typecheck from pkg/: exit 0, 0 errors.
- bun tests/store-harness.ts: 187 PASS, 1 FAIL — the FAIL is the
  pre-existing stale hardcoded check expecting package version 4.1.3
  (not fixed here, per scope).
- bun tests/catalog-harness.ts: ALL PASSED (18 apps).
- bun tests/agent-tools-harness.ts: 40 PASS, 1 FAIL — the FAIL is the
  pre-existing 16-apps count (list_catalog returns 16 apps — got 18).
- bun catalog/tests/app-store-tests.cjs: 120 ok.
- Mock: the v21 Store was installed in the mock and the served page
  verified at the time; the branch-final mock runs the v27 Store
  (see the agent-prompt-pattern close-out for the v27 mock record).

## Deviations and what was left unchecked

- The details placement and prompt text this change specified were
  superseded by later changes in the same session: the details
  element now appends to li (store-row-details-layout, v23), not
  into .store-body, and the prompt text is now the one-liner
  (agent-prompt-pattern, v27). The bundle tests assert the final
  form; tasks 5.1, 5.2, and 6.1 are left unchecked with notes in
  tasks.md.
- Task 6.2 ran under bun with the ephemeral jsdom-test fixture
  (jsdom 26.1.0), not under node as written.
- Task 8.4 (bun build) has no recorded run for this change.
- Task 3.3: hidden flags, homepage placement, and recency have no
  dedicated absorb check (state and pins are verified).
- Tasks 4.1 and 4.2: the absorbed-behind halves (confirmed-overwrite
  update; restore refusal) are in the code but have no harness check.

## Version decision

MINOR, 4.1.11 to 4.2.0 (new MCP export). Recorded here, not in an
implementation commit — no commit was made; the user directed this
work stays uncommitted.

## Open follow-ups

None specific to this change. The Store's minPackageVersion question
belongs to the v27 agent-prompt-pattern change (see its close-out).
