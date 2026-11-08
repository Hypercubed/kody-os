# Tasks

Phases land in order: 1, then 2, then 3. Phase 1
is blocked until the repo is public on GitHub
(see design.md Decision 1). No task in this file
commits, pushes, or publishes anything except as
the coordinated landing with `public-pinned-catalog`
requires.

## 1. Move the catalog (gated on public)

- [x] 1.1 Confirm the public-repo gate: the repo
  is public on GitHub and its bundles are
  fetchable unauthenticated. If the gate is not
  met, stop; do not move the catalog.
- [x] 1.2 Move each per-app directory whole,
  byte-identical (no content change, no
  `catalogVersion` bump): `pkg/catalog/<id>/`
  to `catalog/<id>/`, carrying the definition
  (`definition.json`), the recipe (`RECIPE.md`),
  and the manifest-listed bundle files
  (`index.html` plus any `.js` / `.css` - today
  only the App Store carries extra files,
  `store.js` and `store.css`). Move the catalog
  README to `catalog/README.md`, and move
  `pkg/catalog/tests/` to `catalog/tests/` with
  definition paths updated. Delete the now-empty
  `pkg/catalog/` directory.
- [x] 1.3 Relocate the existing manifest-generation
  script `scripts/build-catalog-index.ts`
  (runnable from a clean checkout, no Kody
  tooling): it reads the per-app definition
  directories and writes `catalog/catalog.json`
  in id order with the fields from design.md
  Decision 2, computing fingerprints the same
  way the install snapshot does. After the move
  the generator writes the manifest only: it no
  longer emits the generated assembly module
  `pkg/src/apps/catalog-bundles.generated.ts`
  (see design.md Decision 7), which is retired
  with the move. Run it once and commit the
  generated manifest with the move. Do not write
  a new generator: the generator and the
  `catalog.json` shape already exist; the move
  relocates them.

## 2. Update references and the harness

- [x] 2.1 Update every `pkg/catalog/` reference
  repo-wide to `catalog/`: `pkg/src/apps/catalog.ts`
  (see 2.3), `pkg/scripts/catalog.ts` (read from
  `../catalog/`), `pkg/.agents/skills/adding-an-app/SKILL.md`,
  `pkg/docs/setup.md`, `pkg/README.md`, and
  `pkg/AGENTS.md`. Repo-wide grep sweep for
  `pkg/catalog` must come back empty except in
  historical/archived spec text.
- [x] 2.2 Update the catalog harness in
  `tests/catalog-harness.ts` to check manifest
  agreement instead of import agreement: every
  definition directory has a manifest entry,
  every manifest entry has a definition
  directory (plus its `RECIPE.md`),
  `catalogVersion`, fingerprint, `installMode`,
  paths, and `bundleFiles` match the definition,
  entries are in id order. The harness must pass
  on the moved catalog with no other changes.
- [x] 2.3 Retire `pkg/src/apps/catalog.ts` as the
  runtime install source, in coordination with
  `public-pinned-catalog` (which supplies the
  replacement source: fetching definitions on
  demand from the public catalog). Since
  `bundle-files`, the install source is the
  generated assembly module
  `pkg/src/apps/catalog-bundles.generated.ts`
  imported by `catalog.ts`, not static
  definition imports (see design.md Decision 7);
  retiring `catalog.ts` retires the assembly
  module with it, and the module file is
  deleted. This task MUST NOT be marked done
  while install still depends on the assembly
  module with no replacement source.

## 3. Verify and sync specs

- [x] 3.1 Verify: the move diff shows only path
  changes (plus the new manifest and script);
  the manifest regenerates byte-identical from
  the directory; the catalog harness and all
  bundle jsdom harnesses pass from their new
  locations; local-dev catalog install via
  `pkg/scripts/catalog.ts` works against
  `../catalog/`.
- [x] 3.2 Sync the canonical specs: update
  `openspec/specs/authoring` (catalog membership
  is manifest agreement, not import agreement)
  and `openspec/specs/app-registry` (catalog
  source). Record in the landing commit that
  this change carries no package version bump
  on its own (outside `pkg/`), and that the
  coordinated Store-source change carries its
  own version decision.
