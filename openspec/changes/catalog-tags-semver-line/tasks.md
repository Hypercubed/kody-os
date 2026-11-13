# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. Cutting or moving a tag and moving the
pin are release acts, documented in `catalog/README.md`
(task 3); running them is a release act, not a task in
this change. A tag move is a force-push of one tag by
name and needs its own explicit direction naming the tag
and the remote (repository rule).

## 1. Spec — semver-line tags

- [x] 1.1 Write this change: proposal (the three
  situations), design (line-tag rule, move discipline,
  freeze rule, failure modes, migration), tasks, and
  spec deltas for `app-registry` and `authoring`
  amending the "tags SHALL NOT be moved" rule. No
  `shell` delta: no shell code changes.

## 2. Pin rename — Store definition

- [x] 2.1 Change `catalog/app-store/definition.json`:
  `catalog-apps` URL from the `4.2.0` tag to the `4.2`
  tag, Store `catalogVersion` 29 → 30 (one +1 for the
  definition change, per the existing rule). Regenerate
  `catalog/catalog.json` with
  `bun scripts/build-catalog-index.ts` (never hand-edit
  it). Verify: the regenerated index parses, the
  app-store entry shows `catalogVersion` 30 and the
  `4.2` pin, and no other app's entry changed except
  the alembic add riding the same commit.
  Done (2026-11-12 evening) as commit `2bc747c`
  "App Catalog v30: pin catalog-apps to semver-line
  tag 4.2" — index parses, Store v30, pin `4.2`.
  Note: the alembic add did NOT ride that commit; it
  landed separately as `cace3b51` right after, and the
  tag was then moved to it. The substance (pin
  renamed, Store v30, tag `4.2` cut) is as specified.

## 3. Maintainer procedure — catalog/README.md

- [x] 3.1 Rewrite "Pinned catalog maintenance" in
  `catalog/README.md` to the line-tag procedure: the
  tag is bare `<major>.<minor>`; an app add moves the
  tag (`git tag -f <major>.<minor> <commit> && git push
  -f origin <major>.<minor>`, one tag by name, explicit
  direction each time); a shell-line advance freezes
  the old tag, cuts the new line tag, and moves the pin
  in a new Store version; a Store update with the shell
  unchanged needs no shell change. Fix the `vX.Y.Z`
  form in the procedure to the bare form the tags
  actually use. Note explicitly that a moved tag can
  serve stale content for a while (raw cache, fetched
  tags) and that a bad manifest breaks the listing for
  the whole line until fixed — run the harness before
  moving the tag.
  Done (2026-11-12 late evening): the section and the
  listing-source paragraph above it were rewritten to
  the line-tag procedure; the `vX.Y.Z` form and the
  "never moved" rule are gone.

## 4. Verify pre-release

- [x] 4.1 Confirm no shell code change is needed and
  record the check: `catalogTagLabel` returns the bare
  ref from the URL and `parseGitHubRawBase` splits on
  slashes with no version-format assumption, so a `4.2`
  base needs no code; `parsePackageVersion` is for
  package versions, not tags. Run typecheck, build,
  and the catalog harness from the repository root and
  record the results. Do not mark a step done if it
  was not run.
  Note (2026-11-12, baseline before implementation):
  index regenerates cleanly (19 apps; diff vs HEAD is
  the alembic entry only); catalog harness ALL PASSED
  (19 apps); typecheck passes via `bun x`
  (`bunx` is missing in this environment — recorded
  substitution); store harness shows 9 failures in the
  working tree, all count assertions expecting 18 apps
  and seeing 19 — verified against a clean checkout of
  `6cc1af3` (ALL STORE CHECKS PASSED), so they are
  caused by the staged alembic add, not by code; the
  harness count expectations need updating to 19 when
  the add lands.
  Check recorded (2026-11-12 late evening): read
  `catalogTagLabel` (returns the bare ref via
  `catalogGitHubRef`, no version-format assumption)
  and `parseGitHubRawBase` (slash-split owner/repo/
  ref/tail, no version-format assumption) — a `4.2`
  base needs no code, and the live `4.2` tag serving
  the listing since that evening proves it. Typecheck
  clean (`bun x`, `bunx` missing — same substitution);
  index regenerates byte-identical (README prose
  only); catalog harness ALL PASSED (19 apps); store
  harness ALL PASSED. The 9 baseline failures are
  gone — the alembic add landed and the harness
  expects 19.

## 5. Verify post-release (after the release acts)

- [x] 5.1 After the tag is cut, the pin is pushed, and
  the live Store is updated to v30: the Store offers
  v30 from `main`, updates to it, and the listing base
  becomes the `4.2` tag. Alembic (the test app) appears
  in the listing and installs. Record the shell
  version, Store version, tag target commit, and what
  was verified. This task runs after the release acts;
  it does not perform them.
  Recorded (2026-11-12 evening): shell 4.2.1 build 48
  (live, unchanged — no publish in this change);
  Store v30 live (user confirmed "I see catalog
  v30"); tag `4.2` cut at `2bc747c`, then moved to
  `cace3b51` (alembic add), `00767d5` (alembic v2),
  `ef6d1f2` (dynamic loading URL, later reverted),
  and `7075a35` (the revert; Store v32, generic
  loading text) — each move at his explicit direction
  naming the tag and the remote, each verified via
  API + ls-remote + raw catalog fetch. Alembic
  appears in the listing (user confirmed seeing it)
  and installs from the Store. The listing base is
  the `4.2` tag; the repo Store is v32, live Store
  v30 until he self-updates.

## 6. Close-out

- [x] 6.1 Add a close-out note to this file recording
  what was verified, what was substituted, and what
  was left open. This change is done when the note is
  written; the Phase 2 generator follow-up (design
  Decision 5) stays open.

## Close-out (2026-11-12, late evening)

This change is done and committed. The line-tag model
(tag = semver major.minor, moves freely within its
line, frozen on a line advance) was decided, written
as this spec, shipped live the same evening (pin
`4.2.0` → `4.2`, Store v30, tag `4.2` cut and moved
four times since), and is now the documented
maintainer procedure in `catalog/README.md`. What was
verified: no shell code change needed (read the tag
label/base parsing + live `4.2` tag serving the
listing); typecheck clean; index regenerates
byte-identical; catalog harness ALL PASSED (19 apps);
store harness ALL PASSED; post-release facts
recorded under 5.1. What was substituted: `bun x`
for missing `bunx`. What was left open: the Phase 2
generator follow-up (design Decision 5 — the
"tag's version matches `pkg/package.json`" check
needs a line-aware form before Phase 2 lands); the
canonical specs in `openspec/specs/` still do not
carry the Phase 1 split-base content (recorded
non-goal of this change, following the
compatible-catalog deltas-only pattern). Note: task
2.1's "alembic riding the same commit" did not
happen literally — the pin rename (`2bc747c`) and
the alembic add (`cace3b51`) were separate commits;
the substance is as specified.
