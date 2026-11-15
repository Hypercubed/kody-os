# Design: Storage-backed catalog override

## Context

See proposal.md (Why). Verified by probe on CLI 3.34.14 and 3.35.10:
mock workerd `process.env` holds only the runtime binding and
`globalThis.KODY_CATALOG_BASE` is undefined, so `devOverrideBase()`
(`pkg/src/apps/remote-catalog.ts:152-178`) can never fire in the mock.
Ambient `fetch()` reaches the real network (subject to
`--allow-private-network`), and `packageStorage` persists arbitrary
keys — those are the two channels that do work. Plain `fetch()` is
already what `remote-catalog.ts` uses, so the fetch side needs no
change; only base *resolution* cannot see the env override.

Current resolution (see `registry.ts:873-939`): explicit `catalogBase`
param > env/`globalThis` override > installed Store's declared base
(listing base for apps, discovery base for the Store itself; the
management API takes no explicit param, so the override is its only
beat over declarations).

## Goals / Non-Goals

- Goals: make the mock Store listing, install, update, and restore
  read a local catalog when a dev override is stored; keep production
  behavior (GitHub declarations) byte-identical when no override is
  stored; keep the override out of backups, exports, and imports.
- Non-goals: no browser UI for the override; no change to the
  `validateUpstreamEntries` `https:` rule for Store *declarations*;
  no change to the fetch layer's URL allowlist; no CLI feature
  request (separate track).

## Decisions

### Decision 1 — Stored override key and read path

New well-known key `kody-os.dev.catalogBase` holding a bare base URL
string. A `readDevCatalogBase(store)` helper reads it with `readJson`
(string check) and runs it through `normalizeCatalogBase`; any
failure (missing key, non-string, refused base) resolves to `null`
(no override), never a throw — resolution must stay total so callers
keep their existing no-source errors.

Why storage over alternatives: env/`globalThis` injection needs CLI
support that does not exist (probed twice); `.kody/mocks.ts` only
intercepts `gatewayFetch`/credentialed hops, not ambient `fetch()`;
a second workerd binding needs a CLI flag. Storage is the only
package-controlled channel into the worker.

### Decision 2 — Precedence: same slot as the env override

Both `resolveAgentCatalogBase` and `resolveManagedBase` /
`resolveManagedBases` consult the stored override exactly where they
consult `devOverrideBase()` today: after an explicit param, before
any Store declaration. The fetch layer (`resolveFetchBase`) keeps its
existing behavior (explicit > env override > refuse) untouched —
registry callers pass the resolved base explicitly, so fetch-time
behavior is unchanged. The env/`globalThis` read stays first within
the override slot (harness compatibility), stored second.

### Decision 3 — Async plumbing

`devOverrideBase()` is synchronous and stays that way (harness stub
compatibility). The stored read is async (`readJson` over the
`KeyStore`), so `resolveAgentCatalogBase`, `resolveManagedBase`, and
`resolveManagedBases` thread it through their existing promise
chains: each takes the store they already receive via
`resolveStore()`. No new parameters on MCP exports; `manage_rows`
and friends already resolve a store first. `get_store_catalog_info`
(C12 in `catalog-robustness-fixes`, still open) is out of scope —
its dead-`store` parameter question is decided there, not here.

### Decision 4 — Hygiene by construction, asserted by test

`export_install` builds its payload only from install keys
(registry/def/state/pinned/hidden/homepage), and `restore` wipes
only install keys while `backup` captures only `export_install`
output — so the dev key is excluded from payloads and survives
restore with zero code change. This is asserted, not assumed: new
harness checks write a stored override, run
backup/export/restore, and confirm the key is absent from payloads
and present afterwards. If a future refactor changes those key
lists, the checks fail loudly.

### Decision 5 — Set/clear surface: script first, MCP export deferred

The write path is `pkg/scripts/catalog.ts` (`kody execute --target
mock --file scripts/catalog.ts`): a new `op` (e.g.
`dev-base` with `base?` — set when given, clear when omitted)
calling new registry functions `set_dev_catalog_base` /
`clear_dev_catalog_base` (names TBD at implementation). No new MCP
export in this change: the script runs on the host against mock
storage (server stopped, per the mock-writes rule), which is exactly
the dev loop; an MCP export would expose a dev control to every
hosted caller and needs its own version/capability review. The spec
requires "an agent path", which the script satisfies.

## Risks / Trade-offs

- [Stale override points at a dead local server] → All fetches fail
  with the honest catalog error + retry the Store already shows;
  clearing is one script call. Documented in `dev-local-catalog.sh`
  usage.
- [Override set in mock storage leaks into a backup taken for
  production use] → Excluded by construction (Decision 4) plus
  harness checks; a `backup` entry inspected shows no dev key.
- [`restore` preserving the key surprises a user expecting a full
  reset] → Spec mandates survival (it is machine-local dev state,
  like the mock session itself); documented alongside the set/clear
  path.
- [Two override sources disagree (env set AND stored set)] →
  Env wins (harness compatibility; env is the narrower, more
  deliberate channel). Documented precedence.

## Migration Plan

No migration: fresh installs have no key (reads as no override);
existing installs gain the key only when an agent sets it. Rollback
is clearing the key. No MCP shape changes, no definition changes,
no catalog manifest changes.

## Open Questions

None — the set/clear naming (`dev-base` op, helper names) is
implementation detail that does not change specs or tasks.
