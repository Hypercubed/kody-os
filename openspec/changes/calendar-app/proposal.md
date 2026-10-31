# Proposal

## Why

There is a Clock app but no Calendar app, and the previous
`clock-calendar` change tried to answer that by extending the package:
new `fromNow` and `calendar` effect ops in the registry, plus two test
fixtures. That was the wrong shape for the actual need. A calendar is
display-only: the month grid is pure date arithmetic, and date
arithmetic is exactly what bundle JavaScript is for. No server state,
no action, and no effect op is required to show a month and step
between months.

## What Changes

- One new catalog app, id `calendar`: a fully JS-driven month
  calendar bundle in `pkg/catalog/calendar.bundle.json`, listed in
  `pkg/src/apps/catalog.ts` like every other catalog app.
- The bundle renders a month grid from the device-local date,
  highlights today, and steps prev/next month entirely in the page:
  no navigation, no fetch, no `act()`, no server state. Opening the
  app always starts on the current month, because nothing is
  persisted — that is the stated behavior, not a gap.
- Nothing else changes: no registry change, no new effect op, no
  stateSchema field, no action, no MCP surface change, no
  storage-key or export-format change.

## Capabilities

### New Capabilities

- `calendar-app`: a month-grid calendar app in the shipped catalog.

### Modified Capabilities

(none)

## Impact

- `pkg/catalog/calendar.bundle.json` (new), `pkg/src/apps/catalog.ts`
  (one import line, alphabetical), `pkg/catalog/README.md` (one entry).
- No `pkg/src/` logic change. The catalog harness covers the new
  bundle automatically once it is imported (validate + install +
  initial state + directory/import match).
- Publish as MINOR (a new catalog app), shared with the pending
  open-mode/agent-tools MINOR if they land together — not a second
  bump.
