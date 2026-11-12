# Proposal: Catalog robustness fixes (code-review C5–C16)

## Why

A read-only code review of the staged catalog work (handoff 09 catalog move + remote catalog, handoff 10 `minPackageVersion`, handoff 11 pin removal, handoff 12 Store-base-to-`main` + schema floor) found no bug that breaks a normal install, corrupts state, or bypasses either install gate. It did find twelve robustness, error-clarity, and UX issues (C5–C16) in the remote-catalog and registry code. This change fixes all twelve. The blocker B1 (no committed `minPackageVersion` test coverage) and concerns C1–C4 (dev-override precedence, Store listing downloading full bundles, manifest fetched ~37× per listing, loopback check prefix-only) are fixed separately in handoff 13, not here.

## What changes

- **C5.** A gated *installed* row keeps its Remove button (today the gate branch suppresses all controls, so an installed app whose catalog entry later raises `minPackageVersion` cannot be removed from the Store UI).
- **C6.** The agent update path gains the same optional `catalogBase` support the install path has; `pkg/scripts/catalog.ts` `update` stops declaring a `base` it silently ignores.
- **C7.** Catalog-fetch failures are no longer all collapsed to "unknown catalog app": the fetch layer distinguishes refused-base vs fetch-failed vs unknown-id, and install/update/status surface the right error.
- **C8.** A fetched definition is verified against its manifest fingerprint before install (refuse on mismatch).
- **C9.** `add_app(null)` returns `{ ok: false }` again instead of throwing a `TypeError` (the floor gate dereferences `definition.schemaVersion` before validation).
- **C10.** The dead no-source branch in `manage_update_with_status` is made reachable (the no-source refusal is checked before `get_app_status`, so the user gets the no-source error instead of "not an installed catalog app").
- **C11.** The agent-facing `useWhen` text for `list_catalog` / `get_catalog_definition` is corrected (bare calls need an explicit base; the Store-base fallback lives in the install/update tools).
- **C12.** `get_store_catalog_info` resolves the Store base from its `store` parameter (like `resolveAgentCatalogBase`) instead of ignoring it.
- **C13.** Fetch caps are enforced on streamed bytes with an abort on timeout (`AbortController`), not after a full download measured in UTF-16 code units.
- **C14.** `MIN_SUPPORTED_SCHEMA_VERSION` is derived from `SUPPORTED_SCHEMA_VERSIONS` instead of being a second hardcoded literal. (Already true in code as of 2026-11-11 — `pkg/src/apps/definition.ts:626` derives it; task 4.1 is checked on that basis.)
- **C15.** The `0.1.0` running-version fallback is observed (logged) so a failed `package.json` import does not silently break all gated installs; the fallback is surfaced distinctly from a real `0.1.0`.
- **C16.** The not-installed Store fallback in the browser becomes the same selectable copy-prompt the empty-Help block gives, instead of a bare repo-relative path.

## What does not change

- No install gate changes (the `minPackageVersion` and schema-floor gates, their comparisons, and their errors are unchanged).
- No catalog source model change (the Store still declares its bases — `catalog` and `catalog-apps`, Phase 1; the shell still holds no catalog source).
- No version bump on its own (this is a robustness/bug-fix change; the version decision is recorded at commit time per the version policy).
- No commit, push, or publish in this change.
