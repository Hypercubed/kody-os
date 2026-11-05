# Tasks: hide-content-in-widgets

This change is spec only until tasks are
directed. All tasks are unchecked.

## 0. Open questions

- [ ] 0.1 Decide open question 0.1
  (explicit `data-context` attribute):
  confirm the default (no attribute in
  v1) or direct a shell change.
- [ ] 0.2 Decide open question 0.2
  (shared theme utility class): confirm
  the default (per-app rules) or direct
  a theme change.
- [ ] 0.3 Decide open question 0.3
  (adding-an-app skill section): confirm
  the skill gains a widget-visibility
  section once the reference proves out.

## 1. Re-verify the shell facts

- [x] 1.1 Re-check in `pkg/src/apps/
  client.ts` that `renderWidgetSection`
  wraps `renderAppSection` in
  `<section class="widget"
  data-app-id="...">`, that
  `renderAppPanel`/`renderOverlaySection`
  use `<section class="app">`, and that
  `renderBundleContent` stamps only
  `data-bundle` and `data-action-base`.
- [x] 1.2 Re-check in
  `inlineBundleAssets` that bundle CSS
  is inlined verbatim with no scoping
  or rewriting.
- [x] 1.3 Re-check in
  `pkg/src/apps/types.ts` that
  `ui.placements` is deprecated and
  gates nothing, and that `ui.openAs`
  is a default, not a restriction.
- [x] 1.4 Confirm home tiles
  (`renderHomeTiles`) are links, not
  bundles, so widget visibility applies
  to pinned widgets only.

## 2. Authoring guidance

- [ ] 2.1 Draft the widget-visibility
  section for the adding-an-app skill:
  the `section.widget` pattern, the
  app-specific-selector rule, the
  widget-only inverse pattern, and the
  hiding-semantics limits (DOM/JS
  still live, not access control).
- [ ] 2.2 On user direction, apply the
  skill edit as a `pkg/` docs change
  with its own commit decision; do not
  sweep it into unrelated work.

## 3. Reference implementation (link-drop)

- [x] 3.1 Add to the link-drop bundle
  CSS: `section.widget #ld-clear-form,
  section.widget #ld-install { display:
  none; }`, keeping only the link list
  visible in widgets and everything
  visible on the full page and in modals
  (scope expanded at user direction:
  all buttons and help text, not just
  the install block).
- [x] 3.2 Update the link-drop Node
  tests: assert the bundle CSS contains
  the widget rule qualified by the
  app-specific id, and assert no
  unqualified widget rule exists in
  the bundle CSS.
- [x] 3.3 Update or extend the
  link-drop DOM tests (or the
  home-widget render check) to prove
  the rule matches only under a widget
  ancestor: widget-section HTML hides
  the install block, page-section HTML
  does not. If the current DOM stub
  cannot model ancestors, record that
  gap and verify via rendered-section
  string checks instead of pretending
  the stub proves it.
- [x] 3.4 Apply the reference bundle
  to the local mock store and to no
  other store unless the user directs
  it; no catalog, version, commit, or
  publish step is part of this task.
- [x] 3.5 Second reference: hoodie-weather
  bundle CSS hides its buttons
  (`.hw-btn`) and its rewrite note
  (`.hw-note`) in widgets, catalogVersion
  2 → 3, tests extended; live and mock
  hoodie-weather left untouched pending
  user direction.
- [x] 3.6 Restore form: hoodie-weather's
  shell "Restore default place" form is
  hidden in widgets by bundle JS
  (`hwIsWidget` in `hwClaimRestoreForm`),
  catalogVersion 3 → 4, widget-form
  test added, mock updated with
  Louisville place preserved.

## 4. Verification

- [ ] 4.1 In a logged-in preview
  browser, pin link-drop as a home
  widget and confirm the install block
  is hidden while the link list and
  Clear All show.
- [ ] 4.2 Open the link-drop full page
  and modal (where applicable) and
  confirm the install block is visible
  in both.
- [ ] 4.3 With a second app pinned
  alongside link-drop on the home
  page, confirm link-drop's widget rule
  hides nothing in the other app.
