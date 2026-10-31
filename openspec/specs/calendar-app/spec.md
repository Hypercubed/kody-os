# Calendar App

## Purpose

The shipped catalog contains a Calendar app that renders a month grid entirely from bundle JavaScript, with no persistent state, no registry change, no effect op, and no server state.

## Requirements

### Requirement: Calendar app in the shipped catalog

The catalog SHALL contain a Calendar app (id `calendar`) that renders a month grid entirely from bundle JavaScript, with no persistent state: `stateSchema` is `{ type: "object", initial: {}, fields: {} }` and `actions` is `{}`. It SHALL NOT depend on any registry change, effect op, or server state.

#### Scenario: Current month on open
- **WHEN** the Calendar app is opened
- **THEN** it shows the device-local current month, with today highlighted, regardless of any month previously viewed.

#### Scenario: Sunday-first grid
- **WHEN** a month is rendered
- **THEN** the weekday header is Su Mo Tu We Th Fr Sa, days of the month fall in their correct weekday columns, and cells outside the month are blank.

#### Scenario: Leap year and month length
- **WHEN** February 2024 is rendered
- **THEN** it shows 29 days; February 2026 shows 28 days; October 2026 shows 31 days.

#### Scenario: Year rollover navigation
- **WHEN** prev is pressed on December 2026
- **THEN** January 2027 renders; next from January 2027 returns to December 2026.

#### Scenario: Navigation never leaves the page
- **WHEN** prev or next is pressed
- **THEN** the grid re-renders in place with no navigation, no fetch, and no `act()` call, and no server state changes.

#### Scenario: Stateless install
- **WHEN** the Calendar definition is installed via `add_app` in a blank store
- **THEN** validation passes, the app appears in `list_apps`, and its state is the empty initial state.

### Requirement: Calendar hosting constraints

The Calendar bundle SHALL meet the same hosting constraints as every catalog bundle: ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, and an icon that is a plain glyph or sanitized SVG, never emoji.

#### Scenario: Ceiling scan
- **WHEN** the bundle script is scanned
- **THEN** there are zero hits for `?.`, `??`, `replaceAll`, `.at(`, or template literals.
