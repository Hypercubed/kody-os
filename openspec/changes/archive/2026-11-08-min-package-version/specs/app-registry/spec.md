# app-registry Specification Delta

## Purpose

Apps declare the minimum shell version they need, and the shell
refuses to install an app it is too old for — for Store and agent
installs alike.

## ADDED Requirements

### Requirement: App definition may declare a minimum shell version

An app definition MAY carry an optional top-level
`minPackageVersion`: a string `MAJOR.MINOR.PATCH` (numeric parts, no
pre-release, no build metadata) declaring the minimum kody-os
package (shell) version the app requires. Absent means no minimum —
the app installs on any shell version, as today. A present but
malformed value SHALL fail definition validation, and nothing is
installed. `minPackageVersion` is fingerprinted definition content
(unlike `installMode`, which is fingerprint-excluded): adding it to
a definition, or changing it, is a definition change and requires a
`catalogVersion` +1 by the existing rule.

#### Scenario: Absent minimum installs on any shell
- **WHEN** `add_app` receives a definition with no `minPackageVersion`
- **THEN** the minimum-version check does not apply, and the install proceeds as today.

#### Scenario: Malformed minimum fails validation
- **WHEN** `add_app` receives a definition whose `minPackageVersion` is not numeric `MAJOR.MINOR.PATCH`
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

#### Scenario: Adding a minimum is a definition change
- **WHEN** `minPackageVersion` is added to a catalog definition with no other change
- **THEN** its `catalogVersion` is incremented by exactly 1 and its fingerprint changes, so installed copies are marked as needing an update.

### Requirement: Install refuses an app the shell is too old for

`add_app` SHALL compare the running shell version against an app's
`minPackageVersion` (when present) before installing. The running
version is read from `pkg/package.json` via `getPackageMeta()` — the
same source the status bar reads — and the comparison uses `version`
only (`MAJOR.MINOR.PATCH`, numeric, in order); the integer `build`
is ignored. When the running shell version is older than the app's
minimum, `add_app` SHALL return `{ ok: false, error }` naming the
app, the required minimum, and the running shell version, and SHALL
write nothing. Equal to the minimum, or newer than it, is
compatible. This check is the single enforcement point: the Store's
install/update and the agent's `install_from_catalog` both funnel
through `add_app`, so it binds both paths. An update is an install
of a newer definition, so the same check applies to updates. The
check runs at install/update time only; an already-installed app
keeps running even if the shell is later older than its minimum. The
Store SHALL NOT offer a one-tap install or update for an app whose
minimum is newer than the running shell; it shows the requirement
and the running shell version instead.

#### Scenario: Too-old shell is refused with both versions named
- **WHEN** `add_app` receives an app whose `minPackageVersion` is newer than the running shell
- **THEN** it returns `{ ok: false, error }` naming the app, the required minimum, and the running shell version, and writes nothing.

#### Scenario: Equal version installs
- **WHEN** `add_app` receives an app whose `minPackageVersion` equals the running shell version
- **THEN** it returns `{ ok: true, id }` and the app installs.

#### Scenario: Newer shell installs
- **WHEN** `add_app` receives an app whose `minPackageVersion` is older than the running shell
- **THEN** it returns `{ ok: true, id }` and the app installs.

#### Scenario: Update that raises the minimum is refused
- **WHEN** a store update is attempted to a definition whose `minPackageVersion` is newer than the running shell
- **THEN** the update is refused with the required minimum and the running shell version named, and the installed definition is unchanged.

#### Scenario: Store does not offer an incompatible install
- **WHEN** the Store lists an app whose `minPackageVersion` is newer than the running shell
- **THEN** its row shows the requirement and the running shell version instead of a one-tap install control.
