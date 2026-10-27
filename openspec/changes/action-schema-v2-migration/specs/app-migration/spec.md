# Spec Delta

## Purpose

Installed apps evolve: fields get renamed, types change, actions gain steps. Migration lets a re-added definition carry user state forward instead of wiping it, and atomic `add_app` guarantees a failed write never leaves storage half-updated.

## ADDED Requirements

### Requirement: Factored definition migration

The system SHALL normalize external definitions into one canonical validator input before validation. Single-`effect` v1 actions expand to one-entry `effects[]`; v2 actions pass through unchanged. The validator is selected by definition version (3 = legacy shape, 4 = effects array). Unknown versions are rejected with an error naming the supported versions, and nothing is written.

#### Scenario: v1 definition normalizes to canonical input

- **WHEN** `add_app` receives a schemaVersion-3 definition with single-`effect` actions
- **THEN** each action is treated as a one-entry `effects[]` action for validation and storage.

#### Scenario: Unknown version rejected before any write

- **WHEN** `add_app` receives a definition whose version is neither supported nor migratable
- **THEN** it returns `{ ok: false, error }` naming the supported versions and writes nothing.

### Requirement: Atomic add_app commit

`add_app` SHALL validate everything first — definition shape, overwrite policy, migration, and the candidate state — and only then commit. The commit SHALL consist of exactly one registry write followed by exactly one state write. If any validation step fails, the call SHALL return `{ ok: false, error }` and storage SHALL be byte-identical to before the call.

#### Scenario: Failed write leaves storage untouched

- **WHEN** `add_app` fails at any step (bad shape, stale version, migration conflict, invalid state)
- **THEN** it returns `{ ok: false, error }` and a re-read of the registry and state keys shows no change.

#### Scenario: Successful write commits once

- **WHEN** `add_app` succeeds
- **THEN** the registry and state each show exactly one write and the installed definition validates clean.

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
