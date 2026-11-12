# Tasks

No task in this file commits, pushes, publishes, tags, or
releases anything. The maintainer tagging and pin-update
procedure is documented in `catalog/README.md` (task 1.5);
running it is a release act, not a task in this change.

This change is phased. Phase 1 (section 1) is the
Store-as-gate slice and has no plugin dependency: it SHALL
be implementable, reviewable, and shippable before Phase 2
starts. Phase 2 (sections 2–7) is the automatic resolver
and is the only part gated behind the plugins spec
(section 2). Do not start section 3 until section 2 is
checked.

## 1. Phase 1 — Store-as-gate (manual pin, no plugin)

- [x] 1.0 Confirm the `catalog-robustness-fixes` gated-row
  Remove behaviour this change assumes is in the canonical
  spec (or record that it is still open and that this
  change's Store section carries the same Remove behaviour
  for gated rows regardless).
  Note (2026-11-11): the gated-row Remove behaviour is NOT in the canonical spec — `openspec/specs/app-registry/spec.md` has only a Remove-on-up-to-date line. It lives only in the open change `openspec/changes/catalog-robustness-fixes/` (tasks.md 1.1 C5, unchecked, plus the spec delta "Gated installed rows keep Remove"). Still open there. The Phase 1 Store section carries the same behaviour regardless: a gated section shows the requirement and keeps Remove with the row confirmation (bundle-tests fixture 5 and the store-harness gated leg).
- [x] 1.1 Shell split-base routing: extend the management
  API (`pkg/src/apps/registry.ts`: `resolveManagedBase`
  and the agent-base fallback) to route by target. A
  Store self-update (`app-store`) uses the Store's
  `catalog` proxy entry (discovery base, `main`); every
  other app's rows, install, and update use the Store's
  `catalog-apps` proxy entry (listing base, pinned tag)
  when the installed Store declares one, falling back
  to the discovery base when it declares none. An
  explicit `catalogBase` supplied to
  `install_from_catalog` / `update_from_catalog` still
  wins over both. Verify: with a Store declaring both
  entries, `manage_rows` lists apps from the pinned
  tag, a Store update fetches from `main`, and an app
  install fetches from the pinned tag; with a Store
  declaring only `catalog`, all three read `main` as
  today.
  Note (2026-11-11): implemented as specified, with two deviations. (1) `update_from_catalog` takes no `catalogBase` parameter (that is C6 in `catalog-robustness-fixes` task 1.2, still open); it resolves via `resolveAgentCatalogBase(active, undefined, id)`, so the agent update path uses the installed Store's listing base. The "explicit catalogBase still wins" verify applies to `install_from_catalog` (and absorb/store variants), which all take the parameter. (2) The dev override (`KODY_CATALOG_BASE`) replaces BOTH bases when set, by design. Store self-update data travels in the `manage_rows` payload (`storeSelf` + `catalogRelease`) — no new endpoint. Verified by 40 new store-harness checks using a fetch stub over distinct https bases (`*.example.com`) backed by temp catalog dirs: loopback servers cannot carry the split bases because `validateCatalogDefinition` requires https proxy URLs.
- [x] 1.2 Store definition: add the `catalog-apps` proxy
  entry to `catalog/app-store/definition.json`, pinned
  to the current tag (or to `main` until the first tag
  is cut — record which, and why), and bump the Store's
  `catalogVersion` by the existing rule. Regenerate
  `catalog/catalog.json`. Changing either proxy URL is
  a definition change and bumps `catalogVersion` by 1.
  Note (2026-11-11): done. `catalog-apps` pinned to the 4.1.11 tag (`https://raw.githubusercontent.com/Hypercubed/kody-os/4.1.11/catalog/`): 4.1.11 is the latest released catalog snapshot; no 4.2.0 tag exists yet (branch uncommitted/unpushed); the pin moves to the v4.2.0 tag when cut per the maintainer procedure (1.5). `minPackageVersion: "4.2.0"` set. Single `catalogVersion` +1 for the whole Phase 1 batch (27 -> 28): tasks 1.2 and 1.3 each call for a +1, but the batch takes one +1 total per the version call — the Store is NOT bumped to 29. Package stays 4.2.0 / build 46.
