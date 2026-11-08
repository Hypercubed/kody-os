# Design: remove-catalog-pin

## Decisions

### Decision 1: The pin is deleted, not moved

`CATALOG_REPO` and `CATALOG_RELEASE` are deleted from
`pkg/src/apps/remote-catalog.ts`. No catalog source is hardcoded
anywhere in the shell. There is no fallback to a default repo or
release. A shell with no Store installed and no agent-supplied base
has no catalog, which is correct: a fresh install starts empty.

### Decision 2: The catalog source is a base URL, supplied by the caller

Every catalog fetch function takes the catalog base as a parameter:
the base URL of the catalog directory (the directory containing
`catalog.json`), e.g.
`https://raw.githubusercontent.com/Hypercubed/kody-os/v4.1.0/catalog/`.
The manifest is at `<base>catalog.json`, a definition at
`<base><id>/definition.json`, a bundle file at
`<base><id>/<file>`, a recipe at `<base><id>/RECIPE.md`. The base is
validated on every use: HTTPS-only, or loopback `http` for dev (see
Decision 6). A non-HTTPS, non-loopback base is refused before any
fetch. Definition and recipe paths still come from the manifest
entry only, never from a request parameter.

### Decision 3: The Store declares its catalog base as a proxy entry

The Store declares its catalog source in its own definition, the
way an RSS app declares its feeds. The App Store's definition
(`catalog/app-store/definition.json`) gains a `capabilities.proxy`
entry named `catalog` whose `url` is the catalog base URL. This is
the allowlist: the shell fetches a catalog only from a base declared
by the calling app. A different Store declares a different base.
The Store's definition change bumps its `catalogVersion` 15 -> 16
by the existing rule (a definition change is a `catalogVersion` +1).

### Decision 4: The registry resolves the base per call

The registry provides the base to the remote-catalog functions:

- For the Store's management-API calls (`get_store_rows`,
  `store_install_from_catalog`, and the Store's listing), the base
  comes from the calling app's stored definition: its `proxy` entry
  named `catalog`. The registry reads the calling app's definition
  (by the app id on the request) and uses that entry's `url`. If the
  calling app declares no `catalog` entry, the catalog is
  unavailable and the Store shows installed apps only, never blank.
- For the agent's `install_from_catalog`, the base is an optional
  parameter (`catalogBase`). When the agent supplies it, it is used.
  When omitted, the registry uses the installed App Store's declared
  base if an App Store is installed. When neither a parameter nor an
  installed Store base exists, the call is refused with a clear
  error naming that no catalog source was given, and nothing is
  written.

This keeps existing agent calls working (they fall back to the
Store's declared base, which for the default Store points at the
same catalog the pin did) while removing the hardcoded pin from the
shell.

### Decision 5: The fetch functions take the base; the cache is keyed by it

`readCatalogManifest`, `list_catalog`, `get_catalog_entry`,
`get_catalog_definition`, and `get_catalog_recipe` all take the base
as a parameter. The in-memory manifest cache is keyed by base, so
different callers with different catalogs do not share a cache
entry. `get_catalog_source` takes the base and reports it (plus a
label derived from it) for the Store display; `catalogReleaseLabel`
is deleted, since it was pin-derived. The Store displays the
declared catalog source it is reading.

### Decision 6: The dev override is kept

`KODY_CATALOG_BASE` (loopback `http` carve-out for local dev) is
kept as-is. It is a dev-only override, not a catalog source: when
set, it replaces the declared base for local verification. It does
not propagate into the `kody execute` worker (known environment
quirk, handoff 09), so dev verification of a declared base uses the
harness local-server checks, not `kody execute`.

### Decision 7: Fetch discipline is unchanged

HTTPS-only (plus loopback dev), 8,000 ms timeout, the same caps
(64 KiB manifest, 512 KiB definition, 256 KiB bundle file, 64 KiB
recipe), manifest and entry validation, path safety, cached
fallback labeled as cached, and the never-blank Store. None of
these change; only the source of the base changes.

### Decision 8: The Store's proxy entry is a declaration, not a fetchable route

The `catalog` proxy entry declares the base; the shell's catalog
fetch uses it as a base to derive manifest, definition, bundle, and
recipe URLs. The generic proxy route (`GET /proxy/<app>/catalog`)
is not used to fetch the catalog itself (the catalog fetch is
server-side via the management API, as today). The entry exists so
the base is declared in the Store's definition and validated at
install, like a feed declaration.

### Decision 9: Version decision deferred to publish

Removing the pin changes catalog-fetch behavior (the shell no
longer has a default catalog), but it does not remove, rename, or
reshape an MCP export (`install_from_catalog` gains an optional
parameter; calls without it still work via the Store fallback), and
it does not invalidate any app definition. The Store's definition
change bumps app-store `catalogVersion` 15 -> 16 by the existing
rule. No `pkg/package.json` change in this change; the release
version decision (MINOR v4.1.0) is deferred to publish.
