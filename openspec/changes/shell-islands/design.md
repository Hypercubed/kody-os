# Design: shell-islands

## Context

See proposal.md (Why). The evidence, all dated:

- **Lit probe (2026-11-08, Scribe, full report in the assistant's VM
  workspace, `~/workspace/kody-ai-os/lit-probe/LIT-PROBE-REPORT.md`):**
  four variants built with esbuild 0.25.10 (`target: 'es2019'`,
  `format: 'iife'`, `minify: true`), ceiling-clean on the built output
  (0 post-ES2019 syntax, 0 banned calls), installed live via `add_app`,
  run on the Scribe, removed afterwards. lit-html cold mount 83 ms vs
  Svelte ~195 ms; LitElement renders, updates, and round-trips state
  through `act()` and the JSON seed; light-DOM keeps the theme; paint
  ~250 ms everywhere (e-ink cadence). lit-html bundle 12,911 B JS,
  LitElement 22,442 B JS; LitElement costs ~9.5 KB over lit-html alone.
  lit-html 3.3.3 does NOT use `<!--` template markers (it uses
  `<?lit$…>` bogus-comment markers), so the `safeInlineJs` guard never
  fired. LitElement updates are microtask-async via `requestUpdate()`,
  so its render work lands in the paint bucket, not the JS bucket.
- **Context + Task probe (2026-11-09, Scribe, report in
  `~/workspace/kody-ai-os/ctx-task-probe/CTX-TASK-PROBE-REPORT.md`):**
  one Counter using a `ContextProvider` (count shared to a child
  `ContextConsumer`, `subscribe: true`) and a `Task` wrapping the
  `set_count` `act()` call. Bundle 29,701 B JS, jsdom 8/8, Scribe run
  with no visual issues, final state `{count: 0}` (consistent with
  the +1-then-Reset script), probe removed live afterwards. Honest
  limit recorded in that report: the on-page probe table rows were
  visible only on the page and sent no beacon home, so their exact
  YES/NO values were not recorded — the Scribe verdict on the two
  per-piece rows rests on the user's on-page observation, while jsdom
  proves the mechanism end to end.
- **Lit Labs research (2026-11-09):** `@lit-labs/ssr` 4.1.0 — don't
  use (shadow-DOM-only, declarative shadow DOM, no Chromium 80
  support, no verified Workers path); `@lit-labs/signals` 0.3.0 —
  maybe (tiny, plain-JS, light-DOM-compatible in principle, can wrap
  the bridge store, but experimental and its shipped code constructs
  `FinalizationRegistry` at import, Chrome 84+, which no build step
  can fix); `@lit-labs/router` 0.1.4 — maybe (tiny, History-API-only,
  but prototyping-stage and needs a `URLPattern` polyfill, Chrome
  95+; a hand-rolled `pushState` router is a credible simpler
  alternative). `@lit/context` 1.1.6 and `@lit/task` 1.0.3 are
  stable, graduated from Labs.
- **Relationship to `agent-app-authoring` (open, Phase 1 done):** this
  change builds on its Phase 2 decisions (bridge-owned store, JSON
  seed + bridge push, optimistic paint with rollback/rebase,
  schemaVersion 5) and on the bridge adapter as it exists in code
  (Counter and xkcd already call `window.KodyBridge.create(...)`).
  It revisits exactly one clause of its Decision #5 (no downleveling
  pipeline): the transpile-once split proposed 2026-11-01 (polyfill =
  runtime, once by shell; transpile/downlevel a vendor library =
  build-time, once by shell; compile components = per-app, still the
  burden originally rejected). Under that split, Lit is re-admitted as
  the provided renderer; Svelte/Solid compiler frameworks stay out
  (they need a per-app compiler, not just bundling + downleveling).
- **Handoff 16 SPA-shell POC (in progress, local agent, branch named
  by the user):** a second Lit SPA UI in `poc/spa-shell/`, local-only,
  to be compared against the original shell on a real Scribe. Its
  Scribe comparison covers the same vendored-form check this change
  needs (shell loads the vendored Lit file once, apps use the global);
  if it lands first, it can satisfy this change's Scribe verification
  task (see tasks). The POC is a prototype of a possible later stage,
  not a commitment to it — this change proceeds independently.
- **Shell constraints that bind this change:** ES2019 only for shell
  and bundle code (canonical statement in
  `pkg/docs/scribe-limitations.md`); GET forms only in browser UI;
  styles inlined (`pkg/src/shell-css.ts` generated from
  `pkg/public/styles.css`); works without JavaScript except the App
  Store data app; 256 KiB cap per app bundle; 48px minimum tap
  targets; no flexbox gap; system fonts only; zero emojis in the app.