- [x] 1.3 Store bundle — self-update section: remove the
  App Store from its own apps list in the Store bundle
  (`catalog/app-store/store.js`, `index.html`): no row
  for `app-store` in `.store-list`, and Update All
  excludes it. Add the separate self-update section
  above the list: installed Store `catalogVersion`,
  pinned snapshot (tag, and the running shell version),
  latest compatible Store version found on the
  discovery (`main`) base, one update control, and the
  gated-row Remove behaviour (with the same
  confirmation as a row). Bump the Store's
  `catalogVersion` by the existing rule and regenerate
  `catalog/catalog.json`. Verify in `kody dev` (mock
  target): the section shows the pinned snapshot and
  the Store updates from `main`; a Store requiring a
  newer shell is refused and the installed Store and
  snapshot are unchanged.
  Note (2026-11-11): done. Section renders above the list: installed v28, pinned snapshot tag + running shell version, latest Store on the discovery base, one control (Update / Remove), gated Remove with the row confirmation. The 27 -> 28 bump is the same single +1 counted in 1.2 (no second bump). Verified in the mock (1.6), by bundle tests (138 checks, incl. a gated-section fixture), and by the store harness.
- [x] 1.4 Store bundle — display: display the pinned
  snapshot (tag) in the Store status line instead of
  the `main` URL, and show the discovery base only for
  the Store's own update. Verify: a Store pinned to a
  tag shows that tag with no resolved-snapshot claim
  and no stale label.
  Note (2026-11-11): done. Status line shows `Catalog 4.1.11` (the pinned tag) with no main URL and no resolved/stale claim; the discovery base is named only inside the self-update section for the Store's own update. Verified in the mock rows payload (`catalogRelease: "4.1.11"`) and bundle tests.
- [x] 1.5 Document the maintainer procedure in
  `catalog/README.md` (tagging and pin update): cut a
  tag for a catalog snapshot (`git tag vX.Y.Z && git
  push origin vX.Y.Z`; tags are never moved after
  cutting), update the Store's `catalog-apps` entry to
  that tag, bump the Store's `catalogVersion` by 1,
  regenerate the catalog index, run the harness,
  commit, push to `main`. Note explicitly that a new
  app version pushed to `main` is not visible to the
  Store until the pin moves, and that an older shell
  keeps its old Store and old pin because the Store
  update is gated by `minPackageVersion`.
  Note (2026-11-11): done. `catalog/README.md` gains "Pinned catalog maintenance" (cut tag -> move pin -> `catalogVersion` +1 -> regenerate -> harnesses -> commit -> push; tags never moved; new versions on `main` invisible until the pin moves; older shells keep old Store + old pin via the `minPackageVersion` gate). Also fixed the two stale sentences (Catalog index paragraph, Release cutting paragraph).
- [x] 1.6 Verify Phase 1 end to end in `kody dev` (mock
  target, server stopped for writes): (a) a new app
  version pushed to `main` and tagged appears to a
  compatible shell after a Store update, with no Kody
  publish in the loop; (b) that update path needs no
  agent; (c) a shell older than the snapshot still
  installs from its pinned tag, because it cannot
  update its Store. Record the shell versions, tags,
  and snapshot used for each leg, and add a close-out
  note for Phase 1 to this file recording what was
  verified, what was substituted, and what was left
  open. Phase 1 is done when this task is checked;
  Phase 2 does not need to be started for Phase 1 to
  ship.

  Note (2026-11-11): verified end to end as far as the environment allows; see the Phase 1 close-out note below.

### Phase 1 close-out (2026-11-11)

Shell 4.2.0 / build 46; Store v28 (`minPackageVersion` 4.2.0); pin `https://raw.githubusercontent.com/Hypercubed/kody-os/4.1.11/catalog/`; `main`'s catalog byte-identical to the 4.1.11 tag's catalog (Store v20 on both).

