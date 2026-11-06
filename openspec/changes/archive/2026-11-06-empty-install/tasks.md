> ARCHIVED 2026-11-06: implemented in the VM (uncommitted working tree, no commit/push/publish); deltas synced by hand into canonical openspec/specs/shell, app-registry, and setup-guide. Verified: store harness ALL PASSED (incl. new empty-registry, empty-state, and prompt-sync checks), catalog harness ALL PASSED (20 apps), app-store bundle tests ALL PASSED under node, bun build clean. Substituted: kody dev cannot run in this VM (no kody CLI) — mock-dev §4 and the human-browser/Scribe visual check stay open for the user/PC. Validate: pre-merge, empty-install exited 1 with ONLY the known omitted-scenario error and mini-apps was valid; post-merge validate shows only the expected already-merged drift (delta scenario names renamed in canonical; mini-apps ADDED already exists) — archiving is the resolution. Flagged and fixed in this PR: setup.md step 4 and the canonical setup-guide spec no longer say the App Store is 'specified but not yet implemented' — corrected to state the Mini-App Store is implemented and installed explicitly (it shipped in v2.7.0). bootstrap-after-fork conflict flagged: its design.md says 'today the shell auto-seeds', no longer true since seeding was removed.

# Tasks

Phases land in order: 1, then 2, then 3, then 4, then 5. Each phase's
verification must pass before the next phase starts. No task in this file
commits, pushes, or publishes anything (see §5).

## 1. Remove the empty-registry seed

- [x] 1.1 Grep the repo for every caller and reference to
  `ensure_app_store_seeded` (code, tests, harnesses, docs): `pkg/src`,
  `pkg/catalog/tests`, and any script that assumes the Store is present
  on first shell use. Record what assumes seeding before deleting
  anything.
- [x] 1.2 Remove the seed call from `dispatch()` in `pkg/src/app.ts`
  (including its comment and the degrade-to-empty-state fallback it
  guarded) and remove `ensure_app_store_seeded` from
  `pkg/src/apps/registry.ts` and any barrel export, if the §1.1 grep
  shows no other caller. Do not add any replacement seeding, flag, or
  explicit-removal state.
- [x] 1.3 Verify in a blank store (memory-store tests where possible):
  `list_apps` returns empty and the store is byte-identical before and
  after; a first authenticated shell request installs nothing.
  DONE 2026-11-06: new store-harness empty-registry checks — blank list_apps empty, no app-store snapshot, explicit install only, remove-last-app (remove_app and manage_remove with confirmation) leaves empty. list_apps is a pure read (no write path), so byte-identical follows from the empty list + no snapshot.
  DONE 2026-11-06: dispatch wrapper + binding removed (dispatch returns the client import directly, no dead Promise.resolve); ensure_app_store_seeded deleted from registry.ts and its export from index.ts; no replacement seeding, flag, or explicit-removal state. Grep clean for ensure_app_store_seeded/seedDone in pkg/src.
  DONE 2026-11-06: grep found callers in pkg/src/app.ts (dispatch wrapper), pkg/src/apps/registry.ts (definition), pkg/src/apps/index.ts (export), tests/store-harness.ts (setup uses + seeding block); docs assumed seeding (pkg/AGENTS.md, pkg/README.md, pkg/docs/setup.md). No caller in pkg/catalog/tests.
## 2. Mini-apps page empty state with two prompts

- [x] 2.1 Replace the empty branch of the Mini-apps page in `pkg/src/app.ts`
  (the `tile-empty` "no apps yet" tile and the Mini-App Store hint) with
  Help-style help text: prose, an `<h3>` for each path, and each prompt
  as selectable text in `<p class="gate-hint"><code>…</code></p>`,
  styled by the shell theme with no new bundle CSS. Final prompt
  wording is the user's call on the drafts in design.md — do not ship
  the drafts as approved copy without that review.
- [x] 2.2 Prompt 1 (install the Mini-App Store) is agent-only:
  `install_from_catalog('app-store')` verified with `list_apps`.
  Do not name the browser fallback (`/apps/app-store`,
  `?install-store=1`) in the copy — it depends on the catalog living
  in `pkg/`, and the catalog is moving out of `pkg/`
  (`catalog-out-of-pkg`). Do not invent an install route.
