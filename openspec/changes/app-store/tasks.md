## 1. Catalog rename and module

- [ ] 1.1 Rename `pkg/examples/` to `pkg/catalog/` (bundles, `README.md`, `tests/`) and sweep every reference (`pkg/docs/adding-an-app.md`, `pkg/AGENTS.md`, `pkg/README.md`, authoring spec, counter harness header); verify with a repo-wide grep that no `examples/` path reference to the old directory remains
- [ ] 1.2 Add `pkg/src/apps/catalog.ts`: explicit per-file JSON imports (alphabetical by id), `list_catalog()` summaries (id, name, label, icon, category, description) and full-definition lookup for install; add a harness (bun, memory store) proving every catalog file validates via `validateDefinition` and installs via `add_app`, and that the import list matches the directory contents exactly
- [ ] 1.3 Review each catalog entry's label, description, and category as user-facing store copy (see design Open Question 5); change copy only, never bundle behavior, and re-run the task 1.2 harness after any copy change
- [ ] 1.4 Author `pkg/catalog/app-store.bundle.json` (id `app-store`, stateless, no actions, page placement, minimal descriptive bundle, sanitized icon per the existing icon rules) and prove it validates and installs via `add_app` in the task 1.2 harness

## 2. Seeding and install-from-catalog

- [ ] 2.1 Add the catalog install helper in the registry layer: look up the id in the catalog, install via the validated `add_app` path with no `resetState`, return `{ ok: false }` naming an unknown id with no write; verify unknown-id, fresh-install (state = `initial`), and re-install-preserves-state cases against a memory store
- [ ] 2.2 Add shell-dispatch seeding: on an authenticated shell request against an empty registry, install only the App Store app before routing, idempotently; verify a blank store opens with exactly the store installed, a non-empty store is untouched, and removing every app (store included) restores only the store on the next shell visit
- [ ] 2.3 Wire the install handling: `GET ?install=<id>` on the store page validates against the catalog, installs, and 303s back to the store page; unknown ids render the store page with an inline error and no write; install forms carry no `app-action` class (no client fast-path interception); verify install adds no pin, homepage entry, or recency entry for the installed app

## 3. Store page

- [ ] 3.1 Render the server-rendered catalog section on the App Store app page: one row per catalog app except `app-store` itself, in import-list order, showing icon, label, and description; not-yet-installed rows show an Install GET form, installed rows show Installed plus a link to the app; verify with no JavaScript (plain form + 303) and that the page keeps one `<style>` block and the ES2019 ceiling
- [ ] 3.2 Update shell copy: Help page gains the browser install path (App Store first, agent/`add_app` for custom apps), and the empty-registry hint no longer presents agent-only install as the only path; verify the honest empty state still renders if seeding fails

## 4. Docs and catalog rules

- [ ] 4.1 Rewrite `pkg/catalog/README.md` as the catalog rules: membership checklist (file + import line + README entry + harness pass), the trust rule (catalog bundles run with session authority), and `add_app` steps for agents; update `pkg/docs/adding-an-app.md` and `pkg/AGENTS.md` ("Adding an app": browser store install vs. agent registry write; catalog paths)
- [ ] 4.2 Apply the MINOR version bump in the same commit as the code (`0.1.7` → `0.2.0`, PATCH reset, `pkg/AGENTS.md` + `pkg/README.md` headers updated; BUILD +1 on publish) per `pkg/AGENTS.md`

## 5. Verification

- [ ] 5.1 Run the full change checks on `kody dev` (mock): blank store opens with only App Store; install every catalog app from the store page; each installed app acts, exports, and re-imports like any other app; remove the store via MCP and remove all apps to confirm the task 2.2 restore; `kody check --offline` passes
- [ ] 5.2 Confirm no other active change depends on the retired prebuilt-apps seeding behavior, no MCP surface change (no new export in `pkg/src/index.ts` `main()` list), and no storage-key or export-format change
