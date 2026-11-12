# Agent prompt pattern - design

## Context

Current texts (read from the branch before writing; do not trust memory):

- `storeAgentPrompt` (`catalog/app-store/store.js:80-120`) returns one prompt per row status: Install (two wordings — "Follow the recipe at <recipeUrl>" when the row carries one, else the bare `install_from_catalog` wording), Update (`update_from_catalog`), Absorb (the long multi-step prompt), Restore (`update_from_catalog`), Overwrite (`update_from_catalog`), Remove (`remove_app`, bare id). No details element on `needsNewerShell` / `needsNewerSchema` rows, on not-installed `recipe-only` rows (render shows only the controls span at `store.js:291`), or on `storage-only` / `storage-only-formerly` rows.
- `renderEmptyHelp` (`pkg/src/apps/client.ts:579`) renders three gate-hint prompts: "Add your own apps" (long, names `add_app` and the `adding-an-app` skill via `package:kody-os#…`), "Remove an app" (`remove_app` naming `[app id]`), "Install the App Catalog" (points at `catalog/app-store/RECIPE.md`). It takes `appBasePath` and voids it (`void appBasePath`); the help text contains no links.
- `StoreRow.recipeUrl` (`pkg/src/apps/registry.ts:1429`, set at `:1545` via `recipeUrlForBase(catalogBase, catalogEntry.recipePath)`) and `CatalogSummary.recipePath` (`pkg/src/apps/remote-catalog.ts:91,105`) are not documented in any canonical spec — the drift this change corrects. `recipeUrlForBase` (`remote-catalog.ts:197`) converts a GitHub raw base to the blob form; any other base yields the raw URL itself.
- `appBasePath` comes from the Kody runtime: `getPackageContext()` (`pkg/src/app.ts:158`) imports `kody:runtime` and returns `runtime.packageContext`; the fetch handler takes `str(context.appBasePath, '')` (`app.ts:1180`). It is the package's mount path (for example `/kody-os` hosted). The Store bundle already derives the same base client-side: `storeManageBase()` (`store.js:6-15`) reads `[data-action-base]` or the path up to `/apps/`.
- The `package:` entity form is documented in Kody's own search docs (crawled 2026-11-12): open one file with `package:{id}#<path>`; `{id}` is a saved-package UUID or a package name leaf, resolved for the signed-in user. The Help's existing `package:kody-os#…` reference already relies on this; the pattern extends it, it does not invent a new mechanism.


## Decisions

1. One file, `pkg/OPERATIONS.md`, at the pkg root. It is a plain document, not a skill (the prompts are its discovery path; no frontmatter, no skill search). It holds all store-operation details inline, one section per operation; no per-operation skills (see "Alternatives considered").
2. The Store and Help prompts share one template: `Read package:<slug>#OPERATIONS.md, then <verb> this app: <folder URL>` — entity form, not a GitHub blob URL (user's choice; the entity resolves inside the reader's own Kody account, to their fork, where a blob URL could not).
3. The folder URL, not the recipe file. The URL is the GitHub tree URL for the app's catalog folder, `https://github.com/<owner>/<repo>/tree/<ref>/catalog/<id>`, built from the resolved catalog base the same way `recipeUrlForBase` builds the recipe URL (same ref — a pinned tag lands in it instead of `main`). The operations file tells the agent the folder holds `RECIPE.md` and `definition.json`, and the folder's last segment is the app id.
4. The package slug is dynamic. It is derived at render time from the running package's own mount — server-side from `context.appBasePath`, bundle-side from `storeManageBase()` — stripped of a leading `/`, first segment, falling back to `kody-os` when no slug is derivable (empty base, root-mounted). The folder URLs were already dynamic (from the catalog base); only the entity's package name needed this. `pkg/package.json`'s `kody.id` is NOT a source: a fork copies it unchanged, so it cannot distinguish the fork.
5. No label or id text in any Store prompt. The folder URL identifies the app. This also fixes the Remove inconsistency (bare id vs `label (id)` elsewhere).
6. Recipe-only not-installed rows gain the Install details, like any other not-installed row. The controls span ("Ask an agent to install via its recipe.") stays: it is the controls column's explanation for why there is no Add button, and removing it would leave the column empty. The details element is the copyable prompt; the span is not a prompt.
7. The Help's App Catalog folder URL is the `main` tree URL for `app-store`, hardcoded in `renderEmptyHelp` exactly as today's RECIPE.md URL is hardcoded there. `renderEmptyHelp` has no catalog base to derive from; the Help names the public catalog, as it does today. A fork's consumer uses the Store rows (dynamic base) or an explicit base. The Help's ops reference, by contrast, IS dynamic (from `appBasePath`), so a fork's Help points at the fork's own OPERATIONS.md while naming the public app-store folder — same split as today, noted here rather than fixed.


