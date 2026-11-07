# Tasks

## 0. Open questions first

- [ ] 0.1 Answer design.md open questions
  1-6, or record the spec defaults as the
  decisions: id `link-drop`, `maxEntryBytes`
  2048, page placement only, no per-item
  delete in v1, title plus URL plus
  timestamp only, mock bookmarklet sending
  to localhost accepted as the mock story.
  A rename of the id must happen before
  the first `add_app`; after install, a
  rename is a new app.
- [ ] 0.2 Re-verify every number this spec
  depends on against the current
  adding-an-app skill and the live shell
  before implementing: `schemaVersion` 5,
  `append` cap and `maxEntryBytes`
  defaults, the GET-action URL form, the
  session-cookie behavior, and the 256 KiB
  bundle cap. Record any correction in
  this change's implementation notes, do
  not silently rewrite the spec.

## 1. Definition and bundle

- [x] 1.1 Write the definition:
  `schemaVersion` 5, id `link-drop`,
  label "Link Drop", category `utilities`,
  page placement, `ui.hideState: true`,
  state field `links` (array of strings,
  initial `[]`, `maxItems` 500), action
  `send` (arg `entry`, string, required;
  effect `append` field `links` from arg
  `entry`, `cap` 500, `maxEntryBytes`
  2048), action `clear` (no args; effect
  `set` field `links` to `[]`), and a
  `ui.actions` entry for `clear` only
  (`send` takes an argument, so it gets no
  shell button). Validate with the
  definition validator before any install.
- [x] 1.2 Write the bundle (ES2019, system
  fonts, zero emojis, 48px tap targets, no
  flexbox gap): read state bridge-first,
  seed-second, span-fallback, after
  DOMContentLoaded with a readyState
  fallback; render entries most-recent-
  first; show each entry's title as a link
  only for `http`/`https` URLs, otherwise
  as plain text; show the URL text and the
  entry timestamp in device-local form;
  escape all entry text before inserting
  it into the page.
- [x] 1.3 Write the entry parser as a pure,
  Node-testable function: parse a JSON
  entry string into `{ t, title, url }`,
  ignore unknown keys, and return a plain-
  text fallback (no link) for entries that
  are not valid JSON or have no usable URL.
