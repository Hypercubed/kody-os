# Spec Delta

## Purpose

Give the shell and panel title bars the adapted
system.css look — slimmer visual strip, larger
title relative to the bar, denser stripes, visible
box glyphs — while keeping every 48px hit slot,
every navigation destination, and the
exactly-one-title rule.

## MODIFIED Requirements

### Requirement: Single shared chrome

The title bar part of this requirement changes
as follows; the rest (menu strip, main content,
footer, clock, close-box destinations, document
title) is unchanged. Every page SHALL use the
same chrome, whose title bar is a racing-striped
strip with a centred title on a white bordered
plate, in the shell font stack, single line with
ellipsis for long titles. The title SHALL be
larger relative to the bar than the pre-change
0.9375rem title, within the 48px-slot constraint
below. The close box SHALL carry a visible X
glyph at rest, black on white, inverting on
hover / active exactly as the box does today;
expand / collapse boxes SHALL carry a readable
glyph (corner bracket or diagonal, whichever
the implementation phase records as reading
better at Scribe resolution) and SHALL keep
their current meanings and destinations.

#### Scenario: Title truncates, never wraps

- **WHEN** an app page with a long title is
  fetched at Scribe width
- **THEN** the title bar stays one line tall,
  the title truncates with ellipsis, and no
  box slot is pushed out of the bar.

#### Scenario: Close glyph is visible at rest

- **WHEN** any page with a close box is fetched
- **THEN** the close box shows an X glyph
  before any hover or press, and pressing it
  still navigates to the opener (or Home on
  a bad / missing `from`).

#### Scenario: Exactly one title bar per app view

- **WHEN** an app page is fetched
- **THEN** the rendered HTML still contains
  exactly one title header for the app (the
  shell window's), and the panel body starts
  directly with the description or first
  state field — a nicer panel bar does not
  become a second app title.

#### Scenario: Unknown routes keep the chrome
- **WHEN** a request hits an unknown path
- **THEN** the shell responds 404 inside the full chrome with plain "Not found." text and no home link in the body; the titlebar close box is the way back.

#### Scenario: Header order and clock
- **WHEN** any page is fetched
- **THEN** the header reads brand, Home, Apps left to right with no Refresh link and no static Help link, then any installed menu-app links in label order, and shows a date + time on the far right.

#### Scenario: Defaults preserve current rendering
- **WHEN** no theme file is present
- **THEN** title, brand, and background are byte-identical to the pre-change shell.

#### Scenario: Footer carries no auth path
- **WHEN** any page is fetched
- **THEN** the footer shows status text, date, and time, and does NOT state an auth path — the strings `via kody` and `locked` SHALL NOT appear in any served page.

#### Scenario: Footer names the auth path
- **WHEN** any page is fetched
- **THEN** RETIRED by this change (see "Footer carries no auth path" above): the footer SHALL NOT state an auth path, because the shell performs no access check.

#### Scenario: Close returns to the opener
- **WHEN** an app opened from the Apps page is closed via the titlebar box
- **THEN** the browser lands on the Apps page, not Home.

#### Scenario: Close from Home returns Home
- **WHEN** an app opened from a home widget is closed via the titlebar box
- **THEN** the browser lands on Home.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

### Requirement: Scribe-ready styles, inlined

The title-bar styles in this change SHALL live
in `pkg/public/styles.css` and be regenerated
into `pkg/src/shell-css.ts`, byte-identical,
with zero external stylesheet `<link>` tags,
zero webfonts, and zero gradients for stripes
or glyphs. Every title-bar hit slot (close,
expand, collapse, modal expand, widget expand)
SHALL be at least 48px in both dimensions,
at full width and under 30rem.

#### Scenario: Tap slots survive slimming

- **WHEN** the landed title bar is rendered at
  Scribe width and under 30rem
- **THEN** every box in it measures at least
  48px by 48px, whatever the visual height
  of the striped strip itself is.

#### Scenario: No external stylesheets anywhere
- **WHEN** any shell page is fetched
- **THEN** its HTML contains exactly one `<style>` block, zero `<link rel="stylesheet">` tags, and the inlined CSS is byte-identical to `public/styles.css`.

## ADDED Requirements

### Requirement: Shared title-bar look across bars

The shell window title bar (`.os-titlebar` /
`.os-title`) and the app panel title bar
(`.app-titlebar` / `.app-title-plate`) SHALL
share title size, plate padding, stripe tile,
box glyphs, and hover / active behavior,
except where their different slot layouts
(absolute slots on the shell bar, padded slots
on the panel bar) force a difference, which
SHALL be commented in `pkg/public/styles.css`.

#### Scenario: Panel bar matches shell bar

- **WHEN** a modal overlay and an app page
  for the same app are compared
- **THEN** their title bars read as the same
  component — same title size, same stripes,
  same close glyph — differing only in the
  slot layout their pages require.

### Requirement: Inactive title bar (only if a use is found)

This requirement applies only if Phase 4 of
`tasks.md` finds a real use for it; otherwise
it is dropped with the phase. When it applies,
an inactive title bar SHALL show its title in
grey with the stripes dropped, keeping the
same 48px slots and the same glyphs as the
active bar.

#### Scenario: Inactive bar is recognizably inactive

- **WHEN** a page renders an inactive title bar
- **THEN** its title is grey, its strip carries
  no racing stripes, and its boxes are still
  tappable at 48px.
