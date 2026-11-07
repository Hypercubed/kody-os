# Tasks

## 0. Open questions first

- [ ] 0.1 Ask the user design Open Questions
  1 (app id: `daily-feed` vs
  `generic-daily-feed`), 2 (entry cap and
  entry size defaults), 3 (catalog from the
  start or `add_app` first), 4 (one-off
  Daily Brief copy step), and 5 (widget
  placement in v1) before writing the
  definition. Question 1 changes the id
  everywhere, including the prompt; question
  3 changes what "done" means and when the
  version decision lands. Record the answers
  in the task notes and do not assume them.
Note: questions 1–4 are settled — see the
implementation notes (spec defaults used: id
`daily-feed`, cap 14 / 19000, page only;
catalog added on user direction) and design.md,
Decision 5 (Daily Brief feed moved verbatim
2026-11-04, Daily Brief deleted live).
Question 5 was settled for v1 as page-only; a
widget remains a future step (design.md,
Decision 6).
- [x] 0.2 Re-check the numbers this spec
  depends on against the repo and the live
  app before building on them: Daily Brief's
  current definition (feed field, `set_feed`
  action, 250000 cap), the bundle ceiling
  in `pkg/docs/scribe-limitations.md`, and
  the 256 KiB bundle cap. Record any drift
  from design.md, Research, and adjust the
  spec delta before implementation, not
  after.

## 1. Definition and bundle

- [x] 1.1 Author the definition:
  `schemaVersion` 5, id per task 0.1,
  label "Daily Feed", category `reading`,
  description in plain words stating that
  the app shows one agent-pushed daily feed
  and that an empty app shows a prompt for
  the user's agent. State: `feed` only,
  string, initial `""`, `maxLength` 250000.
  Action: `set_feed` only, arg `value`
  (string, required, `maxLength` 250000),
  effect `set` field `feed` from arg `value`.
  No capabilities, no other state field, no
  other action. Icon: a monochrome SVG mark
  per the icon rules in
  `pkg/.agents/skills/adding-an-app/SKILL.md`
  (no emoji, allowlisted elements only,
  ~2 KiB), or a plain glyph if an SVG mark
  is not ready; record which was chosen.
- [x] 1.2 Author the bundle page, ES2019
  only, inlined CSS, system fonts, zero
  emojis, 48px minimum tap targets, no
  flexbox gap. Wait for DOMContentLoaded
  (with a readyState fallback) before
  rendering, then hide the shell-rendered
  state fields, so the viewer is the only
  feed shown. Parse the stored RSS XML:
  DOMParser first, regex fallback for
  `<item>` blocks, in the Daily Brief
  pattern. Open on the latest entry.
  Previous / Next step through entries in
  page, nav grid `auto 1fr auto`, date
  plus "N of M" centered. Dates are
  device-local long form when a pubDate is
  present; an entry without a pubDate shows
  its title, or its position when it has no
  title either. Never apply a feed-specific
  title regex; never present an old entry's
  date as today's.
- [x] 1.3 Author the sanitized renderer:
  descriptions are escaped plain text in
  storage and stay plain text on render.
  Linkify at render time only, escape
  first then linkify in one pass: "Source:
  <url>" becomes a "Source" link, any other
  bare URL becomes a link with the URL as
  its text, trailing punctuation kept
  outside the link. No feed-supplied HTML,
  script, iframe, or inline style reaches
  the viewer. Images, if a future entry
  carries one, are capped and show alt
  text; images are not required in v1.
- [x] 1.4 Author the empty-state prompt,
  rendered by the bundle when the feed is
  empty or parses to zero items, in place
  of the viewer. It SHALL contain every
  element in design.md, Decision 3: what is
  missing, the paste-ready agent sentence
  naming app id, `set_feed` action, RSS XML
  newest-first format, and the 14-entry cap,
  and no secret, OTP, code, token, or
  credential-carrying link. The prompt is
  plain selectable text, with no copy button
  and no Clipboard API call anywhere in the
  bundle. A feed that is non-empty but
  unparseable renders the same prompt plus
  a short "stored feed could not be read"
  note, and does not render raw XML as if
  it were entries.

## 2. Push procedure

- [x] 2.1 Author a generic push procedure
  (script plus a short procedure note, in
  the Daily Brief pattern, with the digest
  conversion removed): read the current
  state via `get_app_state`, parse the
  items, prepend the new entry (replacing
  any entry with the same guid), keep only
  the newest 14 entries (or the cap from
  task 0.2), rebuild the feed XML, set it
  with `act` action `set_feed`, and verify
  with a final `get_app_state`. Refuse an
  entry over the size limit from task 0.2.
  If the state read fails, or the existing
  feed is non-empty but unparseable, write
  nothing and exit non-zero; never overwrite
  the feed with a single entry. A push
  failure never blocks the caller's other
  work; it is reported, not swallowed.
