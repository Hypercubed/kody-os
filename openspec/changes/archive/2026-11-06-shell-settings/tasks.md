# Tasks

Phases land in order: 1, then 2, then 3, then 4.
Each phase is usable on its own, and each phase's
verification must pass before the next phase
starts. No task in this file commits, pushes, or
publishes anything (see §7).

## 1. Storage-based overrides

- [x] 1.1 Author `pkg/src/shell-theme.ts`
  (server-side only, ES2019): storage key
  `kody-os.shell.theme`; the partial-override
  shape; per-field validation per design
  Decision 4, reusing the existing background
  grid check from `pkg/src/app.ts` and the
  existing icon sanitizer from
  `pkg/src/apps/registry.ts` (no new allowlist);
  `get` (defaults + override + effective),
  `set` (validate-all-first, atomic, no write
  on any invalid field), and `reset` (whole key,
  or one field, dropping the key when the last
  field is cleared). Corrupt stored JSON reads
  as no override; an invalid stored field falls
  back to the file value for that field only.
  DONE 2026-10-31: module pkg/src/shell-theme.ts implemented (key kody-os.shell.theme, get/set/reset, per-field validation reusing grid check and icon sanitizer, corrupt/invalid read fallback); verified by memory-store tests in /tmp/kody-backend-tests.ts.
- [x] 1.2 Wire the merge in `pkg/src/app.ts`
  `fetch()`: resolve the file theme exactly as
  today (including its once-per-publish cache),
  read the override fresh on every request via
  the module (never from the file cache), merge
  per field, and render the merged theme on
  every page. With no override stored, rendering
  is byte-identical to today.
  DONE 2026-10-31: merge wired into pkg/src/app.ts fetch() (override read fresh every request, file theme cache unchanged, no-override effective equals file values); shell-fetch rendering leg owed (kody dev/hosted out of scope).
  NOTE 2026-11-05: Phase 1 is implemented and committed
  in `ba9193c` (ancestor of local HEAD and origin/main).
- [x] 1.3 Verify Phase 1 in a blank store: set
  one field and confirm only that field changes;
  set with one invalid field and confirm nothing
  is written; corrupt the stored JSON and confirm
  pages still render with file values; reset one
  field and confirm only that field returns to
  the file value, then reset all and confirm the
  key is gone; confirm an override survives a
  simulated republish (the stored key is
  independent of the bundled file). Measure the
  per-request override read (design Open
  Question 3) and record the result; do not add
  a cache to fix a slowness that was not
  measured.
  PARTIAL 2026-10-31: blank-store cases verified via memory-store tests (set one field, invalid set writes nothing, corrupt JSON, reset one field, reset all, survives simulated republish); per-request override read timing (design Open Question 3) NOT measured or recorded — left open.
  NOTE 2026-11-05: per-request override-read timing measured
  on the PC (bun 1.3.13, in-memory store, the get_shell_theme
  code path as fetch() calls it): no override stored, n=2000,
  mean 0.8us, median 0.4us, p95 1.9us; override stored, n=2000,
  mean 0.9us, median 0.5us, p95 1.9us. End-to-end dev-server
  GET / (locked page, merge in path), 20 requests, median 5.7ms,
  min 5.3ms, max 7.2ms. The read is sub-microsecond in-process
  and the page stays at ~6ms: no measurable slowdown, so no
  cache is added (design Open Question 3 answered: no).

## 2. Agent access

- [x] 2.1 Add `get_shell_theme`,
  `set_shell_theme`, and `reset_shell_theme` to
  `pkg/src/index.ts` as thin wrappers over
  `pkg/src/shell-theme.ts` (functions already exist
  there; only the exposure is missing). The wrappers
  must first resolve file defaults — export `getTheme`
  from `pkg/src/app.ts` and pass
  `fileThemeToValues(await getTheme())` — and list all
  three in `main()`'s exports next to the pin / home
  exports, with a `useWhen` line each. No validation
  reimplemented here.
- [x] 2.2 Confirm the return shapes from design
  Decision 6: get returns `{ defaults, override,
  effective }`; set returns `{ ok: true,
  override, effective }` or `{ ok: false, error }`
  with no write; reset takes an optional `field`
  and returns `{ ok: true, effective }`, or
  `{ ok: false, error }` for an unknown field. An
  unknown field in a set payload is an error,
  not a silent ignore.