- [x] 2.3 Prompt 2 (add your own mini-apps) must reuse the Help app's add
  prompt wording from `pkg/catalog/help.bundle.json`, as rewritten by
  `mini-apps-user-facing` (prose says mini-app, code keeps `add_app`,
  `list_apps`, `get_app_state`; skill path
  `package:kody-os#.agents/skills/adding-an-app/SKILL.md`,
  validate-before-write, verify with `list_apps` / `get_app_state`).
  No copy button and no Clipboard API anywhere in the new markup.
- [x] 2.4 Keep the existing empty-state behaviour around the help text:
  the Mini-apps page responds 200, shows no Edit button with no mini-apps
  installed, and the section head ("Mini-apps") stays.
- [x] 2.5 Home, no mini-apps installed: render the same help as the Mini-apps
  page — same intro, same two prompts — from the same shared shell
  block, not a second copy. The intro is: "No mini-apps installed yet.
  This shell starts empty — nothing is installed until you add it.
  Pick a path below. Copy a prompt into a Kody-connected agent."
  The help text also carries the glossary line from
  `mini-apps-user-facing` (Help may not be installed): "A mini-app is
  an installed app: in the browser it is called a mini-app, and agents
  call it an app (`add_app`, `list_apps`)."
- [x] 2.6 Home, mini-apps installed but none on Home: render the short
  message "No widgets yet. You have mini-apps installed — add some to Home
  from the Mini-apps page. Open Mini-apps, tap Edit, and use Add to home on a
  row. They appear here live with no republish." Wording is "Add to
  home", not "pin". `renderDashboard` (`pkg/src/apps/client.ts`)
  currently only receives the widget list, so the shell must pass
  whether any mini-apps exist (from `list_apps` / homepage in
  `dashboardBody`, `pkg/src/app.ts`) for it to pick the right state.
  DONE 2026-11-06: short 'No widgets yet' Add-to-home message exact; harness asserts it appears with mini-apps installed but none on Home, and the two install prompts do not appear.
  DONE 2026-11-06: renderDashboard(widgets, appBasePath, hasApps) renders the same renderEmptyHelp block; harness asserts Home contains it and that Home and Mini-apps render the same block.
  DONE 2026-11-06: empty branch responds 200 with section head 'Mini-apps'; the Edit link only renders when apps exist (renderAllSection editAvailable flag; the empty branch never calls it) — code-read leg; HTTP leg open (see 4.1).
  DONE 2026-11-06: Prompt 2 reuses Help's wording as rewritten by mini-apps-user-facing; store-harness prompt-sync check asserts agreement (skill path, add_app instruction, 'Mini-app id' label). No copy button, no Clipboard API.
  DONE 2026-11-06: Prompt 1 agent-only (install_from_catalog('app-store'), verified with list_apps); no browser install path named in the copy.
  DONE 2026-11-06: empty branch replaced with the shared renderEmptyHelp block (pkg/src/apps/client.ts), exact approved copy, gate-hint code blocks, no new bundle CSS, no copy button, no Clipboard API.
## 3. Tests

- [x] 3.1 Registry tests: a blank store stays empty across shell
  requests; removing the last mini-app (including the Mini-App Store, via
  `remove_app` and via `manage_remove` with confirmation) leaves the
  registry empty on the next shell request — no re-seed.
- [x] 3.2 Mini-apps-page tests: with no mini-apps installed the page contains both
  prompts (Install Mini-App Store; add your own mini-apps), contains no copy
  button and no `navigator.clipboard` reference, and still shows no
  Edit button. Home-page tests: with no mini-apps installed Home contains
  the same two prompts; with mini-apps installed but none on Home it
  contains the short Add-to-home message and not the two prompts.
- [x] 3.3 Prompt-sync check: the empty-page add prompt contains the
  same skill path and `add_app` instruction as the Help app's prompt,
  so the two copies cannot silently diverge, and both use mini-app
  wording in prose per `mini-apps-user-facing`. The Home no-apps help and
  the Mini-apps no-apps help are the same shared block, so a test asserts
  Home and Mini-apps render the same prompt text.