Verified:
- Typecheck exit 0. Store harness 227 PASS / 1 FAIL (only the pre-existing stale 4.1.3 version check, left alone). Catalog harness ALL PASSED (18 apps). Bundle tests ALL PASSED (138 checks). Agent-tools harness 40 PASS / 1 FAIL (only the pre-existing 16-apps count, left alone). `bun build pkg/src/app.ts` succeeds.
- Split-base routing proved in the store harness with genuinely distinct bases (fetch stub over `https://listing/discovery/gated/gated-listing.example.com/catalog/` backed by temp catalog dirs): rows/installs/updates for ordinary apps read the listing base; the Store's own update reads the discovery base; explicit base wins; agent update returns to the listing base; gated self-update (min 99.0.0) is refused with the installed Store byte-identical; catalog-only Store reads the discovery base throughout.
- Mock (`kody dev --target mock`, shell 4.2.0): installed Store v28, `catalogRelease: "4.1.11"`, `storeSelf` installed 28 / pin 4.1.11 / discovery main / running 4.2.0 / latest 20 / no update, 17 rows with no app-store row, all folder URLs from the 4.1.11 tag, Counter still behind-modified (def v4, snapshot v5, untouched).

Substituted (not claimed as live):
- Leg (a) (new version on `main` + tagged appearing after a Store update, no publish): cannot be shown live — no push/tag allowed and v28 is not on `main`. Substituted by the harness two-base test (listing v27 -> discovery v28 self-update) plus the mock install below.
- Leg (b) (no-agent update path): the browser section Update control is the path; in the mock no newer Store exists on `main` (latest v20 < installed v28), so the section shows Remove, not Update. The Update control's call into `manage_update` is proved by the jsdom bundle tests and the harness self-update leg.
- Leg (c) (older shell installs from pinned tag): the mock runs shell 4.2.0, so an older shell cannot be simulated live. Substituted by the harness gated leg (a Store requiring shell 99.0.0 is refused and keeps listing from its pin) and catalog-only leg.
- Mock Store install: `kody execute --target mock` with an explicit loopback catalog base does NOT work in this environment — the mock's workerd egress allows public HTTPS (verified: 200 from raw.githubusercontent in 414 ms) but blocks loopback (direct fetch to 127.0.0.1 and localhost both fail). The install instead ran the real code on the host (`bun` + the same `store_install_from_catalog`, same loopback base) and merged exactly the three keys it wrote (`kody-os.apps.def/snapshot/state.app-store`) into the mock state file while `kody dev` was stopped (backup at `state.json.bak-20261111`); Counter and all other keys verified byte-identical to the backup.
- Browser list content cannot distinguish the listing base from the discovery base today (`main`'s catalog is byte-identical to the 4.1.11 tag's), so the mock rows' tag provenance is shown by the folder URLs (`tree/4.1.11`) and `catalogRelease`, not by differing list content.

Left open:
- The real-release check (a Store update offered from `main` after the v4.2.0 tag is cut and the pin moves) still needs a pushed tag + `main` push + publish decision — none of those are directed here.
- `catalog-robustness-fixes` C5 (gated-row Remove) and C6 (`update_from_catalog` `catalogBase` parameter) remain open in their own change.
- Two pre-existing harness failures left alone: store harness stale 4.1.3 check, agent-tools 16-apps count.

Work left uncommitted on branch `close-v4-tail` (HEAD d3d9785). No commit, push, tag push, or publish done. User decisions still needed: commit, tag push, merge to `main`, publish.

## 2. Gate — the plugins spec first (Phase 2 only)

- [ ] 2.1 Confirm the gate: a plugins OpenSpec change exists,
  is reviewed, and settles the interface Phase 2 depends
  on — plugin location and import rules, manifest shape,
  discovery/registration, route namespacing, storage
  namespace, lifecycle (install, update, disable, remove),
  and failure isolation. Record the plugins change's slug
  and the interface names it settles in this file. If the
  plugins spec settles a different interface from the
  provisional names in design.md Decisions 7 and 9, update
  this change's design and spec deltas to match it and
  re-review this change before proceeding. Do not start
  section 3 until this task is checked.

## 3. Phase 2 — Releases index — generator and harness