## Mechanics

### pkg/OPERATIONS.md (new)

Header: what the file is (the operations runbook for an agent operating a kody-os install), how to read it (the folder URL's last segment is the app id; a catalog folder holds `RECIPE.md` and `definition.json`; the catalog base is the directory containing `catalog.json`; references of the form `package:<slug>#…` use the reader's own package slug, rendered by the prompt — the file itself names no slug). It names no package slug in its own text.

Shared invariants (stated once, apply to every operation): ask the user before writing when anything is missing or ambiguous; never publish or change the package source; verify after every write (`list_apps`, and `export_app` where the operation writes a definition); state for surviving fields carries forward on definition replacement, dropped fields reset to `initial`.

Standalone path (no App Store installed): these operations are package MCP functions; the Store is only one UI that renders prompts for them. The catalog base rules: an explicit `catalogBase` parameter wins; with none, the installed Store's declared base is used; with neither, the call is refused with a no-catalog-source error naming the app id and writes nothing. So with no Store installed, pass the base explicitly. The public catalog base is `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`; a pinned tag replaces `main` with the tag. Prefer the `store_*` variants below for Store-managed installs and updates: they record the install snapshot that makes rows read up-to-date; the plain `install_from_catalog` / `update_from_catalog` do not record snapshots.

Sections, one per operation, each naming the exact call, its inputs, and its verification:
- Install: follow the recipe (`RECIPE.md` in the folder), or call `store_install_from_catalog(id, undefined, catalogBase)`; `install_from_catalog(id, undefined, catalogBase)` is the generic form without a snapshot. Verify with `list_apps` (and `get_app_state`). Recipe-only apps have no JSON install path: follow the recipe. Ask before installing if any detail is missing or ambiguous.
- Update: `store_update_from_catalog(id, undefined, catalogBase)`; `update_from_catalog(id)` takes no base parameter — it resolves the installed Store's declared base and refuses without one. Verify by exporting / `list_apps`.

- Absorb: the steps move here verbatim from the current prompt: take a `backup` first with `backup(name)` so the absorb can be undone; read the installed definition with `export_app(id)` and the catalog definition with `get_catalog_definition(id, catalogBase?)`; compare the two field by field, keep local customizations and take the catalog changes; show the merge plan (every field kept, taken, and in conflict) and ask before writing anything, and ask which value to keep for any field in conflict; then write the merged definition with `absorb_from_catalog(id, definition, catalogBase?)` at the catalog version; verify afterwards by exporting the app again and confirming the stored definition matches the merged one. Refusals (unchanged): the app must be installed, in the catalog, with status `behind-modified`, `modified-current`, or `absorbed-behind`; the merged definition's `catalogVersion` must equal the catalog's.
- Overwrite: `store_update_from_catalog(id, undefined, catalogBase)` with an explicit confirmation — it discards local definition changes. Export first if keeping them. Same call as Update; the difference is confirmation and the row's status.
- Restore: same call as Update/Overwrite (`store_update_from_catalog` with an explicit base, or `update_from_catalog` when a Store is installed). It restores the catalog copy; export first if keeping local edits; ask first.
- Remove: `remove_app(id)` — deletes the definition, state, registry entry, install snapshot, and pinned/hidden/recent/homepage references. Verify with `list_apps`. Ask before removing if anything is missing or ambiguous.
- Add a new app: ONLY a pointer, no procedure. Adding a brand-new app is authoring, not a store operation: follow the adding-an-app skill in this same package (`.agents/skills/adding-an-app/SKILL.md`). The path is relative to the package root, so it follows forks and renames; a static file cannot compute the slug, so it must not name one.


### Server: rename recipeUrl to folderUrl

