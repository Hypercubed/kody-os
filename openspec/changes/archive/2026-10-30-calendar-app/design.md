# Design: calendar-app

## Context

See proposal.md (Why). The shape to copy is the Clock app
(`pkg/catalog/clock.bundle.json`): a stateless bundle —
`stateSchema` is `{ type: "object", initial: {}, fields: {} }`,
`actions` is `{}`, `ui.actions` is `[]` — whose display is produced
entirely by bundle JavaScript. The Calendar differs only in that it
has navigation: prev/next month buttons that re-render the grid in
place. Those buttons are plain bundle buttons, not shell action
forms: they must not submit, navigate, or fetch, because there is
no server state for them to change.

The archived `clock-calendar` change
(`openspec/changes/archive/2026-10-30-clock-calendar/`) is the
record of the rejected approach. It is not a dependency, a
fallback, or a second phase: its `fromNow` and `calendar` effect
ops are explicitly out of scope here, and nothing in this change
revives them.

## Goals / Non-Goals

- Goals: a usable month calendar in the shipped catalog; correct
  grids for every month including leap Februaries and year
  rollovers; today highlighted; prev/next that never navigates.
- Non-goals: events, reminders, sync, week/day views, a persisted
  selected day or remembered month, a calendar effect op, a
  `fromNow` effect, any registry change, any MCP change.

## Decisions

1. **No persistent state, by direction.** The bundle keeps the
   viewed month in a page-local JavaScript variable only. Closing
   or reopening the app returns to the current month. This is
   stated in the app description and in the spec, so it is never
   mistaken for a bug. If a persisted month is ever wanted, it is
   a new change (a `monthOffset` field plus `set` actions), not
   a quiet addition to this one.
2. **Sunday-first grid.** Weekday header Su Mo Tu We Th Fr Sa;
   leading/trailing cells outside the month are blank, not
   greyed-in adjacent-month days. Month/year title above the
   grid. Today (device-local date) is highlighted. Device-local
   time is the correct source here: "today" and month boundaries
   are the user's local calendar, not UTC.
3. **Date arithmetic via `Date`, no hand-rolled tables.** Month
   length, leap years, and year rollover all fall out of
   `Date` arithmetic (e.g. day 0 of the next month is the last
   day of this month). The harness pins this with known months
   rather than trusting the arithmetic by inspection.
4. **Same hosting constraints as every catalog bundle.**
   ES2019 script (no `replaceAll`, no `?.`, no `??`, no template
   literals in the bundle script — the Scribe ceiling in
   `pkg/docs/scribe-limitations.md`), one inline `<style>`,
   inlined assets only, zero external links, system fonts,
   high-contrast black-on-white, icon per the existing icon
   rules (plain glyph or sanitized SVG, never emoji).
5. **`openAs` omitted (page default).** Like Calculator, Puzzle,
   and xkcd after the default-open-mode change, the Calendar
   takes the page default; it declares no `openAs` and no
   `placements`.

## Risks

- **A user expects the month to stick.** Mitigation: the
  no-persistence behavior is stated in the spec, the design,
  and the app description; the app always opens on the current
  month, which is the least surprising default for a calendar.
- **Device clock wrong → grid wrong.** The grid is only as
  correct as the device date. That is true of the Clock app
  too, and there is no server time source in the shell to
  correct it; out of scope.

## Alternatives considered

- **Server-state month (`monthOffset` field + `set` actions).**
  Rejected per direction: it persists a month for no benefit
  (the current month is always the right default on open) and
  adds actions, forms, and state to a display-only app.
- **A `calendar` effect op computing the grid server-side.**
  Rejected: it is the archived `clock-calendar` approach. It
  would make the grid visible in the no-JavaScript server
  readout, but the Scribe runs JavaScript (proven by the probe
  and by every other bundle), and the cost is a registry
  change for one app's display logic.