## Decisions

1. **Transpile-once revisits Decision #5 — narrowly.** The vendored
   Lit build is the one funded downleveling step: esbuild bundles
   LitElement + lit-html (+ `@lit/reactive-element`) into one file,
   `target: 'es2019'`, `format: 'iife'`, `minify: true`, ceiling-scanned
   with the build failing loudly on any banned call or post-ES2019
   syntax. The file is vendored into the shell package and loaded once
   per page. No general per-app downleveling pipeline is funded, no
   `add_app` compile step is added, and per-app Lit stays a documented
   fallback (pinned version + update owner), never the default path.
   Rationale: the probes prove the downleveled output works and is
   small; doing it once in the shell is cheaper than doing it per app,
   and it is the only downleveling the middle ground needs.
   Alternative (keep Decision #5 as written and provide only
   ceiling-clean renderers) rejected: it would leave the proven Lit
   out of the provided surface and keep every stateful app
   hand-rolling reactivity.
2. **Lit 3.3.3 pinned as the provided renderer.** The version verified
   on the Scribe (Nov 8 probe). An upgrade is a re-probe, not a silent
   bump: rebuild, re-scan, re-run the jsdom smoke and the Scribe
   check, then update the recorded version in the same change.
   Rationale: the ceiling scan is version-specific; a different Lit
   version changes it.
3. **Light-DOM only, everywhere in this change.** Shared elements and
   ported apps render into light DOM (`createRenderRoot() { return
   this; }`). Shadow DOM is out by user decision (2026-11-08): it
   blocks the shared theme and hides content until JavaScript loads.
   Rationale: the probes prove light-DOM LitElement keeps the `os-*`
   theme and renders on the Scribe; shadow DOM would reintroduce the
   theming and no-JS problems this change is built to avoid.
4. **Islands are the architecture.** A section is an island: server
   renders seed + skeleton (the no-JS content), the island's bundle
   mounts and adopts state from the JSON seed, one bridge store
   instance per section, failure contained to its section with native
   form submission as the fallback. Islands load at
   `DOMContentLoaded`; no per-island lazy loading in this change.
   Rationale: it is the shell's existing shape made explicit and
   pinned in spec, and it is what makes the progressive path real —
   the same island mounts into a server-rendered section today and
   into a client-routed section later.
5. **Bridge-only state.** Components read state ONLY from the bridge
   store. The JSON seed is the initial handoff, read once at mount.
   No span scraping, no `data-value` attributes, no reading
   server-rendered text as state. Rationale: a component that reads
   server-injected DOM is coupled to the server's markup and to
   full-document navigation; a component that reads only the bridge
   store is routing-agnostic, which is what makes the middle ground
   progressive toward client routing later. The `[data-field]` spans
   stay in the served HTML as the no-JS content and the fallback —
   they are not a state source for components, and existing
   span-reading bundles keep working until ported (dual-channel
   migration, `agent-app-authoring` Decision 2).
6. **Shared elements are shell-owned, namespaced `os-*`, versioned
   with the provided surface.** The shell client defines them once;
   app bundles use the tags and never define them. Tag names are
   namespaced so two apps cannot collide (the `agent-app-authoring`
   isolation requirement, applied to the shared library). A version
   change to the provided surface requires a spec update and
   re-verification of the reference apps before it ships.
   Rationale: one version, loaded once, free to every app — the same
   argument as shared CSS, and the same version-lock-in mitigation
   (per-app vendoring remains the documented fallback for an app that
   needs a different version).
7. **Provision mechanism resolved at implementation.** Asset under
   `pkg/public/` served via `/_assets/`, or inlined into the shell
   client — the `agent-app-authoring` Open Question 2, resolved inside
   the provision task against the shell-spec isolation scenarios
   (loads once per page in every placement; per-section adapter
   instances; no global-scope collisions). Import maps are out
   (Chrome 89+, above the ceiling). Rationale: the mechanism is an
   implementation detail; the spec pins the properties it must have,
   not the file it lives in.
8. **Counter first, a second app as the gate.** Counter ports to the
   provided Lit + adapter without behavior change; a second stateful
   app ports second; only after the second port is green is the
   provided surface declared the recommended path for stateful apps.
   Rationale: one app's evidence is not enough to declare a
   recommended path (the `agent-app-authoring` 2.4 gate, repeated
   here because the surface is new).

## Goals / Non-Goals

- Goals: a stateful app author uses the shell-provided Lit and
  shared elements instead of inventing a reactive system; shell
  chrome and app UI share components defined once; components read
  state only from the bridge store, so the same component works
  under server rendering today and client routing later; the no-JS
  baseline and the full-document navigation model are kept.
