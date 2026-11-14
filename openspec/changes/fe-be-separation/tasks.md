# Tasks

## 1. Audit the current mixing

- [ ] 1.1 List every file under `pkg/src/` as FE (runs in the
      browser) or BE (runs on Kody), and record the audit in the
      design (Decision 3's table) if it differs from what is
      already there.
- [ ] 1.2 List every HTML-string-building site: `shellChrome` in
      `app.ts`, and every `render*` / `tile*` function in
      `apps/client.ts`. Record the list in the design if it
      differs from Decision 1.

## 2. Each component in its own JS file

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

- [ ] 3.1 Rename `apps/client.ts` to `apps/render.ts`. Exported
      function names stay the same. Update all imports in
      `app.ts` and anywhere else that references the path.
- [ ] 3.2 Move `pkg/src/bridge/bridge.js` to
      `pkg/src/client/bridge.js`. Update every reference in the
      same change: the shell client module, the adding-an-app
      SKILL.md, the bundle harnesses, and any doc that names the
      path. The bridge's exports and behavior do not change.
- [ ] 3.3 Update the adding-an-app SKILL.md and any harness/doc
      that references the old paths (`apps/client.ts`,
      `pkg/src/bridge/bridge.js`).

## 4. Boundary rule

- [ ] 4.1 Record the boundary rule in `pkg/AGENTS.md` (canonical
      package-behavior doc) and in the adding-an-app SKILL.md's
      provided-surface section: FE code lives in `pkg/src/client/`,
      BE code lives in `pkg/src/` outside `client/`, and no FE
      module imports a BE module (no `packageStorage`, no
      registry, no server types).
- [ ] 4.2 Verify the boundary by grep at implementation time: no
      file under `pkg/src/client/` contains `packageStorage`,
      `from '../apps/`, `from '../index`, or `from '../app'`.
      Record the grep result in the close-out note.

## 5. Verification

- [ ] 5.1 Typecheck clean (`cd pkg && bun run typecheck`,
      exit 0).
- [ ] 5.2 All harnesses green: counter-tests, link-drop-tests,
      link-drop-dom-tests, lit-isolation, catalog harness (19
      apps), store harness. Record any failure and whether it is
      pre-existing (verify "pre-existing" on a clean checkout of
      the base before saying so).
- [ ] 5.3 `openspec validate` passes for this change
      (`✓ change/fe-be-separation`). This change carries
      `skip_specs: true` (pure refactor, no canonical requirement
      changes).
- [ ] 5.4 Version: PATCH by the package policy (internal refactor,
      no observable change). The bump lands in the implementation
      commit, with `pkg/AGENTS.md` header updated in the same
      commit; build +1 on publish.

## 6. Close-out

- [ ] 6.1 Append a close-out note to this `tasks.md` recording
      what was verified, what was substituted, and what was left
      open, before archiving.

Prep close-out (2026-11-13 evening, user-directed): the component split is done and verified. Each UI component is now its own JS file under pkg/src/client/components/ (15 files: helpers, shell-chrome, app-section, app-panel, overlay-section, pinned-section, recent-section, tiles, bundle-content, state-seed, edit-section, all-section, widget-section, empty-help, dashboard), and apps/client.ts is a thin re-export barrel so existing importers do not change. The BE imports the JS files (tsconfig gains allowJs; checkJs stays off). Verification: typecheck exit 0; counter, link-drop, link-drop-dom, catalog (19 apps), and store harnesses all green; served output byte-identical to the pre-split baseline except the live clock timestamp (expected — the time advanced). One pre-existing staleness fixed alongside: the store harness hardcoded the running version as 4.2.2 while the tree is 4.3.0 (shell-islands MINOR bump); updated to 4.3.0. Remaining in this change (NOT done): the apps/client.ts -> apps/render.ts rename, the bridge move, the boundary rule, and the PATCH version bump.
