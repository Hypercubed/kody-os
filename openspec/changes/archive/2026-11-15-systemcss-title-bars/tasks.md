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

- [x] 0.1 Record the current title bars before
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
- [x] 0.2 Confirm Decision 1 in design.md on
  evidence: the slots stay in place (close left,
  expand right, help right:3rem) at absolute 3rem
  full-height geometry, so record the Scribe-width
  check that no collision with the menubar above
  or the panel below results, and record the
  outcome here either way, because Phase 1's
  values depend on it.
- [x] 0.3 Confirm the Scribe check for each
  phase: render the changed bars at Scribe
  width (and under 30rem) with a long title
  (ellipsis, no wrap), a short title, and a
  modal overlay open, and record what was
  checked. A `kody dev` check that could not
  run in the working environment must be
  recorded as substituted — by which harness
  and why — not as done. (Kept Nov 6, 2026: checks the named Scribe-width behaviors per phase — ellipsis, modal, under-30rem — that gate the next phase, not a routine check.)
## 1. Title treatment: band, title, halos

- [x] 1.1 In `pkg/public/styles.css`, land the
  locked band + title (design.md "Landed design"):
  full-width 29px stripe band centered in a
  2.75rem white bar (white top/bottom padding),
  same 4px `--stripes` tile unchanged; borderless
  ~1.1rem bold title in `--os-font`, stretched
  to the full bar height at its own width
  (`align-self: stretch`, flex-centered) with
  single-line ellipsis. Apply to `.os-title`
  and `.app-title-plate` together (Decision 5),
  with and without the help box (symmetric
  6.5rem padding keeps the title centered).
- [x] 1.2 Confirm the tile is untouched (no
  density change): check that the shell window
  bar, the panel bar, and any other stripes
  consumer still read as stripes, not as
  a solid or a moiré, at Scribe width.
- [x] 1.3 Regenerate `pkg/src/shell-css.ts`
  from `pkg/public/styles.css` and verify the
  two are byte-identical, then check every
  page that carries a title bar (dashboard,
  Apps, an app page, a modal overlay, a home
  widget, the logout confirm, the 404 page)
  for truncation, wrap, or slot collision.
- [x] 1.4 Update the title-bar section of
  `pkg/docs/style-guide.md` to the landed
  sizes and stripe density, so the guide
  matches the theme.

## 2. Box glyphs: close, expand, collapse, help

- [x] 2.1 Grow the drawn squares to 1.7rem and
  give the close box a visible glyph at rest: an
  X (arms 17px) drawn with CSS pseudo-elements
  (or, if the `shared-svg-icons` folder exists
  by then, that folder's close SVG — never a
  second copy), black on white, inverting with
  the box on hover / active exactly as the
  blank square does today. Punch a 3px white
  halo (`box-shadow: 0 0 0 3px #fff`) over the
  stripes around every box. Keep every slot's
  position and 48px hit area and the close
  destination logic unchanged; check the glyph
  at 1-bit e-ink resolution and keep the blank
  square if it reads as a smudge (see design.md
  Risks).
- [x] 2.2 Do the same readability pass for
  expand / collapse (`.os-expand`,
  `.os-collapse`, `.modal-expand`,
  `.widget-expand`) and help (`?` at 1rem):
  1.7rem squares, corner-bracket glyphs at ~10px
  (help keeps its text glyph), keep their
  meanings, slots, and destinations. Record the
  Scribe read; do not rename expand to resize.
- [x] 2.3 Regenerate `pkg/src/shell-css.ts`,
  verify byte-identity, and check the boxes
  at full width and under 30rem, in shell,
  panel, modal, and widget bars, including
  the page-mode expand slot (app pages only)
  and the modal expand slot (overlays only).

## 3. Unify the two bars

- [x] 3.1 Audit `.os-titlebar` and
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
- [x] 3.2 Repo-wide grep sweep: no remaining
  title-bar copy, comment, or test that
  describes the pre-change bar (3rem-tall
  full-height stripes with a 0.9375rem bordered
  title and blank 0.75rem boxes) as current,
  except in this change's own baseline record
  (Phase 0).

## 4. Inactive variant (optional — use case first)

- [x] 4.1 Find a real use for an inactive
  title bar in a single-window shell, or drop
  this phase. The candidate in design.md is
  dimming the underlying page while a `:target`
  modal overlay is open; if that cannot be
  done without a markup or selector change
  that is disproportionate to the effect,
  record that and drop the phase, including
  its spec delta, rather than shipping it.
