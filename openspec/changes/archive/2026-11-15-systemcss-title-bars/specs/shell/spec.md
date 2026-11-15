# Spec Delta

## Purpose

Give the shell and panel title bars the adapted
system.css look — a centered 33px stripe band,
a full-bar-height borderless title, 1.7rem boxes
with visible glyphs — while keeping every 48px
hit slot in its current position, every
navigation destination, and the
exactly-one-title rule.

## MODIFIED Requirements

### Requirement: Single shared chrome

The title bar part of this requirement changes
as follows; the rest (menu strip, main content,
footer, clock, close-box destinations, document
title) is unchanged. Every page SHALL use the
same chrome, whose title bar is a white bar
carrying a full-width racing-striped band
taller than the button squares so all eight rules show (33px:
eight 4px tile rows plus one, so a black rule
lands flush on the band's top and bottom edges,
lining up with the box tops and bottoms), in
the existing 4px `--stripes` SVG tile — the tile
density does not change. Centred on the band,
the title is white from bar top to bar bottom
at its own width (`align-self: stretch`):
borderless, no plate border, in the shell font
stack at ~1.1rem bold, single line with
ellipsis for long titles, so no stripe ever
passes above or below the text. Every box sits
in its current slot — close at left, expand /
collapse at right, help (when the app defines
`ui.help`) at right:3rem — unchanged in
position and 48px hit area; the drawn square
grows to 1.7rem with a 3px white halo punched
over the stripes so the stripes run up to the
halo. The close box SHALL carry a visible X
glyph at rest, black on white, inverting on
hover / active exactly as the box does today;
expand / collapse boxes SHALL carry a readable
glyph (corner bracket or diagonal, whichever
the implementation phase records as reading
better at Scribe resolution) and SHALL keep
their current meanings and destinations.

#### Scenario: Stripe band matches the boxes

- **WHEN** any title bar is fetched
- **THEN** the striped band is as tall as the
  drawn button squares (33px band) with a black rule
  flush on its top and bottom edges, white bar
  padding shows above and below the band, and
  no stripe passes above or below the title
  text, whose white ground runs the full bar
  height.

#### Scenario: Help layout is unchanged

- **WHEN** an app page whose definition sets
  `ui.help` is fetched
- **THEN** the help box sits in its current
  slot (right:3rem, expand at right:0) with the
  same 1.7rem square and 3px halo as the other
  boxes, the bar keeps symmetric padding so
  the full-height title stays centered, and
  pages without help render exactly as before.

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

#### Scenario: Close from an overlay returns to the overlay
- **WHEN** an app expanded from a modal overlay is closed via the titlebar box with JavaScript running
- **THEN** the browser lands on the Apps page with that app's overlay open.

#### Scenario: No stored return goes Home
- **WHEN** an app page is opened by direct navigation, bookmark, or a new tab with no stored return, or with JavaScript disabled
- **THEN** the close box links Home.

#### Scenario: A legacy from value is adopted once, then gone
- **WHEN** an app page is opened with a `?from=` value in the URL
- **THEN** the client stores the validated value, the close box returns to it, and the visible URL no longer carries `from` after load; the server ignores the value entirely.

#### Scenario: Bad from falls back to Home
- **WHEN** an app page is opened with a missing or off-site `from` value
- **THEN** the close box links Home and no open redirect occurs.

### Requirement: Scribe-ready styles, inlined

The title-bar styles in this change SHALL live
in `pkg/public/styles.css` and be regenerated
into `pkg/src/shell-css.ts`, byte-identical,
with zero external stylesheet `<link>` tags,
zero webfonts, and zero gradients for stripes
or glyphs. The stripe tile stays the existing
4px `--stripes` tile; band heights stay 4n+1px
so the tile's rules land flush. Every
title-bar hit slot (close, expand, collapse,
help, modal expand, widget expand)
SHALL keep its current position (close left,
expand right, help right:3rem) and be at least
48px in both dimensions, at full width and
under 30rem.

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
share title size, band height, stripe tile,
box size and halo, box glyphs, and hover /
active behavior,
except where their different slot layouts
(absolute slots on the shell bar, padded slots
on the panel bar) force a difference, which
SHALL be commented in `pkg/public/styles.css`.
Both bars use the same 33px band, the same
full-height borderless title, and the same
1.7rem boxes with 3px halos.

#### Scenario: Panel bar matches shell bar

- **WHEN** a modal overlay and an app page
  for the same app are compared
- **THEN** their title bars read as the same
  component — same title size, same stripes,
  same close glyph — differing only in the
  slot layout their pages require.

<!-- Phase 4 dropped Nov 15, 2026: no real single-window use for an inactive
title bar was found. The `:target`-overlay dimming candidate needs `:has()`
(absent on Scribe Chromium 80) or JS/markup churn disproportionate to the
effect, so this requirement is removed, not shipped. -->
