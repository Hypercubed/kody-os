# Tasks

Phases land in order: 1, then 2, then 3. Phase 1
is blocked until `catalog-out-of-pkg` is done
and the repo is public. No task in this file
commits, pushes, or publishes anything except
as the coordinated landing with
`catalog-out-of-pkg` requires.

## 1. Remote catalog module

- [ ] 1.1 Add a server-side remote-catalog module
  (replacing `pkg/src/apps/catalog.ts` as the
  runtime source): fetch the pinned release's
  `catalog/index.json`, validate its shape
  (entries, ids, `catalogVersion`, bundle paths,
  fingerprints), and fetch a bundle by manifest
  path only, on demand for install/update.
  Fetching is HTTPS only, with timeout and size
  caps following the feed proxy's discipline,
  and bundle paths are never taken from a
  request parameter.
- [ ] 1.2 Put the pin in one named constant in
  the shell source (default: upstream repo and
  release; tag display required, SHA pinning
  optional per design.md Decision 3), and show
  the pinned release in the Store. A fork owner
  changing that one constant must change the
  Store's catalog source.
- [ ] 1.3 Rewire `list_catalog`,
  `get_catalog_definition`, install, and update
  in `pkg/src/apps/registry.ts` to read from
  the remote catalog, with snapshot, fingerprint,
  and status-classification logic unchanged.
  MCP catalog tools keep their shapes.

## 2. Failure behavior

- [ ] 2.1 Implement the failure degradation from
  design.md Decision 5: a failed manifest fetch
  shows installed apps plus an honest catalog
  error with retry, never a blank Store; any
  cached manifest used as fallback is labeled
  as cached with its release. Do not prefetch
  or cache every bundle.
- [ ] 2.2 Verify in `kody dev` with a local
  catalog override (so development does not
  depend on a published release): a new app
  added to the repo and a new release appears
  in the Store with no Kody publish; rolling
  the pin back restores the old list; a failed
  fetch degrades as specified; changing the
  pin constant changes the catalog source.

## 3. Verify, document the procedure, sync specs

- [ ] 3.1 Verify end to end against a real
  public release (not just the local override):
  manifest and bundles fetch from the pinned
  release, install/update/restore round-trip
  through the data Store, and snapshots still
  classify behind/modified correctly against
  the remote definitions.
- [ ] 3.2 Document the release-cutting procedure
  in `catalog/README.md`: regenerate the
  manifest, run the catalog harness, commit,
  tag, publish. Fill in the canonical upstream
  repo URL and release naming from the actual
  public repo; do not invent them in the spec.
- [ ] 3.3 Sync the canonical specs: update
  `openspec/specs/app-registry` (remote catalog
  source, pin, failure behavior) and
  `openspec/specs/shell` (Store release display).
  Record the version decision in the
  implementation commit (MINOR per proposal.md,
  build +1 on publish).
