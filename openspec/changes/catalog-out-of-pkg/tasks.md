# Tasks

Phases land in order: 1, then 2, then 3. Phase 1
is blocked until the repo is public on GitHub
(see design.md Decision 1). No task in this file
commits, pushes, or publishes anything except as
the coordinated landing with `public-pinned-catalog`
requires.

## 1. Move the catalog (gated on public)

- [ ] 1.1 Confirm the public-repo gate: the repo
  is public on GitHub and its bundles are
  fetchable unauthenticated. If the gate is not
  met, stop; do not move the catalog.
- [ ] 1.2 Move `pkg/catalog/*.bundle.json` to
  `catalog/*.bundle.json` byte-identical (no
  content change, no `catalogVersion` bump), move
  the catalog README to `catalog/README.md`, and
  move `pkg/catalog/tests/` to `catalog/tests/`
  with bundle paths updated. Delete the now-empty
  `pkg/catalog/` directory.
- [ ] 1.3 Write the manifest-generation script
  (runnable from a clean checkout, no Kody
  tooling): it reads the bundle directory and
  writes `catalog/index.json` in id order with
  the fields from design.md Decision 2, computing
  fingerprints the same way the install snapshot
  does. Run it once and commit the generated
  manifest with the move.

## 2. Update references and the harness

- [ ] 2.1 Update every `pkg/catalog/` reference
  repo-wide to `catalog/`: `pkg/src/apps/catalog.ts`
  (see 2.3), `pkg/scripts/catalog.ts` (read from
  `../catalog/`), `pkg/docs/adding-an-app.md`,
  `pkg/docs/setup.md`, `pkg/README.md`, and
  `pkg/AGENTS.md`. Repo-wide grep sweep for
  `pkg/catalog` must come back empty except in
  historical/archived spec text.
- [ ] 2.2 Update the catalog harness in
  `tests/catalog-harness.ts` to check manifest
  agreement instead of import agreement: every
  bundle has a manifest entry, every manifest
  entry has a bundle, `catalogVersion` and
  fingerprint match the bundle, entries are in
  id order. The harness must pass on the moved
  catalog with no other changes.
- [ ] 2.3 Retire the shipped-catalog import list
  in `pkg/src/apps/catalog.ts` as the runtime
  catalog source, in coordination with
  `public-pinned-catalog` (which supplies the
  replacement source). This task MUST NOT be
  marked done while the Store still depends on
  the import list with no replacement source.

## 3. Verify and sync specs

- [ ] 3.1 Verify: the move diff shows only path
  changes (plus the new manifest and script);
  the manifest regenerates byte-identical from
  the directory; the catalog harness and all
  bundle jsdom harnesses pass from their new
  locations; local-dev catalog install via
  `pkg/scripts/catalog.ts` works against
  `../catalog/`.
- [ ] 3.2 Sync the canonical specs: update
  `openspec/specs/authoring` (catalog membership
  is manifest agreement, not import agreement)
  and `openspec/specs/app-registry` (catalog
  source). Record in the landing commit that
  this change carries no package version bump
  on its own (outside `pkg/`), and that the
  coordinated Store-source change carries its
  own version decision.
