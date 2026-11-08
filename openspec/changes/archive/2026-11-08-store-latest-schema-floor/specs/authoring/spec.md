# authoring Specification Delta

## ADDED Requirements

### Requirement: A Store's catalog base tracks the latest commit

A Store SHALL declare its catalog base as the `main` branch URL,
not a fixed release tag, so the Store follows the latest catalog
and can discover its own updates. The `catalog` proxy entry's `url`
SHALL be the `main` branch catalog base
(`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`
for the shipped App Store). Changing the base URL is a definition
change and SHALL bump the Store's `catalogVersion` by 1 under the
existing rule. The agent path is unaffected: an agent supplies its
own base and may point at a specific tag for a stable snapshot.

#### Scenario: Store base is the main branch
- **WHEN** the App Store's definition is read
- **THEN** its `catalog` proxy entry url is the `main` branch
  catalog base.

#### Scenario: Base change bumps the version
- **WHEN** the Store's `catalog` proxy entry url changes from a
  fixed tag to the `main` branch base
- **THEN** the Store's `catalogVersion` increments by exactly 1.
