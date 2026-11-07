# Proposal

## Why

Once the catalog lives outside `pkg/` (see
`catalog-out-of-pkg`), the Store needs a new
catalog source, or it has no catalog at all. The
goal is the one from the package-structure
discussion: an app added to the repo becomes
available in the Store without publishing a new
Kody app — but not by tracking `main` HEAD, where
every commit would flow straight into every
user's Store with no review gate and no version
to roll back to.

Pinning to a release is the middle path: adding
an app is a repo commit plus cutting a catalog
release, which is much cheaper than a Kody
publish but still gives a review gate, a version
to name, and a rollback. The Store's default
catalog source is that pinned release, and a fork
owner can change the pin to point at their own
catalog.

## What Changes

- The Store's catalog source becomes the public
  catalog manifest and definitions fetched from
  a pinned release of the public repo. The App
  Store (catalog app `app-store`) fetches the
  manifest through the shell's management API
  path (server-side fetch, as the feed proxy
  does today), not by having the Scribe browser
  fetch GitHub directly.
- The pin is stored as a shell constant a fork
  owner can change: the default is the upstream
  release; changing it points the Store at a
  different repo/release. The Store shows which
  release it is reading, so a user can tell
  whether what they see is upstream or a fork's
  catalog.
- Update detection keeps using the existing
  install-snapshot logic: a remote definition's
  `catalogVersion` and fingerprint are compared
  against the install snapshot, exactly as the
  shipped catalog's were. No snapshot, fingerprint,
  or status rule changes.
- Failure and caching behavior is defined, not
  left to the fetch: a failed catalog fetch shows
  installed apps plus an honest error, never a
  blank Store, and a stale cached manifest may be
  used as a fallback where the spec allows it
  (see design.md).

## Capabilities

### New Capabilities

- `app-registry`: a remote, release-pinned catalog
  source for the Store, replacing the shipped
  catalog import list.

### Modified Capabilities

- `shell`: the Store (as a data app) reads its
  catalog from the pinned release instead of from
  shipped definitions. No new route family beyond
  the management API's catalog fetch.

## Impact

- `pkg/src/apps/catalog.ts`: replaced as the
  runtime catalog source by a remote-catalog
  module (manifest fetch, definition fetch by
  manifest `definitionPath` — recipe fetch by
  `recipePath` — pin constant). The module is
  server-side only; bundle code never fetches
  GitHub directly.
- `pkg/src/apps/registry.ts`: `list_catalog`,
  `get_catalog_definition`, install, and update
  paths read from the remote catalog instead of
  the import list, with snapshot logic unchanged.
- `pkg/src/app.ts`: the management API's catalog
  fetch is a server-side fetch through the
  fetch handler, inside the device gate, with
  the timeout and size discipline of the feed
  proxy.
- `pkg/docs/` and `catalog/README.md`: the
  catalog source, pin, and release-cutting
  procedure are documented (see
  `bootstrap-after-fork` for the user-facing
  bootstrap docs; this change documents the
  mechanism for catalog authors and fork owners).
- BREAKING: none for installed apps or agent
  scripts. The catalog source changes, but an
  installed app's definition, state, and snapshot
  are untouched, and MCP catalog tools keep
  their shapes while reading the new source.
  Version: MINOR at implementation (new catalog
  source, existing registry behavior unchanged)
  — this spec draft itself, outside `pkg/`,
  bumps nothing.
