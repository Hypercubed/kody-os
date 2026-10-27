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