- Non-goals: client-side navigation / pjax and any SPA conversion
  (future change); SSR; signals/router adoption; `ContextRoot`;
  shadow DOM; a general downleveling pipeline; an `add_app` compile
  step; per-island lazy loading; forcing migration of existing apps
  (stateless and presentational bundles may stay plain; stateful
  bundles SHOULD use the provided surface — a recommendation, not a
  validator mandate).

## Risks / Trade-offs

- [Risk] Vendored Lit upgrade breaks existing ported apps → Mitigation:
  the provided surface is versioned, upgrades require a spec update
  plus re-verification of the reference apps, and per-app vendoring
  remains the documented fallback for an app that needs a different
  version.
- [Risk] The provider becomes a second source of truth → Mitigation:
  the bridge-only state rule is a spec requirement with a harness
  check where feasible; the provider (or any context value) is set
  from the bridge on every change, never written directly by app
  code — the `applyCount()` pattern from the ctx-task probe (one
  place where the count changes, setting element state and provider
  value together).
- [Risk] The vendored loading form fails on the Scribe (per-app
  bundled Lit is proven; shell-provided loading is not) → Mitigation:
  a dedicated Scribe verification task for the vendored form (the
  specific unknown this change has); the Handoff 16 POC comparison
  covers the same check and can satisfy it if it lands first.
- [Risk] `adoptedStyleSheets` write in the vendored file (Lit's
  `adoptStyles`, inside the default `createRenderRoot()`) → Mitigation:
  both probe elements override `createRenderRoot()`, so it is dead
  code for light-DOM use; the API is native since Chrome 73, so it
  could not throw on the Scribe even if it ran; recorded, not hidden,
  in the ceiling scan (the ctx-task probe's finding 1).
- [Risk] `ContextRoot` / `WeakRef` (Chrome 84+) sneaks into the
  bundle → Mitigation: the vendored entry SHALL NOT import
  `ContextRoot`; the ceiling scan proves it is not in the bundle
  (the ctx-task probe's `bytesInOutput: 0` check, not the
  metafile-inputs list, which includes tree-shaken modules).
- [Risk] Cross-section leakage through the shared elements or the
  provided global → Mitigation: per-section adapter instances and
  the isolation scenarios (multi-section page, same top-level names,
  same tag names) must pass before any app ports to the surface.
- [Risk] One section's failure breaks its neighbors → Mitigation:
  per-section error containment is a shell-spec requirement; the
  fallback is native form submission, which must keep working when
  the provided surface fails.
- [Risk] jsdom proves the mechanism but not the device → Mitigation:
  the Scribe verification task is the gate for the vendored form;
  jsdom results are smoke only, never reported as Scribe results.
- [Risk] Over-frameworking: the provided surface becomes a de facto
  second shell → Mitigation: SHOULD-not-MUST for stateful apps, no
  forced migration, and the surface stays an authoring surface,
  never a registry feature.

## Migration Plan

None forced for existing apps — provision is additive; no bundle,
definition, or stored-data changes. Existing bundles (including
Counter) keep working; Counter ports first as the reference, a
second stateful app ports second, and new stateful apps SHOULD use
the provided surface at authoring time. Rollback is a republish of
the prior commit, with ported apps reverted to their hand-rolled
bundles in the same change.

## Open Questions

1. **Provision mechanism.** Asset under `pkg/public/` served via
   `/_assets/`, or inlined into the shell client? Resolve inside the
   provision task against the isolation scenarios (loads once per
   page in every placement; per-section adapter instances). Import
   maps are out (Chrome 89+).
2. **Initial `os-*` element set.** Which elements ship first — the
   set the Counter port and the shell chrome's own app-row rendering
   need, recorded at implementation. Further elements are added by
   later changes; this change does not enumerate the whole library
   up front.
3. **`@lit/context` / `@lit/task` in the vendored file?** Default:
   no — the Counter port does not need them, and the stated goals
   name Lit and the shared elements only. Decide at provision time
   and record the decision; if yes, the same pinning + scan
   discipline applies (context 1.1.6, task 1.0.3, the versions
   proven Nov 9).
4. **Global name for the vendored Lit.** One documented global in
   the pattern of `window.KodyBridge` (e.g. `window.KodyLit` —
   name decided at implementation, recorded in the docs with the
   version). App bundles use the global and never import Lit.
5. **Scribe verification vehicle.** The Handoff 16 POC comparison
   covers the vendored-form check; if it lands first it satisfies
   this change's Scribe task. If the POC is abandoned or delayed,
   the check is a standalone probe install (same method as the Lit
   probe: install via `add_app`, run on the Scribe, remove).
