# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. The maintainer tagging and index procedure
is documented in `catalog/README.md` (task 2.4); running it
is a release act, not a task in this change.

## 0. Gate — the plugins spec first

- [ ] 0.1 Confirm the gate: a plugins OpenSpec change exists,
  is reviewed, and settles the interface this change depends
  on — plugin location and import rules, manifest shape,
  discovery/registration, route namespacing, storage
  namespace, lifecycle (install, update, disable, remove),
  and failure isolation. Record the plugins change's slug
  and the interface names it settles in this file. If the
  plugins spec settles a different interface from the
  provisional names in design.md Decisions 7 and 9, update
  this change's design and spec deltas to match it and
  re-review this change before proceeding. Do not start
  section 1 until this task is checked.
- [ ] 0.2 Confirm the `catalog-robustness-fixes` gated-row
  Remove behaviour this change assumes is in the canonical
  spec (or record that it is still open and that this
  change's Store section carries the same Remove behaviour
  for gated rows regardless).

## 1. Releases index — generator and harness

- [ ] 1.1 Extend `scripts/build-catalog-index.ts` (same run
  that regenerates `catalog/catalog.json`) to also generate
  `catalog/releases.json`, never hand-edited. For each local
  git tag, verify it against the tag itself: `git show
  <tag>:pkg/package.json` parses and its version matches
  the tag name, and `git show <tag>:catalog/catalog.json`
  exists and parses. An entry is `{ version, tag, sha,
  shellVersion }`, sorted deterministically; a tag failing
  the checks fails the generator loudly, not silently
  skipped. Output is deterministic: running it twice over
  unchanged inputs is byte-identical. Record the decision
  on catalog-only tag naming (design Open Question 3) in
  the generator's header comment and in `catalog/README.md`.
- [ ] 1.2 Extend `tests/catalog-harness.ts` to fail on a
  stale `releases.json`: any local tag missing from it, any
  entry pointing at a missing tag or a mismatched SHA, any
  entry whose `shellVersion` does not match the version at
  that tag, or non-deterministic ordering. Verify: the
  harness passes on the current tree (no tags exist yet at
  the time of writing — record that the index is empty
  until the first tag is cut); adding a test tag and
  re-running the generator makes the harness pass, and
  deleting the entry makes it fail.
- [ ] 1.3 Verify the generator's failure modes: a tag whose
  `pkg/package.json` version does not match the tag name
  fails the generator; a tag with no `catalog/catalog.json`
  fails the generator; a `releases.json` edited by hand to
  a wrong SHA fails the harness.
- [ ] 1.4 Document the maintainer procedure in
  `catalog/README.md` (release cutting): regenerate,
  run the harness, commit, cut the tag, re-run the
  generator (now it sees the new tag), commit the updated
  `releases.json`, push to `main`; `git fetch --tags`
  before running the generator; tags are never moved after
  cutting. Note explicitly that the Store fetches
  `releases.json` from `main`, not from the tag, so the
  second commit is sufficient and the tag need not
  contain its own entry.

## 2. Resolver plugin — interface and resolution

- [ ] 2.1 Write the resolver plugin against the plugins
  spec's interface (Decision 1): manifest (identity,
  version, minimum shell version, declared `kody:`
  imports/capabilities, routes), segregated location,
  storage namespace per that spec's rule. The plugin
  SHALL NOT ship with the shell: it lives in its own
  source location (per the plugins spec) and is installed
  only by an agent following its recipe. Record the
  plugin's slug, manifest, route/export names, and
  storage key in this file.
- [ ] 2.2 Implement resolution in the plugin's server
  side: read `catalog/releases.json` from `main`
  (HTTPS-only, 8000 ms timeout, size caps per the
  catalog fetch discipline), pick the highest entry
  whose `shellVersion` is at or below the running shell
  version (`getRunningPackageVersion`), skip malformed
  entries and ties silently, and fetch the manifest and
  definitions from that entry's SHA base
  (`https://raw.githubusercontent.com/<owner>/<repo>/
  <sha>/catalog/`). If no entry qualifies, report no
  compatible catalog; do not fall through to `main`.
  Verify: on a shell at version X, the resolver picks
  the highest snapshot at or below X; on a shell older
  than every snapshot, it reports no compatible catalog.
- [ ] 2.3 Implement install/update from the resolved
  base through the existing explicit-base path (the
  same path `install_from_catalog` / `update_from_catalog`
  use): the plugin passes the resolved base explicitly,
  and `add_app` still gates each app on
  `minPackageVersion` and the schema floor. Verify: an
  app in the resolved snapshot whose minimum is above
  the running shell is refused with nothing written;
  an app at or below installs.
- [ ] 2.4 Implement the Store self-update as a special
  case in the plugin: fetching the Store definition from
  the *latest compatible* snapshot, not from the pinned
  snapshot, gated by `add_app`'s `minPackageVersion`
  check. Verify: a Store requiring a newer shell is
  refused and the installed Store and snapshot are
  unchanged; a Store at or below the running shell
  updates and the pin moves to its snapshot.
- [ ] 2.5 Verify plugin failure isolation per the plugins
  spec: a resolver failure (fetch failure, invalid
  index, invalid snapshot) does not take down the shell
  — the Store degrades to the durable snapshot (section
  3) or to installed-only with an honest error, and
  other apps keep working. Record the failure modes
  checked.

