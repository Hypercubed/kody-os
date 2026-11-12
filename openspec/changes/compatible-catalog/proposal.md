# Proposal

## Why

Every installed App Store today reads its catalog from one mutable
base: `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`.
That makes `main` the live catalog for every shell, with no fallback
to a last compatible version:

- A manifest-level break takes out new installs for every older
  shell, not just the app that changed. Manifest validation in
  `pkg/src/apps/remote-catalog.ts` is all-or-nothing
  (`validateManifestShape` returns null if any entry is invalid), so
  one bad entry makes `readCatalogManifest` throw, `get_store_rows`
  falls back to installed-only rows, and no new catalog app can be
  installed.
- A blanket `minPackageVersion` bump has the same shape: the new
  catalog is valid, but its apps require a newer shell, and the
  catalog lists only the latest definition per app, so there is no
  older version left to install.
- The only cache is the in-memory manifest cache in
  `remote-catalog.ts` (30-second TTL, per shell process, gone on
  restart). There is no pinned tag, no SHA, no per-shell-version
  catalog, and nothing durable in `packageStorage`.

A single correctly gated app is already contained: `add_app` in
`pkg/src/apps/registry.ts` refuses it (`App "x" requires package
version Y (running Z)`, writing nothing), and its Store row shows
the requirement instead of an install control. The gap is the
catalog as a whole: there is no way for an older shell to keep
installing from the last catalog that was compatible with it.

## Goals

The user's goals for this change, in his words:

1. He can push a new version of an app in the catalog to GitHub
   without publishing to Kody.
2. If his shell is compatible, he has a path to update that app
   without an agent (updating the catalog first is acceptable).
3. Any user on an older, incompatible shell continues to be able to
   install from their latest compatible catalog.

## What Changes

This change is phased. Phase 1 is the Store-as-gate slice and
needs no plugin; Phase 2 is the automatic resolver and is the
only part gated behind the plugins spec (see Dependencies).
Phase 1 SHALL be implementable, reviewable, and shippable
before Phase 2 starts, and Phase 2 SHALL build on Phase 1
rather than replace it.

### Phase 1 — Store-as-gate (manual pin, no plugin)