- [x] 1.4 Write the bookmarklet builder as
  a pure, Node-testable function: given an
  app base URL (derived from the app
  page's location, Probe `actBase` style),
  produce the `javascript:` snippet that
  opens `<base>?action=send&entry=` plus
  the encoded entry JSON in a new tab;
  truncate the title, never the URL, so
  the encoded entry fits `maxEntryBytes`.
- [x] 1.5 Write the app page's install
  block: a draggable link whose href is
  the built bookmarklet, the same code as
  selectable text (no copy button, per the
  Scribe clipboard finding), desktop
  install steps (drag to the bookmarks
  bar) and mobile install steps (create a
  bookmark, edit its URL to the code), and
  the two requirements in plain words:
  the sending browser must already be
  signed into kody-os, and the send opens
  a new tab and does not return to the
  original page. Show the full install
  block in place of the list when the list
  is empty, and a compact install section
  under the list when it is not.
- [x] 1.6 Write the clear control as the
  shell `ui.actions` button for `clear`
  (a no-argument GET form), and confirm
  the list still accepts a `send` after a
  clear.
- [x] 1.7 Record the agent-side escape
  hatch as a procedure note (not a bundle
  feature): to remove one link, an agent
  reads the list, clears it, and re-pushes
  the kept entries with `act` `send`.
- [x] 1.8 Run the Scribe ceiling scan over
  the bundle: ES2019 only, no `?.` / `??`,
  system fonts, no emojis, 48px minimum
  targets, bundle under 256 KiB.

## 2. Bookmarklet verification in a desktop browser

- [ ] 2.1 From the app page (mock or live),
  install the rendered bookmarklet and
  send links from at least three pages: a
  plain article, a page with a very long
  title (title truncation, URL intact),
  and a page whose URL carries heavy
  tracking parameters. After each send,
  confirm the new entry is on top of the
  list, the original page is untouched in
  its tab, and the kody-os tab shows the
  list, not raw JSON.
- [ ] 2.2 In a browser not signed into
  kody-os, follow a send URL and confirm
  it lands on the Locked page and saves
  nothing (check state before and after).
- [ ] 2.3 Demonstrate the over-cap edge:
  a URL long enough that the entry exceeds
  2048 bytes even with an empty title is
  rejected, state is unchanged, and the
  failure is visible to the user (the app
  page without the link). Record what the
  user actually sees; if the failure is
  silent, say so and revisit design.md
  Decision 4 before shipping.
- [ ] 2.4 Send the same link twice and
  confirm two entries appear (no dedupe),
  then clear and confirm the list is empty
  and accepts a new send.
- [ ] 2.5 Confirm the bookmarklet built on
  one install does not send to another:
  the mock page's bookmarklet targets the
  mock host, the live page's targets the
  live host.

## 3. Verification in Node

- [x] 3.1 Unit-test the entry parser:
  well-formed entries, entries with
  unknown keys, non-JSON entries, entries
  missing title or timestamp, and entries
  with `javascript:`, `data:`, and `file:`
  URLs (plain text, no anchor, in every
  case).
- [x] 3.2 Unit-test the escape step:
  entry titles and URLs containing HTML,
  script tags, quotes, and `&` render as
  text, never as markup, and a single
  anchor is produced for a well-formed
  `http`/`https` entry (no double-wrapped
  href).
- [x] 3.3 Unit-test the bookmarklet
  builder: title truncation keeps the URL
  intact and the entry within
  `maxEntryBytes`; a short entry is
  unchanged; the derived base tracks the
  app page's location, not a hardcoded
  host.
- [x] 3.4 Unit-test display order: append-
  order storage renders most-recent-first,
  and a clear followed by new sends renders
  in the new send order.

## 4. Verification in the mock store

- [x] 4.1 Install the definition into the
  local mock store (stop `kody dev`
  before any mock-store write, restart it
  after — a running preview serves its
  mock store from memory and can silently
  overwrite a file write made while it
  runs).
- [x] 4.2 Send entries through the mock
  `act` path (`send` with a JSON entry,
  then a second send, then `clear`, then a
  send again), verifying state after each
  step: order, counts, and the empty list
  after clear.
- [ ] 4.3 Verify the mock app page renders
  the list and the install block in a
  logged-in preview browser. An
  unauthenticated curl returns the Locked
  page, not the app, so do not claim
  browser verification from curl alone.

## 5. Verification on the Scribe

- [ ] 5.1 On the Scribe, open the app
  page: the list renders most-recent-
  first, tap targets are usable, and
  tapping a link behaves as the device's
  browser normally behaves (record what
  actually happens, including how to get
  back to kody-os).
- [ ] 5.2 On the Scribe, confirm the empty
  state shows the install block as
  selectable text with no copy button, and
  that the install block does not promise
  anything the Scribe cannot do (the
  bookmarklet itself is installed on a
  desktop or phone browser, not on the
  Scribe).
- [ ] 5.3 Record any Scribe deviation in
  this change's implementation notes; do
  not adjust the spec to match a single
  device observation without naming it.

## 6. Catalog shipping (Phase 2, optional)

- [x] 6.1 Only on user direction: add
  `pkg/catalog/link-drop/definition.json`
  (shipped at `catalogVersion` 1, now 3)
  plus `pkg/catalog/link-drop/RECIPE.md`,
  one import line in `pkg/src/apps/catalog.ts`
  (alphabetical by id), the generated index
  regenerated, and one entry in
  `pkg/catalog/README.md`, in the pattern
  of the existing catalog apps.
- [x] 6.2 Run the catalog harness and
  confirm all catalog checks pass with the
  new app included.
- [ ] 6.3 Apply the version decision in the
  same commit as the catalog files: MINOR
  bump, BUILD +1 on publish, per
  `pkg/AGENTS.md`. Do not commit, push, or
  publish without explicit user direction
  at each stop.

## 7. Change hygiene

- [ ] 7.1 Verify `openspec validate
  --changes` passes if the binary is
  available (otherwise check the change
  shape manually, as with other changes
  in this environment: proposal, design,
  tasks, and spec deltas present and
  internally consistent).
- [ ] 7.2 Confirm no file outside
  `openspec/changes/link-drop-to-kody-os/`
  was changed by writing this change
  itself. The app, the catalog files, and
  any version bump are implementation
  work under tasks 1-6, not part of this
  change document.
- [ ] 7.3 When the change is done, archive
  it to
  `openspec/changes/archive/<YYYY-MM-DD>-link-drop-to-kody-os/`
  and add a close-out note to tasks.md
  recording what was actually verified,
  what was substituted, and what was left
  open. Do not rewrite the change to make
  the past look cleaner.

## Implementation notes (2026-11-04, sections 1, 3, 4 except 4.3)

- Scope as directed: sections 1-4 only. Section 5 (Scribe),
  section 6 (catalog), and section 7 (hygiene/archive) were
  NOT done. No commit, push, publish, live install, catalog
  entry, or version change was made.
- Open question section 0 was NOT answered by the user in
  this turn; implementation used the spec defaults
  throughout: id `link-drop`, `maxEntryBytes` 2048, page
  placement only, no per-item delete, title plus URL plus
  timestamp only, mock bookmarklet sending to localhost
  accepted as the mock story.
- Working files live in `link-drop-wip/` at the repo root
  (untracked, NOT the catalog): `link-drop.bundle.json`
  (10,755 bytes, definition plus bundle), `link-drop-tests.cjs`,
  `link-drop-dom-tests.cjs`. Section 6 will move the bundle
  to `pkg/catalog/link-drop.bundle.json` and the tests to
  `pkg/catalog/tests/`; the tests already look for the bundle
  next to themselves, one level up, and in the catalog, so
  the move needs no test-path edit.
- Section 1 done: definition (schemaVersion 5, utilities,
  page, hideState, `links` array string maxItems 500,
  `send` append cap 500 maxEntryBytes 2048, `clear` set to
  `[]`, ui.actions clear only), bundle (ES2019, bridge-first
  / seed-second / span-fallback state read, DOMContentLoaded
  with readyState fallback, most-recent-first render,
  http/https anchor allowlist, escaped text, install block
  with draggable bookmarklet link plus selectable code,
  session requirement and new-tab behavior stated).
- Section 3 done: Node tests 23 checks, DOM tests 5 checks,
  all pass on local Node v24.16.0 (and on VM Node v24.22.1
  during drafting). Coverage: definition shape, ceiling scan
  (no ?. / ?? / replaceAll / .at( / backtick), parser
  (well-formed, unknown keys, non-JSON, missing URL),
  escape, scheme allowlist (javascript:/data:/file: rejected),
  title truncation with URL intact, URL-alone-over-cap,
  app-base derivation, bookmarklet (new tab, own base, no
  hardcoded host), DOM order, DOM javascript:-entry safety,
  DOM install-block move below a non-empty list.
- Section 4 done except 4.3: mock store backed up to
  /tmp/mock-state-before-link-drop.json on be-quite-900
  (410,450 bytes) before install. Mock install via
  `kody execute --target mock --file scripts/add-app.ts`
  from pkg/ returned `{ ok: true, id: "link-drop" }`.
  Mock act sequence, all with before/after state checks:
  send oldest -> 1 entry; send newest -> 2 entries;
  duplicate newest send -> 3 entries (no dedupe, as
  specced); over-cap send -> `{ ok: false, error:
  "append entry exceeds 2048 bytes" }`, state unchanged
  at 3 entries; clear -> 0 entries; send after clear ->
  1 entry ("After clear"). Final mock state holds that
  one test entry; the user may clear it from the app page.
  Dev was stopped before the mock writes and restarted
  after as pid 128078 (ready, mock, http://127.0.0.1:4302/,
  lastError null) via nohup from this work, not from the
  user's terminal; the user may restart it in their own
  terminal if they prefer that session to own it. Mock
  store file after restart still holds link-drop with only
  the "After clear" entry; old/new test entries are gone.
- Dev-stop trap, recorded for next time: a pinned command
  running `pkill -f 'kody dev --target mock'` matched its
  own shell (the pattern text is in its command line) and
  killed itself after the test counts printed, before the
  backup step ran. Dev was confirmed stopped afterwards
  via the status endpoint (empty response), and the backup
  and install then proceeded normally. Next time, use a
  self-avoiding pattern such as moc[k] in the pkill, or
  stop dev from a script file that does not contain the
  literal pattern.
- Section 2 status, stated honestly: the bookmarklet
  mechanics that can be checked without a human browser
  were verified — URL form, base derivation from the app
  page's location, new-tab open, title truncation, and
  over-cap rejection at the act level. The human-browser
  tasks remain OPEN and are left unchecked: 2.1 (install
  the rendered bookmarklet and send from three real
  pages, confirming the landing shows the new entry on
  top and the original page is untouched), 2.2 (an
  unsigned browser lands on the Locked page and saves
  nothing — the Locked landing itself is known from the
  daily-feed work, but a send-URL state check in an
  unsigned browser was not run), 2.3 (what the user
  actually sees on an over-cap landing — the act-level
  rejection is proven, the landing-page visibility is
  not, and if it proves silent, design Decision 4 must
  be revisited before shipping), 2.5 (mock-page
  bookmarklet versus live-page bookmarklet in real
  browsers — base derivation is proven in Node, but no
  live install exists in this scope to test against).
- Section 4.3 also remains OPEN: mock app page rendering
  in a logged-in preview browser was not verified by
  Muse. Unauthenticated curl returns the Locked page,
  not the app, so no browser rendering is claimed from
  curl. The user should open
  http://127.0.0.1:4302/apps/link-drop in their
  already-logged-in preview browser to confirm the list
  and install block.

## Implementation notes (2026-11-04, user-directed bookmarklet fix)

- At the user's direction, the "Or copy this code" paragraph
  and its `<code id="ld-code">` snippet were removed from the
  install block entirely. The install block is now the
  draggable bookmarklet link only, plus the session
  requirement and new-tab notes. This deviates from the
  spec's install-block requirement (selectable code text);
  the user overrode it, so the spec was not rewritten —
  this note records the deviation.
- The bookmarklet now carries an absolute URL, fixing a
  real bug in the first implementation: the old base was a
  path (for example `/kody-os/apps/link-drop`), and
  `window.open` with a path resolves against the sending
  page's origin, not kody-os — so a bookmarklet built on
  the app page would have sent to the wrong host from any
  other site. The new pure functions are `ldAppBase`
  (path derivation, unchanged), `ldAbsoluteUrl` (prefixes
  a path base with the page origin, or protocol plus host
  as fallback, and leaves an already-absolute base alone),
  and `ldAppUrl` (origin plus path). At render time the
  bundle prefers the shell-stamped `data-action-base`
  attribute, falls back to the pathname derivation, then
  makes the result absolute.
- Server-rendered absolute URL investigated first and
  ruled out: the shell stamps `data-action-base` as
  `appBasePath + '/apps/' + def.id` (pkg/src/apps/
  client.ts, renderBundleContent call site), which is a
  path, not an absolute URL. The origin therefore has to
  come from the app page at render time, which is what
  the bundle now does.
- Tests updated and passing on local Node v24.16.0: Node
  tests 24 checks (one new absolute-derivation check,
  bookmarklet check now asserts an absolute URL), DOM
  tests 5 checks (stub location now carries an origin,
  empty-state check asserts the bookmarklet href is the
  absolute own-origin URL and that no code block exists).
- Mock reinstall: dev stopped with the self-avoiding
  `moc[k]` pkill pattern (worked cleanly this time, no
  self-kill), mock store backed up to
  /tmp/mock-state-before-link-drop-v2.json (421,750 bytes),
  re-add via scripts/add-app.ts returned
  `{ ok: true, id: "link-drop" }`. State was NOT preserved
  by the re-add: the mock store came back with
  `{ links: [] }`, despite the "preserves state by
  default" comment in scripts/add-app.ts — that comment
  does not hold for this mock re-add (whether because
  the bundle changed or because the mock path differs
  from hosted is not established). The loss was only the
  one test entry, and it was re-pushed via scripts/act.ts
  afterwards, so the final mock state is again the single
  "After clear" entry, now under the new definition.
  Dev restarted as pid 139192 (ready, mock,
  http://127.0.0.1:4302/, lastError null) via nohup from
  this work. No catalog, version, commit, push, publish,
  or live change was made for this fix.

## Implementation notes (2026-11-04, user-directed layout fix)

- At the user's direction, the page layout is now, in
  order: a Clear All control, the link list (one line per
  link: title as link, then " - ", then date added), and
  last the "Install the bookmarklet" block with its
  instructions. The old help text saying "Saved links
  appear below" was wrong — the install block sits below
  the list, so the links were above it — and that
  sentence is removed entirely, not corrected in place.
- Clear All is now a bundle-owned GET form, not a shell
  `ui.actions` button, for a concrete reason: shell
  `ui.actions` forms render below the bundle (the Counter
  Reset diagnosis established this), so a shell button
  could never sit at the top of the page. The bundle form
  submits a plain GET to the absolute clear-action URL
  (base plus `?action=clear`, set at render time like the
  bookmarklet href), which navigates back to the app page
  on completion, in the Probe navigate-send pattern. The
  `clear` action itself is unchanged and still callable
  via MCP `act`; only its shell button was removed, so
  `ui` now carries title, hideState, and placements only.
  This deviates from the spec's ui.actions requirement
  (clear button only); the user-directed layout is the
  reason, recorded here rather than by rewriting the spec.
- Link lines no longer show a separate URL text line or a
  separate date line: each entry renders as
  `Link name - Date added` on one line (title, or URL
  when the title is empty; plain non-link entries render
  as text, with a date suffix when one parsed). The URL
  is still the anchor's href. Item styling keeps a 48px
  minimum height per line.
- The install instructions now include, as the user asked,
  an agent route: "Or ask your agent to add a link: tell
  them the app is link-drop and the action is send, and
  give them the link." The per-item-delete note stays
  ("There is no per-item delete in v1; Clear All removes
  everything"), now referring to the top button.
- Tests updated and passing on local Node v24.16.0: Node
  tests 25 checks (ui check now asserts no shell actions,
  new check asserts the agent sentence, no "appear below"
  wording, and the Clear All form), DOM tests 4 checks
  (clear-form action is the absolute clear URL, link
  lines are name-dash-date with no url/time divs, order
  and javascript:-safety unchanged).
- Mock reinstall: dev stopped with the self-avoiding
  `moc[k]` pattern, mock store backed up to
  /tmp/mock-state-before-link-drop-v3.json (423,354 bytes),
  re-add returned `{ ok: true, id: "link-drop" }`, and
  the mock store file was checked for the new wording
  ("appear below" absent, "ask your agent" and "Clear All"
  present). The full act sequence was re-run under the
  new definition (sends, duplicate, over-cap rejection,
  clear via act, send after clear) and the final mock
  state is again the single "After clear" entry. Dev
  restarted as pid 147955 (ready, mock,
  http://127.0.0.1:4302/, lastError null) via nohup from
  this work. No catalog, version, commit, push, publish,
  or live change was made for this fix.

## Implementation notes (2026-11-04, user-directed install wording)

- At the user's direction, the "There is no per-item
  delete in v1; Clear All removes everything." note was
  removed from the install block, and the agent sentence
  became a copyable prompt instead of prose: "Or ask
  your agent. Tell your agent:" followed by
  `Add the link [link] to my kody-os "link-drop" app`
  in a code block. The "Two things to know: " prefix was
  also removed; the signed-in requirement and new-tab
  sentences themselves stay, now as a plain paragraph.
- One clarification from the mock reinstall that
  accompanied this change: a raw file grep for
  "per-item delete" still hits the definition's
  `description` field ("clear-all only, no per-item
  delete in v1"), which is app metadata, not page text —
  the page itself no longer contains the phrase, and the
  definition description was left alone.
- Tests updated and passing on local Node v24.16.0: Node
  tests 26 checks (new check asserts the prompt text,
  no per-item phrase in the bundle HTML, and no "Two
  things to know" prefix), DOM tests 4 checks unchanged.
- Mock reinstall: dev was already stopped from the
  previous fix, so no new stop was needed; re-add
  returned `{ ok: true, id: "link-drop" }`, and the mock
  store file was checked ("Two things to know" absent,
  prompt present). State handling differed from the
  earlier re-adds: this re-add preserved state instead
  of resetting it, and the mock state held two identical
  "After clear" test entries — cleared via act and
  re-sent once, leaving exactly one. Dev restarted as
  pid 156544 (ready, mock, http://127.0.0.1:4302/,
  lastError null) via nohup from this work. No catalog,
  version, commit, push, publish, or live change was
  made for this fix.

## Implementation notes (2026-11-04, user-directed paragraph removal)

- At the user's direction, the entire session/new-tab
  paragraph was removed from the install block: "The
  browser you send from must already be signed into
  kody-os, or the send lands on the Locked page and
  nothing is saved. And a send opens kody-os in a new
  tab — it does not return to the original page." The
  install block now holds only the intro line, the
  "Install the bookmarklet" heading, the drag link, and
  the agent prompt. The session requirement and new-tab
  behavior are still true of the mechanism (they remain
  in the spec's design notes), they are simply no longer
  stated on the page.
- Tests updated and passing on local Node v24.16.0: Node
  tests 26 checks (the old session/new-tab presence
  check became an absence check for the paragraph's
  distinctive phrases), DOM tests 4 checks unchanged.
- Mock reinstall: dev stopped with the self-avoiding
  `moc[k]` pattern, mock store backed up to
  /tmp/mock-state-before-link-drop-v5.json (423,477 bytes),
  re-add returned `{ ok: true, id: "link-drop" }`, and
  the mock store file was checked (paragraph absent,
  agent prompt present). This re-add preserved state:
  the single "After clear" test entry survived untouched,
  so no re-push was needed. Dev restarted as pid 160050
  (ready, mock, http://127.0.0.1:4302/, lastError null)
  via nohup from this work. No catalog, version, commit,
  push, publish, or live change was made for this fix.

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
## Close-out note (2026-11-04, catalog shipping only)

- Section 6 catalog shipping is done
  except the commit: `pkg/catalog/link-drop.bundle.json`
  (catalogVersion 1, byte-identical to
  the working bundle), import + list
  entry in `pkg/src/apps/catalog.ts`,
  README entry, tests moved to
  `pkg/catalog/tests/`, working folder
  removed, catalog harness ALL PASSED
  (18 apps), package MINOR bump to
  2.6.0 (build stays 30) with headers
  updated. Task 6.3 stays open because
  its version decision applies "in the
  same commit" and no commit was
  directed. This change itself is NOT
  archived: sections 2 (human-browser),
  5 (Scribe), and 7 (hygiene/archive)
  remain open.
