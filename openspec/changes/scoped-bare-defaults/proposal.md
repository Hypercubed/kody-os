# Proposal

## Status note

This change is a record, not a future plan. The implementation it
describes was already made on 2026-11-04 in the local working tree
(PC repo, committed as `ef654da` and published to Kody as v2.6.0 build 31): the scoped
defaults in `pkg/public/styles.css`, the regenerated
`pkg/src/shell-css.ts`, 17 cleaned catalog bundles, and the updated
style guide and adding-an-app skill. The tasks in tasks.md are marked
done where they are done; the open tasks are the Phase 5 review items (visual check, News bold, pill calls, harness backstop); the ship decisions in 5.4-5.5 have since happened (pushed as `ef654da`, published as v2.6.0 build 31) and are recorded there. Nothing in this change commits,
pushes, or publishes anything.

## Why

The shell already had a shared look, and the rule for using it was
already written down: the Oct 27 style guide and the adding-an-app
skill both said to use the shell's `os-*` classes and not to copy or
redefine them. The Nov 3 audit showed the rule had failed in practice:
zero uses of any `os-*` class inside any catalog bundle, while
per-app classes reinvented the same look — `.ag-btn` (Arrow Game),
`.cp-btn` (Cellular Playground), `.tb-btn` (3-Bit Art), `.hw-btn`
(Hoodie Weather), `.calc-key` (Calculator) — and declarations
repeated across bundles (`background: #fff`, 48px minimum heights,
the same system-ui font stack, `padding: 16px`, 2px `#111` borders).
A system that depends on every future agent remembering a class name
has already failed its own test.

Scoped bare defaults invert the mechanism: a plain `<button>`,
`<input>`, or `<select>` written by any agent inside a bundle is
correct by default, because the shell theme gives it the shell look.
Classes shrink to what a bare element cannot express: variants
(dark, selected, readout, keypad grid, pill shape) and hooks that
JavaScript, tests, or widget rules query. That is also what the owner
likes about system.css — base-element overrides rather than classes
that are easily ignored — adapted to this shell instead of imported
from it: no webfonts, no gradients, no external assets.

## What Changes

- A set of bare-element defaults in `pkg/public/styles.css`,
  scoped to the bundle container (`.bundle`) only. Buttons:
  48px minimum height and width, the shell font, 20px, normal
  weight, paper background, ink text, 1px border, 2px hard shadow,
  square corners, `0 16px` padding; hover stays paper; active inverts with no
  shadow and no press shift; disabled greys with no shadow.
  Fields (`input`, `select`, `textarea`): 48px minimum height,
  shell font, 16px, paper/ink, 1px border, 4px radius,
  `10px 12px` padding; disabled greys. One pinned variant rule,
  `.bundle button.os-btn--dark` (hover stays ink), because
  `.bundle button:hover` would otherwise outrank it and wash a
  dark button back to paper.
- `pkg/src/shell-css.ts` regenerated from `styles.css` with the
  repo's own generator; its diff reflects only the styles change.
- All 17 catalog bundles that carried duplicated look rules
  cleaned up: per-app button look rules deleted, wrapper
  font/color/background re-declarations deleted, markup
  normalized to bare elements or shared classes where a shared
  class is the variant (Calculator: `os-display`, `os-keypad`,
  `os-key`). Each touched bundle's `catalogVersion` increments
  by exactly 1; Help is untouched (it had no bundle CSS) and
  gets no bump. (About and Help have since left the catalog - see `help-about-built-in` - so the 17-bundle list here, which includes `about`, is the Nov 4 catalog, not the current 18-app one.) No app behaviour, JavaScript logic, state,
  content, or tile icon changes.
- The style guide (`pkg/docs/style-guide.md`) and the
  adding-an-app skill (`pkg/.agents/skills/adding-an-app/SKILL.md`)
  rewritten where they stated the old class rule, to state the
  new rule instead.
- Test files updated only where a selector had to follow a
  stripped class (`three-bit-canvas.cjs`, `hoodie-tests.cjs`) and
  where the daily-feed version expectation had to follow the
  mandated bump (`daily-feed-tests.cjs`). No test assertion was
  changed.

## Capabilities

### New Capabilities

- `bundle-styles`: scoped bare defaults inside the bundle
  container, with classes only for variants.

### Modified Capabilities

- `authoring`: the style guide and adding-an-app guidance gain
  the bare-defaults rule and lose the old "use the `os-*` class
  names" rule. The `catalogVersion` rule itself is unchanged:
  a definition change increments the touched bundle's version
  by exactly 1.
- `os-theme`: the shell theme source (`pkg/public/styles.css`)
  gains the `.bundle` defaults. The shell's global bare rules
  and all shell chrome (tiles, menubar, title bars) are
  unchanged.

## Impact

- Changed (working tree, uncommitted): `pkg/public/styles.css`
  (+87 lines), `pkg/src/shell-css.ts`, 17 catalog bundles
  (about, app-store, arrow-game, calculator, calendar,
  cellular-playground, clock, counter, daily-feed, eight-ball,
  hoodie-weather, link-drop, mac-puzzle, news, probe,
  three-bit-art, xkcd), `pkg/docs/style-guide.md`,
  `pkg/.agents/skills/adding-an-app/SKILL.md`, and the three
  catalog test files above — 24 files in total, matching the
  implementation's `git diff --stat`.
- Unchanged: app behaviour, state, content, tile icons, shell
  chrome, the `systemcss-title-bars` and `shared-svg-icons`
  changes, and every live installed definition (a publish
  changes code, not stored app state, so a live install keeps
  its old bundle until it is re-added or updated from the
  catalog — the same re-add path as any catalog change).
- Out of scope: system.css title bars, menus, dialogs,
  scrollbars, and modals (the companion `systemcss-title-bars`
  change); the shared SVG icon folder (the companion
  `shared-svg-icons` change); a runtime icon or style registry;
  and any commit, push, or publish decision, which is the
  owner's at ship time.
- Version: at implementation time the working tree package was 2.6.0, build 30; the implementation commit recorded that version and it shipped as build 31. The package is now 2.8.0.
  This change does not decide the version; the implementation
  commit recorded it, per `pkg/AGENTS.md`, as it does the
  build +1 on a Kody publish. A visible style change across
  all apps is at least a MINOR, but that call is not made
  here.