- [x] 4.2 Only if 4.1 finds a use: add the
  inactive variant (grey title, stripes
  dropped, same 48px slots, same glyphs) to
  the shell bar and the panel bar, regenerate
  `pkg/src/shell-css.ts`, and verify the
  active / inactive switch at Scribe width.

## 5. Verify and sync specs

- [x] 5.1 Run the harnesses for the areas
  changed (repo harnesses from the repository
  root, catalog-bundle tests where a panel
  rendering is involved) and record the
  results; a failing harness is a real signal
  and is not waved through as pre-existing
  without a clean-checkout check naming the
  failing check.
- [x] 5.2 Sync the canonical specs: update
  `openspec/specs/shell` from this change's
  spec delta, and update `pkg/docs/
  style-guide.md` if any phase changed the
  look after its own task already did so.
  Record the version decision in the
  implementation commit (MINOR per
  proposal.md, build +1 on publish).
- [x] 5.3 Scribe check, per phase, on a real
  device or a faithful Scribe-width preview:
  every title bar, long and short titles,
  modal open, narrow screen, and every box
  tappable at 48px. Record what was checked
  and what was substituted, if anything. (Kept Nov 6, 2026: checks the named per-phase Scribe behaviors — title ellipsis, modal, 48px tappability at narrow width — not a routine check.)

## Implementation record (Nov 15, 2026)

- 0.1/0.2/0.3: baseline in `baseline.md`; slots UNMOVED at absolute 3rem; Scribe-width checks substituted (no `kody` CLI here) by catalog harness + store harness + app-store bundle tests + static CSS/render-string checks.
- 1.1–1.4: landed 29px band (`::before`, same 4px tile), 2.75rem white bars, borderless 1.1rem stretch titles on `.os-title` + `.app-title-plate`, symmetric 6.5rem help padding; `shell-css.ts` regenerated BYTE-IDENTICAL (42610 chars); style-guide section 1 updated.
- 2.1/2.2/2.3: squares 1.7rem + 3px halos everywhere; close X (`×`, 1.1rem, inverts with box, blank-square fallback commented); brackets 10px recentered (expand/widget/modal + collapse mirror); help `?` at 1rem; slots/destinations unchanged; `shell-css.ts` regen BYTE-IDENTICAL; no gradients for stripes/glyphs, no external stylesheet, grid-only gaps, ES2019.
- 3.1/3.2: bars share size/band/tile/boxes/glyphs/hover; forced slot-layout difference commented in CSS; grep sweep clean (remaining 0.9375rem hits are menubar/store/alert, not title bars).
- 4.1/4.2: DROPPED — no single-window use; `:target`-overlay dimming needs `:has()` (absent on Scribe Chromium 80) or disproportionate markup/JS churn; spec-delta inactive requirement removed, not shipped.
- 5.1: `bun tests/catalog-harness.ts` ALL PASSED (19 apps); `node catalog/tests/app-store-tests.cjs` ALL PASSED; `bun run typecheck` clean; `bun tests/store-harness.ts` 2 FAILED but identical on clean checkout (pre-existing storeSelf discovery-base failures, unrelated to title bars).
- 5.2: canonical `openspec/specs/shell/spec.md` synced (title-bar paragraph, Scribe-ready title-bar sentences, new Shared requirement); style-guide already updated in 1.4; version decision: MINOR + build +1 on publish (no bump in this change).
- 5.3: substituted Scribe check — static (band 29px = 7×4+1 flush; bar 44px with 7.5px white top/bottom; squares 27.2px + 3px halos; slots 48px absolute) + render-string checks (exactly-one-title with withHeader=false, ellipsis rules, modal/panel header parity) + harnesses above; no real-device check available.

## Follow-up fix (Nov 15, 2026)
- 8th stripe line was clipped: 29px band showed 7 rules (at 2,6,...,26), 8th at y=30 cut off. Band raised to 33px (8x4+1) on both shell + panel bars so 8 rules render with the last flush at the bottom, lining up with the box bottoms; specs + style-guide updated 29px→33px; `shell-css.ts` regen BYTE-IDENTICAL; validate + typecheck clean.

## Follow-up fix 2 (Nov 15, 2026)
- Buttons sat ~2.5px low vs the 33px band (squares centered in the 44px bar, band centered with less inset). Raised all header-box slots (`top: 0` → `top: -2.5px`) on `.os-box`, `.os-expand`/`.os-collapse`, `.os-help`, `.widget-expand`, `.modal-expand` so squares + glyphs move together; 48px min-height untouched; `shell-css.ts` regen BYTE-IDENTICAL; validate + typecheck clean.
