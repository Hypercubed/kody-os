# Proposal

## Why

Today the catalog lives inside the published package
at `pkg/catalog/`, imported file-by-file into
`pkg/src/apps/catalog.ts`. That means forking the
shell also ships the author's apps, and adding an
app to the catalog is a package change: a bundle
file, an import line, a README entry, a harness
pass, and then a version bump and a Kody publish
before the Store can see it — even though installing
via `add_app` itself needs no publish.

Moving the catalog out of `pkg/` to the repo root
separates the shell from the apps, which is the
point of the whole sequence: nobody has to trust
the author's apps just because they got the shell.
The shell package then contains no app code at
all, and the catalog becomes repo data with its
own manifest, ready for the Store to read from the
public repo (see `public-pinned-catalog`).

## What Changes

- `pkg/catalog/*.bundle.json` moves to
  `catalog/*.bundle.json` at the repo root. The
  catalog README moves with it, and `pkg/catalog/`
  no longer exists as a shipped directory.
- A new `catalog/index.json` manifest lists every
  catalog app: id, name, label, icon, category,
  description, `catalogVersion`, bundle path, and
  fingerprint (the content-only fingerprint of the
  canonical stored definition, as the install
  snapshot uses today). The manifest is the
  catalog's source of truth for listing: the shell
  cannot list a directory at runtime, and after
  this change it cannot import the catalog either.
- A manifest-generation script regenerates
  `catalog/index.json` from the directory, and the
  catalog harness fails on drift: an orphan bundle
  with no manifest entry, a manifest entry with no
  bundle, a mismatched `catalogVersion` or
  fingerprint, or out-of-order entries.
- Local development reads from the new location:
  `pkg/scripts/catalog.ts` and the catalog harness
  read `../catalog/` (relative to `pkg/`), and
  `kody dev` instructions are updated accordingly.

## Capabilities

### New Capabilities

- `authoring`: catalog membership is defined by the
  manifest (bundle file plus manifest entry, in
  agreement), replacing the import-list rule.

### Modified Capabilities

- `app-registry`: the shipped-catalog import list in
  `pkg/src/apps/catalog.ts` is retired as the
  catalog source. (What replaces it at runtime is
  `public-pinned-catalog`; this change only moves
  the source and defines the manifest.)

## Impact

- Repo layout: `catalog/` (bundles, README, tests
  where they belong — see design.md), `catalog/index.json`,
  manifest-generation script, `tests/catalog-harness.ts`
  updated to check manifest agreement instead of
  import agreement.
- `pkg/` references: `pkg/src/apps/catalog.ts`,
  `pkg/scripts/catalog.ts`, `pkg/docs/adding-an-app.md`,
  `pkg/docs/setup.md`, `pkg/README.md`, and
  `pkg/AGENTS.md` paths and copy updated from
  `pkg/catalog/` to `catalog/`.
- Gating: this change MUST NOT land before the repo
  is public on GitHub. Until then, the public
  catalog it prepares for cannot be fetched
  unauthenticated, and moving the catalog out would
  strand the Store. See design.md Decision 1.
- BREAKING (by design, coordinated): the published
  package no longer contains the catalog. That is
  the point of the change, but it means this change
  alone is not shippable: it MUST land in the same
  release window as `public-pinned-catalog`, or
  with a publish-time copy step the spec explicitly
  rejects in design.md. No installed app, definition,
  or agent script breaks on its own: already
  installed apps stay installed, and `add_app`
  still installs any definition it is given.
  Version: no package version change for the move
  itself (changes outside `pkg/` do not bump the
  version per `pkg/AGENTS.md`); the coordinated
  Store-source change carries its own version
  decision in its spec.