- [ ] 4.4 On the Scribe, confirm the
  widget rendering hides the install
  block and the full page shows it,
  or record the Scribe check as still
  open if it cannot run.

## 5. Hygiene and archive

- [ ] 5.1 Confirm this change touched
  nothing outside
  `openspec/changes/hide-content-in-widgets/`
  except work the user separately
  directed (reference bundle, skill
  docs).
- [ ] 5.2 On user direction only,
  commit and/or publish the change
  and the reference implementation
  with the scope named explicitly
  (Entire vs GitHub vs Kody-live).
- [ ] 5.3 When the change is done or
  superseded, archive it under
  `openspec/changes/archive/` following
  the repo's existing archive pattern.

## Implementation notes (2026-11-04, reference implementations)

- Link Drop (bundle-only, `link-drop-wip/`):
  `section.widget #ld-clear-form, section.widget
  #ld-install { display: none; }`. In widgets
  the Clear All form and the whole install
  block (intro, drag link/bookmarklet, agent
  prompt) are hidden and only the link list
  shows; on the full page and in modals
  everything shows. This expands spec task
  3.1, which originally named only the
  install block — the user directed hiding
  all buttons and help text, and Clear All
  is the bundle's only button. Link Drop has
  no shell `ui.actions` button left, so no
  shell form is involved there. Node tests
  gained a widget check (both rules present,
  no unqualified widget selectors); DOM
  tests are unchanged because the stub does
  not model widget ancestors (see task
  3.3's recorded gap). Mock reinstall
  returned `{ ok: true, id: "link-drop" }`
  with the widget rule verified in the mock
  store file; state was preserved, including
  a real "HackerWeb" entry the user had
  sent during testing, which was left
  untouched. Dev restarted as pid 182808
  (ready, mock).
- Hoodie Weather (catalog bundle,
  `pkg/catalog/hoodie-weather.bundle.json`):
  `section.widget .hw-btn, section.widget
  .hw-note { display: none; }`. In widgets
  the three bundle buttons (refresh, retry,
  search toggle) and the "A kody-os rewrite
  of" note are hidden; forecast readout and
  verdict stay visible. The search panel is
  hidden by default already, so hiding its
  toggle is sufficient. `catalogVersion`
  2 → 3 for the definition change; package
  version bump deferred to commit time.
  Hoodie tests gained a widget check (both
  rules present, no unqualified widget
  selectors). Catalog harness: ALL CATALOG
  CHECKS PASSED (17 apps). Hoodie jsdom
  tests: 95 assertions pass including all
  6 new widget assertions, with the same 2
  failures as a HEAD worktree baseline
  ("no external href references", "k is
  preserved") — pre-existing, not caused
  by this change. One formatting lesson:
  a JSON round-trip reformatted the whole
  44 KB hoodie file, so the change was
  redone as a surgical text edit (rule
  plus version line only, 4 lines changed)
  after a JSON-escape fix (a literal
  newline inside the JSON string broke
  parsing; the separator must be the
  backslash-n escape the file already uses).
- Deliberately NOT hidden: hoodie-weather's
  shell "Restore default place" form. The
  shell renders action forms as plain
  `<form class="app-action">` with the
  action name only in a hidden input, so
  bundle CSS has no app-specific hook for
  it — `section.widget form.app-action`
  would hide every app's shell buttons in
  every widget, and `:has()` is unavailable
  on the Scribe's Chromium 80. Hiding it
  needs a shell change (for example
  stamping the action name on the form),
  which is not part of this implementation.
  Mock hoodie-weather was also left
  untouched (its mock definition still
  predates the widget rules); live was not
  touched either — no commit, push, or
  publish, and no `update_from_catalog`
  for hoodie-weather, pending user
  direction.

## Implementation notes (2026-11-04, restore form hidden too)

- At the user's direction, hoodie-weather's
  shell "Restore default place" form is now
  hidden in widgets as well. CSS could not
  do this one: the shell renders action
  forms as plain `<form class="app-action">`
  with the action name only in a hidden
  input, so there is no app-specific CSS
  hook, and `:has()` is unavailable on the
  Scribe's Chromium 80. Instead the bundle
  hides it with JS, reusing machinery it
  already had: `hwClaimRestoreForm`
  already locates the restore form to
  claim it through the bridge, and
  `hwSectionEl` is the section element
  itself, so a new one-line `hwIsWidget`
  check (section class contains "widget")
  hides the claimed form with
  `style.display = 'none'` when, and only
  when, the section is a widget. The hide
  runs inside `hwInit`'s existing bridge
  path, which runs at DOMContentLoaded
  when the server-rendered form already
  exists; without a bridge the form stays
  visible, which is the safe degradation.
  The hiding semantics still hold: the
  form is display-none only, the action
  still exists, and the full page and
  modals show the form unchanged.
- This is a deliberate, narrow exception
  to the spec's CSS-only convention:
  bundle content hides by CSS, shell
  forms hide by JS because CSS has no
  hook for them. A shell change stamping
  the action name on the form would make
  the CSS route possible for all apps,
  but was not made here — the app-local
  JS change was smaller and reused the
  existing claim function.
- Bundle change: `catalogVersion` 3 → 4
  (package version bump again deferred
  to commit time). Hoodie tests gained a
  widget-form test (widget section hides
  the form, app section shows it) via a
  new `sectionClass` option on `makeDom`;
  existing tests are unaffected because
  their sections carry no class. Test
  results unchanged from the previous
  run: all widget assertions pass,
  catalog harness ALL PASSED (17 apps),
  and the same 2 pre-existing hoodie
  failures as the HEAD baseline.
- Mock hoodie-weather updated to
  catalogVersion 4 via `scripts/add-app.ts`
  with its Louisville, CO saved place
  preserved (verified after the update;
  backup at
  /tmp/mock-state-before-hoodie-v4.json).
  Dev restarted as pid 190825 (ready,
  mock). Live hoodie-weather still
  untouched — no commit, push, publish,
  or `update_from_catalog` for it,
  pending user direction.

## Implementation notes (2026-11-04, renamed to Link Drop; hoodie centered)

- Rename (user-directed, before any live
  install or catalog entry, so no live
  migration was needed): the app formerly
  Send Link is now Link Drop everywhere
  it is defined — id `link-drop`, label
  and title Link Drop, DOM ids and JS
  functions `sl-*` → `ld-*`, agent prompt
  now names the `link-drop` app, working
  folder `send-link-wip/` →
  `link-drop-wip/`, openspec change
  `send-link-to-kody-os/` →
  `link-drop-to-kody-os/` (spec folder
  `send-link` → `link-drop`), and all
  references in the hide-content-in-widgets
  change renamed the same way. A repo-wide
  grep after the rename finds no remaining
  `send-link`, `Send Link`, or `sl-*`
  references in those files. Generic
  sentences about sending a link to
  kody-os (bookmarklet drag text, page
  intro) were left alone — they describe
  the action and the platform, not the
  app name. Link Drop tests pass under
  their new names (Node + DOM).
- Mock migration: `link-drop` installed
  in the mock store, the two existing
  entries (test "After clear" and the
  user's real "HackerWeb" entry) copied
  over in order via `send` acts, then
  `send-link` removed from the mock
  store and verified absent. Mock
  hoodie-weather updated to
  catalogVersion 5 in the same cycle
  with Louisville, CO preserved.
  Dev restarted as pid 206828 (ready,
  mock). No live change, no commit,
  push, or publish.
- Hoodie vertical centering in widgets:
  the shell already centers Counter and
  Eight Ball bodies with an
  aria-label-scoped rule (`.app-body` as
  a flex column, `justify-content:
  center`, `min-height: 8rem`), but
  Hoodie Weather was not in that list
  and the widget box itself is not a
  flex column, so the mechanism is a
  minimum-height body, not full-height
  stretching. The app-local equivalent
  was added to the hoodie bundle
  instead of a shell change:
  `section.widget[data-app-id="hoodie-weather"]
  .app-body { flex: 1; display: flex;
  flex-direction: column;
  justify-content: center; min-height:
  8rem; }` — scoped by `data-app-id`
  so it cannot leak into other widgets.
  CatalogVersion 4 → 5; widget CSS
  test extended with centering
  assertions (rule present, qualified
  only, no unqualified
  `section.widget .app-body` rule).
