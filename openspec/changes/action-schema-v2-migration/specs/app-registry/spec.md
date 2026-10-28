# Spec Delta

## MODIFIED Requirements

### Requirement: Same-id overwrite preserves references

Re-adding an existing id via `add_app` SHALL overwrite the definition, preserve state by default (declared fields carried forward, dropped fields reset to `initial`), and leave registry order, pins, hidden flags, homepage placement, and recent entries untouched (only `remove_app` scrubs reference lists). Passing `resetState: true` SHALL reset state to `initial` instead. Passing `migrate` SHALL map old field names to new ones with validator-checked values: an unmappable field aborts the whole re-add with `{ ok: false }` and no state change.

#### Scenario: Re-added app keeps its route and pins

- **WHEN** an installed app (pinned, on homepage) is re-added under the same id
- **THEN** `GET /apps/<id>` renders the new definition and the id remains in the pinned and homepage lists.

#### Scenario: Re-add preserves state by default

- **WHEN** an installed app with user-modified state is re-added without options
- **THEN** declared fields keep their stored values and only dropped fields reset to `initial`.

#### Scenario: resetState restores the legacy wipe

- **WHEN** an installed app is re-added with `resetState: true`
- **THEN** state resets to `initial` exactly as the pre-v4 rule required.

#### Scenario: Unmappable migrate aborts without writing

- **WHEN** a re-add passes `migrate` with an old field that cannot map to the new shape
- **THEN** `add_app` returns `{ ok: false, error }` and stored state is byte-identical to before the call.

### Requirement: v4 drops the frozen ui.template stub

`ui.template` (`hello | generic | clock`) is render-ignored — the shell always renders bundle + state + forms and never branches on it. Version-4 definitions SHALL NOT carry `ui.template`: the v4 validator rejects a definition containing it, and the v4 restamp strips it from example apps and `test-app.ts`. Stored v3 definitions keep working on read (the field rides along inertly); it disappears on re-add under v4.

#### Scenario: v4 definition with template rejected

- **WHEN** `add_app` receives a schemaVersion-4 definition containing `ui.template`
- **THEN** it returns `{ ok: false, error }` naming the removed field and writes nothing.

#### Scenario: Restamped apps carry no template

- **WHEN** the example apps are restamped to schemaVersion 4
- **THEN** no stored definition contains `ui.template` and a repo grep for `template` in `pkg/src` hits only the v3-legacy validator branch.
