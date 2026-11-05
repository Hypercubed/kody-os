# Design: scoped-bare-defaults

## Context

See proposal.md (Why). The starting facts, all already true before
this change:

- Bundles render inline inside the shell page inside
  `<div class="bundle" data-bundle="...">` (see
  `pkg/src/apps/client.ts`). Scoping defaults to `.bundle`
  therefore covers every bundle and nothing else: shell chrome
  (tiles, menubar, title bars) sits outside it.
- The shell's *global* bare button rules are the wrong look:
  bold, 2px border, 3px shadow, shade on hover, shift on press.
  The shell's `.os-btn` class is the right look: 20px, normal
  weight, paper/ink, 1px border, 2px hard shadow, invert on
  active, no transform. The scoped defaults mirror `.os-btn`
  exactly and pin the global rules off inside `.bundle`,
  rather than editing the global rules and risking shell
  chrome that may rely on them.
- The Nov 3 audit (16 apps at the time) found the duplication
  this change removes: `background: #fff` in 15 apps,
  `min-height: 48px` in 13, the system-ui stack in 12,
  `padding: 16px` in 10, `border: 2px solid #111` in 8, and
  near-identical per-app button classes. Probe was the one app
  that already followed the old rule (four `os-btn` classes);
  its look is byte-identical under the new defaults, which is
  the check that the defaults match `.os-btn`.
- No canonical openspec spec previously stated the old class
  rule: a check of `openspec/specs/*/spec.md` found no mention
  of `os-btn` or `os-*`. The old rule lived only in the style
  guide and the skill, which is why this change adds a new
  `bundle-styles` spec delta rather than modifying an existing
  one.

## Goals / Non-Goals

- Goals: plain bundle markup is correct by default; the shell
  look lives in exactly one place (the theme); a variant is
  explicit in markup or in a delta-only class; no app changes
  behaviour; the catalog harness stays the backstop for
  regressions.
- Non-goals: importing system.css or any of its components;
  changing shell chrome; changing tile icons; a runtime style
  registry; changing any app's state, content, or logic; and
  deciding commit, push, or publish.

## Decisions

1. **Scope is `.bundle` only, and the global bare rules stay.**
   A global bare rule would restyle anything in the shell page
   that uses a bare element, including chrome. The scoped rule
   `.bundle button` (class + element) also beats a bundle's
   single-class look rule, so most reinventions would lose to
   the default even without editing the bundles — but the
   bundles were edited anyway, so no bundle now depends on
   winning a specificity contest.
2. **Match `.os-btn` exactly, not the average of old sizes.**
   Bare buttons are 20px even though per-app buttons were
   16–18px, because "the shared look" means the shared class's
   look. Fields are 16px (body text), not 20px; only Hoodie
   Weather has a field, so that change is 1px (17px before).
   This is the largest visible change in the implementation
   and the main thing the visual check in tasks.md must cover.
3. **Dark variant is pinned, not left to cascade.**
   `.bundle button.os-btn--dark` and its `:hover` state are
   written explicitly (hover stays ink), because
   `.bundle button:hover` would otherwise outrank
   `.os-btn--dark:hover` and wash a dark button back to paper.
   Cellular Playground toggles and the News active tab use it.
4. **State and variant rules are dual-selected where they
   must win.** Arrow Game cells, Puzzle tiles, and Three-Bit
   swatches carry rules written as both `.x` and
   `.bundle button.x` (including selected/blank/disabled
   states), so neither the bare default nor its `:disabled`
   grey can wash a game state out. Puzzle tiles pin their
   disabled ink/border for the same reason.
5. **Classes kept as hooks and markers, not styles.**
   `news-tab` / `news-tab-on` (active marker, aria-pressed
   checks), `hw-btn` (widget-hide rule and its test assertion),
   `cal-prev` / `cal-next`, `store-retry`, `news-retry`,
   `ball-shake`, `cp-auto` / `cp-paint` (JavaScript queries)
   keep their names with look CSS deleted; they carry layout,
   widget visibility, identity, or a test contract only.
   Removing them too would need test selector updates like
   the three-bit one, and buys nothing a reader can see.
6. **Pill shapes are variants; Puzzle New Game is not.**
   Counter and Eight Ball keep pill deltas (border-radius
   and padding only; font, border, and shadow now come from
   the default), because the shape reads as intentional.
   Puzzle's New Game was flattened to the bare default
   (radius 4 not 0, 2px shadow not 3px, normal weight, no
   press shift) on the judgement that its differences were
   drift, not a variant. Either call is reversible at review.
7. **News active tab loses its bold.** The old
   `.news-tab-on` was bold + inverted; the new active tab is
   inverted via `.os-btn--dark` only. Inversion remains the
   state cue, per the style guide's principle 2. Bold can be
   restored with a marker rule if the owner wants it back.
8. **`catalogVersion` +1 per touched bundle, no others.**
   Per the authoring spec rule (positive integer, +1 on any
   definition change): about 2→3, app-store 6→7, arrow-game
   3→4, calculator 2→3, calendar 2→3, cellular-playground
   3→4, clock 2→3, counter 2→3, daily-feed 2→3, eight-ball
   2→3, hoodie-weather 5→6, link-drop 1→2, mac-puzzle 2→3,
   news 2→3, probe 4→5, three-bit-art 17→18, xkcd 2→3.
   Help is untouched and unbumped.
9. **Docs are part of the change, not an afterthought.**
   The style guide and skill are where the next agent will
   look, and they are what stated the failed rule. Both now
   state the bare-defaults rule. A drive-by correction inside
   the edited style-guide note: "Daily Brief's Previous/Next"
   became "Daily Feed's" (Daily Brief was deleted Nov 4).
10. **Tests follow selectors, not assertions.** The only
    test changes are selector updates where a class was
    stripped (three-bit gallery buttons, hoodie result
    buttons) and the daily-feed version expectation (2→3).
    No assertion was weakened. The remaining suite failures
    are pre-existing on a clean tree (counter "k param
    preserved", hoodie "no external href references" and "k
    is preserved", news description text, store combined-rows
    19 rows) and are unchanged by this change.

11. **Review fixes (Nov 4, during owner review).** Bundle buttons
    are square (border-radius: 0), overriding the 4px `--os-radius`
    token that `.os-btn` itself still carries; the scoped
    `.bundle button` rule outranks `.os-btn` inside a bundle, so
    bundle buttons render square while pill variants keep their
    radius. Separately, modal panels get their border back: Apps
    page overlays render inside `.os-window main`
    (renderOverlaySection in apps/client.ts, sections into main
    in app.ts), so the Oct 31 single-frame rule
    (`.os-window main .app { border: 0 }`) was stripping modal
    panels too, despite its comment saying modals are untouched.
    A restoring rule (`.os-window main .overlay .app`, three
    classes to two) gives modal panels `var(--rule)` and
    `var(--lift)` again. The logout modal sits outside
    `.os-window` and was never stripped. This modal fix is a
    shell correction discovered in review, not a bundle-styles
    requirement, and it is recorded here rather than in the
    spec delta.
