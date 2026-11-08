# Close-out: catalog-out-of-pkg

Archived 2026-11-07 (dated 2026-11-08, matching the other Nov 7 evening archives).
Landing commit: ddea688 ("Refactor catalog paths and enhance store harness tests").
Package version: no bump — pkg/package.json stays v4.0.0 build 34.

## What it did
Moved the app catalog out of the Kody package (`pkg/catalog/` → `catalog/`, 18 apps,
byte-identical, no catalogVersion bump) and retired the old runtime install source
(`pkg/src/apps/catalog.ts` + the generated assembly module
`pkg/src/apps/catalog-bundles.generated.ts`). The generator
(`scripts/build-catalog-index.ts`) now writes `catalog/catalog.json` only.
The replacement install source (fetching definitions on demand from the public
catalog) is supplied by the coordinated `public-pinned-catalog` change, archived
separately.

## Verification (handoff 09 + re-verified at archive, Nov 7)
- 1.1 Public-repo gate: repo public on GitHub (unauthenticated API: private false,
  visibility public); bundles fetchable unauthenticated.
- 1.2 Move: `catalog/` holds 18 apps, `pkg/catalog/` is gone, `catalog.json`
  lists 18 apps; handoff 09 verified the per-app move byte-identical.
- 1.3 Generator: assembly module deleted, generator no longer emits it,
  writes `catalog/catalog.json` only.
- 2.1 References: live tree clean — AGENTS.md (4 lines) and the counter bundle
  comment (2 refs) were the last live `pkg/catalog` hits and were fixed during
  the archive. Remaining `pkg/catalog` hits are confined to other changes'
  spec text (pre-move proposals in openspec/changes/), not live code or docs.
- 2.2 Harness: catalog harness checks manifest agreement and passes
  (ALL CATALOG CHECKS PASSED, 18 apps).
- 2.3 Retirement: `pkg/src/apps/catalog.ts` deleted, assembly module deleted,
  `pkg/src/apps/remote-catalog.ts` is the install source.
- 3.1 Manifest regenerates byte-identical (`bun scripts/build-catalog-index.ts`,
  verified at archive); catalog harness passes.
- 3.2 Canonical specs synced (authoring: manifest agreement; app-registry:
  catalog source). No package version bump on this change.

## Notes
- Counter bundle test: `catalog/tests/counter-tests.cjs` passes under `node`
  (ALL TESTS PASSED). Under `bun` it shows 14 fetch-simulation failures that
  are pre-existing — identical on the committed HEAD version — a bun-vs-node
  runner difference, not a bundle defect. The definition/shape checks pass
  under both runners.
- The coordinated `public-pinned-catalog` change is archived separately; its
  3.1 (real-release verification) needs the v4.1.0 tag.
