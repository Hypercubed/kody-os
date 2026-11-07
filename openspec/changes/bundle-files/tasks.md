# Tasks: Bundle files on disk

## 1. Loader and validation

- [ ] 1.1 Probe the Kody bundler for text imports: in the mock/dev environment, import a `.html` file as text (`import x from "<path>" with { type: "text" }`) and confirm the content arrives. Record pass or fail in the design (Decision 4). If it fails, switch to the generator-emitted assembly module fallback.
- [ ] 1.2 `pkg/src/apps/types.ts`: `BundleManifest.files` becomes `Record<string, string> | string[]` (inline files map or manifest file list). Document the two forms and that a definition carrying both is an error.
- [ ] 1.3 `pkg/src/apps/registry.ts`: add the assembler — given a definition and a file reader, resolve a manifest list to the runtime files map; a missing file is an error; a definition carrying both forms is an error.
- [ ] 1.4 `pkg/src/apps/registry.ts`: extend `validateBundleManifest` to the manifest form and add reference validation — every `<script src>` / `<link rel="stylesheet" href>` reference resolves to a manifest file; every `.js` / `.css` manifest file is referenced; references are bare relative paths matching manifest keys exactly; no attributes beyond `src` / `href` (and `rel` for link); no absolute or external URLs.
- [ ] 1.5 `pkg/src/apps/client.ts`: remove the append fallback from `renderBundleContent` — only referenced assets execute. Keep the render-time drop of dangling references as the fail-closed fallback for already-stored definitions.
- [ ] 1.6 Extend the ES2019 ceiling grep to on-disk `.js` files (same rule as inline bundle scripts: no `?.`, `??`, `replaceAll`, `.at(`).

## 2. Catalog tooling

- [ ] 2.1 `scripts/build-catalog-index.ts`: assemble each definition's bundle files from disk before fingerprinting; record `bundleFiles` (sorted, relative to the app directory) in each index entry; fail the build on a missing or unresolvable bundle file; keep output deterministic and byte-identical on re-run.
- [ ] 2.2 `pkg/src/apps/catalog.ts`: statically import each bundle file as text and assemble the files map at module load. The import list still enumerates apps alphabetically by id; a directory without an import entry is still not listed.
- [ ] 2.3 `tests/catalog-harness.ts`: extend check 1 (every app directory holds `definition.json` + `RECIPE.md` + `index.html`, and the manifest files are present on disk) and check 2 (index entries carry matching `bundleFiles`); extend check 4 (the assembled definition validates, installs via `add_app`, and its fingerprint equals the index fingerprint).
- [ ] 2.4 `tests/catalog-harness.ts`: add fixture checks that a dangling reference fails validation and that an unreferenced `.js` / `.css` file fails validation (fixture definitions, test-only, not catalog apps).

## 3. Migration

- [ ] 3.1 Write the extraction script (repo tooling, e.g. `scripts/extract-bundle-files.ts`): for each of the 18 catalog apps, write each inline bundle file to disk byte-identical, then rewrite `definition.json`'s bundle to the manifest form. The script verifies fingerprint equality per app (assembled post-migration fingerprint equals the pre-migration fingerprint) and fails the run on any mismatch.
- [ ] 3.2 Run the extraction over all 18 apps; regenerate the index (`bun scripts/build-catalog-index.ts`); the catalog harness passes with no `catalogVersion` bump for any app.
- [ ] 3.3 Verify the App Store renders with `store.js` / `store.css` inlined: install `app-store` in the mock instance and confirm the page renders and the Store works (the inliner output is unchanged in kind).
- [ ] 3.4 Verify a migrated single-file app (counter) renders identically in the mock instance.

## 4. Docs and skill

- [ ] 4.1 `pkg/.agents/skills/adding-an-app/SKILL.md`: rewrite the bundle contract for the two forms (manifest list + inline map), the reference contract, the flat layout, and the generator rule.
- [ ] 4.2 `pkg/catalog/README.md`: update the layout + import + harness checklist (index.html + optional files; generator rule; the extraction no-bump rule).
- [ ] 4.3 Check `pkg/README.md` for a bundle-shape quote; update it only if it shows the old inline-only shape.

## 5. Verification

- [ ] 5.1 Full harness suite on the PC: `bun tests/store-harness.ts`, `bun tests/catalog-harness.ts`, `bun tests/agent-tools-harness.ts`, `bun tests/open-mode-harness.ts`, `bun tests/owner-check-harness.ts`, `node pkg/catalog/tests/app-store-tests.cjs` — all pass except the known pre-existing agent-tools FAIL.
- [ ] 5.2 Mock-dev: install a migrated app via the empty-state prompt path; verify the page renders and the bundle JS runs.
- Removed Nov 6, 2026 per the no-release / no-generic-Scribe-verify rule: task 5.3 "Human-browser / Scribe check of a migrated app page" — a generic check naming no specific unknown behavior; the mock-instance checks 3.3, 3.4, and 5.2 cover the migration.
- [ ] 5.4 `npx --yes @fission-ai/openspec@latest validate bundle-files --type change` reports valid; `validate --changes` shows no new failures.

## 6. Version and archive

- [ ] 6.1 Version decision at the implementation commit (MINOR expected).
- [ ] 6.2 Reconcile with help-about-built-in if it archived first: its app-registry deltas touch "Catalog index" and "Catalog version" — whoever archives second reconciles the two deltas' texts against the then-current canonical spec.
- [ ] 6.3 Archive the change.
