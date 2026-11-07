# Tasks

Phases land in order: 0, then 1, then 2, then 3.
Phase 4 is optional and Phase 5 is verification;
neither starts until its predecessor's Scribe-width
check passes. Each phase is independently shippable
and independently revertible: a later phase never
depends on an earlier phase's exact values, only on
its decisions. No task in this file commits, pushes,
or publishes anything, and no task bumps the package
version; the version decision is recorded in the
implementation commit (MINOR per proposal.md, build
+1 on publish) when a phase actually lands.

## 0. Baseline and the height decision

- [ ] 0.1 Record the current title bars before
  changing anything: shell window bar
  (`.os-titlebar` / `.os-title` / `.os-box`),
  app panel bar (`.app-titlebar` /
  `.app-title-plate`), and the expand / collapse
  and modal / widget expand boxes, with their
  heights, title sizes, stripe tile, and hit
  slots, at full width and under 30rem (where
  the window frame drops and the panel border
  returns). Keep the record in this change so a
  later phase can be compared against it.
- [ ] 0.2 Decide Decision 1 in design.md on
  evidence, not preference: can the visual bar
  drop below 3rem while every slot keeps a
  48px hit area, without colliding with the
  menubar above or the panel below at Scribe
  width? If the test fails, the bar stays 3rem
  and later phases slim inside it; record the
  outcome here either way, because Phase 1's
  values depend on it.
- [ ] 0.3 Confirm the Scribe check for each
  phase: render the changed bars at Scribe
  width (and under 30rem) with a long title
  (ellipsis, no wrap), a short title, and a
  modal overlay open, and record what was
  checked. A `kody dev` check that could not
  run in the working environment must be
  recorded as substituted — by which harness
  and why — not as done. (Kept Nov 6, 2026: checks the named Scribe-width behaviors per phase — ellipsis, modal, under-30rem — that gate the next phase, not a routine check.)
## 1. Title treatment: size, plate, stripes

- [ ] 1.1 In `pkg/public/styles.css`, move the
  title toward the system.css proportion within
  the shell font stack: a larger title relative
  to the bar than today's 0.9375rem, keeping
  bold weight, 0.04em letter-spacing, the white
  bordered plate, and single-line ellipsis.
  Apply to `.os-title` and `.app-title-plate`
  together (Decision 5), and keep the title
  centred on the stripes in both.
- [ ] 1.2 Adjust the stripe density if the
  larger title needs it: change the `--stripes`
  SVG tile (rule spacing) rather than replacing
  it with a gradient, and check that the shell
  window bar, the panel bar, and any other
  stripes consumer still read as stripes, not
  as a solid or a moiré, at Scribe width.
- [ ] 1.3 Regenerate `pkg/src/shell-css.ts`
  from `pkg/public/styles.css` and verify the
  two are byte-identical, then check every
  page that carries a title bar (dashboard,
  Apps, an app page, a modal overlay, a home
  widget, the logout confirm, the 404 page)
  for truncation, wrap, or slot collision.
- [ ] 1.4 Update the title-bar section of
  `pkg/docs/style-guide.md` to the landed
  sizes and stripe density, so the guide
  matches the theme.

## 2. Box glyphs: close, expand, collapse

- [ ] 2.1 Give the close box a visible glyph
  at rest: an X drawn with CSS pseudo-elements
  (or, if the `shared-svg-icons` folder exists
  by then, that folder's close SVG — never a
  second copy), black on white, inverting with
  the box on hover / active exactly as the
  blank square does today. Keep the 3rem /
  48px slot and the close destination logic
  unchanged; check the glyph at 1-bit e-ink
  resolution and keep the blank square if it
  reads as a smudge (see design.md Risks).
- [ ] 2.2 Do the same readability pass for
  expand / collapse (`.os-expand`,
  `.os-collapse`, `.modal-expand`,
  `.widget-expand`): keep their meanings and
  slots, and either keep the corner-bracket
  glyphs or try a system.css-style diagonal
  glyph, whichever reads better at 0.75rem on
  the Scribe. Record which one was kept and
  why; do not rename expand to resize.
- [ ] 2.3 Regenerate `pkg/src/shell-css.ts`,
  verify byte-identity, and check the boxes
  at full width and under 30rem, in shell,
  panel, modal, and widget bars, including
  the page-mode expand slot (app pages only)
  and the modal expand slot (overlays only).

## 3. Unify the two bars

- [ ] 3.1 Audit `.os-titlebar` and
  `.app-titlebar` after Phases 1–2 and remove
  any remaining gratuitous difference between
  them (title size, plate padding, stripe
  tile, box glyph, hover / active behavior)
  that is not forced by their different slot
  layouts (absolute slots on the shell bar,
  padded slots on the panel bar). Where a
  difference must stay, comment why in
  `pkg/public/styles.css` so the next editor
  does not "fix" it back into drift.
- [ ] 3.2 Repo-wide grep sweep: no remaining
  title-bar copy, comment, or test that
  describes the pre-change bar (3rem-tall
  visual with a 0.9375rem title and blank
  boxes) as current, except in this change's
  own baseline record (Phase 0).

## 4. Inactive variant (optional — use case first)

- [ ] 4.1 Find a real use for an inactive
  title bar in a single-window shell, or drop
  this phase. The candidate in design.md is
  dimming the underlying page while a `:target`
  modal overlay is open; if that cannot be
  done without a markup or selector change
  that is disproportionate to the effect,
  record that and drop the phase, including
  its spec delta, rather than shipping it.
- [ ] 4.2 Only if 4.1 finds a use: add the
  inactive variant (grey title, stripes
  dropped, same 48px slots, same glyphs) to
  the shell bar and the panel bar, regenerate
  `pkg/src/shell-css.ts`, and verify the
  active / inactive switch at Scribe width.

## 5. Verify and sync specs

- [ ] 5.1 Run the harnesses for the areas
  changed (repo harnesses from the repository
  root, catalog-bundle tests where a panel
  rendering is involved) and record the
  results; a failing harness is a real signal
  and is not waved through as pre-existing
  without a clean-checkout check naming the
  failing check.
- [ ] 5.2 Sync the canonical specs: update
  `openspec/specs/shell` from this change's
  spec delta, and update `pkg/docs/
  style-guide.md` if any phase changed the
  look after its own task already did so.
  Record the version decision in the
  implementation commit (MINOR per
  proposal.md, build +1 on publish).
- [ ] 5.3 Scribe check, per phase, on a real
  device or a faithful Scribe-width preview:
  every title bar, long and short titles,
  modal open, narrow screen, and every box
  tappable at 48px. Record what was checked
  and what was substituted, if anything. (Kept Nov 6, 2026: checks the named per-phase Scribe behaviors — title ellipsis, modal, 48px tappability at narrow width — not a routine check.)