- [x] 3.4 Run the catalog harness and the store harness; record any
  failures that assume seeding and fix or explicitly note them (do not
  silently drop a failing check).
  DONE 2026-11-06: catalog harness ALL PASSED (20 apps); store harness ALL PASSED. agent-tools harness 1 FAIL — 'list_catalog returns 16 apps — got 20' — verified identical on a clean checkout of c1da8cb (git worktree), pre-existing, not caused by this change.
  DONE 2026-11-06: store-harness prompt-sync check (Help vs empty help: same skill path, add_app instruction, 'Mini-app id' label) + same-block check (Home rendering contains renderEmptyHelp output).
  DONE 2026-11-06: store-harness checks — both prompts present, no copy button, no navigator.clipboard, Home same prompts, short-message case; Edit-button absence is the code-read leg in 2.4.
  DONE 2026-11-06: store-harness checks — blank stays empty; remove-last via remove_app and via manage_remove (confirmed) leaves the registry empty, no re-seed.
## 4. Mock-dev empty verification

- [ ] 4.1 Stop `kody dev` first (a running preview serves its mock store
  from memory and can overwrite a file write), wipe the mock store to
  empty, restart dev, and confirm: the Mini-apps page shows the help text
  with both prompts, and Home shows the same help text (not just its
  honest no-widgets state).
  OPEN 2026-11-06: kody dev cannot run in this VM (no kody CLI) — mock-dev verification substituted by the harness render checks; the live mock-store leg stays open for the PC/user.
- [ ] 4.2 Follow Prompt 1 from the empty Mini-apps page via an agent
  (`install_from_catalog('app-store')`, verified with `list_apps`),
  confirm the Mini-App Store lists catalog mini-apps; then remove the Store as the
  only mini-app and confirm the Mini-apps page is empty again with the help text
  (no resurrection), and Home shows the same help again.
  OPEN 2026-11-06: same as 4.1 — Prompt 1 follow-through and remove-the-only-mini-app resurrection check need mock-dev or hosted; harness covers the registry leg only.
- [ ] 4.3 Follow Prompt 2 at least once end-to-end (agent `add_app` of a
  small catalog mini-app, e.g. counter) and confirm it appears on the Mini-apps
  page. Then, with that mini-app installed but not on Home, confirm Home
  shows the short Add-to-home message; add it to Home via Mini-apps Edit
  and confirm its widget appears. No visual check on a real
  browser/Scribe is claimed from command output alone — that check
  stays open for the user.
  OPEN 2026-11-06: same as 4.1 — Prompt 2 end-to-end and the Home Add-to-home flow need mock-dev; no visual check on a real browser/Scribe is claimed from command output alone.

## 5. Docs, specs, and version

- [x] 5.1 Update `pkg/docs/setup.md` (and the setup sections of
  `pkg/README.md`) to describe the empty install, the Mini-apps-page
  help text, and the two Home empty states, using mini-app wording for
  user-facing prose per `mini-apps-user-facing`; check the result against
  `openspec/changes/
  bootstrap-after-fork` so the two changes agree on what empty means
  (that change is docs-only and pending — flag any conflict to the
  user rather than silently rewriting its decisions).
- [x] 5.2 Sync the canonical specs: `openspec/specs/shell` and
  `openspec/specs/app-registry` per this change's spec deltas, and
  `openspec/specs/setup-guide` for the new documented empty state.
  Record the version decision in the implementation commit (MINOR
  recommended, MAJOR defensible — see design.md Open Questions) and
  bump `pkg/package.json` plus the `pkg/AGENTS.md` and `pkg/README.md`
  headers in the same commit, per the version policy; build +1 on
  publish. No task in this file commits, pushes, or publishes anything
  except the spec commit itself, which is outside this change's
  implementation scope.
  DONE 2026-11-06: canonical shell/app-registry/setup-guide synced by hand from the deltas (see archive note for the validate interaction). Version 2.8.0 MINOR (highest of empty-install MINOR + mini-apps PATCH), build stays 32 (build +1 on publish only); pkg/package.json + pkg/AGENTS.md + pkg/README.md headers updated in the same uncommitted working tree — no commit, push, or publish, per direction.
  DONE 2026-11-06: pkg/docs/setup.md + pkg/README.md updated (empty install, help text, two Home states, mini-app wording). bootstrap-after-fork checked: its design.md premise 'today the shell auto-seeds' is now false (flagged in the archive note); its setup-guide delta ('NOT be presented as shell seeding') still agrees with the new behavior.
