# app-registry — delta

## ADDED Requirements

### Requirement: Store recipe prompt rendering

Implements the Store behavior specified by "Recipe install mode":
a `recipe-only` app appears in the App Store list with the recipe
prompt in place of one-tap install. The manage rows SHALL carry
`installMode`, copied from the catalog definition and defaulting to
`json` when the definition carries none; a missing `installMode` on
a row SHALL be treated as `json`. For a not-installed row whose
`installMode` is `recipe-only`, the App Store bundle SHALL render
the recipe prompt in place of the Add button: selectable text in a
`<code>` element naming the app, the install guide
(`pkg/docs/install-guide.md`), and its recipe file
(`pkg/catalog/<id>/RECIPE.md`),
with no copy button and no Clipboard API use. `json`
not-installed rows SHALL offer one-tap Add with no prompt.
Installed rows SHALL keep their existing controls and never show
the prompt.

#### Scenario: Recipe-only not-installed row shows the prompt, no Add

- **WHEN** a Store row is not installed and its `installMode` is
  `recipe-only`
- **THEN** the row renders the recipe prompt (a `<code>` element
  naming the app, the install guide, and its recipe file) and offers
  no Add button.

#### Scenario: Json not-installed row installs with one tap

- **WHEN** a Store row is not installed and its `installMode` is
  `json` (or the row carries no `installMode`)
- **THEN** the row offers one-tap Add and shows no prompt.

#### Scenario: Installed recipe-only row keeps its controls, no prompt

- **WHEN** a Store row is installed and its `installMode` is
  `recipe-only`
- **THEN** the row shows its normal control for its status (for
  example Remove when up-to-date) and shows no prompt.

#### Scenario: Rows carry installMode

- **WHEN** the Store rows are built for a `recipe-only` app and
  for a `json` app
- **THEN** the first row reports install mode `recipe-only` and
  the second reports `json`.

#### Scenario: Prompt is selectable text, no copy button, no Clipboard API

- **WHEN** a `recipe-only` row renders its prompt
- **THEN** the prompt is selectable text in a `<code>` element, the
  row has no copy button, and the bundle uses no Clipboard API for
  the prompt.
