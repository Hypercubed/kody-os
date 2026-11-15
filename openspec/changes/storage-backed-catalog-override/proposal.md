## Why

Local catalog development is blocked in the mock: `KODY_CATALOG_BASE` never reaches package code inside mock workerd (probed on CLI 3.34.14 and 3.35.10 — `process.env` holds only the runtime binding, `globalThis.KODY_CATALOG_BASE` is undefined), so the Store listing and management API always fall back to the installed Store's declared GitHub base even when a local catalog server is running.

## What Changes

- Add a durable dev override for the catalog base stored in `packageStorage()` (key `kody-os.dev.catalogBase`), readable from inside mock workerd where env vars are not.
- Consult the stored override in catalog base resolution at the same precedence position the env override holds today: explicit `catalogBase` parameter wins, else stored override, else the installed Store's declared base; management API (which takes no explicit base) uses stored override over the Store's declared bases.
- Validate the stored value with the existing `normalizeCatalogBase` allowlist (HTTPS, loopback `http` for dev) on every read; a missing, corrupt, or refused value reads as no override.
- Exclude the override key from install backup/export/import payloads and from restore's install-key handling, so a dev-machine setting never leaks into production data or backups.
- Provide an agent/script write path to set and clear the override (no browser one-tap control).

## Capabilities

### New Capabilities

(none — this extends the existing catalog-source behavior, not a new user capability.)

### Modified Capabilities

- `app-registry`: catalog base resolution gains a storage-backed dev override consulted before the installed Store's declared base, with the same precedence the env override holds today (explicit > override > Store base). Stored value validated with the existing base allowlist; refused/corrupt reads as no override.

## Impact

- `pkg/src/apps/remote-catalog.ts` (`devOverrideBase` / fetch-layer resolution), `pkg/src/apps/registry.ts` (`resolveAgentCatalogBase`, `resolveManagedBase`/`resolveManagedBases`), `pkg/src/apps/storage.ts` or registry backup/export key lists (hygiene), plus a set/clear surface (MCP export and/or `pkg/scripts/catalog.ts`).
- No change to the App Store's shipped GitHub declaration (production behavior unchanged); no change to the `validateUpstreamEntries` `https:` rule for Store declarations.
- Version decision deferred to implementation (additive behavior; no existing call breaks).
