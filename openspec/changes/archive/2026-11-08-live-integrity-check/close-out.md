# Close-out: live-integrity-check

Archived 2026-11-08. Implemented as specified: the versioned check script,
the release-procedure gate, and the canonical `shell` spec sync. Nothing
was committed, pushed, or published by this change. No `pkg/` change, so no
version bump (specs + repo script only, outside `pkg/`).

## What changed

- **`scripts/live-integrity-check.py`** (new, executable, stdlib only): five
  checks in order via cloud execute — import-resolution (fail fast),
  list, catalog, fingerprint, state-read — plus a read-only guard (ids +
  per-app `catalogVersion` before/after). Exit `0` on pass, non-zero naming
  the failed check and the observed value. Bridge path is a parameter
  (`--bridge` / `--bridge-command`, or `KODY_MCP_BRIDGE` /
  `KODY_MCP_BRIDGE_COMMAND`); default backend is `kody execute --code`
  (cloud, resolves `kody:` imports against the published build).
  `--simulate-default-only` verifies the fail path without a broken
  publish. Fingerprint uses the repo's exact `registry.ts`
  implementation via `bun` when available, else an embedded port that is
  byte-identical for non-SVG definitions and refuses SVG icons rather
  than guessing.
- **`catalog/README.md`** (release cutting): after every publish, run
  `scripts/live-integrity-check.py`; it SHALL pass before the package is
  made public or announced; on failure the package stays private and the
  fix is a new publish + re-run.
- **`openspec/specs/shell/spec.md`** (canonical): the change's three
  requirements merged verbatim (MCP surface importable from the app
  entry; the publish gate; the fingerprint assertion).

## Verification (live, 2026-11-08, package v4.1.3)

Via cloud execute (`kody execute --code`, no substitution — the real
published build, not the mock):

- **import-resolution PASS.** Namespace import returns 38 keys including
  all six required (`install_from_catalog`, `add_app`, `list_apps`,
  `get_app`, `get_app_state`, `act`); single named imports resolve.
- **list PASS.** `list_apps()` returns 15 installed apps including
  `app-store`; every entry carries `id`, `label`, `schemaVersion`.
- **catalog PASS.** `list_catalog()` with the declared base returns 18
  ids exactly equal to the live manifest ids.
- **fingerprint FAILS HONESTLY.** Installed `app-store` is `catalogVersion`
  19, `fnv:495347351-3347083049-16410`; manifest entry is `catalogVersion`
  20, `fnv:2877279389-1173698234-17377`. The live Store is stale (likewise
  `probe`: installed 7 vs manifest 8). The gate works: it caught real
  drift. Positive control: `clock` (installed cv 5) fingerprints
  `fnv:433473223-3408256014-2743` via the exact repo implementation,
  equal to its manifest entry — the comparison passes when in sync. The
  embedded port was verified byte-identical to `registry.ts` for
  `app-store`.
- **state-read PASS.** `get_app_state("app-store")` returns `{}` (stateless
  Store), no error.
- **Fail path PASS.** `--simulate-default-only` exits 1 naming
  `import-resolution` (`returned only 'default'`).
- **Read-only PASS.** `list_apps()` ids identical (same 15) before and
  after all runs; the script only ever invokes `list_apps`,
  `list_catalog`, `get_app`, `get_app_state` (no install/update/write
  call exists in it).
- **Regression guard PASS.** `bun build pkg/src/app.ts --target=browser
  --external 'kody:*'` succeeds (no `pkg/` change in this change).

Note: tasks 1.1/2.4/4.1 assumed a fully passing live run ("passes against
live v4.1.1"); the live package is now v4.1.3 and its installed Store is
one catalog version behind, so the full run exits non-zero on the
fingerprint check. That is the specified gate behavior, not a script
defect — the script correctly refuses to bless a stale install.

## Substitution

`kody execute` CLI used as the cloud-execute backend instead of the VM's
`client.py` (no `client.py` exists in this repo; the bridge path is
parameterized so the VM run uses its own client). No mock or local-context
substitution: every assertion ran against the live published package.

## Left open

- **Live Store is stale.** `app-store` (19 vs 20) and `probe` (7 vs 8)
  are behind the `main` catalog. The check fails until the live install
  is brought up to date. Updating the live instance is a user decision;
  this change deliberately writes nothing live.
- **Browser-UI half remains open.** Handoff 09's post-tag `kody dev`
  browser end-to-end and `public-pinned-catalog` 3.1 (real-release Store
  round-trip) are not closed by this change; this check is the MCP/API
  half.
- **Package visibility:** still private. Making it public remains the
  user's explicit call, gated on this check passing.

## Version decision

No bump: specs + repo script only, outside `pkg/`. No MCP export added,
removed, renamed, or reshaped; no catalog app definition changed.