- [ ] 3.1 Extend `scripts/build-catalog-index.ts` (same run
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
- [ ] 3.2 Extend `tests/catalog-harness.ts` to fail on a
  stale `releases.json`: any local tag missing from it, any
  entry pointing at a missing tag or a mismatched SHA, any
  entry whose `shellVersion` does not match the version at
  that tag, or non-deterministic ordering. Verify: the
  harness passes on the current tree (no tags exist yet at
  the time of writing — record that the index is empty
  until the first tag is cut); adding a test tag and
  re-running the generator makes the harness pass, and
  deleting the entry makes it fail.
- [ ] 3.3 Verify the generator's failure modes: a tag whose
  `pkg/package.json` version does not match the tag name
  fails the generator; a tag with no `catalog/catalog.json`
  fails the generator; a `releases.json` edited by hand to
  a wrong SHA fails the harness.
- [ ] 3.4 Document the maintainer procedure in
  `catalog/README.md` (release cutting): regenerate,
  run the harness, commit, cut the tag, re-run the
  generator (now it sees the new tag), commit the updated
  `releases.json`, push to `main`; `git fetch --tags`
  before running the generator; tags are never moved after
  cutting. Note explicitly that the Store fetches
  `releases.json` from `main`, not from the tag, so the
  second commit is sufficient and the tag need not
  contain its own entry. This extends the Phase 1
  pin-update procedure (task 1.5); the pin itself is
  now set by the resolver, not by hand.

## 4. Phase 2 — Resolver plugin — interface and resolution

- [ ] 4.1 Write the resolver plugin against the plugins
  spec's interface (Decision 1): manifest (identity,
  version, minimum shell version, declared `kody:`
  imports/capabilities, routes), segregated location,
  storage namespace per that spec's rule. The plugin
  SHALL NOT ship with the shell: it lives in its own
  source location (per the plugins spec) and is installed
  only by an agent following its recipe. Record the
  plugin's slug, manifest, route/export names, and
  storage key in this file.
- [ ] 4.2 Implement resolution in the plugin's server
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
- [ ] 4.3 Implement install/update from the resolved
  base through the existing explicit-base path (the
  same path `install_from_catalog` / `update_from_catalog`
  use): the plugin passes the resolved base explicitly,
  and `add_app` still gates each app on
  `minPackageVersion` and the schema floor. Verify: an
  app in the resolved snapshot whose minimum is above
  the running shell is refused with nothing written;
  an app at or below installs.
- [ ] 4.4 Implement the Store self-update as a special
  case in the plugin: fetching the Store definition from
  the *latest compatible* snapshot, not from the pinned
  snapshot, gated by `add_app`'s `minPackageVersion`
  check. Verify: a Store requiring a newer shell is
  refused and the installed Store and snapshot are
  unchanged; a Store at or below the running shell
  updates and the pin moves to its snapshot. This
  reuses the separate section built in Phase 1
  (task 1.3); only the source of the Store definition
  changes, from the discovery base to the resolved
  snapshot.
- [ ] 4.5 Verify plugin failure isolation per the plugins
  spec: a resolver failure (fetch failure, invalid
  index, invalid snapshot) does not take down the shell
  — the Store degrades to the durable snapshot (section
  5) or to installed-only with an honest error, and
  other apps keep working. Record the failure modes
  checked.

## 5. Phase 2 — Durable last-good snapshot of the resolved catalog

- [ ] 5.1 Implement the durable snapshot in the plugin
  (storage key per the plugins spec's namespace rule;
  provisional key in design Decision 7 to be confirmed):
  manifest plus definitions as fetched from the resolved
  snapshot. Refresh it only on a validated successful
  read from the resolved snapshot; never refresh it with
  a gated or invalid catalog, or with a catalog from a
  different snapshot. Verify: a successful read updates
  the snapshot; a failed or gated read leaves the
  previous snapshot untouched.
- [ ] 5.2 Serve the snapshot labelled stale on failure:
  when the resolved snapshot fetch or validation fails,
  the Store shows the durable snapshot with its tag and
  age, and installs from it. When there is no durable
  snapshot, the Store falls back to installed-only with
  an honest error, as today. Verify: with the resolved
  base made unreachable, the Store still lists and
  installs from the stale snapshot; with no snapshot
  stored, it shows installed-only and an error.
