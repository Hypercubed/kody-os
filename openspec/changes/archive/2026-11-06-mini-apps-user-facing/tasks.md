> ARCHIVED 2026-11-06: implemented in the VM (uncommitted working tree, no commit/push/publish); deltas synced by hand into canonical openspec/specs/shell, app-registry, and setup-guide. Verified: store harness ALL PASSED, catalog harness ALL PASSED (20 apps), app-store bundle tests ALL PASSED under node, bun build clean; re-grep after edits shows no user-facing bare 'app' outside the §1.2 allowlist; diff contains no internal rename. Substituted: kody dev cannot run in this VM (no kody CLI) — the human-browser/Scribe visual check stays open for the user (§4.2). Note: the delta's 'Home empty hint says mini-apps' scenario was superseded by empty-install's two-state Home rendering and was NOT carried into the canonical shell spec (recorded in the sync note there). Deviation 2026-11-06 (user-directed, after archiving): the top menu bar link now reads "Apps" instead of "Mini-apps" — a short label for the bar; the Mini-apps page title, sections, and all other surfaces stay mini-app. Canonical shell spec updated to match. REVERSED 2026-11-06 (user decision): the user-facing term is now plain 'Apps', not 'mini-app' — the mini-app wording in this archived change is superseded; this change is kept as a record of the decision and implementation it documents. CLOSED AS OBE 2026-11-06 (user direction): 'Apps' is the settled term; this change is closed and the mini-app wording is not to be revived. The replacement wording is implemented by the Apps rename on this same branch (uncommitted).

# Tasks

Phases land in order: 1, then 2, then 3, then 4. Each phase's
verification must pass before the next phase starts. No task in this
file commits, pushes, or publishes anything (see §4).

## 1. Audit the user-facing strings

- [x] 1.1 Grep the rendered output for the generic word "app"
  (case-insensitive, whole word) across `pkg/src/app.ts`,
  `pkg/src/apps/client.ts`, `pkg/catalog/*.bundle.json`,
  `pkg/docs/setup.md`, and `pkg/README.md`, and sort every hit
  into user-facing (Decision 1: a human reads it in the browser)
  or internal (code, MCP, route, storage key, type, skill,
  JSON error). Record the list before changing anything; the
  audit in design.md Context is the starting point, not a
  substitute for the grep.
