# Design: catalog-tags-semver-line

## Context

Compatible-catalog Phase 1 pins the Store's listing base
to a git tag and states that tags SHALL NOT be moved
after cutting. The tag names a shell release (`4.1.11`,
`4.2.0`), so the rule made sense: a pinned tag keeps
meaning the same snapshot. The cost is that a
catalog-only change — adding an app, changing no shell
code — needs a new tag, a pin move, a Store
`catalogVersion` bump, and a Store update before it is
visible, and it has no natural tag name. This change
redefines the tag so the maintainer's three situations
(proposal) hold with no extra machinery. It resolves
compatible-catalog design Open Question 3: neither a
`catalog-` tag namespace nor a PATCH bump per catalog
snapshot — the line tag is the answer.

## Decisions

### 1. The tag is the semver line

The listing-base tag SHALL be bare `<major>.<minor>`
(for example `4.2`): no patch, no `v` prefix. Existing
tags are bare (`4.1.11`, `4.2.0`), and the `vX.Y.Z`
form in some maintainer docs does not match reality;
this change uses the bare form and the procedure
rewrite (task 3) fixes the docs to match. A patch
release cannot change what apps can be installed
(semver), so the patch carries no information the tag
needs. The tag is the catalog's id: a shell reads
only its own line's tag, so the catalog cannot get
ahead of the shell.

### 2. A line tag MAY move, only within its line

A line tag MAY be moved forward across commits that
are compatible with that line: every app in the
catalog at the target commit installs on the line's
shells (each app's `minPackageVersion` at or below
the line, each `schemaVersion` at or above the floor),
and the manifest validates. Moving is
`git tag -f <major>.<minor> <commit> && git push -f
origin <major>.<minor>` — a force-push of one tag by
name, never `--mirror` or `--all`. Per the repository
rule, a force-push needs its own explicit direction
naming the tag and the remote; a tag move is never
implied by a commit, a push, or a general instruction
to keep going. The tag SHALL NOT be moved across a
commit that changes the line's compatibility (a shell
feature, a raised schema floor, an app requiring a
newer shell): that commit belongs to the next line's
tag instead.

### 3. A line advance freezes the old tag

When a shell change adds a feature — a minor or major
line advance — the old line's tag stops moving: it is
frozen at its last commit. A new line tag is cut, and
the Store pin moves to it through a Store update.
That Store update is gated by `minPackageVersion`
(the existing gate), so a user on the old shell is
never offered it and keeps installing from the frozen
tag. After their shell is updated, the Store update
goes through, the pin moves, and the new catalog is
there. Shell first, then Store.

### 4. The three situations, mapped to mechanics

- **App add (situation 1).** Push the app to `main`,
  move the line tag. The Store's pin URL is
  unchanged, so the listing refreshes from the moved
  tag within the manifest cache window. No pin move,
  no Store update, no version bump anywhere.
- **Shell feature (situation 2).** Freeze the old
  line's tag (Decision 3). Cut the new line tag, move
  the pin in a new Store version, publish that Store
  version to `main`. Old shells stay on the frozen
  tag; new shells update the Store and move on.
- **Store update, shell unchanged (situation 3).**
  Unchanged from today: the Store self-updates from
  the discovery base (`main`) whenever the latest
  Store version is newer and compatible with the
  running shell (`hasUpdate`). A Store update that
  keeps the same minimum version goes through on the
  shell already installed. This is also how situation
  2 completes: the new catalog arrives as a Store
  update carrying the new pin.

### 5. In Phase 1 the tag is label AND fetch identity

Compatible-catalog Decision 4 ("tag is the label; SHA
is the fetch identity") is Phase 2's rule: the
resolver fetches by SHA, so a moved tag cannot
silently change a snapshot. In Phase 1 there is no
resolver; the listing-base URL contains the tag name,
so the tag IS the fetch identity and moving it is the
mechanism by which the listing changes. This change
amends Decision 4's scope to Phase 2 only. Phase 2's
SHA fetching still stands as the strengthening, and
the Phase 2 generator's "tag's version matches
`pkg/package.json`" check is a recorded follow-up
(Decision 7): a line tag has no full version to
match, so that check needs a line-aware form before
Phase 2 lands.

### 6. Failure modes

- **Bad manifest breaks the line.** Manifest
  validation is all-or-nothing: one bad entry makes
  `readCatalogManifest` throw and the Store falls back
  to installed-only rows. A moved tag carrying a bad
  manifest breaks the listing for every shell on that
  line until it is fixed (move the tag back, or fix
  forward). The blast radius is one line, not every
  shell — but within the line it is total. The
  mitigation is the harness: regenerate and run it
  before moving the tag, and never move the tag across
  an unvalidated commit.
- **Stale reads after a move.** `raw.githubusercontent`
  caches by ref, so a moved tag can keep serving the
  old snapshot for a while, and a clone that already
  fetched the old tag keeps the old target until it
  force-fetches tags. Neither breaks correctness —
  the old snapshot is still a valid catalog for the
  line — but a new app may take a while to appear.
  Do not re-move the tag to "fix" a slow appearance;
  wait for the cache.
- **A tag moved too far.** If a tag is moved across a
  commit that adds an app requiring a newer shell, the
  per-app gates still refuse that install and the row
  shows the requirement. The gates are the backstop;
  the move discipline (Decision 2) is the rule.

### 7. Migration: pin `4.2.0` → `4.2`

Today the live Store v29 pins `catalog-apps` to the
`4.2.0` tag. The one-time migration is a Store update
(situation 3): change the Store definition's
`catalog-apps` URL to the `4.2` tag, bump the Store's
`catalogVersion` 29 → 30, regenerate the catalog
index, commit, push to `main`; cut the `4.2` tag at
the commit containing the new pin (and the alembic
add, which rides the same commit), push the tag.
Then the live Store updates to v30 from `main`, the
listing base becomes the `4.2` tag, and from then on
app adds are push + move tag. No shell code change,
no package publish: the pin rename is catalog data
outside `pkg/`, which does not bump the package
version.

## Non-goals

- No shell code change; no package publish. The tag
  label and base parsing take the bare ref from the
  URL and assume no version format.
- No change to split-base routing, per-app gates, the
  discovery base, or the Store self-update section.
- No change to Phase 2's shape. The generator's
  line-tag check (Decision 5) is a follow-up, not
  part of this change.
- No canonical-spec sync. The canonical specs in
  `openspec/specs/` do not yet carry the Phase 1
  split-base content (that sync is an open item from
  compatible-catalog); this change follows the same
  pattern as that change — deltas under this change
  dir only — and does not take on the sync.
