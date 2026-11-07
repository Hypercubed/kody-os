# Tasks

## 1. Clock app tick

- [x] 1.1 Rewrite the Clock app tick (DONE: `catalog/clock/index.html` now renders once on load, `setTimeout` for `60000 - (Date.now() % 60000)` ms, then `setInterval(renderAllClocks, 60000)`; format and cadence unchanged) in `pkg/catalog/clock/index.html` to align to the wall-clock minute boundary: on load, render once, then `setTimeout` to the next minute boundary (computed from the current time), then `setInterval` every 60,000 ms. Keep the 60-second cadence and the display format (12-hour + AM/PM, date line) unchanged. No seconds are added.
- [x] 1.2 Bump the Clock app `catalogVersion` 4 → 5 (DONE: definition set to 5, index regenerated via `bun scripts/build-catalog-index.ts` — clock entry v5; `catalog.json` + `catalog-bundles.generated.ts` regenerated, not hand-edited) in `pkg/catalog/clock/definition.json`, regenerate the index with `bun scripts/build-catalog-index.ts`, and do not hand-edit `catalog.json`.

## 2. Verify

- [x] 2.1 Catalog harness passes with Clock at catalogVersion 5 (DONE: `bun tests/catalog-harness.ts` ALL PASSED, 18 apps) (`bun tests/catalog-harness.ts`).
- [x] 2.2 Mock verification (DONE: server restarted to pick up the new catalog, clock updated to v5 via Store `manage/update`; served page 200 contains the alignment code; executed the real bundle script in node with a stub DOM/clock — load at :37 schedules a 23,000 ms timeout, fires exactly on the boundary rendering the new minute, then 60,000 ms cadence; format confirmed 12-hour + AM/PM, date line, no seconds. No literal eyeball watch — headless here — the stub-clock run of the actual bundle is the boundary evidence) — the Clock app and the header clock agree within the same minute (the Clock app flips exactly at the boundary, not up to ~59 seconds later). Confirm the display format is unchanged (12-hour + AM/PM, date line, no seconds).
- [x] 2.3 Bundle constraints (DONE: script has no `?.` / `??` / `replaceAll` / `.at(` / backticks; 2,102 bytes « 256 KiB cap; no buttons in the bundle), 256 KiB cap, 48px targets (the Clock bundle has no buttons; the ceiling and cap still apply).

## 3. Sync and archive

- [x] 3.1 Validation (DONE: `validate clocks-align --type change` valid; `validate --changes` 15 passed / 3 failed — the same pre-existing email-client, f-flat-minor-calculator, generic-rss-feed failures, no new failures) and the whole repo (`openspec validate --changes`); no new failures.
- [x] 3.2 Sync canonical spec (DONE: `openspec/specs/clock-app/spec.md` created from the delta with the `## Purpose` header the validator requires; validates valid) from the delta in this change.
- [x] 3.3 Archive (DONE: folder moved via `mv` to `openspec/changes/archive/2026-11-08-clocks-align/`, close-out note appended)

## Close-out note (2026-11-08)

Implemented and verified per the tasks above. No deviations from the delta. No shell code was changed; the header clock was already the correct reference. Mock store left tidy: clock reinstalled at v5 via the Store update path, no stray state.
