# Spec Delta

## ADDED Requirements

### Requirement: Release-pinned remote catalog source

The Store's catalog SHALL be the manifest and
bundles fetched server-side from a pinned release
of the public repo, not from shipped definitions
and not from `main` HEAD by default. The pin
SHALL be one named constant in the shell source
that a fork owner can change to point at a
different repo/release, and the Store SHALL
display the pinned release it is reading.

#### Scenario: A repo-added app appears without a Kody publish

- **WHEN** an app is added to the repo and a new
  catalog release is cut, with no Kody publish
- **THEN** the Store, reading the new pinned
  release, lists the new app as installable.

#### Scenario: A fork changes its catalog source

- **WHEN** a fork owner changes the single pin
  constant to their own repo/release
- **THEN** the Store lists that catalog instead of
  upstream, and displays the fork's release.

### Requirement: Catalog fetch failure degrades honestly

If the catalog manifest fetch fails, the Store
SHALL show installed apps with their known status
plus an honest catalog error with a retry, and
SHALL NOT show a blank Store. Any cached manifest
used as fallback SHALL be labeled as cached with
its release, and SHALL NOT be presented as fresh.

#### Scenario: GitHub is down when the Store opens

- **WHEN** the manifest fetch fails
- **THEN** installed apps are still listed, an
  error states the catalog could not be refreshed,
  and a retry is offered.

### Requirement: Snapshot rules unchanged against remote definitions

Install snapshots SHALL continue to record
install-time `catalogVersion` plus a content-only
fingerprint, and Store status classification
SHALL continue to compare installed definitions
and snapshots against the catalog definitions —
now the remote definitions — with no change to
the status set or its rules.

#### Scenario: A remote update is classified as before

- **WHEN** a remote catalog release bumps an
  installed app's `catalogVersion`
- **THEN** the Store classifies the installed app
  as behind (clean or modified, as its snapshot
  and definition dictate), exactly as it did
  against the shipped catalog.

## REMOVED Requirements

### Requirement: Shipped catalog as the Store source

The Store SHALL NOT read its catalog from
definitions shipped in `pkg/`. The import list in
`pkg/src/apps/catalog.ts` SHALL NOT be the
runtime catalog source.
