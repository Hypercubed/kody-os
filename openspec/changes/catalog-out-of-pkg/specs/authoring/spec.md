# Spec Delta

## ADDED Requirements

### Requirement: Catalog manifest at the repo root

The catalog SHALL live at `catalog/` at the repo
root, not inside `pkg/`, and SHALL be described
by `catalog/index.json`. Each manifest entry
SHALL carry `id`, `name`, `label`, `icon`,
`category`, `description`, `catalogVersion`,
`bundle` (relative path within `catalog/`), and
`fingerprint` (the content-only fingerprint of
the canonical stored definition). Entries SHALL
be alphabetical by id.

#### Scenario: The manifest describes the directory

- **WHEN** the manifest is regenerated from the
  bundle directory
- **THEN** it lists exactly the bundles present,
  in id order, with `catalogVersion` and
  fingerprint matching each bundle.

### Requirement: Manifest agreement is the membership rule

A bundle SHALL be a catalog app if and only if
it has a manifest entry agreeing with it (same
id, `catalogVersion`, and fingerprint). A bundle
without a manifest entry, or a manifest entry
without a bundle, SHALL fail the catalog harness.

#### Scenario: An orphan bundle fails the harness

- **WHEN** a bundle file is added to `catalog/`
  without regenerating the manifest
- **THEN** the catalog harness fails on the
  directory-vs-manifest disagreement.

## REMOVED Requirements

### Requirement: Shipped-catalog import list

The catalog SHALL NOT be defined by an import
list in `pkg/src/apps/catalog.ts`. A file in
`catalog/` without a manifest entry SHALL NOT be
listed, and the import list SHALL NOT be the
runtime catalog source.

#### Scenario: No import list to disagree with

- **WHEN** the catalog harness runs after the move
- **THEN** it checks directory-vs-manifest
  agreement, not directory-vs-import agreement.
