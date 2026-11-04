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
- [ ] 1.3 Verify Phase 1 in a blank store: set
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

## 2. Agent access

- [ ] 2.1 Add `get_shell_theme`,
  `set_shell_theme`, and `reset_shell_theme` to
  `pkg/src/index.ts`, as thin wrappers over the
  Phase 1 module — no validation reimplemented
  here — and list all three in `main()`'s
  exports, next to the pin / home exports, with
  a `useWhen` line each.
- [ ] 2.2 Confirm the return shapes from design
  Decision 6: get returns `{ defaults, override,
  effective }`; set returns `{ ok: true,
  override, effective }` or `{ ok: false, error }`
  with no write; reset takes an optional `field`
  and returns `{ ok: true, effective }`. An
  unknown field in a set payload is an error,
  not a silent ignore.
- [ ] 2.3 Verify Phase 2 with MCP-style calls
  against a blank store (no browser needed):
  get on a fresh install returns file defaults
  with an empty override; set, then get, then
  reset, then get round-trips to file defaults;
  an invalid set leaves the previous override
  untouched.

## 3. App access

- [ ] 3.1 Add `capabilities.theme: { view:
  boolean, set: boolean }` to
  `pkg/src/apps/types.ts` (`AppCapabilities`,
  next to `feeds` and `email`) and validate it
  in `pkg/src/apps/registry.ts`: any other shape
  fails validation, a definition with neither
  flag true is treated as not declaring theme,
  and install-time sanitizing normalizes missing
  flags to `false`. Existing `feeds` and `email`
  declarations and validation are unchanged.
- [ ] 3.2 Wire the routes in `pkg/src/app.ts`
  dispatch, after the `/apps/` branches and
  alongside the `/feed/` route, so they inherit
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
- [ ] 3.3 Enforce the gate in the route handler:
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
- [ ] 3.4 Verify Phase 3 end to end: an
  unauthenticated request to any theme route
  gets the locked page (never theme); a declared
  view + set app can read, set, and reset; an
  undeclared app, an unknown app, and a
  view-only app calling set all get the plain
  404; an invalid set from a gated app gets the
  JSON 400 and writes nothing. Record the
  results in the task notes; a unit-level pass
  alone does not close this task.

## 4. Control panel app

- [ ] 4.1 Author `pkg/catalog/settings.bundle.json`
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
- [ ] 4.2 Register the bundle in the catalog:
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
- [ ] 4.3 Add one line to the Help page in
  `pkg/src/app.ts` naming the Settings app as
  the browser path for changing the shell
  theme, alongside the existing App Store and
  agent / `add_app` guidance. No other Help
  text changes in this change.

## 5. Docs

- [ ] 5.1 Write `pkg/docs/shell-settings.md`:
  the two-layer model (file default, storage
  override), the storage key, the per-field
  precedence and set semantics, the MCP export
  shapes, the route table and gate, the
  `capabilities.theme` declaration, the panel's
  scope (including grid / SVG not editable in
  the panel), and the out-of-scope list.
- [ ] 5.2 Add a `capabilities.theme` row to
  `pkg/.agents/skills/adding-an-app/SKILL.md`, next to the
  `capabilities.feeds` and `capabilities.email`
  rows, and update the "Adding an app"
  capability paragraph in `pkg/AGENTS.md` to
  name theme as a generic capability (this rides
  with the MINOR bump, not as a separate docs
  commit).

## 6. Verification

- [ ] 6.1 Prove the panel bundle in jsdom
  (harness outside `pkg/`): controls render
  from a fixture read response with correct
  source labels; desk / paper, name, title,
  glyph, stock-mark, per-field reset, and
  reset-all flows submit to the theme routes
  (never to `act()`); no navigation, no POST,
  and no theme stored in app state occurs in
  any flow.
- [ ] 6.2 Run the ES2019 ceiling scan on the
  bundle script and the new module (zero hits
  for `?.` / `??` / `replaceAll` / `.at(` /
  template literals), the catalog harness, and
  the Counter harness green.
- [ ] 6.3 Smoke-test the full loop with a live
  shell request: file defaults render; set via
  MCP, and the next page render shows the
  override; set via the panel's GET forms with
  no JavaScript, and the 303 lands back on the
  panel showing the new source labels; reset
  all, and the next render is file defaults
  again. Confirm `?k=` stamping is preserved
  on the panel's forms for query-authenticated
  sessions (via `finishResponse`, as with other
  shell forms).
- [ ] 6.4 Verify `openspec validate --changes`
  passes if the binary is available (otherwise
  check the change shape manually, as with
  other changes in this environment: proposal,
  design, tasks, and spec deltas present and
  internally consistent).

## 7. Version and publish

- [ ] 7.1 Apply the MINOR version bump in the
  same commit as the code per `pkg/AGENTS.md`
  (BUILD +1 on publish; `pkg/AGENTS.md` +
  `pkg/README.md` headers updated to the new
  version in that commit). If the phases land
  in separate publishes, each publish bumps per
  `pkg/AGENTS.md` at that time instead of
  folding several MINORs into one. Do not
  commit, push, or publish this change without
  the user's explicit direction for that step,
  and do not approve any Kody capability
  re-approval on the owner's behalf (none is
  expected for this change: no new
  `kody.app.capabilities` entry).
