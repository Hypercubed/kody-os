# Design: systemcss-title-bars

## Context

See proposal.md (Why). The reference is system.css
(`sakofchit/system.css`, MIT, self-described beta, last
updated 2023-11-26 in the check recorded Nov 3,
2026), read from its docs site and its raw `style.css`.
The parts of that file that matter here, with the
adaptations forced by kody-os, are:

- `.title-bar`: a flex strip, 1.5rem tall, margin
  0.1rem top and bottom, padding 0.2rem 0.1rem, with
  racing stripes drawn as a `linear-gradient` sized
  6.666% by 13.333% and clipped to the content box.
  Its `.title` is centred (margin auto), 1.5rem bold,
  on a white background, in the Chicago_12 webfont.
- `.title-bar button`: a 40px square, 4px border,
  white background, scaled to 0.5 — an effective
  20px button. The close button's X is drawn with
  two gradient pseudo-elements whose opacity is 0
  at rest and 1 when active. The resize button's
  glyph is two gradient diagonals.
- `.inactive-title-bar`: the same strip with no
  stripes and the title in grey.

The current shell, for comparison
(`pkg/public/styles.css`, the source of truth;
`pkg/src/shell-css.ts` is generated from it):

- `.os-titlebar`: min-height 3rem, padding
  0.3rem 3.5rem (room for the left close slot and
  the right expand / collapse slot), border-bottom
  2px, stripes from the `--stripes` SVG tile
  (a 1px rule every 4px), repeated.
- `.os-title`: padding 0.2rem 0.85rem, border 2px,
  white background, 0.9375rem bold, letter-spacing
  0.04em, line-height 1.5, single line with ellipsis.
- `.os-box`: an absolute left slot, 3rem wide and
  full bar height (min 3rem). Its `::before` is a
  0.75rem square, 2px border, white, 1px hard shadow;
  hover / active turn it black, active drops the
  shadow and shifts 1px. There is no glyph in it.
- `.app-titlebar` / `.app-title-plate`: the same
  stripes, plate, size, and weight, with 3.5rem side
  padding only when the panel has a close and / or
  expand box (`.has-close`, `.has-expand`).
- `.os-expand`, `.os-collapse`, `.modal-expand`,
  `.widget-expand`: 3rem hit areas, outlined square
  plus a corner-bracket glyph.

## Goals / Non-Goals

- Goals: a title bar that reads as the system.css
  bar at a glance — slimmer visual strip, larger
  title relative to the bar, denser stripes, a
  visible glyph in each box — on the shell window
  bar and on the app panel bar alike, judged on
  the Scribe, one phase at a time.
- Non-goals: copying system.css's 1.5rem bar height
  or 20px buttons (see Decision 1); copying its
  gradient stripes or gradient glyphs (see
  Decision 2); shipping its Chicago / Geneva
  webfonts (see Decision 3); changing where any
  box navigates, what the expand control does, or
  how many title headers a page shows; menu bars,
  window panes, dialog bodies, scrollbars, or
  `.btn` (each is a separate change, if at all);
  any change to bundles, the catalog, routes,
  storage, or MCP exports.

## Decisions

1. **Tap height and visual height are separate,
   and tap height wins.** A 48px hit slot is a
   binding shell constraint (`pkg/docs/
   scribe-limitations.md`, repo AGENTS.md). The
   system.css bar is 1.5rem tall and its buttons
   are effectively 20px; neither number survives
   contact with the Scribe. Phase 0 must settle,
   before any CSS lands, whether the landed bar
   stays 3rem tall with a slimmer look inside it,
   or drops to a shorter visual height while the
   slots keep a 48px hit area that overlaps the
   bar's padding. The second option needs a
   Scribe-width layout test, not an argument:
   a slot taller than its bar can collide with
   the menubar above or the panel below. Until
   that test is done, the default is: bar stays
   3rem, visual padding and title size do the
   slimming. No phase may land a slot under 48px
   in either dimension, including the close box
   on narrow screens, where the window frame
   drops away and the panel border returns.
