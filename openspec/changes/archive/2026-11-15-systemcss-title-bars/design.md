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
`pkg/src/shell-css.ts` is generated from it),
plus the app-help change on this branch, which
this change builds on rather than revisits:

- `.os-titlebar`: min-height 3rem, padding
  0.3rem 3.5rem (6.5rem sides with `.has-help`),
  border-bottom 2px, stripes full bar height from
  the `--stripes` SVG tile (a 1px rule every 4px).
- `.os-title`: padding 0.2rem 0.85rem, border 2px,
  white background, 0.9375rem bold, letter-spacing
  0.04em, line-height 1.5, single line with ellipsis.
- `.os-box` / `.os-expand` / `.os-collapse` /
  `.os-help` (help at right:3rem, expand at right:0):
  absolute 3rem slots, full bar height, min 3rem;
  the drawn mark is a shared 0.75rem outlined square
  (flat since the help change — no hard shadow).
  Expand / collapse add a corner-bracket glyph,
  help a `?` text glyph; close is still blank.
- `.app-titlebar` / `.app-title-plate`: the same
  stripes, bordered plate, size, and weight, with
  3.5rem (6.5rem with `.has-help`) side padding
  only when the panel has boxes.
- `.modal-expand`, `.widget-expand`: same 3rem
  slots, outlined square plus corner bracket.

## Landed design (locked Nov 15, 2026, mock v12)

Iteration with the reference image (a classic Mac
"System Folder" bar) settled every open value;
_phases below implement this, not explore it:_

- Stripe band: full-width, 29px tall, centered —
  exactly as tall as the 1.7rem button squares.
  29px is 7 x 4px tile rows + 1, so a black rule
  lands flush on the band's top and bottom edges
  and lines up with the box tops and bottoms.
  The `--stripes` tile itself is unchanged (same
  4px density as today); band heights stay 4n+1px
  for the flush-rule property.
- Title: borderless (no plate border), ~1.1rem
  bold in `--os-font`, stretched to 100% bar
  height at its own width (`align-self: stretch`,
  flex-centered), white top-to-bottom — no stripe
  ever passes above or below the text.
- Boxes: 1.7rem drawn squares (up from 0.75rem),
  glyphs scaled with them (X arms 17px, bracket
  10px, `?` at 1rem), each with a 3px white halo
  (`box-shadow: 0 0 0 3px #fff`) punched over the
  stripes — stripes run up to the halo, no white
  end columns. Glyph drawing stays CSS
  pseudo-elements / text per Decision 2.
- Slots: UNMOVED — close left, expand right,
  help right:3rem, all absolute 3rem full-height
  hit targets exactly as today. Bar min-height
  2.75rem with white top/bottom padding around
  the band.
- Help: the `ui.help` layout (slot, padding,
  dialog) is untouched; only the square and halo
  restyle. Works with and without help —
  symmetric padding keeps the full-height title
  centered either way.

## Goals / Non-Goals

- Goals: the landed design above, on the shell
  window bar and on the app panel bar alike —
  29px stripe band matching the 1.7rem boxes,
  full-height borderless title, tight 3px halos,
  unmoved 48px slots with and without the help
  box — judged on the Scribe, one phase at a time.
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

1. **Tap slots stay where they are, at 48px.**
   A 48px hit slot in its current position
   (close left, expand right, help right:3rem)
   is a binding shell constraint (`pkg/docs/
   scribe-limitations.md`, repo AGENTS.md). The
   landed bar is 2.75rem tall with a 29px visual
   band inside it — the slots keep their absolute
   3rem full-height geometry exactly as today,
   and only the _drawn_ square grows (0.75rem to
   1.7rem), never the slot. Phase 0 still
   records the baseline and confirms no collision
   with the menubar above or the panel below at
   Scribe width, but the overlap question is
   settled: there is none, because the slots do
   not move. No phase may land a slot under 48px
   in either dimension or in a new position,
   including the close box on narrow screens,
   where the window frame drops away and the
   panel border returns.
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
   Stripes stay the `--stripes` tile at its
   current 4px density — the design densifies
   nothing; the band is taller (29px) because the
   boxes are bigger (1.7rem), and band heights
   stay 4n+1px so the tile's rules land flush.
3. **No webfonts; the shell font stack does the
   work.** System.css's title is Chicago_12, a
   webfont recreation. Kody-os uses system fonts
   only, so the title keeps `--os-font`
   (`"Chicago", "Geneva", Helvetica, Arial,
   sans-serif`) and the system.css quality has
   to come from size, weight, spacing, and the
   band-and-full-height-title composition, not
   from the font file. The title lands at ~1.1rem
   bold, borderless, stretched to the full bar
   height at its own width, and the single-line
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
   and its corner-bracket form, scaled to the
   1.7rem box (bracket ~10px, X arms 17px, `?`
   at 1rem); the name and the destination never
   change with the glyph. Boxes punch a 3px white
   halo over the stripes — stripes run up to the
   halo, not under the box.
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