- [ ] 5.3 Verify the snapshot does not mask a deliberate
  removal: an app removed from the resolved snapshot is
  not offered from the stale snapshot as a new install
  after the snapshot's freshness window the design
  records at implementation (record the window and the
  reasoning; if no window is implemented, record that
  explicitly and why).

## 6. Phase 2 — Store bundle — resolved display

- [ ] 6.1 Display the resolved snapshot in the Store
  status line (tag, and stale labelling with age when
  the durable snapshot is being served), replacing the
  pinned-tag display from Phase 1 (task 1.4) when a
  snapshot is resolved. When the resolver plugin is
  not installed, the section degrades to the Phase 1
  behaviour: latest compatible Store read from the
  declared (`main`) base, apps list from the pinned
  listing base, and no resolved snapshot claimed.
  Verify: a fresh resolved snapshot shows its tag with
  no stale label; a stale snapshot shows its tag and
  age.
- [ ] 6.2 Verify the Store still requires JavaScript
  (no-JS note pointing at agent `add_app`, no rows),
  and that a row action, Update All, or the self-update
  control while in flight is disabled with a working
  label, re-enabled on settle, per the existing shell
  rule.

## 7. Phase 2 — Recipes — plugin dependencies

- [ ] 7.1 Document the recipe rule in the authoring
  docs (`pkg/.agents/skills/adding-an-app/SKILL.md` and
  the authoring spec delta): an app whose install
  requires a shell feature declares it in its
  `RECIPE.md`, and the recipe instructs the agent to
  install the named plugin first (copy in, register,
  check, publish the user's package) and only then
  install the app. The Store never one-click installs
  a plugin and never auto-installs one.
- [ ] 7.2 Write the resolver plugin's own recipe
  (`RECIPE.md` in the plugin's source location, per the
  plugins spec): the install procedure for the plugin,
  naming the plugin and the target package
  unambiguously. The Store's separate section points
  at that recipe with selectable text (no copy button,
  in the pattern of the existing recipe prompts) when
  the plugin is not installed and a compatible catalog
  cannot be resolved without it.
- [ ] 7.3 Verify: a recipe-only app that requires a
  plugin shows its recipe prompt in place of Add, and
  the prompt names the plugin install step before the
  app install step.

## 8. Verify and sync specs

- [ ] 8.1 Verify: catalog harness ALL PASSED (including
  the new releases-index checks); store harness ALL
  PASSED (including the separate self-update section,
  the resolved-snapshot display, and the stale-snapshot
  checks); `bun build pkg/src/app.ts --target=browser
  --external 'kody:*'` succeeds; ES2019 scan clean.
  `kody execute --target mock` (server stopped) and
  jsdom where a live browser is not available; record
  any substitution with its reason, the same way
  earlier changes recorded theirs.
- [ ] 8.2 Verify the three user goals end to end in
  `kody dev` (mock target, server stopped for writes):
  (a) a new app version pushed to `main` and tagged
  appears to a compatible shell after a Store update,
  with no Kody publish in the loop; (b) that update
  path needs no agent; (c) a shell older than the
  snapshot still installs from its latest compatible
  snapshot. Record the shell versions, tags, and
  snapshot used for each leg. (Phase 1 verifies the
  same three goals with the manual pin, task 1.6;
  Phase 2 verifies them with the resolver picking the
  pin.)
- [ ] 8.3 Sync the canonical specs: the app-registry,
  shell, and authoring deltas in this change become
  canonical (see `specs/`). Record the version
  decision in the implementation commit (Store
  `catalogVersion` +1 by the bundle-change rule;
  no pkg version bump is specified by this change
  alone — see proposal.md, Impact).
- [ ] 8.4 Archive with a close-out note recording what
  was verified, what was substituted, and what was
  left open. `openspec validate` passes for the change
  (run on the PC — the `openspec` CLI is not available
  on this VM; record the run and its result here).
