# Design: catalog-out-of-pkg

## Context

See proposal.md (Why). Today every `*.bundle.json`
in `pkg/catalog/` is a catalog app, listed only if
it also has an import line in
`pkg/src/apps/catalog.ts` (alphabetical by id) —
the Worker has no directory listing at runtime, so
the catalog is an explicit import list, and the
harness in `tests/catalog-harness.ts` fails when
the directory and the import list disagree. Catalog
definitions carry `catalogVersion`, incremented by
exactly 1 on any change to that definition file,
and a Store install records a separate snapshot
(install-time `catalogVersion` plus a fingerprint
of the canonical stored definition, content only).
`pkg/` is what Kody publishes; files outside it
(`openspec/`, root `tests/`, root docs) are not in
the published package.

## Goals / Non-Goals

- Goals: a catalog that lives outside the published
  package, with a checkable manifest; a clean repo
  layout for the public move; no change to any
  bundle's content, `catalogVersion` rule, or
  snapshot rule.
- Non-goals: changing the Store's runtime catalog
  source (see `public-pinned-catalog`); changing
  any bundle; adding or removing catalog apps as
  part of the move; a publish-time copy of the
  catalog back into `pkg/` (rejected below).

## Decisions

1. **Gate: public repo first.** This change lands
   only after the repo is public on GitHub. The
   manifest and bundles it moves are the material
   the public Store will fetch; moving them before
   they are publicly fetchable leaves the Store
   with no catalog source. The gate is a release
   condition, not a code condition: the spec's
   tasks are blocked until the public move is done.
2. **Manifest fields are fixed and minimal.**
   Each entry carries: `id`, `name`, `label`,
   `icon`, `category`, `description`,
   `catalogVersion`, `bundle` (relative path
   within `catalog/`, e.g. `counter.bundle.json`),
   and `fingerprint` (the content-only fingerprint
   of the canonical stored definition, computed
   the same way the install snapshot computes it).
   Entries are alphabetical by id. No other fields
   are added in this change; a future field is a
   manifest-version discussion, not a silent
   addition.
3. **The manifest is generated, never hand-edited
   as source of truth.** A script (repo tooling,
   run from the repo root) regenerates
   `catalog/index.json` from the bundle directory:
   it reads each bundle, derives the listing fields
   and fingerprint, and writes the manifest in
   id order. Hand edits to the manifest are
   overwritten by the next regeneration, and the
   harness treats a hand edit that disagrees with
   the directory as drift. The one human decision
   in the manifest is therefore the bundle file
   itself, including its `catalogVersion` bump.
4. **No publish-time copy step.** Copying
   `catalog/` back into `pkg/` at publish time
   would reintroduce the coupling this sequence
   removes (the published package would again
   contain app code, just via a build step), and
   it would hide the source-of-truth question:
   which copy is canonical? Rejected. The
   coordinated landing with `public-pinned-catalog`
   is the mechanism instead: the Store reads the
   public catalog, so the published package needs
   no catalog copy.
5. **Tests move with their subject, harness stays
   outside `pkg/`.** The jsdom harnesses in
   `pkg/catalog/tests/` move to `catalog/tests/`
   (they test bundles, not the shell), and they
   read bundles from their new location. The
   catalog harness in `tests/catalog-harness.ts`
   stays outside `pkg/` (as today) and is updated
   to check manifest agreement (directory vs
   manifest vs fingerprint) instead of
   directory-vs-import agreement.
6. **Bundles are moved byte-identical.** The move
   changes paths and references only. Any bundle
   content change, `catalogVersion` bump, or
   catalog membership change is a separate commit
   and a separate review; bundling it into the
   move would make the move unverifiable by diff.

## Open Questions

- The manifest-generation script's language and
  location (a `bun`/`node` script in repo tooling
  vs a `pkg/scripts/` script run from the root)
  is left to implementation; the requirement is
  that it is runnable from a clean checkout with
  no Kody tooling.
- Whether the manifest carries a top-level
  manifest version field in addition to per-app
  `catalogVersion` is left open; the implementation
  may add one if the public-catalog spec needs it
  to detect manifest-format changes, but it MUST
  NOT change the per-app versioning rule.