## 3. Durable last-good snapshot of the resolved catalog

- [ ] 3.1 Implement the durable snapshot in the plugin
  (storage key per the plugins spec's namespace rule;
  provisional key in design Decision 7 to be confirmed):
  manifest plus definitions as fetched from the resolved
  snapshot. Refresh it only on a validated successful
  read from the resolved snapshot; never refresh it with
  a gated or invalid catalog, or with a catalog from a
  different snapshot. Verify: a successful read updates
  the snapshot; a failed or gated read leaves the
  previous snapshot untouched.
- [ ] 3.2 Serve the snapshot labelled stale on failure:
  when the resolved snapshot fetch or validation fails,
  the Store shows the durable snapshot with its tag and
  age, and installs from it. When there is no durable
  snapshot, the Store falls back to installed-only with
  an honest error, as today. Verify: with the resolved
  base made unreachable, the Store still lists and
  installs from the stale snapshot; with no snapshot
  stored, it shows installed-only and an error.
- [ ] 3.3 Verify the snapshot does not mask a deliberate
  removal: an app removed from the resolved snapshot is
  not offered from the stale snapshot as a new install
  after the snapshot's freshness window the design
  records at implementation (record the window and the
  reasoning; if no window is implemented, record that
  explicitly and why).

## 4. Store bundle — self-update section and resolved display

- [ ] 4.1 Remove the App Store from its own apps list in
  the Store bundle (`catalog/app-store/store.js`,
  `index.html`): no row for `app-store` in `.store-list`,
  and Update All excludes it. Bump the Store's
  `catalogVersion` by the existing rule and regenerate
  `catalog/catalog.json`.
- [ ] 4.2 Add the separate self-update section above the
  list: installed Store `catalogVersion`, resolved
  snapshot (tag, running shell version), latest
  compatible Store version found, one update control,
  and the gated-row Remove behaviour (with the same
  confirmation as a row). When the resolver plugin is
  not installed, the section degrades to the current
  behaviour: latest compatible Store read from the
  declared (`main`) base, apps list from `main`, and
  no resolved snapshot claimed. Verify in `kody dev`
  (mock target): with the plugin installed, the section
  shows the resolved snapshot and the Store updates
  from the latest compatible snapshot; without it, the
  section shows the `main` behaviour and claims no
  snapshot.
- [ ] 4.3 Display the resolved snapshot in the Store
  status line (tag, and stale labelling with age when
  the durable snapshot is being served), replacing the
  `main` URL display when a snapshot is resolved.
  Verify: a fresh resolved snapshot shows its tag with
  no stale label; a stale snapshot shows its tag and
  age.
- [ ] 4.4 Verify the Store still requires JavaScript
  (no-JS note pointing at agent `add_app`, no rows),
  and that a row action, Update All, or the self-update
  control while in flight is disabled with a working
  label, re-enabled on settle, per the existing shell
  rule.

## 5. Recipes — plugin dependencies

- [ ] 5.1 Document the recipe rule in the authoring
  docs (`pkg/.agents/skills/adding-an-app/SKILL.md` and
  the authoring spec delta): an app whose install
  requires a shell feature declares it in its
  `RECIPE.md`, and the recipe instructs the agent to
  install the named plugin first (copy in, register,
  check, publish the user's package) and only then
  install the app. The Store never one-click installs
  a plugin and never auto-installs one.
- [ ] 5.2 Write the resolver plugin's own recipe
  (`RECIPE.md` in the plugin's source location, per the
  plugins spec): the install procedure for the plugin,
  naming the plugin and the target package
  unambiguously. The Store's separate section points
  at that recipe with selectable text (no copy button,
  in the pattern of the existing recipe prompts) when
  the plugin is not installed and a compatible catalog
  cannot be resolved without it.
- [ ] 5.3 Verify: a recipe-only app that requires a
  plugin shows its recipe prompt in place of Add, and
  the prompt names the plugin install step before the
  app install step.

## 6. Verify and sync specs

- [ ] 6.1 Verify: catalog harness ALL PASSED (including
  the new releases-index checks); store harness ALL
  PASSED (including the separate self-update section,
  the resolved-snapshot display, and the stale-snapshot
  checks); `bun build pkg/src/app.ts --target=browser
  --external 'kody:*'` succeeds; ES2019 scan clean.
  `kody execute --target mock` (server stopped) and
  jsdom where a live browser is not available; record
  any substitution with its reason, the same way
  earlier changes recorded theirs.
- [ ] 6.2 Verify the three user goals end to end in
  `kody dev` (mock target, server stopped for writes):
  (a) a new app version pushed to `main` and tagged
  appears to a compatible shell after a Store update,
  with no Kody publish in the loop; (b) that update
  path needs no agent; (c) a shell older than the
  snapshot still installs from its latest compatible
  snapshot. Record the shell versions, tags, and
  snapshot used for each leg.
- [ ] 6.3 Sync the canonical specs: the app-registry,
  shell, and authoring deltas in this change become
  canonical (see `specs/`). Record the version
  decision in the implementation commit (Store
  `catalogVersion` +1 by the bundle-change rule;
  no pkg version bump is specified by this change
  alone — see proposal.md, Impact).
- [ ] 6.4 Archive with a close-out note recording what
  was verified, what was substituted, and what was
  left open. `openspec validate` passes for the change
  (run on the PC — the `openspec` CLI is not available
  on this VM; record the run and its result here).
