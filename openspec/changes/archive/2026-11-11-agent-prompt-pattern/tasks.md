# Agent prompt pattern - tasks

No task in this file commits, pushes, or publishes anything. No release/publish steps. No verify-on-Scribe task: the changed surfaces are the mock-verified Store page and `/help`, rendered in the same Chromium the Scribe uses. Leave every checkbox unchecked unless the user directs marking.

## 1. pkg/OPERATIONS.md (new file)

- [x] 1.1 Write `pkg/OPERATIONS.md` at the pkg root with the sections in the design (how to read, shared invariants, standalone path, Install, Update, Absorb, Overwrite, Restore, Remove, Add a new app). The Absorb steps move here verbatim from the current prompt text (`store.js:100-104`); the standalone path states the explicit-`catalogBase` rule and the public base plus the pinned-tag form.
- [x] 1.2 Confirm: the file names no package slug in its own text; the "Add a new app" section is only the pointer to `.agents/skills/adding-an-app/SKILL.md` (package-relative path); `adding-an-app` itself is untouched.
- [x] 1.3 Confirm the file is valid Markdown with no leftover template text, and that no other file references `STORE-OPERATIONS.md` (the name was superseded during design; the file is `OPERATIONS.md`).

## 2. Server: folder URL rename (remote-catalog.ts + registry.ts)

- [x] 2.1 In `pkg/src/apps/remote-catalog.ts`, extract the GitHub-raw parsing from `recipeUrlForBase` into a shared helper and add `folderUrlForBase(base, id)` as specified in the design; `recipeUrlForBase` keeps its exact behavior and stays exported.
- [x] 2.2 In `pkg/src/apps/registry.ts`, rename the `StoreRow.recipeUrl` field to `folderUrl` (doc comment rewritten), update the import, and set it in `buildStoreRows` as `folderUrl: catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) : undefined`. Confirm no remaining `recipeUrl` reference in `pkg/src` or the bundle.
- [x] 2.3 Confirm the manage API shape is unchanged apart from the field rename (no new field).

## 3. Store bundle one-liners (store.js)

- [x] 3.1 Rewrite `storeAgentPrompt(row)` (store.js:80-120) to the template in the design: the ops reference from a new `storePackageSlug()` helper (derived from `storeManageBase()`, fallback `kody-os`), the verb per status, and `row.folderUrl`. Delete the fallback Install wording (no `folderUrl` means no Install details).
- [x] 3.2 Remove the `if (!row.installed && row.installMode === 'recipe-only') { return null; }` early return so recipe-only not-installed rows gain the Install details. Keep the controls span ("Ask an agent to install via its recipe.", store.js:291) as-is.
- [x] 3.3 Confirm: the details element markup, summaries, `textContent` rule, and all controls are unchanged; no label or id text remains in any prompt; the Remove prompt no longer uses the bare id.


## 4. Help: renderEmptyHelp rewrite (client.ts)

- [x] 4.1 In `pkg/src/apps/client.ts`, rewrite `renderEmptyHelp(appBasePath, opts)` (client.ts:579): drop `void appBasePath`; derive the slug from `appBasePath` the same way (leading `/` stripped, first segment, fallback `kody-os`); rewrite the three gate-hints to the one-liners in the design (Add references the ops file with the Name / What-it-does operand; Remove keeps the `[app id]` operand; Install the App Catalog uses the hardcoded `main` tree URL for `app-store`). Intro and closing unchanged.
- [x] 4.2 Confirm: `/help` still omits the closing line and empty Home/Apps keep it (unchanged code path, `omitClosing`).

## 5. Tests

- [x] 5.1 Extend `catalog/tests/app-store-tests.cjs`: update the header comment and the `recipe-app` fixture row to `folderUrl`; assert each rendered details prompt is the one-liner (ops reference with `package:kody-os#OPERATIONS.md`, verb per status, folder URL, no label/id text, no `install_from_catalog` / `update_from_catalog` / `remove_app` naming); assert a recipe-only not-installed row now shows the Install details; assert a row without a `folderUrl` shows no Install details. (jsdom does not lay out; assert on rendered text and DOM structure. Use the ephemeral `/tmp/jsdom-test` fixture with jsdom 26.1.0 — jsdom 30.1.3 breaks the bundle tests under Bun.)
- [x] 5.2 Update the store-harness Help checks (`tests/store-harness.ts:294-303`) to the new one-liner wording (App Catalog prompt points at the app-store folder, not `RECIPE.md`; Add prompt references the ops file; the ordering/closing/no-copy-button checks stay). Do not redesign the harness.
- [x] 5.3 Run the bundle tests (`bun catalog/tests/app-store-tests.cjs`) and record the result.

## 6. Harnesses and typecheck

- [x] 6.1 Run the store harness (`bun tests/store-harness.ts`) and the catalog harness (`bun tests/catalog-harness.ts`); record the results. The two known pre-existing failures (store harness stale 4.1.3 version check; agent-tools harness 16-apps count) are not to be fixed here.
- [x] 6.2 Run the typecheck (`bun run typecheck` from `pkg/`; use the full bunx path if the scripted form fails with 127, as before) and record the result.


## 7. Mock verification (dev server, mock target)

- [x] 7.1 Install the v27 Store in the mock (stop `kody dev` first; `store_install_from_catalog('app-store', undefined, 'http://127.0.0.1:8899/catalog/')` via the kody CLI with `--allow-private-network`; verify on disk before restarting dev that the def is catalogVersion 27 and the snapshot matches the new catalog entry), restart dev, and confirm GET `/apps/app-store` serves the new bundle: every row's details is the one-liner with the `package:kody-os#OPERATIONS.md` reference and a folder URL; the Counter row (behind-modified) shows the Absorb one-liner.
- [x] 7.2 Fetch GET `/help` in the mock and confirm the three rewritten prompts (Add with Name / What-it-does, Remove with `[app id]`, Install the App Catalog with the app-store folder URL), all under the `package:kody-os#OPERATIONS.md` reference; intro and closing unchanged.
- [x] 7.3 Confirm the Counter row still reads behind-modified (unregressed) and the App Store row still reads modified-ahead (local v27 vs GitHub main v20); GET `/` and `/apps` list the installed apps with no empty state. Record the served page byte sizes and marker counts as the rendering proof. Do not click Restore on the App Store row (it would restore the GitHub v20 copy).
- [x] 7.4 Record the open Kody entity-resolution item's status: the design already records what was verified from Kody's docs; re-check only if a stronger source appears, otherwise leave it open as stated — the dynamic-slug implementation stands either way.

## 8. Versioning

- [x] 8.1 `catalog/app-store/definition.json`: catalogVersion 26 to 27.
- [x] 8.2 Regenerate `catalog/catalog.json` (`bun scripts/build-catalog-index.ts` from the repo root) and confirm only the app-store entry changed.
- [x] 8.3 Confirm: no other app's catalogVersion changed; `pkg/package.json` stays 4.2.0 / build 46 (no additional bump). Note: the counter 5 to 6 change in the same tree is a mock-only demo bump and must be reverted before any real commit; it is not part of this change.