- [x] 1.2 Confirm the allowlist: every hit that stays `app` must
  be one of — MCP export names, `/apps` routes and the `from`
  parameter, `kody-os.apps.*` storage keys, type/function names,
  the adding-an-app skill name/path/text, the export envelope
  `kody-os-app/2`, MCP JSON error text, the word "app" inside a
  Kody-app phrase ("my hosted kody-os app on Kody", "package
  app"), and the bare word inside code samples. Anything else
  that stays `app` in user-facing text is a miss, not an
  allowlist entry — flag it to the user rather than silently
  keeping it.
  DONE 2026-11-06: allowlist confirmed — remaining bare 'app' hits are MCP names, /apps routes, kody-os.apps.* keys, types, skill name/path/text, export envelope kody-os-app/2, MCP JSON errors, Kody-app phrases ('my hosted kody-os app on Kody', 'package app'), code samples, CSS classes, and comments, plus the glossary line's intentional 'an installed app' / 'agents call it an app'. One judgment call: Help's 'open the Settings app' became 'open the Settings mini-app' (not in the listed Help strings; revert if the user prefers the proper-name form).
  DONE 2026-11-06: grep across pkg/src/app.ts, pkg/src/apps/client.ts, pkg/catalog/*.bundle.json, pkg/docs/setup.md, pkg/README.md; hits sorted user-facing vs internal (design.md audit as starting point, re-grep after edits in 2.6).
## 2. Apply the display rename

- [x] 2.1 Shell chrome and pages (`pkg/src/app.ts`,
  `pkg/src/apps/client.ts`): menu "Mini-apps"; page title and
  section head "Mini-apps"; "All mini-apps"; "Edit mini-apps";
  "Back to Mini-apps"; "no mini-apps yet" (or the `empty-install`
  replacement text, if that change has landed first — see 2.5);
  the Apps empty hint; the Home dashboard empty hint ("Install
  mini-apps from the Mini-App Store…"); the Store fallback and
  "Install Mini-App Store" button; "Launcher management moved to
  Mini-apps Edit". Pinned and Recent headings do not change.
  Document titles follow the page word. No routing, state, or
  handler change in either file.
- [x] 2.2 Store bundle (`pkg/catalog/app-store.bundle.json`,
  catalogVersion +1): name, label, and `ui.title` become
  "Mini-App Store"; description, intro, no-JS note, loading /
  failure status, capability line, and confirm-dialog wording
  become mini-apps per design.md Draft copy. Id stays
  `app-store`; route and management calls are unchanged.
- [x] 2.3 Help bundle (`pkg/catalog/help.bundle.json`,
  catalogVersion +1): description, intro (including the one
  glossary line from design.md Decision 3), "Adding mini-apps"
  heading, add prompt (prose mini-app, code `add_app` /
  `list_apps` / `get_app_state`, field label "Mini-app id"),
  and closing line become mini-apps per design.md Draft copy.
  Id stays `help`. Final prompt wording is the user's call on
  the drafts in design.md — do not ship the drafts as approved
  copy without that review.
- [x] 2.4 Docs (`pkg/docs/setup.md`, `pkg/README.md`): user-facing
  prose becomes mini-apps per design.md Draft copy; code, MCP
  names, routes, and storage keys in those docs stay `app`.
  The adding-an-app skill does not change.
- [x] 2.5 Sync with `empty-install`, whichever order the two
  land in: if `empty-install` has landed, rewrite its Apps/Home
  empty-state prompts to mini-app wording per design.md
  Decision 6 and re-run its prompt-sync check; if it has not,
  record in this change's close-out note that its drafts must
  be written in mini-app wording when it lands. The two changes
  must not ship one saying "apps" and the other "mini-apps".
- [x] 2.6 Re-run the §1.1 grep after the edits: no user-facing
  "app" (whole word, case-insensitive) remains outside the §1.2
  allowlist. Record any remaining hit and why it is allowed.
  DONE 2026-11-06: re-grep after edits across the six files; remaining hits allowlisted per 1.2 (incl. the store.js and Help judgment calls noted there).
  DONE 2026-11-06: both changes landed together in one working tree; empty-install prompts written in mini-app wording; prompt-sync check passes.
  DONE 2026-11-06: pkg/docs/setup.md + pkg/README.md prose → mini-apps; code/MCP names/routes/storage keys stay app; adding-an-app skill unchanged.
  DONE 2026-11-06: help bundle 4→5; description, intro + glossary line, 'Adding mini-apps' heading, prompt (prose mini-app, code add_app/list_apps/get_app_state, 'Mini-app id' label), closing, setup-guide line. Id stays help.
  DONE 2026-11-06: app-store bundle 11→12; name/label/ui.title 'Mini-App Store', description/intro/no-JS note/status/capability line/confirm dialogs per draft copy (plus 'exported the app first' → 'exported the mini-app first', 2x in the confirm-loss wording, same rule). Id stays app-store; route and management calls unchanged.
  DONE 2026-11-06: shell renames applied (menu, titles, section heads, fallback, Edit, expand/collapse, launcher-error block). The delta's Home empty hint ('Install mini-apps from the Mini-App Store…') was superseded by empty-install's two-state rendering — the implemented Home states are the shared help block and the 'No widgets yet' Add-to-home message.
## 3. Tests

- [x] 3.1 Shell rendering tests: the menu, the Mini-apps page
  (title, section head, "All mini-apps", "Edit mini-apps"),
  the Home empty hint, and the Store fallback render
  "mini-app(s)" / "Mini-App Store" and contain no user-facing
  bare "app" outside the §1.2 allowlist. Update existing
  assertions that expect the old wording instead of deleting
  them; a deleted assertion hides a regression.
- [x] 3.2 Store harness and catalog harness pass
  (`bun tests/store-harness.ts`, `bun tests/catalog-harness.ts`
  from the repository root). The Help and App Store bundles
  validate with their new catalogVersions (help +1, app-store
  +1, no other bundle bumped). Record any failure that is not
  caused by this change and verify it on a clean checkout of
  the base commit before calling it pre-existing — do not wave
  failures through.
- [x] 3.3 Prompt-sync check: Help's add prompt and the
  `empty-install` add prompt (if that change is present) agree
  — same skill path, same `add_app` instruction, same
  "Mini-app id" field label — so the two copies cannot silently
  diverge. If `empty-install` is not present, the check asserts
  Help's prompt alone carries both words per design.md
  Decision 4.
- [x] 3.4 No internal rename leaked in: grep the diff for
  renames of MCP exports, routes, storage keys, type names, or
  the skill path. The diff must contain no `add_app` →
  `add_mini_app`, no `/apps` → `/mini-apps`, no
  `kody-os.apps.*` → `kody-os.mini-apps.*`. Any such rename is
  out of scope and must be reverted, not shipped.
  DONE 2026-11-06: git diff grep clean — no add_app→add_mini_app, no /apps→/mini-apps, no kody-os.apps.*→kody-os.mini-apps.*.
  DONE 2026-11-06: prompt-sync check in tests/store-harness.ts — Help's add prompt and the empty-install add prompt agree (same skill path, same add_app instruction, same 'Mini-app id' label).
  DONE 2026-11-06: store harness ALL PASSED; catalog harness ALL PASSED (20 apps). Help catalogVersion 5, app-store 12, no other bundle bumped (git diff pkg/catalog shows only the two bundles + app-store test expectations). agent-tools 1 pre-existing FAIL verified on a clean checkout of c1da8cb.
  DONE 2026-11-06: harness checks cover renderEmptyHelp/renderDashboard/renderHomeTiles and Help/Store bundle strings (node app-store tests); menu/title strings verified by code-read + grep audit — HTTP leg open (see 4.2).
## 4. Docs, specs, and version

- [x] 4.1 Sync the canonical specs: `openspec/specs/shell`,
  `openspec/specs/app-registry`, and `openspec/specs/setup-guide`
  per this change's spec deltas. Record the version decision in
  the implementation commit (PATCH recommended, MINOR if the
  reviewer disagrees — see design.md Open Questions) and bump
  `pkg/package.json` plus the `pkg/AGENTS.md` and `pkg/README.md`
  headers in the same commit, per the version policy; build +1
  on publish. No task in this file commits, pushes, or publishes
  anything except the spec commit itself, which is outside this
  change's implementation scope.
  DONE 2026-11-06: canonical shell/app-registry/setup-guide synced by hand from the deltas. Version 2.8.0 combined MINOR (the PATCH recommendation is superseded by empty-install's MINOR — highest bump wins); pkg/package.json + pkg/AGENTS.md + pkg/README.md headers updated, build stays 32. No commit, push, or publish, per direction.
- [ ] 4.2 Human-browser verification is the user's check, not a
  harness claim: the implementer must not claim a real-browser
  or Scribe visual check from command output alone. `kody dev`
  cannot run in this VM (no `kody` CLI here), so any mock-dev
  verification is recorded as substituted — by which harness,
  and why — or left open for the PC, per the repository
  AGENTS.md. That check stays open for the user.
  OPEN 2026-11-06: human-browser/Scribe visual check stays open for the user; kody dev cannot run in this VM (no kody CLI) — substituted by the store/catalog/app-store harnesses + bun build, per repo AGENTS.md. No real-browser or Scribe check is claimed from command output alone.
