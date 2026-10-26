## 1. Bundle manifest + validation

- [x] 1.1 Add the bundle definition type (`kind: 'bundle'`, manifest, file map) and verify operator-form definitions validate byte-identical to today
- [x] 1.2 Implement bundle validation (entry is `index.html`; path allowlist; no `..`/absolute paths; 256 KiB total cap) and verify oversized, path-escaping, and entryless bundles are rejected with no writes
- [x] 1.3 Verify `act()` on a bundle id returns a clear `{ ok:false }` error and changes nothing

## 2. Shell hosting

- [x] 2.1 Render bundle entry HTML inlined into the app panel/overlay at `GET /apps/:id` (bundle scripts/styles inlined, no external bundle assets) and verify operator app pages render unchanged
- [x] 2.2 Verify the shell chrome (title, nav, inlined theme, single `<style>`, no external links) is identical around bundle content, and the ES2019 ceiling holds for any shell-side hosting code
- [x] 2.3 Verify unknown ids still 404 and bundle fetch failures degrade to the server-rendered page, never a blank

## 3. Reference app + guide

- [x] 3.1 Ship the Magic 8-ball as the canonical bundle in `example-apps/eight-ball.bundle.json` (vanilla JS shake, no state, no MCP — replaces the 20-button operator hack) and verify add → open → shake updates the answer with no navigation on a capable browser
- [x] 3.2 Document the bundle contract in `pkg/docs/adding-an-app.md` (format, caps, Scribe JS posture, trust boundary, "toy with JS? bundle / shared validated state? operators") and verify the Kody file path opens post-publish
- [x] 3.3 Update the README prompt with the bundle path (when to reach for it) and verify `openspec validate` passes for the change
- [x] 3.4 Ship the clock as the second canonical bundle in `example-apps/clock.bundle.json` under the existing `clock` id (live ticking time, vanilla JS, ES2019, minute-granularity updates out of respect for e-ink refresh) and verify add → open shows advancing time with no navigation

## 5. Docs in package + templates frozen + examples

- [x] 5.1 Move the Scribe findings to `pkg/docs/scribe-limitations.md`, link it from `pkg/docs/adding-an-app.md`, `pkg/README.md`, and `pkg/AGENTS.md` by relative path, and verify every authoring link opens via the Kody file path post-publish
- [x] 5.2 Mark `ui.template` deprecated in the guide and the app-definition doc (frozen at `hello` | `generic` | `clock`, bundles for anything visual), update the shipped registry spec's template line to match, and verify validation still accepts the three and rejects unknown templates with a naming error
- [x] 5.3 Add `example-apps/` (`hello-counter.json`, `eight-ball.bundle.json`, `clock.bundle.json` (modal), README with `add_app` install steps) and verify each file installs unchanged and renders on preview
- [x] 5.4 Delete orphaned `pkg/apps/clock.json` once the bundle clock lands (superseded, referenced nowhere) and verify no route, doc, or script references the removed path
- [x] 5.5 (Phase 2, blocked on the storage bridge) Convert the Scribe probe to a bundle: beacon persistence via the namespaced bridge, then retire the custom `/probe*` routes and `kody-os.probe.*` keys, and verify the full probe run end to end on the Scribe

## 6. House-app migration (preview + Kody)

- [x] 6.1 Inventory both stores via `list_apps` on the preview mock and the Kody prod store; record ids, kinds, and reference-list memberships
- [x] 6.2 Convert eight-ball in place (same id via `add_app` overwrite; routes, pins, and homepage placement survive, state resets) and verify shake updates with no navigation on preview
- [x] 6.3 Make clock a modal bundle under the same id (`ui.placements: ["modal"]`); `hello-counter-modal` removed repo-only per owner (never on Kody); verify the Clock tile links to `#app-clock` and the overlay opens with no navigation
- [x] 6.4 Delete orphaned seed files (`pkg/app.json`, `pkg/apps/clock.json`, `pkg/apps/` dir if empty) once their bundle replacements land; update docs scratch-path references to a non-seeded temp file; verify preview seeds exactly the example-apps set and no doc or script references the removed paths
- [x] 6.5 Repeat the conversions on Kody prod via MCP (same ids), verify each app opens, and confirm pins + homepage placement intact; hello-counter stays operator everywhere as the contract fixture

## 4. Verification

- [x] 4.1 Run static checks (type-strip + `node --check`, ES2019 ceiling grep, single-`<style>`/zero-external-asset grep) and verify live on preview: bundle page, no-JS-equivalent plain render, fast-path behavior unchanged for operator apps
