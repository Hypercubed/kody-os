# Tasks

## 1. Bundle

- [ ] 1.1 Author `pkg/catalog/calendar.bundle.json` (id `calendar`,
  schemaVersion 5, `ui.title` Calendar, `ui.actions` [], no `openAs`
  and no `placements`, `stateSchema` `{ type: "object", initial: {},
  fields: {} }`, `actions` {}, sanitized icon per the existing icon
  rules, user-facing description stating the app always opens on
  the current month and keeps no state): bundle JavaScript renders
  a Sunday-first month grid from the device-local date with a
  month/year title, today highlighted, blank padding cells, and
  prev/next buttons that re-render in place with no navigation,
  no fetch, and no `act()`; one inline `<style>`, inlined assets
  only, zero external links, ES2019 script per
  `pkg/docs/scribe-limitations.md`
- [ ] 1.2 Register the bundle in the catalog: one import line in
  `pkg/src/apps/catalog.ts` (alphabetical by id) plus one entry in
  `pkg/catalog/README.md`; verify the catalog harness passes
  (validate + install in a blank store + empty initial state +
  directory/import match) with no other catalog file changed

## 2. Verification

- [ ] 2.1 Prove the grid in jsdom (harness outside `pkg/`, run
  with bun): February 2026 renders 28 days starting Sunday;
  October 2026 renders 31 days starting Thursday; February 2024
  renders 29 days (leap year); prev from December 2026 lands on
  January 2027 and next from January 2027 lands back on December
  2026; today is highlighted for a mocked device date; prev/next
  clicks cause no navigation and no fetch calls
- [ ] 2.2 Run the ES2019 ceiling scan on the bundle script (zero
  hits for `?.`/`??`/`replaceAll`/`.at(`/template literals) plus
  the catalog harness and the Counter harness green, and verify
  `openspec validate --changes` passes if the binary is available
  (otherwise check the change shape manually, as with other
  changes in this environment)
- [ ] 2.3 Apply the MINOR version bump in the same commit as the
  code per `pkg/AGENTS.md` (shared with the pending open-mode /
  agent-tools MINOR if they land together, not a second bump;
  `pkg/AGENTS.md` + `pkg/README.md` headers updated, BUILD +1 on
  publish)
