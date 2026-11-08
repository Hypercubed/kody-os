# Proposal: remove-catalog-pin

## Why

The shell should not care what catalog you use. A Store is just an
app: it reads its own catalog and enables installing, and a different
Store can have a different catalog. The primary install path is
asking your agent to install directly from a repo, with the agent
supplying the source.

Today the shell holds a catalog source of its own: `remote-catalog.ts`
pins one repo and release (`CATALOG_REPO` + `CATALOG_RELEASE`,
`Hypercubed/kody-os@v4.1.0`) and every catalog fetch falls back to
it. That pin is the shell caring what catalog you use. It goes.

The replacement follows a mechanism the shell already has. An RSS
app declares its feeds in its definition (`capabilities.feeds`), and
the shell fetches only declared feeds through `GET /feed/<app>/<name>`
— the route never takes a URL from the request. A Store works the
same way: it declares its catalog source in its definition as a
`proxy` entry named `catalog`, and the shell fetches the catalog from
that declared base only. The shell holds no catalog source of its
own, and the fetch logic (HTTPS-only, timeout, caps, validation,
cached fallback) is unchanged.

## What changes

- `remote-catalog.ts`: the pin constants are deleted. Every catalog
  fetch function takes the catalog base as a parameter, validated
  HTTPS-only (loopback `http` for dev via the existing
  `KODY_CATALOG_BASE` override, which is kept).
- The App Store's definition declares its catalog base as a `proxy`
  entry named `catalog`. Its `catalogVersion` bumps by the existing
  rule (15 -> 16).
- The registry resolves the base per call: for the Store's
  management-API calls, from the calling Store's declared `catalog`
  entry; for the agent's `install_from_catalog`, from an optional
  parameter, falling back to the installed App Store's declared base,
  and refusing with a clear error when no source is given.
- The Store displays the declared catalog source it is reading, not
  a pinned release.

## What does not change

- The catalog itself stays at the repo root (`catalog/`, 18 apps),
  fetched from GitHub. The move stands.
- The fetch discipline is unchanged: HTTPS-only, 8,000 ms timeout,
  the same caps (64 KiB manifest, 512 KiB definition, 256 KiB bundle
  file, 64 KiB recipe), manifest validation, paths from the manifest
  entry only, cached fallback labeled as cached, never-blank Store.
- `minPackageVersion` (handoff 10) is untouched.
- No commit, push, publish, or version bump in this change; the
  version decision is deferred to publish (the release is MINOR
  v4.1.0 per the earlier decision).
