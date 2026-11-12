# Design: compatible-catalog

## Context

See proposal.md (Why, Goals). The facts this design takes as
given, all verified against the tree at v4.1.11 build 46:

- The Store's declared catalog base is `main`
  (`catalog/app-store/definition.json`, `capabilities.proxy`
  entry named `catalog`). The shell fetches only from the
  declared base (`pkg/src/apps/remote-catalog.ts`,
  `pkg/src/apps/registry.ts`: `resolveManagedBase`,
  `resolveAgentCatalogBase`).
- Manifest validation is all-or-nothing
  (`validateManifestShape` returns null if any entry is
  invalid). The only cache is in-memory, 30-second TTL.
- `add_app` is the single install entry point and already
  gates on `minPackageVersion` and on the schema floor
  (`MIN_SUPPORTED_SCHEMA_VERSION`, currently 3).
- The browser management API (`GET /manage/rows|install|
  update|restore`) takes no catalog-base parameter; the
  agent exports `install_from_catalog` / `update_from_catalog`
  do take an optional `catalogBase`.
- A Store bundle can *read* GitHub tags through a declared
  `proxy` entry (`GET /proxy/app-store/<name>`), but it
  cannot *install from* a tag it discovers that way, because
  the management API will only install from the acting
  Store's declared base. Discovery and application are
  different capabilities, and the bundle has only the first.
- The canonical "Store follows the latest catalog"
  requirement (app-registry, authoring) says the Store's
  declared base SHALL be `main`, not a fixed tag, because a
  Store pinned to a tag only ever sees that tag's catalog,
  where the Store is itself, and can never discover a newer
  catalog or a newer Store. Any design that pins the Store's
  declared base to a tag reintroduces that freeze, and must
  answer it explicitly. Phase 1 answers it with two bases,
  not one: the discovery base stays `main`, so the Store
  can always discover a newer Store, while only the
  listing base is pinned (Decision 1B).

## Phases

- **Phase 1 — Store-as-gate (no plugin gate).** Split
  bases, Store self-update out of the list, maintainer
  pin-update procedure. Implementable now.
- **Phase 2 — Automatic resolution (plugin-gated).**
  `releases.json`, the resolver plugin, the durable
  last-good snapshot, and recipe plugin dependencies.
  Implementable only after the plugins spec (Decision 1).

## Decisions

### 1. Gate: the plugins spec gates Phase 2 only

No Phase 2 implementation work starts until the plugins
spec exists, is reviewed, and settles the interface
Phase 2 depends on (proposal.md, Dependencies). The
resolver's manifest shape, route namespace, storage
namespace, and lifecycle are defined there, not here. If
that spec settles a different interface, this change's
Phase 2 deltas follow it and this change is re-reviewed.
This is a sequencing dependency, not a validity failure:
Phase 2 is written so it can be reviewed now, and
implemented only after the gate passes. Phase 1 has no
plugin dependency and SHALL NOT wait for this gate.

### 1A. Phase 1 — Store self-update is a separate section, out of the apps list

The App Store bundle SHALL NOT render the App Store as
a row in its own list. It SHALL render a separate
section above the list showing: installed Store
`catalogVersion`, the pinned snapshot (tag, and the
running shell version), and the latest compatible Store
version found on the discovery (`main`) base, with one
update control. Updating the Store SHALL fetch that
Store definition from the discovery base, not from the
pinned listing base, and SHALL be gated by `add_app`'s
`minPackageVersion` check: a Store requiring a newer
shell SHALL be refused, and the user stays on the old
Store and the old snapshot. After a successful Store
update, the pin moves and the apps list refreshes from
the new snapshot. Update All SHALL NOT include the
Store itself. The Store's own row controls (Remove, and
the gated-row Remove from `catalog-robustness-fixes`)
move with it into the separate section, with the same
confirmation behaviour as a row. This decision is
Phase 1: it needs no plugin, and Phase 2 reuses the
same section, showing the resolved snapshot instead
of the pinned one.

