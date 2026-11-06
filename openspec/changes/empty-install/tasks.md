# Tasks

Phases land in order: 1, then 2, then 3, then 4, then 5. Each phase's
verification must pass before the next phase starts. No task in this file
commits, pushes, or publishes anything (see §5).

## 1. Remove the empty-registry seed

- [ ] 1.1 Grep the repo for every caller and reference to
  `ensure_app_store_seeded` (code, tests, harnesses, docs): `pkg/src`,
  `pkg/catalog/tests`, and any script that assumes the Store is present
  on first shell use. Record what assumes seeding before deleting
  anything.
- [ ] 1.2 Remove the seed call from `dispatch()` in `pkg/src/app.ts`
  (including its comment and the degrade-to-empty-state fallback it
  guarded) and remove `ensure_app_store_seeded` from
  `pkg/src/apps/registry.ts` and any barrel export, if the §1.1 grep
  shows no other caller. Do not add any replacement seeding, flag, or
  explicit-removal state.
- [ ] 1.3 Verify in a blank store (memory-store tests where possible):
  `list_apps` returns empty and the store is byte-identical before and
  after; a first authenticated shell request installs nothing.

## 2. Apps page empty state with two prompts

- [ ] 2.1 Replace the empty branch of the Apps page in `pkg/src/app.ts`
  (the `tile-empty` "no apps yet" tile and the App Store hint) with
  Help-style help text: prose, an `<h3>` for each path, and each prompt
  as selectable text in `<p class="gate-hint"><code>…</code></p>`,
  styled by the shell theme with no new bundle CSS. Final prompt
  wording is the user's call on the drafts in design.md — do not ship
  the drafts as approved copy without that review.
- [ ] 2.2 Prompt 1 (install the App Store) must name the real mechanisms
  only: browser fallback at `/apps/app-store` (press "Install App
  Store", GET `?install-store=1`) and agent
  `install_from_catalog('app-store')` verified with `list_apps`. Do not
  invent an install route.
- [ ] 2.3 Prompt 2 (add your own apps) must reuse the Help app's add-app
  prompt wording from `pkg/catalog/help.bundle.json` (skill path
  `package:kody-os#.agents/skills/adding-an-app/SKILL.md`, `add_app`,
  validate-before-write, verify with `list_apps` / `get_app_state`).
  No copy button and no Clipboard API anywhere in the new markup.
- [ ] 2.4 Keep the existing empty-state behaviour around the help text:
  the Apps page responds 200, shows no Edit button with no apps
  installed, and the section head ("Apps") stays.

## 3. Tests

- [ ] 3.1 Registry tests: a blank store stays empty across shell
  requests; removing the last app (including the App Store, via
  `remove_app` and via `manage_remove` with confirmation) leaves the
  registry empty on the next shell request — no re-seed.
- [ ] 3.2 Apps-page tests: with no apps installed the page contains both
  prompts (Install App Store; add your own apps), contains no copy
  button and no `navigator.clipboard` reference, and still shows no
  Edit button.
- [ ] 3.3 Prompt-sync check: the empty-page add-app prompt contains the
  same skill path and `add_app` instruction as the Help app's prompt,
  so the two copies cannot silently diverge.
- [ ] 3.4 Run the catalog harness and the store harness; record any
  failures that assume seeding and fix or explicitly note them (do not
  silently drop a failing check).

## 4. Mock-dev empty verification

- [ ] 4.1 Stop `kody dev` first (a running preview serves its mock store
  from memory and can overwrite a file write), wipe the mock store to
  empty, restart dev, and confirm: the Apps page shows the help text
  with both prompts, and Home shows its honest no-widgets state.
- [ ] 4.2 Follow Prompt 1 from the empty Apps page (browser fallback):
  open `/apps/app-store`, press "Install App Store", confirm the Store
  lists catalog apps; then remove the Store as the only app and confirm
  the Apps page is empty again with the help text (no resurrection).
- [ ] 4.3 Follow Prompt 2 at least once end-to-end (agent `add_app` of a
  small catalog app, e.g. counter) and confirm it appears on the Apps
  page. No visual check on a real browser/Scribe is claimed from
  command output alone — that check stays open for the user.

## 5. Docs, specs, and version

- [ ] 5.1 Update `pkg/docs/setup.md` (and the setup sections of
  `pkg/README.md`) to describe the empty install and the Apps-page
  help text; check the result against `openspec/changes/
  bootstrap-after-fork` so the two changes agree on what empty means
  (that change is docs-only and pending — flag any conflict to the
  user rather than silently rewriting its decisions).
- [ ] 5.2 Sync the canonical specs: `openspec/specs/shell` and
  `openspec/specs/app-registry` per this change's spec deltas, and
  `openspec/specs/setup-guide` for the new documented empty state.
  Record the version decision in the implementation commit (MINOR
  recommended, MAJOR defensible — see design.md Open Questions) and
  bump `pkg/package.json` plus the `pkg/AGENTS.md` and `pkg/README.md`
  headers in the same commit, per the version policy; build +1 on
  publish. No task in this file commits, pushes, or publishes anything
  except the spec commit itself, which is outside this change's
  implementation scope.
