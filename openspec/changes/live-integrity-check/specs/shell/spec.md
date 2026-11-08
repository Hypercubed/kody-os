# shell

## ADDED Requirements

### Requirement: The published package's MCP surface is importable from the app entry

The MCP functions SHALL be importable from the package's app entry (`pkg/src/app.ts`) in Kody execute, so that `import { install_from_catalog } from 'kody:@hypercubed/kody-os'` (and the same for `add_app`, `list_apps`, `get_app`, `get_app_state`, `act`) resolves. The app entry SHALL re-export the MCP surface from its source module (`pkg/src/apps/index.ts`), not from `pkg/src/index.ts` (which imports `getTheme` from the app entry, so re-exporting from it would create a cycle).

#### Scenario: Named MCP imports resolve in cloud execute

- **WHEN** an agent runs, in cloud execute, `import { install_from_catalog } from 'kody:@hypercubed/kody-os'` (or any of `add_app`, `list_apps`, `get_app`, `get_app_state`, `act`)
- **THEN** the import succeeds (no "No matching export" build error) and the imported value is a function.

#### Scenario: Namespace import exposes the MCP surface, not just default

- **WHEN** an agent runs, in cloud execute, `import * as pkg from 'kody:@hypercubed/kody-os'`
- **THEN** the resulting keys include `install_from_catalog`, `add_app`, `list_apps`, `get_app`, `get_app_state`, and `act`, not just `default`.

### Requirement: A live integrity check runs after every publish, before the package goes public

After every Kody publish, a live integrity check SHALL run against the published package via cloud execute on the MCP bridge (not the mock, not a local execution context), and it SHALL pass before the package is made public or a release is announced. The check is read-only: it installs nothing, writes no app state, and does not mutate the live instance. If it fails, the package stays private, the failure is reported naming the failed check and the observed value, and the fix is a new publish followed by a re-run of the check.

#### Scenario: The check passes on a healthy publish

- **WHEN** the check runs against a published package whose app entry re-exports the MCP surface and whose App Catalog is installed and up to date
- **THEN** every assertion passes (import resolution, `list_apps`, `list_catalog`, App Catalog fingerprint match, `get_app_state`) and the check exits `0`.

#### Scenario: The check fails on a package whose MCP surface is not importable

- **WHEN** the check runs against a published package whose app entry does not re-export the MCP surface (the namespace import returns only `default`)
- **THEN** the import-resolution check fails immediately, the check exits non-zero naming that check and the observed keys, and the package is not made public.

#### Scenario: The check does not mutate the live instance

- **WHEN** the check runs against the live published package
- **THEN** `list_apps()` returns the identical installed set (same ids, same `catalogVersion` values) before and after the run, and no new install snapshot appears for any app.

### Requirement: The live integrity check asserts the App Catalog is installed and up to date by fingerprint

The check SHALL verify the installed `app-store` (App Catalog) matches its catalog manifest entry, without re-installing it: the installed definition's fingerprint (`fingerprintDefinition(installed)`) SHALL equal the manifest entry's `fingerprint`, and its `catalogVersion` SHALL equal the manifest entry's `catalogVersion`. A mismatch SHALL fail the check naming the app.

#### Scenario: Installed App Catalog matches the catalog

- **WHEN** the installed `app-store` definition is compared to its manifest entry from the declared catalog base
- **THEN** the fingerprints and `catalogVersion` values match and the check passes.

#### Scenario: A stale or differing App Catalog fails the check

- **WHEN** the installed `app-store` fingerprint or `catalogVersion` differs from its manifest entry
- **THEN** the check fails naming `app-store` and the mismatch.
