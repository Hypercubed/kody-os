## 1. Provision — vendored Lit (transpile-once)

- [x] 1.1 Build the vendored Lit file: in a scratch directory, `npm install lit@3.3.3 esbuild@0.25.10` (pinned; an upgrade is a re-probe, not a silent bump). Bundle LitElement + lit-html (+ `@lit/reactive-element`) into one file with esbuild, `target: 'es2019'`, `format: 'iife'`, `minify: true`. Record the file's bytes/gzip. Expected result, from the Nov 8 probe: ~16 KB minified for the LitElement runtime (~22 KB with a small app's code in it)
- [x] 1.2 Ceiling-scan the BUILT file and fail the build loudly on any of: `?.`, `??`, logical assignment (`||=`, `&&=`, `??=`), or calls to `replaceAll`, `structuredClone`, `Object.hasOwn`, `.at()`, `WeakRef`, `FinalizationRegistry`, `URLPattern`. (The scan matches CALLS, not mentions — the probe's own table labels and `typeof` checks name the built-ins.) Record the result. The `adoptedStyleSheets` write inside Lit's `adoptStyles` is recorded as `builtin-ok` (dead code for light-DOM use: both probe elements override `createRenderRoot()`; the API is native since Chrome 73), never a fail. The entry SHALL NOT import `ContextRoot` (the only `WeakRef` in `@lit/context`); prove it is not in the bundle with per-output `bytesInOutput: 0`, not the metafile-inputs list (which includes tree-shaken modules)
- [x] 1.3 Decide the provision mechanism (design Open Question 1: asset under `pkg/public/` served via `/_assets/`, or inlined into the shell client) and the global name (design Open Question 4), and expose the vendored Lit under one documented global in the pattern of `window.KodyBridge`, loaded once per page in every placement where app sections render (page, widget, modal). Record the mechanism, the global name, and the version (Lit 3.3.3) in the docs with the surface. Import maps are out (Chrome 89+)
- [x] 1.4 Decide and record whether `@lit/context` 1.1.6 / `@lit/task` 1.0.3 ship in the vendored file (design Open Question 3). Default: no — the Counter port does not need them. If yes, the same pinning + scan discipline applies, and the vendored file is re-scanned with them included
- [x] 1.5 Demonstrate the isolation properties on a multi-section page before any app ports to the surface: the framework loads once, the adapter exists once per section with its own bridge-owned store, two sections sharing top-level names do not collide, two apps cannot collide on a custom-element tag, and one section's failure does not break its neighbors (shell-spec scenarios)

## 2. Shared elements — the `os-*` library (light-DOM only)

- [x] 2.1 Define the `os-*` naming convention and the shared-element contract: shell-owned (the shell client defines them once; app bundles use the tags and never define them), light-DOM only (`createRenderRoot() { return this; }`, no shadow root anywhere), theme via the shared `os-*` CSS, versioned with the provided surface. Record the convention in the authoring docs
- [x] 2.2 Implement the initial element set — the set the Counter port and the shell chrome's own app-row rendering need, recorded at implementation (design Open Question 2) — and demonstrate each element on a multi-section page (renders, keeps the theme, no-JS content visible)
- [x] 2.3 Verify no shared element uses a shadow root, constructable stylesheets, or `adoptedStyleSheets` at runtime (ceiling scan + code read of the element definitions)

## 3. Islands — the architecture

- [x] 3.1 Pin the island contract in the shell spec and the authoring docs: a section is an island; the server renders the JSON state seed + skeleton HTML (the no-JS content) before bundle scripts run; the island's bundle mounts onto it (a LitElement or a lit-html `render()` call) and adopts its starting state from the JSON seed; one bridge store instance per section; failure contained to its section with native form submission as the fallback; islands load at `DOMContentLoaded`
- [x] 3.2 Port the Counter bundle to the provided Lit + adapter without behavior change; the harness scenarios and `kody dev` E2E checks must pass identically, and the ported bundle must be byte-checked against the same state/action behavior as the hand-rolled reference
- [x] 3.3 Port a second stateful app to the provided Lit + adapter without behavior change; if the port needs adapter or shared-element changes, revise and re-verify the Counter port. Only after the second port is green is the provided surface declared the recommended path for stateful apps in the docs; if no second consumer is found, record that outcome and keep the provision marked provisional (do not declare it recommended on one app's evidence)

## 4. Bridge-only state — the rule

- [x] 4.1 State the rule in the shell spec and the authoring docs: a component written under this change reads state ONLY from the bridge store (a `KodyBridge.create(section)` subscription, or context derived from it). The JSON seed is the initial handoff, read once at mount. A component SHALL NOT read state from server-injected DOM — no span scraping, no `data-value` attributes, no reading server-rendered text as state. The `[data-field]` spans stay in the served HTML as the no-JS content and the fallback; existing span-reading bundles keep working until ported (dual-channel migration)
- [x] 4.2 Add the rule to the pre-`add_app` authoring checklist ("stateful bundle uses the provided surface, or records why not" gains "and its components read state only from the bridge store"), and evaluate a harness/static check for it (a component reading `[data-field]` spans or `data-value` attributes fails the check); ship the check only if it catches a class of defect review cannot, and record the evaluation either way

## 5. Docs

- [x] 5.1 Update `pkg/.agents/skills/adding-an-app/SKILL.md` with the concrete provided surface (global name, version, per-section instantiation, bridge-owned store and JSON seed, optimistic/rebase behavior, `os-*` naming convention, bridge-only state rule, `DOMContentLoaded` discipline) and the fallback rules (per-app vendoring/compilation only as a documented fallback with pinned version and update owner, never the default path)
- [x] 5.2 Update `pkg/AGENTS.md` and `pkg/README.md` headers to the new version in the same commit as the bump (MINOR: a new provided-framework capability existing apps can ignore; build +1 on publish). The version classification is recorded here; the release itself is the user's call and is not a step in this change

## 6. Verification

- [x] 6.1 Run the full change checks (jsdom harness green on Counter and the second ported app, `kody dev` E2E green, isolation scenarios green on a multi-section page, ceiling scan green on the vendored file, `openspec validate` passes for the change)
- [x] 6.2 Scribe verification — the vendored loading form (the specific unknown this change has: per-app bundled Lit is proven, shell-provided loading is not). Verify on the Scribe that the shell loads the vendored Lit file once, an app uses the global with no per-app build, the shared elements render with the theme, and the Counter port round-trips state. The Handoff 16 POC comparison covers the same check; if it lands first, it satisfies this task — record which vehicle verified it. If the POC is abandoned or delayed, run it as a standalone probe install (install via `add_app`, run on the Scribe, remove)
- [x] 6.3 Record the close-out note in this file (what was actually verified, what was substituted, and what was left open) before archiving

## Close-out (2026-11-13, Tessa, on be-quite-900, branch shell-islands, uncommitted)

Verified:
- Vendored Lit 3.3.3 built reproducibly (esbuild 0.25.10, ES2019, iife, minify): 17,422 B, gzip 6,587 B; ceiling scan clean (only globalThis x4, builtin-ok; WeakRef 0, ContextRoot 0, adoptedStyleSheets 1 known dead-code case). Rebuild reproduces byte-identical output.
- Provision: asset pkg/public/lit.js served via /_assets/lit.js, global window.KodyLit, emitted before the client-module script; kody dev E2E confirms the asset serves (17,422 B) and the script tag is on app pages.
- @lit/context / @lit/task do NOT ship (Counter port doesn't need them).
- Isolation: tests/lit-isolation.cjs 6/6 passed (single definition, independent per-section state, redefinition throws, a throwing section doesn't break its neighbor); tests/isolation-demo.cjs passed.
- os-* contract: pkg/src/client/os-elements.ts, exactly one element (os-stepper), light-DOM only, no shadow root / adoptedStyleSheets in code. NOTE: os-stepper has no catalog-app consumer yet — neither the Counter port (lit-html render, synchronous) nor the link-drop port (lit-html list) uses it. It is available; the first app to use it proves it.
- Counter port (catalogVersion 5 -> 6): lit-html render via window.KodyLit, bridge store stays the state source, no behavior change. counter-tests.cjs ALL PASSED (including rapid-click coalescing, rebase, Reset, span adoption). Catalog harness ALL PASSED (19 apps). kody dev E2E: Counter page 200 with lit.js + KodyLit + counter-num; set_count -> 3 and reset_count -> 0 round-trip via ?format=json; page seed reflects the reset state.
- Link-drop port (catalogVersion 3 -> 4): lit-html list rendering via window.KodyLit, bridge subscription, http-only anchors (javascript: has no anchor). link-drop-tests.cjs (pure functions) ALL PASSED; link-drop-dom-tests.cjs (rewritten from vm stub to jsdom) ALL PASSED. Catalog harness ALL PASSED.
- Bridge-only state rule: in the canonical shell spec + authoring spec (Task 3.1), in the adding-an-app SKILL.md (Task 5.1), and in the pre-add_app checklist. Harness/static check EVALUATED and NOT shipped (recorded in design.md): the [data-field] pattern is greppable so review catches it, and a check would false-positive on the documented no-bridge fallback (both ports read a span only when window.KodyBridge is absent).
- Docs: adding-an-app SKILL.md updated with the concrete provided surface (KodyLit, Lit 3.3.3, per-section instantiation, bridge store + JSON seed, optimistic/rebase, os-* convention, bridge-only rule, DOMContentLoaded discipline, mount-point discipline, fallback rules); the provided surface is declared the recommended path for stateful apps (second port green).
- Version: MINOR bump 4.2.2 -> 4.3.0 in pkg/package.json (build stays 49; build +1 to 50 happens on publish, not here) and pkg/AGENTS.md header. pkg/README.md states no version, so no header update was applicable (consistent with prior releases).
- Typecheck clean (exit 0). openspec validate: shell-islands PASSES. Other changes fail validation (pre-existing, unrelated): qr-code-agent-prompts (incomplete MODIFIED deltas), plugins (no deltas yet), compatible-catalog, email-client, f-flat-minor-calculator, sessionstorage-return.

Substituted:
- The kody dev E2E used the mock target with the ported definitions re-added via add-app.ts (assembled inline form from the working tree), because the mock store held stale catalog versions and the catalog install path needs a served base. The mock store's Counter/link-drop now carry the ported versions (v6/v4); the mock store is scratch and this does not affect the hosted instance.
- The link-drop DOM test was rewritten from a Node vm stub to a jsdom harness (the vm stub's plain-object elements cannot host lit-html rendering; assertions now read the live DOM instead of innerHTML strings, because lit-html marks dynamic parts with comment nodes).

Left open:
- 6.2 Scribe verification RUN 2026-11-13 evening (user, physical Scribe, standalone probe via ./scripts/dev-local-catalog.sh --lan, mock on the LAN). Vehicle: standalone Scribe run (not the Handoff 16 POC — the POC had not landed). Result: PASSED — Counter round-trips state (taps, rapid taps, Reset, count persists on reload), link-drop adds and lists a link, shell Home/Apps/Store navigate and the theme looks right. The mock log does not record individual HTTP requests, so the lit.js fetch was not confirmed from the log; the E2E already proved the page serves lit.js + KodyLit, and the Scribe loading the Counter page with the port working is the behavioral evidence. EXCEPTION: the shared-elements rendering check (os-stepper with theme) was NOT verified — os-stepper has no catalog-app consumer yet, so there was nothing on screen to check. That sub-check stays open until an app uses os-stepper; it does not block 6.2.
- The change delta's MODIFIED requirement ("Shell provides the framework and adapter surface") is still not synced to the canonical shell spec: its base comes from agent-app-authoring (still open) and is not in canonical. Sequencing dependency, not a validity failure.
- os-stepper has no catalog-app consumer (see above); the first consumer proves it.
- The open-mode harness's 12 pre-existing failures (missing-await test bug) and the agent-tools harness's stale app-count failure are unchanged by this change; they are not this change's scope.
- Nothing is committed, pushed, or published. Commit/push/publish are separate stops and need the user's direction.

Checkbox sync (2026-11-13 evening, user-directed): 1.1-1.5, 2.1, 2.3, 3.1 marked done — each was verified during implementation (see the close-out note above) but the boxes had been left unchecked. 2.2 left UNCHECKED: os-stepper was implemented, but its 'demonstrate each element on a multi-section page' step was not run — the isolation test used os-probe, not os-stepper. 2.2 stays open until os-stepper is demonstrated (or an app consumes it).

2.2 verified (2026-11-13 evening, user, physical Scribe): the stepper-test probe app (installed as the only app in the mock, via ./scripts/dev-local-catalog.sh --lan) rendered <os-stepper> with the theme, and the + / - buttons stepped the count. os-stepper is now demonstrated and proven by a consumer. This closes the last open shell-islands task (18 of 18 checked).

## Final close-out addendum (2026-11-13 evening, Tessa, user-confirmed)

The stepper-test probe app now proves os-stepper on BOTH devices,
closing the last open sub-check from the 6.2 close-out note above
(the shared-elements rendering check, which had no consumer):

- Scribe (2026-11-13 evening, user, physical Scribe, mock --lan):
  the stepper worked (reported "The stepper worked"); task 2.2
  marked done at that report.
- Chrome (2026-11-13 evening, user, PC Chrome, mock loopback
  http://127.0.0.1:4302/): after the two fixes below, the user
  reports "I see it now. Running as expected." The stepper renders
  a single number with - and + buttons, and stepping works.

Two bug fixes to the shell-islands implementation landed after the
6.3 close-out note above (both verified, both uncommitted on this
branch):

1. os-stepper duplicate number (pkg/src/client/os-stepper.ts):
   lit-html render() does not clear the element's existing children
   on first render, so the static no-JS "0" stayed alongside the
   Lit-rendered value and the Scribe showed the value twice. Fixed
   by clearing the element's children once in connectedCallback
   (a _cleared flag; the value attribute survives, so the property
   still initializes from it) — the same mount-point discipline as
   the Counter port. Verified in jsdom
   (~/workspace/test_osstepper_node.cjs, updated with a duplicate
   check): exactly one value span, textContent "0-+"; all checks
   pass. Typecheck clean, lit-isolation 6/6.
2. Relative client-module URL (pkg/src/app.ts, fetch handler):
   the shell stamped the platform-provided ABSOLUTE client-module
   URL (the mock's configured LAN host, 10.0.0.181) into the page,
   even when the page was loaded via loopback (127.0.0.1). Chrome
   on loopback could not reach the LAN IP, so the client module
   timed out (console: ERR_CONNECTION_TIMED_OUT), os-stepper was
   never defined, and Chrome showed only the static "0". Fixed by
   stripping the scheme + host from context.clientModuleUrl so the
   browser fetches the module from the same host as the page, like
   lit.js already does. Verified: the served page shows a relative
   client-module URL via both loopback and LAN IP, zero absolute
   LAN-IP asset URLs remain; set/reset round-trips; typecheck clean.
   This is a shell bug fix and warrants a PATCH bump (4.3.0 ->
   4.3.1) when committed; the bump is NOT applied here.

Code-organization note (fe-be-separation, separate change, NOT
archived here): the user clarified "each component in its own file"
means each custom element / LitElement definition, not the renderers.
The 15-file renderer split done as fe-be-separation prep was
REVERTED at his direction (client.ts, app.ts, tsconfig.json restored
from git HEAD; components/ deleted); the custom-element split was
KEPT (pkg/src/client/os-stepper.ts holds the os-stepper definition,
pkg/src/client/os-elements.ts is the registry). The fe-be-separation
change (openspec/changes/fe-be-separation/) stays ACTIVE and is not
part of this archive; its spec still describes the renderer split
and needs updating to reflect that "component" means custom element.

Left open (unchanged from above, still true):
- The change delta's MODIFIED requirement ("Shell provides the
  framework and adapter surface") is still not synced to the
  canonical shell spec (base comes from agent-app-authoring, still
  open). Sequencing dependency, not a validity failure.
- The open-mode harness's 12 pre-existing failures and the
  agent-tools harness's stale app-count failure are unchanged.
- Nothing is committed, pushed, or published. Commit/push/publish
  are separate stops and need the user's direction. The branch also
  carries the active fe-be-separation change and the two bug fixes
  above; the version is still 4.3.0 build 49 (the PATCH bump for the
  relative-URL fix is pending a commit direction).