### 1B. Phase 1 — Split bases: discovery on `main`, listing pinned to a tag

The Store SHALL declare two proxy entries: `catalog`
(`https://raw.githubusercontent.com/Hypercubed/kody-os/
main/catalog/`, the discovery base) and `catalog-apps`
(`https://raw.githubusercontent.com/Hypercubed/kody-os/
<tag>/catalog/`, the listing base, pinned to a tag by
the maintainer). The shell's management API SHALL
route by target: a Store self-update uses the discovery
base; every other app's rows, install, and update use
the listing base when the installed Store declares one,
falling back to the discovery base when it declares
none (so a Store installed before this change keeps
working as today, reading `main`). The agent exports
SHALL follow the same routing when no explicit
`catalogBase` is supplied. Changing either entry's URL
is a definition change and bumps the Store's
`catalogVersion` by 1 under the existing rule.

Rationale: this is the freeze answer. A Store whose
only base were a pinned tag could never discover a
newer Store. With the discovery base kept on `main`,
the Store always can, and the pin only ever governs
which apps it lists. The pin is set by hand in Phase 1
and set by the resolver in Phase 2; the routing does
not change between phases, only who picks the tag.

### 2. Phase 2 — The resolver is a user-land plugin, not shell core

The shell core ships no resolver and no
releases-index reader; the pin lives in the Store
definition (Phase 1), not in shell core. The resolver is installed by an
agent following a recipe, into the user's own package, in
the segregated plugin location the plugins spec defines,
and is published as part of that user's package. It is
never shipped with the shell, never auto-installed, and
never one-click installed from the Store.

Rationale: this is the plugin model the user directed
(2026-11-09): user-land installed shell enhancements that
are not shipped with the shell, part of the recipe system.
A resolver that shipped with the shell would be shell core
by another name, and would make every shell carry a
catalog policy its owner may not want. A resolver that
lived only in the Store data app could discover a tag but
could not install from it (see Context), so it would need
either the agent or a shell change anyway — the plugin is
the honest place for the server side.

Consequence: a shell without the plugin installed behaves
exactly as Phase 1. That is intentional and is the
backwards-compatibility story: nothing in Phase 2
breaks a shell that never installs the plugin.

### 3. Phase 2 — Discovery source is `catalog/releases.json` on `main`

The resolver reads one static file from `main`:
`catalog/releases.json`, generated alongside
`catalog/catalog.json`. Each entry is
`{ version, tag, sha, shellVersion }`, sorted
deterministically. The file is generated, never
hand-edited (Decision 8).

Rejected: the GitHub Tags API and the GitHub Releases
API at runtime. The Tags API is rate-limited
unauthenticated (60/hour per IP; hit from this VM on
2026-11-09), paginates at 30 tags, and the proxy route
returns only the body, not the `Link` header for the
next page. The Releases API adds draft/prerelease
filtering semantics and GitHub-only metadata that is not
in a git clone. A static file has none of those problems,
is cacheable by the same fetch discipline as the catalog,
and is fork-friendly: a fork generates its own file from
its own tags.

### 4. Phase 1 and 2 — Tag is the label; SHA is the fetch identity

A catalog snapshot is identified by its git tag for
display and by its commit SHA for fetching. The resolver
fetches from `https://raw.githubusercontent.com/
<owner>/<repo>/<sha>/catalog/`, never from a bare tag
name it has not verified, so a moved tag cannot silently
change a snapshot. The tag is what the Store displays
("Catalog v4.1.11"), the SHA is what it fetches.

A GitHub Release may be created from a tag afterwards
for human notes. It is optional, and nothing in this
change reads it. Releases do not add a mechanism: a
release *is* a tag plus notes.

### 5. Phase 2 — Resolution rule: highest snapshot at or below the running shell

The resolver SHALL pick the highest entry in
`releases.json` whose `shellVersion` is at or below the
running shell version (`getRunningPackageVersion`).
Ties and malformed entries are skipped, never picked.
If no entry qualifies, the resolver SHALL report no
compatible catalog (and the durable snapshot, Decision 7,
is the fallback); it SHALL NOT fall through to `main`.

