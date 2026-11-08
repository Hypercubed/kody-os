# Design: min-package-version

## Context

See proposal.md (Why). Today `add_app` validates a definition's shape
(`id`, `schemaVersion`, bundle, capabilities) and installs it with no
regard for which shell version the app needs. The shell version is the
package version in `pkg/package.json`, read at runtime by
`getPackageMeta()` (`pkg/src/app.ts:143`) — the same source the status
bar displays. `add_app` (`pkg/src/apps/registry.ts:1701`) is the
single install entry point: the Store's install/update and the agent's
`install_from_catalog` both funnel through it. Herdr's plugin system
is the reference: `min_herdr_version` is required in every
`herdr-plugin.toml`, and Herdr refuses to link or install when the
current binary is older.

## Goals / Non-Goals

- Goals: a per-app minimum shell version, enforced at install time
  for both Store and agent installs, with an honest refusal; a Store
  that never offers an install the shell cannot run.
- Non-goals: a catalog pin; changing the catalog source; sandboxing;
  retroactive enforcement on already-installed apps.

## Decisions

1. **Field: `minPackageVersion`, optional, semver string.** The
   definition carries an optional top-level `minPackageVersion`: a
   string `MAJOR.MINOR.PATCH` (numeric parts, no pre-release, no
   build metadata). Absent means no minimum — the app installs on
   any shell version, as today. A present but malformed value (not
   `MAJOR.MINOR.PATCH`, non-numeric parts) SHALL fail definition
   validation, like any other malformed field, and nothing is
   installed.
2. **Enforcement point: `add_app`.** The check lives in `add_app`
   (`pkg/src/apps/registry.ts`), the single install entry point.
   The Store's install/update and the agent's `install_from_catalog`
   both funnel through it, so one check binds both paths. When the
   running shell version is older than the app's `minPackageVersion`,
   `add_app` returns `{ ok: false, error }` naming the app, the
   required minimum, and the running shell version, and writes
   nothing. A definition without the field is unaffected.
3. **Version source: the running package version.** The running
   version is read from `pkg/package.json` via `getPackageMeta()` —
   the same source the status bar reads. The comparison uses
   `version` only (`MAJOR.MINOR.PATCH`); the integer `build` is a
   publish counter, not a compatibility signal, and is ignored.
4. **Comparison: numeric semver.** Compare `MAJOR`, then `MINOR`,
   then `PATCH` numerically. Running version equal to the minimum is
   compatible. Running version newer than the minimum is compatible.
5. **Fingerprint: `minPackageVersion` is fingerprinted content.**
   Unlike `installMode` (fingerprint-excluded), `minPackageVersion`
   is part of the definition's content fingerprint. Adding it to a
   definition, or changing it, is a definition change: it requires a
   `catalogVersion` +1 by the existing rule, and installed copies
   are marked as needing an update (the update itself is then
   subject to the same check — see Decision 7).
6. **Store: never offer an install the shell cannot run.** The
   Store SHALL NOT offer a one-tap install or update for an app
   whose `minPackageVersion` is newer than the running shell. It
   shows the requirement and the running shell version instead. The
   exact row rendering is the implementer's call.
7. **Updates: same check.** An update is an install of a newer
   definition, so the same check applies. When a catalog update
   raises an app's `minPackageVersion` above the running shell, the
   update is refused the same way (the Store shows it as needing a
   newer shell, not as a plain update).
8. **Already installed: no retroactive check.** The check runs at
   install/update time only. An app already installed keeps running
   even if the shell is later found to be older than the app's
   minimum (for example after a shell downgrade). No installed app
   is removed or disabled by this change.
9. **No pin.** This change adds no catalog pin and does not depend
   on one. The catalog source (which repo a Store reads, which
   release) is the Store's or the installer's business, not the
   shell's. The fate of the `public-pinned-catalog` pin constant is
   a separate decision, not part of this change.

## Open Questions

- Whether the Store's "needs a newer shell" row should also name the
  shell release that satisfies the requirement (it can only name the
  minimum version; there is no release-notes lookup in this change).
- Whether a future `maxPackageVersion` (an app that must NOT run on
  a newer shell) is ever needed; this change does not add one, and
  no current app needs it.