**Split the bases.** The Store declares two catalog bases
instead of one. Its `catalog` proxy entry stays `main` and
becomes the *discovery* base: it is where the Store discovers
its own updates. A second proxy entry, `catalog-apps`,
declares the *listing* base: a pinned tag
(`https://raw.githubusercontent.com/Hypercubed/kody-os/
<tag>/catalog/`), from which the Store lists, installs, and
updates every app except itself. The shell routes by target:
a Store self-update uses the discovery base, all other
apps use the listing base when present, falling back to
the discovery base when a Store definition carries no
listing entry (so an older Store keeps working as today).
The snapshot is a git tag, and tags SHALL NOT be moved
after cutting, so a pinned tag keeps meaning the same
snapshot. (Phase 2 strengthens this by fetching from
the tag's commit SHA instead of the tag name.)

**Store self-update moves out of the apps list.** The App
Store no longer appears as a row in its own list. It gets
a separate section above the list showing the installed
Store version, the catalog snapshot it is pinned to, and
the latest compatible Store version found on `main`, with
one update control. Updating the Store moves the pin; the
apps list then refreshes from the new snapshot. A shell
behind the latest version cannot update the Store: the
update is refused by the existing `minPackageVersion`
gate, and the user stays on the old Store and the old
snapshot.

Phase 1 already meets the three goals, manually: a new
app version is pushed to GitHub and tagged, the
maintainer moves the Store pin to that tag (a Store
definition change, `catalogVersion` +1), and a
compatible shell updates its Store first and then its
apps, with no agent and no Kody publish in the loop;
an older shell cannot update its Store, so it keeps
installing from the tag its Store is pinned to. What
Phase 1 does not do is choose the pin automatically —
the maintainer picks it, one tag at a time.

### Phase 2 — Automatic resolution (plugin, gated)

**Resolution, not a fixed base.** The Store stops treating
its declared listing base as fixed. A resolver picks the
latest catalog snapshot compatible with the running shell
— the highest snapshot whose required shell version is at
or below the running shell — and the Store lists and
installs from that snapshot's base. The pin set by hand
in Phase 1 becomes the pin the resolver sets, and the
separate Store section from Phase 1 becomes the place
that shows the resolved snapshot.

**The resolver is a plugin, not shell core.** The shell core ships
no resolver and no releases-index reader; the pin lives in the
Store definition (Phase 1), not in shell core. The resolver is
a user-land plugin, installed by an agent following a recipe (see
Dependencies), and only after it is installed does a shell resolve
a compatible catalog. Without the plugin, a shell behaves exactly
as Phase 1: the data-app Store reads its pinned listing base,
per-app gates are the backstop.

**Discovery is a static file, not the GitHub API.** The resolver
reads `catalog/releases.json` from `main`: a generated list of
catalog snapshots, each `{ version, tag, sha, shellVersion }`.
It does not call the GitHub Tags or Releases API at runtime. The
API is rate-limited unauthenticated (60 requests/hour per IP, and
the limit was hit from this VM on 2026-11-09), paginates at 30
tags, and the proxy route returns only the body, not the `Link`
header for the next page. A static file on `main` has none of
those problems.

**Tags are the mechanism; releases are notes.** A GitHub release
is a tag plus notes and optional assets. The Store and the resolver
fetch files from `raw.githubusercontent.com/<repo>/<ref>/catalog/`,
where `<ref>` is a tag name or a commit SHA — never a release
object. Tags are git-native (`git tag vX.Y.Z && git push origin
vX.Y.Z`), travel with a clone to forks, and are the snapshot. A
SHA cannot be moved; a tag can, so the SHA in the releases entry
is what gets fetched and the tag is the display label. Creating a
GitHub Release from a tag afterwards, for human notes, is fine
and optional; nothing in this change depends on the Releases API.

**A durable last-good snapshot is the safety net (Phase 2).** The resolver
keeps one durable snapshot of the *resolved* catalog (manifest
plus definitions) in `packageStorage`, refreshed only on a
validated successful read from the resolved snapshot. On a fetch
or validation failure it serves that snapshot labelled stale,
instead of falling back to installed-only. It is never refreshed
with a gated or invalid catalog, or it stops being a fallback.
Phase 1 has no durable snapshot: a failed read of the pinned
listing base falls back to installed-only with an honest error,
as today.

## Capabilities

### New Capabilities

- `app-registry` (Phase 1): a pinned listing base
  (`catalog-apps` proxy entry) alongside the `main`
  discovery base, and the maintainer pin-update procedure.
- `app-registry` (Phase 2): a generated releases index
  (`catalog/releases.json`), compatible-catalog resolution
  (highest snapshot whose required shell is at or below
  the running shell), and a durable last-good snapshot
  of the resolved catalog.
- `shell` (Phase 1): split-base routing in the management
  API — Store self-update from the discovery base, other
  apps from the listing base.
- `shell` (Phase 2): catalog resolution provided by an
  installed resolver plugin through its declared
  interface; the shell core ships no resolver.
- `authoring`: recipes declare plugin dependencies, and plugin
  install is agent-assisted; the maintainer tagging and
  releases-index procedure.

### Modified Capabilities

- `app-registry`: "Store follows the latest catalog" — the Store's
  declared `catalog` base stays `main`, but that base is now the
  *discovery* base (its own updates, the releases index), not
  necessarily the listing/install base. In Phase 1 the
  listing/install base is the pinned tag in the `catalog-apps`
  entry; in Phase 2 it is the resolved snapshot. Without a
  listing entry and without a plugin, rows and installs come
  from `main` as today.
- `shell`: "App Store page is a data app" — the App Store itself no
  longer appears as a row in its own list; its update lives in a
  separate section. (Phase 1.)
- `authoring`: "A Store's catalog base tracks the latest commit" —
  clarified to the same discovery-base reading as above, with
  the listing base pinned in Phase 1 and resolved in Phase 2.

## Impact

- Code, Phase 1: the Store bundle's separate self-update
  section, the second (`catalog-apps`) proxy entry and its
  shell routing in the management API, and the maintainer
  tagging and pin-update procedure.
- Code, Phase 2: the resolver plugin (user-land, not shipped —
  see Dependencies), the resolved-snapshot display, the
  releases-index generator extension and its harness, and
  the recipe/docs updates for plugin dependencies and tagging.
- No change to the agent path: `install_from_catalog` /
  `update_from_catalog` already take an explicit `catalogBase`,
  so an agent can install from any tag or from `main` today, and
  keeps that ability. The Store remains discovery and
  convenience; it never blocks an agent install. Without an
  explicit base, the agent path SHALL use the same base the
  Store would use for that target (listing base for apps,
  discovery base for the Store itself).
- No change to the install gates: per-app `minPackageVersion`
  and the schema floor (`MIN_SUPPORTED_SCHEMA_VERSION`, currently
  3, supported `[3, 4, 5]`) stay as the backstop, and `add_app`
  remains the single install entry point.
- BREAKING: none for a shell on Phase 1 without the plugin
  installed — it lists from its pinned tag instead of `main`,
  and the Store's own update is a separate section instead
  of a row. For a shell with the plugin installed, the
  visible change is that the Store lists the resolved snapshot
  instead of the pinned tag. Installed apps are untouched by
  installing the plugin; the Store never auto-updates anything.
- Version: no pkg version bump is specified by this change
  alone. A Store definition change bumps its `catalogVersion`
  by the existing rule. A plugin install is copy-in + register +
  publish of the *user's own* package (per the plugins spec),
  not a publish of this repo's package. The version
  classification for any shell-core change this change turns
  out to need is recorded in the implementation commit, as
  always; the release itself is the user's call and is not a
  step in this change.

## Dependencies

**Phase 2 only is gated behind the plugins spec. Phase 2
SHALL NOT be implemented until that spec exists, is reviewed,
and is settled. Phase 1 has no plugin dependency and SHALL
NOT wait for it.**

There is no plugins OpenSpec change yet. The exploration plan
is at `~/workspace/goals/kindle-scribe-ai-use/files/kody-os-plugin-exploration-plan/kody-os-plugin-exploration-plan.md`
(also in `~/workspace/your_files/`), and the Nov 9, 2026
exploration recorded the shape to test: a plugin is code that
ships inside the kody-os package, lives in its own segregated
place, and is reached by the shell only through a declared
interface; it declares what it needs; the shell does not reach
into its internals, and it does not reach into the shell's.

The plugins spec must settle, at minimum, before Phase 2
can be implemented:

- where plugin code lives and what it may import or touch;
- the manifest shape (identity, version, minimum shell
  version, declared `kody:` imports/capabilities, routes);
- how the shell discovers and registers a plugin, and how
  its routes are namespaced so they cannot collide with the
  shell's or another plugin's;
- the storage namespace rule (namespaced inside the shared
  per-package `packageStorage` bucket);
- the lifecycle for install, update, disable, and remove,
  including what "install a plugin" consists of (copy code
  in, register it, check it, publish the user's package)
  and what verification proves it landed in the intended
  package;
- failure isolation: a plugin failure must not take down
  the whole shell.

Phase 1 archives on its own when Phase 1 is done; Phase 2
archives after the plugins spec, or the two land together
with the resolver's interface defined in the plugins
spec. Phase 2's spec deltas that name a plugin interface are
conditional on that spec; if the plugins spec settles a
different interface, this change's deltas follow it, and this
change is re-reviewed rather than implemented against a
guessed interface.

This change also depends, in the smaller sense, on
`catalog-robustness-fixes` (open) for the gated-row Remove
behaviour it assumes: a gated installed row keeps Remove.
It does not depend on that change's other fixes.

## Non-goals

- A full package manager: no keeping multiple versions of
  each app in the catalog, no "pick the highest compatible
  version per app" resolver, no dependency graph, no
  retention or pruning policy. The catalog still lists one
  version per app — the version in the pinned (Phase 1) or
  resolved (Phase 2) snapshot.
- Per-entry manifest tolerance: a bad entry in a pinned or
  resolved snapshot still fails that snapshot as a whole;
  the fix in Phase 2 is the durable last-good fallback, not
  tolerating the bad entry. Per-entry handling stays with
  `catalog-robustness-fixes`.
- Changing the shell's fetch discipline (HTTPS-only, 8000 ms
  timeout, size caps) or the install gates.
- Using the GitHub Tags or Releases API at runtime for
  discovery.
- Shipping the resolver in the shell core, auto-installing
  a plugin, or one-click plugin install in the Store.
  Plugin install is always agent-assisted, via a recipe.
- Release or publish steps. The release decision stays the
  user's, as always.
