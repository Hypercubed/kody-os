# Proposal

## Why

Phase 1 of compatible-catalog (Store-as-gate, shipped in
4.2.1 / Store v29) pins the Store's listing base to a git
tag and states that tags SHALL NOT be moved after cutting.
That rule was written for tags that name a shell release
(`4.1.11`, `4.2.0`): the tag is a snapshot, and a pinned
tag keeps meaning the same snapshot.

It makes catalog-only changes expensive. Adding an app
changes no shell code, but under the current rule it needs
a new tag, a pin move in the Store definition, a Store
`catalogVersion` bump, and a Store update on every shell
before the app is visible — and a catalog-only snapshot
has no natural tag name, because tags are shell-release
tags and there is no shell release to name it after. The
maintainer's three situations, in his words:

1. Adding a new app: it should be available to all users
   with the current App Store, without reinstalling the
   App Store.
2. A shell change that adds a feature: the existing
   catalogs become "frozen", and the user updates to the
   new catalog only after their shell is updated to be
   compatible with the catalog's minimum version.
3. Updating the App Store but leaving the shell the same:
   a Store update with no shell change.

Situation 3 is already the mechanism: the Store
self-updates from `main`, gated only by
`minPackageVersion`. Situations 1 and 2 are what the tag
rule needs to express. A patch shell release changes
nothing for the catalog — under semver it cannot change
what apps can be installed — so the tag does not need
the full version at all.

## What Changes

The tag becomes the semver line: bare
`<major>.<minor>` (for example `4.2`), no patch, no `v`
prefix, matching the existing tags (`4.1.11`, `4.2.0`
are bare). The tag is the catalog's id: a shell reads
only its own line's tag, so the catalog cannot get
ahead of the shell.

- A line tag MAY move, only across commits compatible
  with that line (no app requiring a newer shell, no
  schema beyond the line's floor, manifest validates).
  An app add is a tag move: push to `main`, move the
  tag, done. No pin move, no Store update, no version
  bump anywhere. This is situation 1.
- When a shell change adds a feature (a minor or major
  line advance), the old line's tag stops moving — it
  is frozen. A new line tag is cut, and the Store pin
  moves to it through a Store update gated by
  `minPackageVersion`, so a user on the old shell stays
  on the frozen catalog until their shell is updated.
  This is situation 2.
- A Store update with the shell unchanged keeps working
  exactly as today: the Store self-updates from `main`
  whenever the latest Store version is newer and
  compatible with the running shell. This is
  situation 3, and it is also how situation 2
  completes — the new catalog arrives as a Store
  update carrying the new pin.

This change resolves compatible-catalog design Open
Question 3 (whether catalog-only snapshots need a tag
namespace distinct from shell-release tags, or a PATCH
bump per snapshot): neither. The line tag is the
answer — catalog-only snapshots move the line tag,
and no PATCH bump is involved.

## What Does Not Change

- Split-base routing, per-app gates
  (`minPackageVersion`, `schemaVersion` floor), and
  the discovery base (`main`) are unchanged. The
  per-app gates remain the backstop if a tag ever
  moves too far.
- No shell code change. The tag label and base parsing
  (`catalogTagLabel`, `parseGitHubRawBase`) take the
  bare ref from the URL and assume no version format,
  so a `4.2` base needs no code. There is no package
  publish in this change.
- Phase 2 keeps its shape (resolver plugin,
  `releases.json`, durable last-good snapshot), with
  one recorded follow-up: the Phase 2 generator's
  "tag's version matches `pkg/package.json`" check
  assumes full-version tags, and a line tag has no
  full version to match. That check is a Phase 2
  follow-up, not part of this change.
