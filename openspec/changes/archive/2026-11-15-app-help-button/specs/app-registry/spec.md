# Spec Delta

## Purpose

Add the optional `ui.help` definition field — plain-text how-to-use
text for one app — following the `ui.menuBar` precedent: validated,
canonicalized, fingerprinted, and round-tripped through export and
import, with no `schemaVersion` bump.

## ADDED Requirements

### Requirement: `ui.help` definition field

App definitions MAY carry `ui.help`, a plain-text string: the app's
own how-to-use text, shown in the help dialog behind the title-bar
help button (see the shell delta). It is distinct from `description`,
which is the what-it-is-for text shown on the app page body and as a
tile tooltip. A non-string `ui.help` SHALL be rejected by
`validateDefinition` and SHALL write nothing. An empty or
whitespace-only `ui.help` SHALL be treated as absent:
canonicalization drops it, and no help button renders. `add_app`
SHALL preserve `ui.help` through canonicalization, and
export/import SHALL round-trip it. `list_apps()` summaries SHALL NOT
carry help — tiles never show it, and the app page and the overlay
already hold the full stored definition. `ui.help` SHALL be part of
the definition fingerprint (only `catalogVersion` and `installMode`
are excluded), so a catalog app gaining or changing help SHALL bump
`catalogVersion` +1 by the existing rule. No `schemaVersion` change:
an optional `ui` field is MINOR by the version policy, the same as
`menuBar` and `minPackageVersion`.

#### Scenario: Help validates and installs
- **WHEN** `add_app` receives a definition with `ui.help` as a non-empty string
- **THEN** it installs, and the installed definition carries that help text.

#### Scenario: Absent help installs without a button
- **WHEN** an installed definition has no `ui.help`, or an empty or whitespace-only one
- **THEN** the app installs normally and no help button renders for it.

#### Scenario: Bad help writes nothing
- **WHEN** `add_app` receives `ui.help` as a non-string value
- **THEN** it returns an error and storage is untouched.

#### Scenario: Help survives export and import
- **WHEN** an app with `ui.help` is exported and imported into a blank store
- **THEN** the imported definition still carries the same help text.

#### Scenario: Help is fingerprinted
- **WHEN** a catalog app's `ui.help` is added or changed
- **THEN** its definition fingerprint changes, and its `catalogVersion` is bumped +1 by the existing rule.

#### Scenario: Summaries carry no help
- **WHEN** `list_apps()` is read for an app with `ui.help`
- **THEN** its summary carries no help field.
