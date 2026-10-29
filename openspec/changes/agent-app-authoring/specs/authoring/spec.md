## ADDED Requirements

### Requirement: Bundle/shell interaction contract is documented in the package

`pkg/docs/adding-an-app.md` SHALL state the complete bundle/shell interaction contract an agent needs to author a stateful bundle correctly, citing the Counter bundle (`pkg/examples/counter.bundle.json`) as the reference implementation: the exact state-readout markup and how to read initial state from it; the shell client's span-only patch semantics and native-submit fallback; that `ui.actions` forms are shell-owned and how a bundle must handle actions shared with shell forms (capture-phase claim, optimistic paint, single-flight ordered queue, sequencing guard, `MutationObserver` adoption); and the `data-action-base` action-URL rule with `credentials: 'same-origin'` and full-navigation fallback. The contract SHALL be consistent with the shell requirements in the `shell` spec. No bundle behavior is changed by this requirement; it documents the existing protocol. Note: the no-JS premise that originally motivated server-rendered state is retired (2026-10-28) — JavaScript on the Scribe is assumed — but this change makes no state-bridge change; replacing span-reading with a structured state handoff is a future change.

#### Scenario: Agent initializes from the shell span
- **WHEN** an agent follows the guide to write a bundle that displays a declared state field
- **THEN** the bundle reads its initial value from the rendered `[data-field]` span's text (the only initial-state source the renderer provides) and never assumes a `data-value` attribute.

#### Scenario: Agent handles a shell-form action without races
- **WHEN** an agent follows the guide for a bundle whose buttons share actions with shell `ui.actions` forms
- **THEN** the bundle claims its own forms at capture phase, paints optimistically, orders its writes through one single-flight queue, and adopts late shell patches only when no newer bundle step has intervened — so Reset-then-step and stale-response orderings settle at the newest intended value.

#### Scenario: Agent resolves action URLs from the container
- **WHEN** an agent follows the guide for a bundle `fetch` of a state action
- **THEN** the URL resolves against the bundle container's `data-action-base`, sends `credentials: 'same-origin'`, requests `?format=json`, and falls back to full navigation where `fetch`/JSON parsing are absent.

### Requirement: ES2019 ceiling is canonicalized in one place

The binding ES2019 ceiling for bundle code (and `pkg/src`) SHALL be stated exactly once, in `pkg/docs/scribe-limitations.md`, with the on-device probe evidence it rests on; `pkg/docs/adding-an-app.md` and `pkg/AGENTS.md` SHALL cross-reference it rather than restating their own versions. The statement SHALL resolve the current split (different engine versions named, stricter constructs avoided in practice but not listed as binding) so an agent cannot follow one doc into a bundle another doc forbids.

#### Scenario: Docs agree on the ceiling
- **WHEN** an agent reads the ceiling from any of the three docs
- **THEN** all three name the same engine/ceiling statement and the same forbidden-construct list, with the probe evidence cited in `scribe-limitations.md`.

### Requirement: Authoring docs match shipped behavior (no drift)

The published authoring docs SHALL match the shipped registry and definition behavior: re-adding an existing id preserves state by default (`resetState: true` restores the wipe; `migrate` renames fields); schemaVersion 4 definitions carry no `ui.template`; `pkg/AGENTS.md` states the current package version; and pin and homepage are described as separate lists/actions. Any statement contradicting shipped behavior is a docs defect under this requirement.

#### Scenario: Re-add guidance matches behavior
- **WHEN** an agent reads the re-add guidance
- **THEN** it states state preservation by default with `resetState`/`migrate` options, and no troubleshooting entry claims re-adding resets state.

#### Scenario: Template guidance matches schemaVersion 4
- **WHEN** an agent reads the template guidance
- **THEN** it states the field is removed in schemaVersion 4 (required only for schemaVersion 3 submissions) and that the renderer ignores it in every version.

### Requirement: One documented verification path for new bundles

The package docs SHALL document exactly one supported local verification path for a new bundle, covering `kody dev` end-to-end checks (real shell rendering via `kody dev fetch`/curl against the mock server, seeded through `pkg/scripts/registry.ts`) and the jsdom harness pattern (real bundle plus simulated shell-client patch with controlled fetch timing), plus a pre-`add_app` authoring checklist. References to the removed `dev/` preview tooling SHALL NOT remain in the package docs or example READMEs.

#### Scenario: Agent verifies a stateful bundle before adding it
- **WHEN** an agent follows the documented path for a new stateful bundle
- **THEN** it can run the `kody dev` end-to-end check and the harness scenarios (ordering, staleness, fallback, ceiling scan) from the docs alone, with no undocumented scratch files and no references to removed tooling.

#### Scenario: No removed-tooling references remain
- **WHEN** the package docs and example READMEs are searched for `dev/preview.mjs` or `dev/README.md`
- **THEN** no references remain; the only local verification path named is `kody dev` plus the jsdom harness.

### Requirement: Stateful bundles use the shell-provided framework (SHOULD, not MUST)