The per-app gates remain as a backstop: an app in the
resolved snapshot whose `minPackageVersion` is above the
running shell, or whose `schemaVersion` is below the
floor, is still refused by `add_app` and shown gated in
the Store. Resolution picks the snapshot; the gates
still police individual apps inside it.

Open question, recorded not decided: whether a snapshot
whose `shellVersion` is *above* the running shell but
whose apps are all individually compatible should ever
be considered. The rule as written says no — the
snapshot is the unit of compatibility, and an app-level
exception would reintroduce per-app version picking,
which is out of scope (see Non-goals).

### 6. The Store's declared discovery base stays `main`; the listing base is pinned (Phase 1) or resolved (Phase 2)

The Store's `capabilities.proxy` entry named `catalog`
SHALL stay the `main` branch base. That preserves the
canonical "Store follows the latest catalog" requirement
in its discovery sense: the Store can discover its own
updates and can read `releases.json` from `main`.

In Phase 1 the Store's rows and installs come from the
*listing* base declared in its `catalog-apps` entry
(Decision 1B), not from the declared discovery base.
In Phase 2, when the resolver plugin is installed, the
Store's rows and installs come from the *resolved
snapshot's* base instead of the pinned listing base.
The plugin's server side passes the resolved base
explicitly to the catalog fetch (the same explicit-base
path the agent exports already use), and the Store
bundle displays the resolved snapshot (tag + SHA short
form) instead of the pinned tag. When the plugin is
not installed, rows and installs come from the pinned
listing base as in Phase 1.

This is the design's answer to the freeze the canonical
requirement warns about: the Store is not pinned to a
tag in its only base, so it can always discover a
newer Store; the *listing* is pinned to a snapshot by
the maintainer (Phase 1) or by the resolver (Phase 2),
and the pin moves when the Store updates (Decision 9
below, as built in Phase 1).

### 7. Phase 2 — Durable last-good snapshot of the resolved catalog

The resolver SHALL keep one durable snapshot of the
resolved catalog in `packageStorage`, under a key the
plugins spec's storage-namespace rule assigns (provisional
key, to be confirmed against that rule:
`kody-os.catalog.last-good.<base-hash>` — the exact key
is the plugins spec's call, not this change's). The
snapshot holds the manifest plus the definitions as
fetched from the resolved snapshot (bundle files are
fetched on demand from the same resolved base, not
cached wholesale; the whole catalog directory is ~656 KB
and the definitions plus index files ~266 KB, so the
snapshot fits the durable budget, but caching every
bundle file is not required to make install work — the
resolved base is immutable, so a later fetch from it
returns the same files).

Refresh rule: the snapshot SHALL be refreshed only on
a validated successful read from the resolved snapshot
(manifest validates, definitions validate). It SHALL
NOT be refreshed with a gated or invalid catalog, or
with a catalog from a different snapshot. On a fetch or
validation failure of the resolved snapshot, the
resolver SHALL serve the durable snapshot labelled
stale (tag, age), instead of falling back to
installed-only. If there is no durable snapshot, it
falls back to installed-only with an honest error, as
today.

### 8. Phase 2 — `releases.json` is generated, and the harness enforces it

`catalog/releases.json` SHALL be generated by extending
the existing catalog-index generator
(`scripts/build-catalog-index.ts`, same run that
regenerates `catalog.json`), never hand-edited. The
generator SHALL read local git tags, and for each tag
verify it against the tag itself: `git show
<tag>:pkg/package.json` parses and its version matches
the tag name, and `git show <tag>:catalog/catalog.json`
exists and parses. An entry whose tag fails those
checks SHALL fail the generator loudly, not be skipped
silently.