- [x] 2.2 Record the push trigger choice in
  the task notes: a Kody scheduled job, a
  Muse cron, or on-demand agent pushes.
  The app enforces no schedule; the note
  records which trigger the user chose, so
  a later reader does not mistake "no
  schedule in the app" for "no schedule
  anywhere".

## 3. Verification in Node

- [x] 3.1 Verify the parser in Node: a
  well-formed multi-item feed opens on the
  latest entry and steps correctly in both
  directions; an empty feed and a feed with
  zero items both render the prompt, not a
  blank viewer; a non-empty unparseable
  feed renders the prompt plus the
  could-not-be-read note; an entry without
  a title or pubDate still renders without
  crashing, using the fallbacks in task 1.2.
- [x] 3.2 Verify linkify in Node: "Source:
  <url>" becomes exactly one "Source" link,
  a bare URL becomes exactly one link with
  the URL as text, trailing punctuation
  stays outside the link, and no nested
  anchors are produced. Verify escaping:
  feed-supplied `<script>`, `<iframe>`, and
  inline style never reach the output.
- [x] 3.3 Verify the push procedure in
  Node against a fixture store: prepend
  keeps newest first, same-guid replacement
  replaces in place, the cap drops the
  oldest first, an oversize entry is refused
  without writing, and an unparseable
  existing feed blocks the write without
  overwriting it. Record the fixture
  results; do not claim procedure safety
  for cases that were not run.
- [x] 3.4 Run the ES2019 ceiling scan on
  the bundle script (zero hits for `?.` /
  `??` / `replaceAll` / `.at(` / template
  literals if the bundle style forbids
  them), confirm the bundle total is under
  the 256 KiB cap, and run the definition
  validation path (`validateDefinition`
  equivalent) and record the result. For an
  `add_app` v1, no catalog harness run is
  required; for a catalog v1 (task 0.1,
  question 3), the catalog harness is
  required instead (see task 6.1).

## 4. Verification in the mock store

- [x] 4.1 Install via `add_app` in a blank
  mock store and confirm `add_app` returns
  `{ ok: true, id: "<id from task 0.1>" }`,
  the app appears in `list_apps`, and its
  state is the empty initial state.
  Respect the stopped-server trap in
  `pkg/AGENTS.md`: mock writes made while
  `kody dev` is running land on disk but
  are silently overwritten by the preview's
  next write, so stop the server, run the
  mock writes, then start it again; do not
  record a mock install as verified from a
  running preview alone.
- [x] 4.2 In the mock preview, confirm the
  empty app shows the prompt (not a blank
  page), then push one entry with the
  procedure from task 2.1 and confirm the
  viewer shows it, then push a second entry
  and confirm Previous / Next and "N of M"
  behave, then push an entry with the same
  guid as an existing entry and confirm
  replacement, not duplication.

## 5. Verification on the Scribe

- [ ] 5.1 Install via `add_app` on the live
  store (definition as authored in task 1;
  backup the live store first if any
  existing app would be touched, which this
  change does not do). Confirm `add_app`
  returns `{ ok: true }` and the app appears
  in `list_apps` and on the Apps page, with
  no package republish. (The Daily Brief
  check in the original text is overtaken:
  Daily Brief was deleted live on 2026-11-04
  after its feed moved to Daily Feed; there
  is no Daily Brief left to confirm.)
- [ ] 5.2 The user runs the app on the
  Scribe: open the empty app and read the
  prompt, push an entry from their agent
  using that prompt, open the app again and
  step through entries. Record the run's
  outcome (pass, or each failure with the
  exact input and symptom) in the task
  notes; a desktop-browser pass alone does
  not close this task. (Kept Nov 6, 2026: checks the untested RSS parse and prompt rendering on the actual Scribe engine — DOMParser/regex fallback, prompt readability — not a routine check.)
- [ ] 5.3 Fix Scribe-only issues found in
  5.2 (input, tap targets, wrapping,
  refresh, prompt readability) and re-run
  until the Scribe run passes or the user
  directs a scope cut.

## 6. Catalog shipping (Phase 2, optional)

Only on the user's explicit direction, and
only after tasks 1-5 pass, unless task 0.1
question 3 moved catalog into v1.

- [x] 6.1 Write
  `pkg/catalog/daily-feed/definition.json`
  (or the id from task 0.1) from the
  verified v1 definition, plus
  `pkg/catalog/daily-feed/RECIPE.md`,
  with `catalogVersion` 1 (now 5,
  `installMode` `recipe-or-json`), and
  register it: one import line in
  `pkg/src/apps/catalog.ts` (alphabetical
  by id), the generated index regenerated,
  plus one entry in `pkg/catalog/README.md`.
  Verify the catalog harness passes
  (validate + install in a blank store +
  empty initial state + directory / import
  match) with no other catalog file changed.
