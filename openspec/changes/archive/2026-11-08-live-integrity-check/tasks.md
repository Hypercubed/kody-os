# Tasks

A live integrity check against the published package, run after every publish and before the package goes public. No task in this file commits, pushes, or publishes anything.

## 1. The check script

- [x] 1.1 Add `scripts/live-integrity-check.py` (repo root `scripts/`). It runs the assertions in §2 via cloud execute on the MCP bridge (the VM's Kody MCP `client.py`; the bridge path is a parameter or environment variable, not hardcoded). It exits `0` when every check passes and non-zero on any failure, printing the failed check name and the observed value. Verify: the script runs end-to-end against the live v4.1.1 package and passes; it fails (non-zero, naming the check) when pointed at a package whose app entry lacks the MCP re-exports (simulate by asserting against a namespace import that returns only `default`).
- [x] 1.2 The script SHALL NOT install, uninstall, or write app state. It imports and reads only. Verify: `list_apps()` before and after a check run returns the identical installed set (same ids, same `catalogVersion` values); no new install snapshot appears for any app.

## 2. The assertions (run in order; fail fast on the import check)

- [x] 2.1 **Import resolution (core, runs first).** In cloud execute, `import * as pkg from 'kody:@hypercubed/kody-os'` SHALL return the named keys `install_from_catalog`, `add_app`, `list_apps`, `get_app`, `get_app_state`, `act` (at minimum), not just `default`. Single named imports SHALL resolve for the same set. Verify: the namespace import keys include all six; a single `import { install_from_catalog }` succeeds (no "No matching export" build error). If the namespace import returns only `default`, the check fails immediately naming that.
- [x] 2.2 **List.** `list_apps()` SHALL return the installed apps (a non-empty list; each entry has `id`, `label`, `schemaVersion`). Verify: the call succeeds and returns a list containing `app-store`.
- [x] 2.3 **Catalog.** `list_catalog()` with the declared catalog base (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`) SHALL return the catalog apps (18 apps, matching `catalog/catalog.json` ids). Verify: the returned ids equal the manifest ids.
- [x] 2.4 **App Catalog installed and up to date (fingerprint, read-only).** The installed `app-store` definition (via `get_app`) SHALL match its catalog manifest entry: `fingerprintDefinition(installed)` equals the manifest entry's `fingerprint`, and `catalogVersion` equals the manifest entry's `catalogVersion`. Verify: the comparison passes for the live install; a deliberately mismatched fingerprint (e.g. against a stale manifest entry) fails the check naming the app.
- [x] 2.5 **State read.** `get_app_state()` SHALL read live state for an installed app (e.g. `app-store`, or `settings` if `app-store` has no state fields). Verify: the call succeeds and returns a state object (it does not throw or return an error).

## 3. The gate and the release procedure

- [x] 3.1 Document the gate in the release procedure (`catalog/README.md` §3.2 area / the release-cutting procedure): after every publish, run `scripts/live-integrity-check.py`; it SHALL pass before the package is made public or a release is announced. If it fails, the package stays private, the failure is reported (check name + observed value), and the fix is a new publish followed by a re-run. Verify: the procedure names the script, the pass condition, and the on-failure behavior.
- [x] 3.2 Record the relationship to the owed checks: this check is the MCP/API half; handoff 09's post-tag browser end-to-end and `public-pinned-catalog` 3.1 remain the browser-UI half and are not closed by this change. Verify: the close-out note (task 4.2) names both and states they remain open.

## 4. Verify and sync specs

- [x] 4.1 Verify: the script passes against the live v4.1.1 package (all of §2); the script fails correctly against a `default`-only module (simulated); `list_apps()` is identical before/after (no mutation); `bun build pkg/src/app.ts --target=browser --external 'kody:*'` still succeeds (no `pkg/` change in this change — this is a regression guard, not a new build). Record any substitution (e.g. if cloud execute is unavailable, record why and what was substituted) the same way handoffs 10/11/12 recorded theirs. Do not mark a verification step done if it was not run.
- [x] 4.2 Sync the canonical specs: the `shell` delta in this change becomes canonical (see `specs/`). Archive with a close-out note recording what was verified, what was substituted, what was left open (including that the browser-UI half — handoff 09 end-to-end and `public-pinned-catalog` 3.1 — remains open), and the version decision (no bump: specs + repo script only, outside `pkg/`).