- `pkg/src/apps/remote-catalog.ts`: extract the GitHub-raw parsing out of `recipeUrlForBase` into a small shared helper (returns `{ owner, repo, ref, tail }` or null); `recipeUrlForBase` keeps its exact behavior on top of it. Add a sibling `folderUrlForBase(base, id)`: for a GitHub raw base, `https://github.com/<owner>/<repo>/tree/<ref>/<tail><id>` (with `<tail>` the path after the ref, for example `catalog/`); for any other base, `base + id + '/'` (the same fallback shape as `recipeUrlForBase` — a loopback folder URL is not a browsable listing, noted, not fixed). `recipeUrlForBase` stays exported and unchanged; deleting an export is out of scope.
- `pkg/src/apps/registry.ts`: `StoreRow.recipeUrl` becomes `StoreRow.folderUrl` (doc comment rewritten: the app's catalog folder URL in GitHub tree form, set when the row came from a catalog entry). `buildStoreRows` sets it as `folderUrl: catalogEntry ? folderUrlForBase(catalogBase, catalogEntry.id) : undefined`. Every valid catalog entry carries a `recipePath` (manifest validation requires it), so dropping the `recipePath` gate changes no row in practice; the folder exists for every entry regardless.
- No change to the manage API shape: the rows payload carries `folderUrl` in place of `recipeUrl`; no new field.

### Store bundle: one-liners and the dynamic slug

- `catalog/app-store/store.js`: `storeAgentPrompt(row)` is rewritten to the template. It takes the ops reference from a new `storePackageSlug()` helper: `storeManageBase()` with a leading `/` stripped, first segment, falling back to `kody-os` when empty (in the mock the base is empty, so the mock renders `package:kody-os#OPERATIONS.md`). The prompts are built as `'Read package:' + slug + '#OPERATIONS.md, then <verb> this app: ' + row.folderUrl`. The fallback Install wording (no folder URL) is deleted with the field: a row without a `folderUrl` (no catalog entry) shows no Install details, as no-details rows do today.
- The details element markup, the summaries, the `textContent` rule, and the controls (including the recipe-only span) are unchanged.


### Help: renderEmptyHelp rewritten

- `pkg/src/apps/client.ts`: `renderEmptyHelp(appBasePath, opts)` drops `void appBasePath` and derives the slug from it the same way (`appBasePath` stripped of a leading `/`, first segment, fallback `kody-os`). The three gate-hints become the one-liners; the intro and closing are unchanged. The App Catalog folder URL is the hardcoded `main` tree URL for `app-store` (see Decision 7).

## Versioning

App Store 26 to 27. `pkg/package.json` stays 4.2.0 / build 46 (the Help text, the new pkg file, and the `pkg/src` changes are MINOR-grade but fold into the pending 4.2.0). The counter v6 demo bump is unrelated and must be reverted before any real commit.

## Open verification items

- Kody `package:` entity resolution (verified as far as this environment allows; remains open). Verified from Kody's own search docs (crawled 2026-11-12): open one file with `package:{id}#<path>`; `{id}` is a saved-package UUID or a package name leaf, resolved "for the signed-in user". Not verified: whether two users' packages with the same leaf collide, and whether an `@owner/leaf` entity form is accepted (that form appears in the search query description, not in the entity description). The dynamic slug is correct under the documented model — a fork's leaf differs, so it resolves to the fork for the signed-in user — and the fallback keeps today's behavior when no slug is derivable. If the resolution turns out to need an owner, the owner is derivable from the request host; that is a follow-up, not a blocker.
- Hosted `packageStorage().list()` shape: unchanged from the list-shape change (handled by the both-shapes design, never verified live).


## Alternatives considered

- Per-operation skills with the ops file holding pointers: rejected. Five of the six operations are two or three lines; only Absorb has a real procedure. Six skill files would be mostly scaffolding, the prompts already select the operation (discoverability is not the bottleneck), and the shared invariants would duplicate or strand in the index. If one operation later grows complex on its own, split that one out then.
- Merging operations into `adding-an-app`: rejected. That file is 476 lines of authoring contract; the operations would make it ~600 lines and the small operations would become expensive reads. Authoring and operating are different tasks in different moments.
- Blob URL for the ops reference: rejected as the primary form (user's choice). The entity resolves inside the reader's own Kody account; a blob URL names the Hypercubed repo and cannot follow a fork.

## Out of scope

- Status derivation, the button mapping, row layout, badge text, the caret, the confirm dialog, Update All.
- `adding-an-app` (only pointed at), the recipe files, the catalog manifest, the store harnesses' behavior (their Help/prompt checks are updated to the new wording, not redesigned).
- The shell spec's "two copy-paste prompts" wording (pre-existing: the shared help text has three prompts; the shell spec says two). Noted, not fixed here.