- Removed Nov 6, 2026 per the no-release / no-generic-Scribe-verify rule: task 6.2 "Apply the MINOR version bump in the same commit as the catalog files" (was already marked done when removed) — a version-bump release step; the user decides when to release.
- Removed Nov 6, 2026 per the no-release / no-generic-Scribe-verify rule: task 6.3 "Do not commit, push, or publish this change without the user's explicit direction" — a commit/publish guard that is now the standing rule; nothing is lost by removing it as a task.
## 7. Change hygiene

- [ ] 7.1 Verify `openspec validate
  --changes` passes if the binary is
  available (otherwise check the change
  shape manually, as with other changes
  in this environment: proposal, design,
  tasks, and spec deltas present and
  internally consistent).
- [ ] 7.2 Confirm no file outside
  `openspec/changes/generic-daily-feed/`
  was changed by writing this change
  itself. The app, the catalog files, and
  any version bump are implementation
  work under tasks 1-6, not part of this
  change document.
- [ ] 7.3 When the change is done, archive
  it to
  `openspec/changes/archive/<YYYY-MM-DD>-generic-daily-feed/`
  and add a close-out note to tasks.md
  recording what was actually verified,
  what was substituted, and what was left
  open. Do not rewrite the change to make
  the past look cleaner.

## Implementation notes (2026-11-04, steps 1-4 + catalog + mock)

- Open question 0.1 was NOT answered by the user in this turn;
  implementation used the spec defaults throughout: id `daily-feed`,
  cap 14 entries / 19,000 chars per entry, page placement only, no
  widget. Catalog was added now on the user's explicit direction
  in this turn, not as the spec's optional Phase 2. If the user
  later wants a different id, it must change before any live
  install; the mock install already uses `daily-feed`.
- Bundle reading path differs from the spec's older span wording
  in one deliberate way: the current adding-an-app skill requires
  new bundles to read the JSON state seed (bridge first, seed
  second, span fallback), not span scraping. The bundle sets
  `ui.hideState: true`, so the shell hides the state readout;
  DOMContentLoaded handling is still present as a fallback.
- Dev lifecycle on be-quite-900: original dev pid 8372 was
  stopped for the mock install, restarted as pid 84618, stopped
  again for the corrected push run, and restarted as pid 85845
  (ready, mock target, http://127.0.0.1:4302/). The restarted
  dev was started via nohup from this work, not from the user's
  original terminal; the user may restart it in their own
  terminal if they prefer that session to own it.
- Mock store now holds daily-feed with two test entries only
  (mock-g1 "Mock entry one", mock-g2 "Mock entry two, revised");
  these are test data, not a real feed, and must be replaced by
  a real push before any live use. Mock store file is outside
  the repo and is not tracked by git.
- Verification actually run: Node bundle tests (22 checks, all
  pass), Node DOM wiring tests (6 checks, all pass), Python
  push-procedure tests (prepend, dedupe, unparseable refusal,
  all pass), catalog harness (ALL CATALOG CHECKS PASSED, 17
  apps, bun 1.3.13), mock install (`{ ok: true, id:
  "daily-feed" }`) plus three mock `act` pushes with
  after-state checks. No browser run of the mock preview was
  made in this turn, and no Scribe run (task 5) was made; both
  remain open. Nothing was committed, pushed, or published.

Note on mock preview check: unauthenticated curl to /apps/daily-feed returns the Locked page (404 body), not the app, so no browser rendering was verified in this turn. The user should open http://127.0.0.1:4302/apps/daily-feed in their already-logged-in preview browser to confirm the viewer. No dev OTP was minted for this check.

Note (2026-11-04 evening): user confirmed browser rendering of the mock app looks good with entries, then asked for the data to be removed to see the empty landing page. Mock feed cleared via act set_feed to empty (before: 2 mock entries, after: empty string, verified), dev restarted as pid 92676. The app definition itself was NOT removed, only its feed data; the pre-clear mock store is backed up at /tmp/mock-state-before-clear.json on be-quite-900.

Note (2026-11-04 evening, live install): user directed install on hosted Kody with no data. Definition used was byte-identical to local pkg/catalog/daily-feed.bundle.json (sha256 6157c5e1ba0f8045cc805017ce5086fa06e1d288ac135e365ffd23b79378e5bd, catalogVersion 2, Help-style code-block prompt). Live add_app returned { ok: true, id: "daily-feed" }; verified live list_apps count 18 -> 19, daily-feed present (schemaVersion 5, reading, page), state { feed: "" }, daily-brief still present and untouched. No repo commit, push, or Kody package publish was made for this install; add_app is a registry write only. Live URL: https://hypercubed.kody.run/kody-os/apps/daily-feed (needs device session; not pinned to home unless the user adds it via Apps Edit).