The harness (`tests/catalog-harness.ts`, extended)
SHALL fail if `releases.json` is stale: any local tag
missing from it, any entry pointing at a missing tag or
a mismatched SHA, any entry whose `shellVersion` does
not match the version at that tag, or non-deterministic
ordering. The release procedure (catalog/README.md)
SHALL be: regenerate, run the harness, commit, cut the
tag, re-run the generator (now it sees the new tag),
commit the updated `releases.json`, push to `main`.
The second generator run is load-bearing: a tag cut
after a commit is not in that commit, so the first run
cannot list it, and the Store fetches `releases.json`
from `main`, not from the tag, so the second commit is
sufficient. `git fetch --tags` before running the
generator, so local tags do not lag remote ones. Tags
SHALL NOT be moved after cutting.

Failure mode if the maintainer forgets the second run:
the harness fails on the next run, and the resolver
treats a missing entry as "no newer catalog", not as
an error — users keep installing from their last
resolved catalog and simply do not see the new apps
until the index lands.

### 9. Phase 1 built, Phase 2 reuses — Store self-update section

See Decision 1A: the separate self-update section is
built in Phase 1, showing the pinned snapshot and the
latest compatible Store version found on the discovery
(`main`) base. In Phase 2 the same section shows the
resolved snapshot instead of the pinned one, and the
Store update is fetched from the *latest compatible*
snapshot (as resolved), not from the pinned snapshot.
In both phases the update is gated by `add_app`'s
`minPackageVersion` check, and after a successful Store
update the pin moves and the apps list refreshes from
the new snapshot. The section SHALL NOT claim a
resolved snapshot when none was resolved.

### 10. Phase 2 — Recipes declare plugin dependencies; plugin install is always agent-assisted

An app whose install requires a shell feature SHALL
declare that requirement in its `RECIPE.md` (and, where
the definition carries a machine-readable field for it,
in the definition — the field, if any, is the plugins
spec's call). The recipe SHALL instruct the agent to
install the named plugin first — copy the plugin source
into the user's package, register it, check it, publish
the user's package — and only then install the app.
The Store SHALL NOT one-click install a plugin, and
SHALL NOT auto-install one. A recipe-only app that
requires a plugin SHALL show its recipe prompt in place
of Add, as for any recipe-only app.

The catalog-resolver plugin itself SHALL be installed
this way: its recipe is the install procedure for the
plugin, and the Store's separate section SHALL point
at that recipe (selectable text, no copy button, in the
pattern of the existing recipe prompts) when the plugin
is not installed and a compatible catalog cannot be
resolved without it.

### 11. What this change does not do

- It does not change the shell's fetch discipline, the
  install gates, the install-snapshot rules, or the
  status classification. Those are reused unchanged.
- It does not make the manifest validation per-entry.
  A bad entry in a resolved snapshot still fails that
  snapshot as a whole; the durable snapshot (Decision 7)
  is the recovery, not tolerance of the bad entry.
- It does not add a catalog source constant to the shell.
  The shell still holds no catalog source of its own;
  the resolver plugin holds the resolved base for the
  duration of a call, and the Store's declared base
  stays `main`.
- It does not add release or publish steps to any plan.
  The maintainer's tagging and index procedure is a
  *release procedure* documented in `catalog/README.md`,
  not a step in this change's tasks, and the user's
  release decision stays the user's.

## Open questions

1. The exact durable-snapshot storage key and the exact
   plugin route/export names are the plugins spec's call
   (Decision 1, Decision 7). This change records the
   provisional key and the required behaviour, not the
   final names.
2. Whether a snapshot whose `shellVersion` is above the
   running shell but whose apps are all individually
   compatible should ever be considered (Decision 5).
   Default answer in this design is no.
3. Whether catalog-only snapshots need a tag namespace
   distinct from shell-release tags (for example a
   `catalog-` prefix), or whether every catalog snapshot
   is a shell-release tag with a PATCH bump. The tagging
   rule in Decision 8 assumes the latter — a tag's
   version matches the `pkg/package.json` version at
   that tag — and a distinct namespace would need the
   generator and the harness to parse it. This is a
   maintainer decision to record at implementation, not
   a reason to delay review of the rest of the change.