- [x] 2.3 Verify Phase 2 with MCP-style calls
  against a blank store (no browser needed):
  get on a fresh install returns file defaults
  with an empty override; set, then get, then
  reset, then get round-trips to file defaults;
  an invalid set leaves the previous override
  untouched.

## 3. App access

- [x] 3.1 Add `capabilities.theme: { view:
  boolean, set: boolean }` to
  `pkg/src/apps/types.ts` (`AppCapabilities`,
  next to `feeds`, `proxy`, and `manageApps`) and
  validate it
  in `pkg/src/apps/registry.ts`: any other shape
  fails validation, a definition with neither
  flag true is treated as not declaring theme,
  and install-time sanitizing normalizes missing
  flags to `false`. Existing `feeds`, `proxy`, and
  `manageApps` declarations and validation are
  unchanged. `theme` must be added to the
  `validateCapabilities` allowlist in
  `pkg/src/apps/registry.ts` (it rejects unknown
  capability keys) with the `{ view, set }` shape
  validated, and `sanitizeCapabilities` must gain a
  `theme` branch normalizing missing flags to `false`.
- [x] 3.2 Wire the routes in `pkg/src/app.ts`
  dispatch, after the `/feed/` route (dispatch order
  is `/apps/` branches, then `/manage/`, then
  `/proxy/`, then `/feed/`, then the 404 fallthrough),
  so they inherit
  the device gate in `fetch()`: `GET
  /theme/:app` (read, JSON `{ ok: true,
  defaults, override, effective }`,
  `no-store`); `GET /theme/:app?action=set&...`
  and `GET /theme/:app?action=reset[&field=...]`
  (JSON `{ ok: true, override, effective }`
  when `format=json` is present, otherwise 303
  back to the `from` path, defaulting to the
  app's page). Set query parameters follow
  design Decision 4, with a grid background
  passed as `background_grid` (eight comma-
  separated integers) when the caller needs it;
  the panel in Phase 4 uses desk / paper only.
  No POST route is added. Unknown theme paths
  fall through to the existing 404 and cannot
  shadow an app page.
- [x] 3.3 Enforce the gate in the route handler:
  resolve the `:app` slug, load that app's
  stored definition, and require
  `capabilities.theme.view` for reads and
  `capabilities.theme.set` for set / reset.
  Any gate failure (unknown app, malformed
  slug, app without the declaration, view-only
  app calling set / reset) returns the feed-
  style plain 404, with no theme and no
  capability detail. A gated app with an invalid
  value gets JSON `{ ok: false, error }` (400)
  and no write.
- [x] 3.4 Verify Phase 3 end to end: an
  unauthenticated request to any theme route
  gets the locked page (never theme); a declared
  view + set app can read, set, and reset; an
  undeclared app, an unknown app, and a
  view-only app calling set all get the plain
  404; an invalid set from a gated app gets the
  JSON 400 and writes nothing. Record the
  results in the task notes; a unit-level pass
  alone does not close this task.
- [x] 3.5 Extend `summarizeCapabilities` and
  `capabilityAdditions` in `pkg/src/apps/registry.ts`
  (they currently enumerate only manageApps,
  feedHosts, and proxyHosts) so a `theme`
  declaration appears in the Store's installer
  disclosure and in the capability-expansion
  confirmation gate.
  NOTE 2026-11-05: added by the Nov 5 audit;
  renumbers nothing else.

## 4. Control panel app

- [x] 4.1 Author `pkg/catalog/settings.bundle.json`
  (id `settings`, schemaVersion 5, `stateSchema`
  `{ type: "object", initial: {}, fields: {} }`,
  `actions: {}`, `capabilities.theme: { view:
  true, set: true }`, `ui.openAs: "page"`):
  a stateless bundle that renders its controls
  from the Phase 3 read route and submits them
  to the Phase 3 set / reset routes — no theme
  in app state, no `act()` calls. App id for
  routes is resolved from `data-action-base`
  (xkcd pattern) with a `/apps/<id>` path
  fallback, never hardcoded. Controls (design
  Decision 11): background desk / paper buttons;
  name and title text inputs (title blank =
  clear); icon as a glyph text input, a "stock
  mark" button (sets icon to `""`), and a
  per-field reset; per-field reset buttons for
  every field; one "reset all to file defaults"
  button. For each field, show the effective
  value and its source (file default or
  override); when the effective background is a
  grid or the effective icon is SVG, show the
  "custom grid / custom mark, set via file or
  agent" notice instead of an editor. Core
  controls are plain GET forms (no POST, no JS
  required); bundle JS may enhance in place
  with `format=json`, but must never be
  required. ES2019 script, one inline `<style>`,
  inlined assets only, zero external links,
  system fonts, high-contrast black-on-white,
  48px minimum tap targets, icon per the
  existing icon rules, within the 256 KiB cap.
  Bundle CSS uses the shell's scoped bare-element
  defaults inside `.bundle` and does not redefine
  buttons or fields.
- [x] 4.2 Register the bundle in the catalog:
  one import line in `pkg/src/apps/catalog.ts`
  (alphabetical by id) plus one entry in
  `pkg/catalog/README.md`; verify the catalog
  harness passes (validate + install in a blank
  store + empty initial state + directory /
  import match) with no other catalog file
  changed. Confirm the panel is NOT installed
  by default on a fresh install, and that
  removing it leaves `kody-os.shell.theme`
  untouched and a later reinstall shows the
  same overrides.
- [x] 4.3 Add one line to `pkg/catalog/help.bundle.json`
  (the Help page is a catalog bundle, not an `app.ts`
  page) alongside 'Adding apps', naming the Settings
  app as the browser path for changing the shell
  theme; bump the Help bundle's `catalogVersion` +1
  per the catalog rule. No other Help text changes
  in this change.

## 5. Docs

- [x] 5.1 Write `pkg/docs/shell-settings.md`:
  the two-layer model (file default, storage
  override), the storage key, the per-field
  precedence and set semantics, the MCP export
  shapes, the route table and gate, the
  `capabilities.theme` declaration, the panel's
  scope (including grid / SVG not editable in
  the panel), and the out-of-scope list.
- [x] 5.2 Add a `capabilities.theme` row to
  `pkg/.agents/skills/adding-an-app/SKILL.md`, next to
  the `capabilities.feeds` / `proxy` / `manageApps`
  rows, and update the `capabilities.feeds` /
  `proxy` / `manageApps` rows in `pkg/AGENTS.md` to
  name theme as a generic capability (this rides
  with the MINOR bump, not as a separate docs
  commit).

## 6. Verification

- [x] 6.1 Prove the panel bundle with a Node-stub DOM
  test at `pkg/catalog/tests/settings-dom-tests.cjs`
  (the daily-feed / generic-feed pattern, not jsdom
  outside `pkg/`): controls render
  from a fixture read response with correct
  source labels; desk / paper, name, title,
  glyph, stock-mark, per-field reset, and
  reset-all flows submit to the theme routes
  (never to `act()`); no navigation, no POST,
  and no theme stored in app state occurs in
  any flow.
  DONE 2026-11-06: `node pkg/catalog/tests/settings-dom-tests.cjs` from the repo root — ALL SETTINGS DOM CHECKS PASSED (exit 0); `node pkg/catalog/tests/settings-tests.cjs` also passed (ALL SETTINGS CHECKS PASSED, exit 0). Run on be-quite-900.
- [x] 6.2 Run the ES2019 ceiling grep on the bundle
  script and the new module (zero hits for `?.` /
  `??` / `replaceAll` / `.at(` — template literals
  are not part of the ceiling; avoiding them is
  Counter's conservative style, not a binding rule),
  the catalog harness, and the new bundle tests.
  NOTE 2026-11-05: `counter-tests` has 1 pre-existing
  failure, identical on clean HEAD, so it is not a
  gate — gate on the catalog harness + the new
  bundle tests instead.
  DONE 2026-11-06: ES2019 ceiling grep — 0 hits for `?.` / `??` / `replaceAll` / `.at(` in the bundle script (extracted from `pkg/catalog/settings/definition.json` bundle.files['index.html'] — there is no separate settings/index.html file) and in the new module `pkg/src/shell-theme.ts`; no template literals in the bundle script either. `bun tests/catalog-harness.ts` — ALL CATALOG CHECKS PASSED (18 apps, 0 collections), exit 0; new bundle tests passed (see 6.1). `counter-tests` re-confirmed at 1 pre-existing failure (k param preserved), not a gate. Run on be-quite-900.
- [x] 6.3 Smoke-test the full loop with a live
  shell request: file defaults render; set via
  MCP, and the next page render shows the
  override; set via the panel's GET forms with
  no JavaScript, and the 303 lands back on the
  panel showing the new source labels; reset
  all, and the next render is file defaults
  again. Verify cookie-authenticated fetch and
  no-JS GET submit round-trips instead of any
  `?k=` check: `finishResponse` only sets
  `Cache-Control: no-store` + security headers
  and does no `?k=` stamping, and there is no
  persistent query-authenticated session — `?k=`
  is a single-use OTP submission transport and
  sessions ride the session cookie. Confirm no
  `?k=` is rendered in any link, form, or redirect.
  DONE 2026-11-06: live smoke test against mock dev on localhost:4302 (two stop/restart cycles — one to mint the dev OTP, one for the MCP file-store write, both the established stop-write-restart pattern; the session cookie survived the restart, so the second OTP minted was unused). File defaults render (read route: defaults name kody-os, background desk, showHelp/showAbout true; override {} after a baseline reset-all; home title 'Home · kody-os'); set via MCP (`kody execute --target mock` calling the package's set_shell_theme export, name 'Smoke Test') and the next render showed 'Home · Smoke Test'; set via the panel's GET forms with no JavaScript (background=paper) — 303 to /apps/settings, read route then showed override {name 'Smoke Test', background 'paper'}; reset all — 303 to /apps/settings, read route override {}, home title back to 'Home · kody-os'. Source labels are proven by the 6.1 DOM tests; live, the values the panel renders were verified via the read route and the panel page loaded 200. Cookie-authenticated fetch verified (footer 'via cookie', HttpOnly session cookie); unauthenticated requests to /, /theme/settings, /apps/settings get the locked page (404). No `?k=` in the locked page, the panel pages, or any 303 Location header; the single '?k=' occurrence on Home is inside the hoodie-weather app's bundle JS (pre-existing feed-URL helper), not a shell link, form, or redirect. A pre-existing mock-store override {showHelp:true} was present before the test and was cleared by the loop's reset-all (effective values unchanged — showHelp true is the file default). Run on be-quite-900.
- [x] 6.4 Run `openspec validate --changes` on the
  PC (binary at
  `/home/jmh/.nvm/versions/node/v24.16.0/bin/openspec`;
  add that directory to PATH for the run; `bun` is
  at `/home/jmh/.bun/bin/bun`, not on the daemon
  shell's PATH) and confirm it passes.
  DONE 2026-11-06: `openspec validate shell-settings --type change` — 'Change shell-settings is valid'. Repo-wide `openspec validate --changes`: 19 passed, 5 failed (24 items); the 5 failures are pre-existing in other changes (email-client, f-flat-minor-calculator, generic-daily-feed, generic-rss-feed, link-drop-to-kody-os), not this change. Run on be-quite-900.

## 7. Version and publish

- [x] 7.1 Apply the MINOR version bump at publish per `pkg/AGENTS.md` (deferred to publish by the user, Nov 6, 2026 — the code is already committed)
  (BUILD +1 on publish; `pkg/AGENTS.md` +
  `pkg/README.md` headers updated to the new
  version in that commit). If the phases land
  in separate publishes, each publish bumps per
  `pkg/AGENTS.md` at that time instead of
  folding several MINORs into one.
  NOTE 2026-11-05: Phase 1 was committed in `ba9193c`
  with NO version bump (deliberate at the time), so
  'apply the MINOR bump in the same commit as the code'
  is already violated for Phase 1; the package has
  since moved 2.4.1 -> 2.6.0 -> 2.7.0 and is now
  2.7.0 / build 32. Remaining phases ride the next
  MINOR (2.8.0, build 33). Publish scope is open:
  the app-store commit `08b81cd` and the generic-feed
  commit are also unpushed, and which of those ride
  the same 2.8.0 publish is the user's call. Do not
  commit, push, or publish this change without
  the user's explicit direction for that step,
  and do not approve any Kody capability
  re-approval on the owner's behalf (none is
  expected for this change: no new
  `kody.app.capabilities` entry).
  DONE 2026-11-06: version decision deferred to publish by the user (Nov 6); MINOR recommended; highest bump wins; build +1 on publish. No version bump applied in this change.
