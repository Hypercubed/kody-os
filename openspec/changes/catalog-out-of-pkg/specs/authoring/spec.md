# Spec Delta

## ADDED Requirements

### Requirement: Catalog manifest at the repo root

The catalog SHALL live at `catalog/` at the repo
root, not inside `pkg/`, and SHALL be described
by `catalog/catalog.json`. Each manifest entry
SHALL carry `id`, `label`, `catalogVersion`,
`fingerprint` (the content-only fingerprint of
the canonical stored definition),
`installMode`, `definitionPath` (relative path
within `catalog/`, e.g.
`counter/definition.json`), and `recipePath`
(e.g. `counter/RECIPE.md`). Entries SHALL
be alphabetical by id.

#### Scenario: The manifest describes the directory

- **WHEN** the manifest is regenerated from the
  per-app definition directories
- **THEN** it lists exactly the definitions present,
  in id order, with `catalogVersion` and
  fingerprint matching each definition.

### Requirement: Manifest agreement is the membership rule

A definition directory SHALL be a catalog app if
and only if it has a manifest entry agreeing
with it (same id, `catalogVersion`, and
fingerprint). A definition directory without a
manifest entry, or a manifest entry without a
definition directory, SHALL fail the catalog
harness.

#### Scenario: An orphan definition fails the harness

- **WHEN** a definition directory is added to `catalog/`
  without regenerating the manifest
- **THEN** the catalog harness fails on the
  directory-vs-manifest disagreement.

## REMOVED Requirements

### Requirement: Shipped-catalog import list

The catalog SHALL NOT be defined by an import
list in `pkg/src/apps/catalog.ts`. A file in
`catalog/` without a manifest entry SHALL NOT be
listed, and the import list SHALL NOT be the
runtime catalog listing source. (The static
imports remain as the install mechanism until
`public-pinned-catalog` supplies on-demand
definition fetching; retiring them is that
change's work, not this one's.)

#### Scenario: No import list to disagree with

- **WHEN** the catalog harness runs after the move
- **THEN** it checks directory-vs-manifest
  agreement, not directory-vs-import agreement.
