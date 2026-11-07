# Bundle Styles (scoped bare defaults)

## Purpose

Plain bundle markup gets the shell look by default. Classes exist
only for variants: states, shapes, and shared components that a
bare element cannot express.

Sync note (2026-11-07, archiving `scoped-bare-defaults`): synced from
the change delta at its current state, not its original text. The
Counter/Eight Ball pill variants are gone (removed Nov 7 by owner
decision, task 5.3 — both buttons now take the bare default), and the
News active tab matches the Apps-page Edit treatment (task 5.2), not
the earlier inversion-only text. Where the delta contradicted those
decisions, the decisions won.

## Requirements

### Requirement: Scoped bare defaults inside the bundle

Bundles render inside `<div class="bundle">` in the shell page.
The shell theme SHALL define, scoped to `.bundle` only:

- `.bundle button`: minimum height and width 48px, shell font,
  20px, normal weight, paper background, ink text, 1px border,
  2px hard shadow, square corners (border-radius: 0), `0 16px` padding. `:hover` SHALL stay paper.
  `:active` SHALL invert (ink background, paper text) with no
  shadow and no transform. `:disabled` SHALL grey with no
  shadow.
- `.bundle input`, `.bundle select`, `.bundle textarea`:
  minimum height 48px, shell font, 16px, paper background, ink
  text, 1px border, 4px radius, `10px 12px` padding.
  `:disabled` SHALL grey.
- `.bundle button.os-btn--dark`, including its `:hover` state,
  SHALL stay ink, so the bare hover rule cannot wash a dark
  button back to paper.

No bare-element default in the theme SHALL apply outside
`.bundle`: shell chrome (tiles, menubar, title bars) is
unaffected by this requirement.

#### Scenario: Bare button looks like the shell button

- **WHEN** a bundle renders a plain `<button>` with no class
- **THEN** it renders at 48px, 20px, paper/ink, 1px border,
  2px hard shadow, and inverts on press with no shift.

#### Scenario: Shell chrome is untouched

- **WHEN** the shell renders a tile, menubar, or title bar
- **THEN** none of the `.bundle` defaults applies to it.

#### Scenario: Dark variant survives hover

- **WHEN** a pointer hovers a `.bundle button.os-btn--dark`
- **THEN** it stays ink; it does not revert to paper.

### Requirement: Classes only for variants

A bundle's CSS SHALL NOT redefine a look already covered by
the scoped defaults. A class SHALL be used only for a variant
a bare element cannot express — a state (selected, on,
active), a shape (tile, swatch), a shared component
(display, keypad, key), or a layout/hook/marker role — and
SHALL carry only the delta from the default: the properties
that differ, not the full look again. A bundle SHALL NOT
reintroduce a per-app button look class (the old `.ag-btn` /
`.cp-btn` / `.tb-btn` / `.hw-btn` / `.calc-key` pattern).

#### Scenario: Variant class carries only its delta

- **WHEN** a bundle defines a variant class (for example a
  tile, swatch, or key state)
- **THEN** its rule contains only the properties that differ
  from the default, and font, border, and shadow come from
  the default.

#### Scenario: Pill variants are gone

- **WHEN** the Counter or Eight Ball bundle renders its main
  button
- **THEN** it takes the bare default with no pill rule (the
  `.counter-step` and `.ball-shake` pill rules were removed
  Nov 7, 2026; the classes remain only as JavaScript hooks).

#### Scenario: News active tab matches the Edit treatment

- **WHEN** the News bundle marks the active tab
- **THEN** `.news-tab-on` carries the Apps-page Edit values
  (ink background, paper text, no shadow, pressed shift),
  with no bold.

#### Scenario: Duplicated button look is non-conforming

- **WHEN** a bundle defines a button look rule that duplicates
  the scoped default
- **THEN** it violates this requirement, even if it renders
  identically today; the fix is to delete the rule, not to
  keep it as a safety net. (No automated harness check for
  this rule exists yet; see the archived change's tasks.md 5.6.)

### Requirement: Catalog version follows bundle changes

Each bundle touched by a styling cleanup SHALL increment its
own `catalogVersion` by exactly 1, per the authoring rule
(positive integer, +1 on any definition change), and no
untouched bundle's version SHALL change.

#### Scenario: Touched bundle bumps by one, untouched bundles do not

- **WHEN** a bundle is touched by a styling cleanup
- **THEN** its `catalogVersion` increments by exactly 1, and no
  untouched bundle's version changes.

### Requirement: Authoring style guidance

The style guide (`pkg/docs/style-guide.md`) and the
adding-an-app skill (`pkg/.agents/skills/adding-an-app/SKILL.md`)
SHALL state the bare-defaults rule — "use the bare defaults;
classes only for variants" — and SHALL NOT state the
superseded rule ("use the `os-*` class names; do not copy or
redefine them").

#### Scenario: New app with a bare button

- **WHEN** an agent authors a new app with a plain `<button>`
  and no class
- **THEN** the button renders with the shell look by default,
  and no class is needed to achieve it.
