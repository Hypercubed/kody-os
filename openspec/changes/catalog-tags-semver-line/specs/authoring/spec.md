# authoring — delta

## MODIFIED Requirements

### Requirement: Maintainer pin-update procedure (Phase 1, no plugin)

A catalog snapshot SHALL be a git tag. The maintainer SHALL
cut a tag for every catalog snapshot. The procedure SHALL be:
cut the tag (`git tag vX.Y.Z && git push origin vX.Y.Z`;
tags SHALL NOT be moved after cutting), update the Store's
`catalog-apps` entry to that tag, bump the Store's
`catalogVersion` by 1, regenerate the catalog index, run
the harness, commit, push to `main`. A new app version
pushed to `main` SHALL NOT be visible to the Store until
the pin moves. This requirement is Phase 1 and is NOT
gated behind the plugins spec.

**Amendment (catalog-tags-semver-line):** a catalog
snapshot SHALL be a semver-line tag, bare
`<major>.<minor>` (for example `4.2`). The procedure
SHALL be, for a compatible app add: push the app to
`main`, move the line tag (`git tag -f
<major>.<minor> <commit> && git push -f origin
<major>.<minor>`, one tag by name; a tag move is a
force-push and needs its own explicit direction naming
the tag and the remote). No pin move, no Store update,
no version bump. For a shell-line advance: freeze the
old line's tag (stop moving it), cut the new line tag,
update the Store's `catalog-apps` entry to it, bump
the Store's `catalogVersion` by 1, regenerate the
catalog index, run the harness, commit, push to
`main`. A new app version pushed to `main` SHALL be
visible to the Store once the line tag moves to a
commit containing it; it SHALL NOT need a pin move.
This requirement is Phase 1 and is NOT gated behind
the plugins spec.

#### Scenario: Catalog-only snapshot moves the tag, no pin move
- **WHEN** a new app version is pushed to `main` with no
  shell-code change
- **THEN** the maintainer moves the line tag to that
  commit, and the app is visible to the Store with no
  pin move and no Store update.

#### Scenario: Shell-line advance moves the pin
- **WHEN** the shell line advances and a new line tag is
  cut
- **THEN** the maintainer moves the Store pin to the new
  line tag and bumps the Store's `catalogVersion` by 1,
  and a shell on the old line keeps its old Store and
  its frozen tag until its shell is updated.

### Requirement: Maintainer tagging and releases-index procedure (Phase 2)

A catalog snapshot SHALL be a git tag. The maintainer SHALL
cut a tag for every catalog snapshot, including catalog-only
snapshots (see design Open Question 3 for the tag-naming
decision this procedure records at implementation). The
procedure SHALL be: regenerate the catalog index and the
releases index, run the harness, commit, cut the tag,
re-run the generator (now it sees the new tag), commit the
updated `releases.json`, push to `main`; `git fetch --tags`
before running the generator; tags SHALL NOT be moved after
cutting. `catalog/releases.json` SHALL be generated, never
hand-edited, and the harness SHALL fail on a stale copy
(see app-registry, Releases index). A GitHub Release may
be created from a tag afterwards for human notes; nothing
in the Store or the resolver reads it.

**Amendment (catalog-tags-semver-line):** the tag-naming
decision recorded at implementation is the semver line:
tags are bare `<major>.<minor>` and move within their
line (see "Maintainer pin-update procedure" above). The
"tags SHALL NOT be moved after cutting" sentence is
superseded by the line-tag rule. The generator's
"version matches the tag name" check needs a line-aware
form before Phase 2 lands; that is a Phase 2 follow-up,
not a change to this requirement now.
