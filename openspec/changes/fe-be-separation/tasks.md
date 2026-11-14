# Tasks

## 1. Audit the current mixing

- [x] 1.1 List every file under `pkg/src/` as FE (runs in the
      browser) or BE (runs on Kody), and record the audit in the
      design (Decision 3's table) if it differs from what is
      already there. (Done in the design's Context table,
      verified against main `ecef0f7`; the post-change layout is
      in Decision 3.)
- [x] 1.2 List every HTML-string-building site: `shellChrome` in
      `app.ts`, and every `render*` / `tile*` function in
      `apps/client.ts`. Record the list in the design if it
      differs from Decision 1. (Done — the design's Context
      names them; the renderers stay in the BE as
      `apps/render.ts` per the revised Decision 1.)

## 2. Each component in its own JS file — DROPPED

SUPERSEDED 2026-11-14 (user direction: "You dont have to
create component for every peice of code. Use best practices
for organizing FE. Treat it as if the FE may eventually be run
on a different BE."). The component-per-file approach was
implemented 2026-11-13 evening (15 files under
`pkg/src/client/components/`, `apps/client.ts` as a re-export
barrel, `allowJs` in the tsconfig) and verified byte-identical,
then REVERTED the same evening at the user's direction
("Revert the renderer split, keep only the custom-element
split"). It is now dropped, not deferred: the FE is organized
by concern (Decision 1), and the HTML text stays in the BE
renderers. The boxes below are left as they were (checked)
as the record of the reverted implementation; they are not
work to redo.

- [x] 2.1 Move `shellChrome` (`app.ts:290`) to
      `pkg/src/client/components/shell-chrome.js`, exporting a
      render function (opts → HTML string). `app.ts` imports and
      calls it; no HTML string concatenation remains in `app.ts`.
      Add `"allowJs": true` to `pkg/tsconfig.json` so the TS BE
      can import the JS component files (`checkJs` stays off;
      JSDoc carries the signatures).
- [x] 2.2 Move each app-section renderer from `apps/client.ts`
      to its own JS file under `pkg/src/client/components/`
      (`app-section.js`, `app-panel.js`, `overlay-section.js`,
      `pinned-section.js`, `recent-section.js`, `tiles.js`,
      `bundle-content.js`, `state-seed.js`, `edit-section.js`,
      `all-section.js`, `widget-section.js`, `empty-help.js`,
      plus `helpers.js` for the shared helpers). Each exports
      its render function(s); the render module imports and calls
      them. No HTML string concatenation remains in the render
      module.
- [x] 2.3 Verify byte-identical served output: capture the served
      pages from `kody dev` (Home, an app page, the App Store,
      Help, About, the Apps list) BEFORE the split and diff
      them AFTER. The diff must be empty. A difference is a defect
      in the split, not a baseline to update.

## 3. Rename and move

- [x] 3.1 Rename `apps/client.ts` to `apps/render.ts`. Exported
      function names stay the same. Update all imports in
      `app.ts` and anywhere else that references the path.
      (Done 2026-11-14: `git mv`, dynamic import in `app.ts:523`
      and the re-export in `apps/index.ts:110` updated, plus
      `INTEGRATION.md`, `shell-pages.ts`, and the SKILL.md.)
- [x] 3.2 Move `pkg/src/bridge/bridge.js` to
      `pkg/src/client/bridge.js`. Update every reference in the
      same change: the shell client module, the adding-an-app
      SKILL.md, the bundle harnesses, and any doc that names the
      path. The bridge's exports and behavior do not change.
      Remove the now-empty `pkg/src/bridge/` directory. The
      Counter bundle comment naming the bridge path is updated
      too (comment-only change; its `catalogVersion` bumps by
      the catalog rule and the catalog index is regenerated).
      (Done 2026-11-14: `git mv`, `index.ts` import + comment,
      SKILL.md, Counter bundle comment, `counter-tests.cjs`,
      `link-drop-dom-tests.cjs`, `hoodie-tests.cjs`,
      `home-widget-counter.cjs`, `isolation-demo.cjs`; Counter
      `catalogVersion` 6→7; `bun scripts/build-catalog-index.ts`
      regenerated `catalog.json` (19 apps); `pkg/src/bridge/`
      removed. A bridge.js doc comment was reworded to drop the
      literal `packageStorage` so the boundary grep stays clean.)
- [x] 3.3 Update the adding-an-app SKILL.md and any harness/doc
      that references the old paths (`apps/client.ts`,
      `pkg/src/bridge/bridge.js`). (Done 2026-11-14: SKILL.md
      `apps/render.ts` + `pkg/src/client/bridge.js`; the
      `styles.css` comment + regenerated `shell-css.ts`; the
      plugins `definition.md` paths. Archived changes were NOT
      rewritten (historical record); the active `apps-search`
      change still names the old path and is out of scope here.)

## 4. Boundary rule and FE/BE contract

- [x] 4.1 Record the boundary rule in `pkg/AGENTS.md` (canonical
      package-behavior doc) and in the adding-an-app SKILL.md's
      provided-surface section: FE code lives in `pkg/src/client/`,
      BE code lives in `pkg/src/` outside `client/`, and no FE
      module imports a BE module (no `packageStorage`, no
      registry, no server types). (Done 2026-11-14: new
      "Frontend / backend boundary (FE/BE)" section in
      `pkg/AGENTS.md`; a short FE/BE boundary paragraph in the
      SKILL.md's bridge section.)
- [x] 4.2 Record the FE/BE contract in `pkg/AGENTS.md` alongside
      the boundary rule: the bridge (`window.KodyBridge`), the
      JSON state seed, the action URLs (`data-action-base`, GET
      forms), and the `data-*` attributes the FE reads
      (`data-app-id`, `data-field`, `data-client-module`). A
      different BE could serve the same FE as long as it honors
      that contract. (Done 2026-11-14, same AGENTS.md section.)
- [x] 4.3 Verify the boundary by grep at implementation time: no
      file under `pkg/src/client/` contains `packageStorage`,
      `from '../apps/`, `from '../index`, or `from '../app'`.
      Record the grep result in the close-out note. (Done
      2026-11-14: grep empty. One hit was a doc comment in
      `bridge.js` mentioning `packageStorage`; reworded to
      "server-side" so the grep stays clean. No live-code or
      live-doc reference to the old paths remains.)

## 5. Verification

- [x] 5.1 Typecheck clean (`cd pkg && bun run typecheck`,
      exit 0). (Done 2026-11-14: `bunx` is not on the VM's
      PATH, so the equivalent `bun x --package
      typescript@5.9.3 tsc --noEmit` was run; exit 0. One error
      surfaced during the run — the re-export in
      `apps/index.ts:110` still named `./client.ts` — and was
      fixed to `./render.ts`; the re-run is exit 0.)
- [x] 5.2 All harnesses green: counter-tests, link-drop-tests,
      link-drop-dom-tests, lit-isolation, catalog harness (19
      apps), store harness. Record any failure and whether it is
      pre-existing (verify "pre-existing" on a clean checkout of
      the base before saying so). (Done 2026-11-14: typecheck 0;
      counter ALL PASSED; link-drop ALL PASSED; link-drop-dom
      ALL PASSED; lit-isolation 6/6 ALL PASSED; isolation-demo
      ALL PASSED; catalog harness ALL PASSED (19 apps); store
      harness ALL PASSED. Two failures are PRE-EXISTING,
      verified on a clean worktree of the base
      (`origin/shell-islands`, 53dec25): hoodie-tests fails "no
      external href references" (the hoodie-weather bundle links
      to its GitHub repo) and home-widget-counter fails ENOENT
      (stale `pkg/catalog/` path — the catalog moved to the repo
      root). Neither is caused by this change. jsdom is not
      installed on the VM; it was installed ephemerally to
      `/tmp/jsdom-test` for this run.)
- [ ] 5.3 `openspec validate` passes for this change
      (`✓ change/fe-be-separation`). This change carries
      `skip_specs: true` (pure refactor, no canonical requirement
      changes). (NOT RUN 2026-11-14: the `openspec` CLI is not
      on the VM — it lives on the PC
      (`/home/jmh/.nvm/versions/node/v24.16.0/bin/openspec`) and
      be-quite-900 was offline. Run it on the PC before
      archiving.)
- [x] 5.4 Version: PATCH by the package policy (internal refactor,
      no observable change). The bump lands in the implementation
      commit, with `pkg/AGENTS.md` header updated in the same
      commit; build +1 on publish. (Done 2026-11-14: 4.3.0 →
      4.3.1 in `pkg/package.json` and the `pkg/AGENTS.md`
      header; build stays 49, +1 on publish. This PATCH also
      covers the relative client-module URL fix from
      shell-islands, which was uncommitted on the same branch.
      The `tests/store-harness.ts` version expectation was
      updated 4.3.0 → 4.3.1. `pkg/README.md` states no version,
      so nothing to update there.)

## 6. Close-out

- [x] 6.1 Append a close-out note to this `tasks.md` recording
      what was verified, what was substituted, and what was left
      open, before archiving.

Close-out (2026-11-14, Tessa, in the VM on the `shell-islands`
branch pulled from origin 53dec25): the fe-be-separation spec
was revised to the user's direction — organize the FE by
concern, treat it as if it may run on a different BE — and the
component-per-file approach (section 2) is dropped, not
deferred. Implemented: `apps/client.ts` → `apps/render.ts`
(dynamic import in `app.ts`, re-export in `apps/index.ts`,
INTEGRATION.md, shell-pages.ts, SKILL.md); `pkg/src/bridge/bridge.js`
→ `pkg/src/client/bridge.js` (client import + comment, SKILL.md,
Counter bundle comment, five harnesses, plugins definition.md;
`pkg/src/bridge/` removed); the boundary rule + FE/BE contract
recorded in `pkg/AGENTS.md` (new section) and the SKILL.md's
bridge section; the boundary grep is empty; Counter
`catalogVersion` 6→7 with the catalog index regenerated (19
apps); version PATCH 4.3.0 → 4.3.1 (also covers the shell-islands
relative-URL fix on the same branch), build stays 49. Verified:
typecheck exit 0 (via `bun x`, since `bunx` is not on the VM);
counter, link-drop, link-drop-dom, lit-isolation (6/6),
isolation-demo, catalog (19 apps), and store harnesses all
green. Two failures are pre-existing (verified on a clean
worktree of the base): hoodie-tests ("no external href
references" — the bundle links to GitHub) and
home-widget-counter (stale `pkg/catalog/` path). Substituted:
`bun x` for `bunx`; jsdom installed ephemerally to
`/tmp/jsdom-test` (not on the VM). Left open: `openspec
validate` (5.3) — the CLI is not on the VM and be-quite-900 was
offline; run it on the PC before archiving. Nothing is
committed, pushed, or published — those are separate stops
needing his direction. The active `apps-search` change still
names `apps/client.ts` and is out of scope here.

Prep close-out (2026-11-13 evening, user-directed): the component split is done and verified. Each UI component is now its own JS file under pkg/src/client/components/ (15 files: helpers, shell-chrome, app-section, app-panel, overlay-section, pinned-section, recent-section, tiles, bundle-content, state-seed, edit-section, all-section, widget-section, empty-help, dashboard), and apps/client.ts is a thin re-export barrel so existing importers do not change. The BE imports the JS files (tsconfig gains allowJs; checkJs stays off). Verification: typecheck exit 0; counter, link-drop, link-drop-dom, catalog (19 apps), and store harnesses all green; served output byte-identical to the pre-split baseline except the live clock timestamp (expected — the time advanced). One pre-existing staleness fixed alongside: the store harness hardcoded the running version as 4.2.2 while the tree is 4.3.0 (shell-islands MINOR bump); updated to 4.3.0. Remaining in this change (NOT done): the apps/client.ts -> apps/render.ts rename, the bridge move, the boundary rule, and the PATCH version bump.

SUPERSEDED 2026-11-13 ~22:07 MST: the component split above was REVERTED at the user's direction ("Revert the renderer split, keep only the custom-element split"). The 15 component files were deleted, apps/client.ts / app.ts / tsconfig.json were restored from git HEAD, and the store-harness 4.3.0 fix was kept. The spec's section 2 is now marked DROPPED (2026-11-14, user direction: organize the FE by concern, treat it as if it may run on a different BE). The remaining work is the rename (3.1), the bridge move (3.2), reference updates (3.3), the boundary rule + FE/BE contract (4.1–4.3), verification (5.x), and the PATCH version bump.