2. **No gradients, no external glyph assets.**
   System.css draws stripes and both box glyphs
   with `linear-gradient`, and its button borders
   with `border-image: url("./icon/...")` via
   PostCSS `svg-load()` — none of which runs
   raw on the Scribe, and gradients are out of
   the shell's own discipline (its stripes are
   an SVG tile precisely so they are not a
   gradient). Glyphs here are drawn with CSS
   pseudo-elements (borders, rotated bars) or
   with an inline SVG data URI in the shell's
   existing tile style, in monochrome only.
   Stripes stay the `--stripes` tile; a phase
   may change the tile's density (rule every
   3px instead of 4px, for example) but may not
   replace it with a gradient.
3. **No webfonts; the shell font stack does the
   work.** System.css's title is Chicago_12, a
   webfont recreation. Kody-os uses system fonts
   only, so the title keeps `--os-font`
   (`"Chicago", "Geneva", Helvetica, Arial,
   sans-serif`) and the system.css quality has
   to come from size, weight, spacing, and the
   plate-on-stripes composition, not from the
   font file. If the title grows (Phase 1), it
   grows within that stack, and the single-line
   ellipsis rule stays: a long title must still
   truncate, never wrap and push the bar taller.
4. **Visible glyphs, not press-only glyphs.**
   System.css's close X is invisible at rest
   (opacity 0) and appears only while active.
   That is not an improvement over the shell's
   blank square for telling the user what the
   box does. The landed close glyph is visible
   at rest: an X drawn in the box, black on
   white, inverting with the box on hover /
   active exactly as the box does today. The
   expand / collapse glyph keeps its current
   meaning (page-mode expand, not a Mac resize)
   and its corner-bracket form unless Phase 2's
   Scribe test shows a system.css-style diagonal
   glyph reads better at 0.75rem; the name and
   the destination never change with the glyph.
5. **One bar, two renderings — not two bars.**
   `.os-titlebar` and `.app-titlebar` are the
   same component in two places (shell window
   vs panel / modal / widget), and they drift
   if they are edited separately. Each phase
   changes both, or says explicitly why a phase
   touches only one (for example, the shell bar
   alone carries the page-mode expand slot).
   The exactly-one-title rule constrains this:
   an app page's panel must not gain a title
   header just because its bar got nicer; the
   panel bar is for modals, widgets, and the
   logout confirm, where the shell bar does
   not name the app.
6. **Inactive is a decision, not a default.**
   System.css's inactive bar (grey title, no
   stripes) has no obvious kody-os use: there
   is one centred window per page, not a stack
   of windows with one active. The only
   plausible use is dimming the underlying page
   while a `:target` modal overlay is open, and
   that needs a markup or selector change
   (CSS cannot easily style the page behind an
   overlay from the overlay itself). Phase 4
   therefore starts with the use case, not the
   CSS: if no use case survives review, the
   phase is dropped and the spec delta for it
   is removed, not shipped speculatively.
7. **Glyphs may live in the shared icon folder.**
   If the companion `shared-svg-icons` change
   lands first, a title-bar glyph that is an
   SVG (rather than a pseudo-element drawing)
   should be one of its files, not a second
   copy pasted into the theme. The two changes
   are independent — neither blocks the other —
   but the icon folder is the home for any SVG
   glyph, and a phase that invents an SVG glyph
   while duplicating it is a review failure.

## Risks

- A slimmer bar that looks right in a desktop
  browser can read as cramped on the Scribe's
  e-ink at its actual width, and a larger title
  can truncate titles that fit today. Every
  phase needs a Scribe-width check (the shell's
  narrow-screen rule already changes the frame
  under 30rem) before it is called done.
- Pseudo-element glyphs at 0.75rem are fiddly:
  an X drawn with two rotated bars can look
  like a smudge at e-ink resolution. If a glyph
  does not read cleanly at 1-bit, the phase
  keeps the blank inverting square and records
  that, rather than shipping a muddy glyph.
- The two title bars share tokens but not
  markup (absolute slots on the shell bar,
  padded slots on the panel bar). A change to
  one that is not mirrored to the other is the
  most likely regression; the tasks require
  both to be checked in every phase.