A bundle with state SHOULD use the shell-provided framework and adapter surface (see the `shell` spec): the framework is loaded once by the shell and instantiated per app section, and the adapter implements the documented interaction contract (initial-state read, paint/sync, observer adoption, single-flight queue, capture-phase claim, action-base resolution, fetch-with-fallback). Hand-rolled bundles remain valid — the validator SHALL NOT reject a bundle for not using the provided framework — and stateless or presentational bundles need not use it at all. The provided surface SHALL take no dependencies beyond the selected framework itself, SHALL satisfy the canonicalized ES2019 ceiling, and SHALL persist state only through `act()`. It SHALL NOT introduce new effect operators, declarative UI, or registry/shell storage surface. No existing app is force-migrated by this requirement. A stateful bundle that does not use the provided framework SHOULD record why in its definition notes or the change that adds it.

#### Scenario: Second app proves the provided framework
- **WHEN** the provided framework is proposed as the recommended path for stateful apps
- **THEN** a second stateful app has been ported to it with byte-identical behavior under the harness, after the Counter port, and the docs name the framework's namespace, version, and per-section instantiation.

#### Scenario: Hand-rolled bundle still valid
- **WHEN** a bundle implements the documented contract directly without the provided framework
- **THEN** it validates, installs, and behaves identically to a provided-framework bundle under the same harness scenarios; the authoring checklist records the reason it does not use the provided surface.

#### Scenario: Stateless bundle need not use the framework
- **WHEN** a bundle declares no state fields and no state actions
- **THEN** the checklist does not require the provided framework, and the bundle validates without it.

### Requirement: Selection evaluation for the shell-provided framework (gated, isolation first)

This change SHALL evaluate four candidates for the one framework the shell provides — Svelte (plain Svelte compiler only, not SvelteKit), Custom Elements / Web Components (vanilla platform only; Lit not evaluated here), the microframeworks re:dom and VanJS (each separately), and Alpine.js (directive-based, no build step) — and SHALL select one only if it passes all gates. Provision feasibility and isolation are the primary gates: the shell can load it once per page in all placements; it instantiates per app section with no shared mutable state; top-level names, registry names, and styles stay section-scoped; and a failure in one section stays contained to that section. The remaining gates are: size (including any shared code, against the 256 KiB bundle cap where per-app code remains); ceiling-scan result (after downleveling for Svelte, as written otherwise); harness scenarios (ordering, staleness, fallback) against real shell markup via `kody dev`; hydration/upgrade behavior against the shell-rendered page; and a probe on the Scribe engine. For Svelte the evaluation SHALL additionally determine a provision mechanism (shared runtime, import map, or per-app compile with only the adapter provided). For Custom Elements it SHALL test light-DOM and shadow-DOM variants, including shared-CSS behavior per variant. For Alpine.js it SHALL determine the adapter bridge (per-section store, effect, or watch), the `Alpine.data()`/`Alpine.store()` namespacing and `alpine:init` registration discipline, the ownership of `Alpine.start()` timing, and whether directive expressions compiled with `new Function` behave on the JIT-less Scribe engine and fall under the ceiling; it SHALL measure the actual build shipped, since size claims conflict. Each evaluation SHALL test its candidate composed with the span/`act()` adapter (never bypassing it), and SHALL record a selection/reject decision with evidence. No provision ships without a selection. Per-app vendoring or compilation remains allowed only as a documented fallback under the fallback rules, never as the default path.

#### Scenario: Selection record with evidence exists
- **WHEN** the Phase 2 selection evaluation completes
- **THEN** a decision record exists for each candidate stating select or reject, with provision feasibility, isolation evidence on a multi-section page, measured size, ceiling-scan result, harness outcomes, shared-CSS/upgrade outcomes (Custom Elements), and Scribe-probe result cited — not compiler documentation or compatibility tables alone.

#### Scenario: No provision without passing gates
- **WHEN** any gate (provision feasibility, isolation, size, ceiling, harness, hydration/upgrade, shared CSS, Scribe probe) fails for a candidate
- **THEN** that candidate is not selected, no provision of it ships, and the record names the failing gate and the fallback (adapter alone, or another candidate).

#### Scenario: Provided-framework bundle satisfies the contract
- **WHEN** a bundle is authored with the selected provided framework and passes the gates
- **THEN** it satisfies every requirement in this spec (contract, ceiling, checklist, harness) identically to a hand-rolled bundle, with its state sync going through the per-section adapter and `act()`.

#### Scenario: Custom element variant styling and upgrade are recorded
- **WHEN** the Custom Elements evaluation completes
- **THEN** the record states, per variant, whether the shell's shared `os-*` styles apply to the element's content and what (if anything) must be duplicated inside a shadow root, and whether upgrade-on-define paints acceptably on e-ink when the defining script is an appended extra `.js` file.

#### Scenario: Per-app fallback is recorded, not default
- **WHEN** a bundle uses per-app vendoring or per-app compilation instead of the provided framework
- **THEN** its pinned version and update owner are recorded with the bundle, and the docs present the fallback as an exception, never as the recommended path.
