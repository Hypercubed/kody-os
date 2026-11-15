# Baseline — title bars before systemcss-title-bars (Phase 0.1)

Recorded Nov 15, 2026 from `pkg/public/styles.css` (source of truth) on branch
`systemcss-title-bars`, before any Phase 1 edit. Compared against later phases.

## Shell window bar (`.os-titlebar` / `.os-title` / `.os-box`)

- `.os-titlebar`: `position: relative; display: flex; align-items: center;
  justify-content: center; min-height: 3rem; padding: 0.3rem 3.5rem;
  border-bottom: var(--rule); background: paper + var(--stripes) repeat full bar height.`
- `.os-title`: `max-width: 100%; margin: 0; padding: 0.2rem 0.85rem;
  border: var(--rule); background: paper; font-size: 0.9375rem; bold;
  letter-spacing: 0.04em; line-height: 1.5; single line ellipsis.`
- `.os-box` (close): absolute `top: 0; left: 0; width: 3rem; height: 100%;
  min-height: 3rem`, flex-centered, no text. Drawn mark via `::before`:
  `0.75rem` outlined square (`2px solid #000`, `#fff`), flat since help change
  (no shadow). Blank at rest; inverts to black on hover/active. Destination
  logic unchanged (opener / Home on bad-missing `from`, omitted on dashboard).
- `.os-expand` / `.os-collapse`: absolute `top: 0; right: 0; width: 3rem;
  height: 100%; min-height: 3rem`. Same `0.75rem` square + corner-bracket
  `::after` (`0.28rem`, 2px borders; expand top-right, collapse bottom-left),
  bracket inverts to white with square. Page-mode expand only on app pages.
- `.os-help` (help at `right: 3rem`, expand at `right: 0`): same slot geometry
  (`3rem` absolute full-height), `<button>` reset (transparent, no border),
  same `0.75rem` square, `?` element text in `.os-help-glyph` (`0.75rem` bold,
  +1px optical drop), slot transparent on hover/active so only square+glyph invert.
- `.os-titlebar.has-help`: symmetric `padding-left/right: 6.5rem` (two 3rem
  slots + breathing room), title stays centered with and without help.

## App panel bar (`.app-titlebar` / `.app-title-plate`)

- `.app-titlebar`: `margin: 0; padding: 0.3rem 0.5rem; border-bottom: var(--rule);
  background: paper + var(--stripes) repeat full height; text-align: center;
  font-size: 0.9375rem; line-height: 1.5.`
- `.app-title-plate`: `display: inline-block; padding: 0.2rem 0.85rem;
  border: var(--rule); background: paper; font-size: 0.9375rem; bold;
  letter-spacing: 0.04em.` Same stripes/bordered-plate/size/weight as shell bar.
- `.has-close`: `position: relative; padding-left/right: 3.5rem.`
  `.has-expand`: `position: relative; padding-right: 3.5rem.`
  `.has-help`: `position: relative; padding-left/right: 6.5rem` (wins at equal
  specificity, symmetric so plate stays centered).
- Panel boxes reuse the shell slot classes: close is `.os-box` (absolute left),
  expand is `.modal-expand` (absolute right), help is `.os-help`
  (absolute `right: 3rem`) — same `0.75rem` square, same 48px slots.

## Modal / widget expand boxes

- `.widget-expand`, `.modal-expand`: absolute `top: 0; right: 0; width: 3rem;
  height: 100%; min-height: 3rem`, same `0.75rem` square + `0.28rem`
  upward-outward corner bracket, same invert. Meanings unchanged
  (widget expand, modal expand to full page).

## Stripe tile and hit slots

- Tile: `--stripes: url("data:image/svg+xml,... width='4' height='4' ...
  rect y='2' width='4' height='1' ...")` — 1px rule every 4px, SVG tile, no gradient.
- Slots: close left, expand right, help `right: 3rem`, all absolute `3rem`
  full-height (`min-height: 3rem`), so every hit area is exactly 48px.
  Visual squares are `0.75rem` (12px) centered in the 48px slots.

## Full width and under 30rem

- Full width: `.os-window` centered `max-width: 48rem`; bars span window width;
  title truncates with ellipsis, no wrap, no slot push-out.
- Under 30rem: window frame drops (`width: 100%; margin: 0; border: 0`),
  app panel becomes the single frame again (border + lift restored);
  tiles go 2-column, widgets 1-column; title bars keep the same 48px slots.
  No collision recorded between slots and menubar above / panel below:
  slots are inside the bar (absolute `top: 0`, `height: 100%`), they do not
  overlap the menubar or the panel body at either width.

## Phase 0.2 — Decision 1 confirmation

Decision 1 (design.md) holds on evidence: slots stay UNMOVED (close left,
expand right, help `right: 3rem`), all absolute `3rem` full-height geometry
exactly as today. Only the drawn squares grow (0.75rem → 1.7rem) in Phase 2;
the bar slims to `2.75rem` with a 29px visual band inside it, but the slots
keep their `3rem` full-height hit targets. Because the slots do not move and
do not shrink, there is no new overlap with the menubar above or the panel
below at Scribe width or under 30rem — the absolute slots already live inside
the bar vertically. Scribe-width check substituted by harness + static
measurement (no `kody dev` in this environment; see Phase 0.3 record).

## Phase 0.3 — Scribe-check record (substituted)

`kody dev` could not run in this working environment (no `kody` CLI here),
so every Scribe-width check in this change is substituted by:

- `bun tests/catalog-harness.ts` + `bun tests/store-harness.ts` (repo harnesses
  for the areas changed) and `node catalog/tests/app-store-tests.cjs`
  (panel rendering), plus
- static measurement of the landed CSS (band 29px = 7×4+1 so tile rules land
  flush; bar 2.75rem = 44px with 7.5px white top/bottom around the band;
  squares 1.7rem = 27.2px with 3px halos; slots still `3rem` = 48px absolute),
  plus render-string checks (exactly-one-title, ellipsis, no wrap, modal
  overlay header) via `bun -e` imports of `pkg/src/apps/render.ts`.

Per phase: long title (ellipsis, no wrap, no slot push-out), short title
(centered), modal overlay open (panel bar matches shell bar), narrow screen
(under 30rem slots still 48px). Recorded per phase in tasks 1.3 / 2.3 / 5.1 /
5.3 when each lands.
