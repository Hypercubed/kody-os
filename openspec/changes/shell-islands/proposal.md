# Proposal

## Why

The shell's frontend and backend are one tangled unit today: `pkg/src/app.ts`
hand-builds interactive HTML strings interleaved with fetch-handler logic,
and every stateful app re-derives its own rendering. The `agent-app-authoring`
change (open, Phase 1 done) already decided the shape of the fix — a
bridge-owned store with a JSON seed, optimistic paint with rollback/rebase,
and a framework the shell itself provides, loaded once and free to every
app — but its Phase 2 Decision #5 (2026-10-30, "require as-shipped ES2019,
no downleveling pipeline") rejected Lit as shipped, and the provided
renderer narrowed to ceiling-clean options only. The evidence since then
changes that decision, narrowly:

- **Lit probe (2026-11-08, Scribe):** Lit 3.3.3 downleveled at build time
  to ES2019-clean output renders, updates, and round-trips state on the
  Scribe — lit-html cold mount 83 ms vs Svelte ~195 ms, LitElement bundle
  22,442 B JS, light-DOM keeps the `os-*` theme, paint ~250 ms everywhere
  (e-ink cadence, not a framework number). Downleveling is a build-time
  step, not a runtime cost.
- **Context + Task probe (2026-11-09, Scribe):** `@lit/context` 1.1.6 and
  `@lit/task` 1.0.3 downleveled the same way work as per-app compiled
  pieces (bundle 29,701 B, jsdom 8/8, Scribe run with no visual issues).
  The bridge-owned store plus Lit rendering is a proven combination.
- **Lit Labs research (2026-11-09):** SSR is out (shadow-DOM-only via
  declarative shadow DOM, unusable on Chromium 80); signals and router
  are maybes with their own blockers. Nothing in the Labs family changes
  the core pick: Lit is the renderer; the bridge stays the store.
- **The middle ground (2026-11-09, user direction):** the user does not
  want a full SPA. He wants better FE-BE separation, less full page load
  on actions, and components defined once by the shell and reused in
  user-land apps. That is the islands model the shell already has in
  shape — server-rendered pages with interactive app sections — plus a
  shell-provided Lit and shared elements. This change specs that middle
  ground. It is also the progressive path: the vendored Lit, the shared
  elements, the converted apps, and the bridge all carry over unchanged
  if the shell ever moves to full client routing later; the only thing a
  later SPA step gives up is the no-JS baseline, which this change keeps.

This change therefore revisits exactly one clause of
`agent-app-authoring` Decision #5: it funds **one** downleveling step —
the vendored Lit build, done once when Lit is added to the package,
pinned, ceiling-scanned, and re-probed on upgrade (the transpile-once
split proposed 2026-11-01). It does NOT fund a general per-app
downleveling pipeline and does NOT add an `add_app` compile step; those
remain out of scope and undecided.

## What Changes

**Provision — vendored Lit (transpile-once).** Lit 3.3.3 (pinned) is
bundled once with esbuild (`target: 'es2019'`, `format: 'iife'`,
`minify: true`), ceiling-scanned (fail loudly on any banned call or
post-ES2019 syntax in the built output), and vendored into the shell
package as a single file the shell loads once per page, exposing Lit
under one documented global in the pattern of `window.KodyBridge`.
`@lit/context` and `@lit/task` are NOT vendored by default — the
Counter port does not need them (bridge subscribe + `render()` is
enough); whether they ship in the same vendored file is decided at
provision time and recorded, under the same pinning + scan discipline
if the answer is yes.

**Shared elements — the `os-*` library, light-DOM only.** The shell
defines shared custom elements once in its client, under the `os-*`
namespace, rendering into light DOM (`createRenderRoot() { return
this; }`) so the shared theme CSS applies and content stays visible
without JavaScript. Any app bundle can use the tags with no per-app
JavaScript or duplication. Shadow DOM is out by user decision
(2026-11-08) — no shared element uses a shadow root. The initial
element set is the set the Counter port and the shell chrome's own
app-row rendering need, recorded at implementation; further elements
are added by later changes.

**Islands — the architecture.** Every app section
(`section[data-app-id]`) is an island: the server renders the seed
(JSON state seed + skeleton HTML, the no-JS content), and the
island's bundle mounts onto it (a LitElement or a lit-html
`render()` call), adopting its starting state from the JSON seed.
Islands are independent: one bridge store instance per section, no
shared mutable state, failure contained to its section with native
form submission as the fallback. Islands load at `DOMContentLoaded`
(the `client:load` shape); per-island lazy loading is out of scope.

**Bridge-only state — the rule that makes components portable.** A
component written under this change reads state ONLY from the bridge
store (a `KodyBridge.create(section)` subscription, or context
derived from it). The JSON seed is the initial handoff, read once at
mount. A component SHALL NOT read state from server-injected DOM —
no span scraping, no `data-value` attributes, no reading
server-rendered text as state. The `[data-field]` spans stay in the
served HTML as the no-JS content and the fallback, not as a state
source for components. This rule is what makes a component
routing-agnostic: the same element works mounted into a
server-rendered section today and into a client-routed section later.

**Ports — Counter first, a second app as the gate.** The Counter
bundle ports to the provided Lit + adapter without behavior change
(first consumer); a second stateful app ports second, and only after
the second port is green is the provided surface declared the
recommended path for stateful apps (the same gate as
`agent-app-authoring` 2.4). No existing app is force-migrated.

## Capabilities

### New Capabilities

- `shell`: islands as the shell's rendering architecture, the vendored
  Lit provision, and the shared `os-*` element library (light-DOM
  only, versioned with the provided surface).
- `authoring`: the provided surface becomes documentable (global,
  version, per-section instantiation, `os-*` naming, bridge-only
  state rule) and the pre-`add_app` checklist gains the bridge-only
  state rule.

### Modified Capabilities

- `shell`: the provided-framework surface from `agent-app-authoring`
  is amended — Lit IS provided, via the single vendored downleveling
  step; the "no downleveling pipeline" clause is narrowed to the
  general per-app pipeline, which remains unfunded.
- `authoring`: the recommended path for stateful bundles gains its
  concrete surface (this change), replacing the provisional note that
  the surface would be documented after selection.

## Impact

- Code: shell provision (vendored Lit file + client exposure + `os-*`
  library under `pkg/src/` + `pkg/public/` as the mechanism requires),
  Counter port, second-app port, authoring docs.
- Version: MINOR by the package policy — a new provided-framework
  capability existing apps can ignore; the provided surface is
  versioned and a breaking change to it is MAJOR. A publish is
  required before any app can use the provided surface (a factual
  consequence, not a release step — the release itself is the user's
  call, as always).
- BREAKING: none. Additive provision and additive docs; existing
  bundles keep working unchanged, no app is forced to migrate, the
  no-JS baseline is kept, and rollback is a republish of the prior
  commit with ported apps reverted to their hand-rolled bundles in
  the same change.

## Dependencies

This change's MODIFIED requirement applies to "Shell provides the
framework and adapter surface", introduced by `agent-app-authoring`
(still open, 6 tasks left). That change's delta must be in the
canonical shell spec before this change archives — this change
archives after `agent-app-authoring`, or the two land together with
the requirement merged. The validator already flags this
("Archive would refuse this delta" while the base requirement is
not in canonical); it is a sequencing dependency, not a validity
failure — the change validates.

## Non-goals

- Client-side navigation / pjax for shell pages, and any SPA
  conversion — a future change; this change keeps full document
  navigation and the no-JS baseline.
- SSR (out: shadow-DOM-only, unusable on Chromium 80), `@lit-labs`
  signals/router adoption, `ContextRoot` use (the only `WeakRef`
  in `@lit/context`, Chrome 84+), shadow DOM anywhere.
- A general per-app downleveling pipeline, an `add_app` compile
  step, per-island lazy loading, catalog changes, new effect
  operators, `act()`/registry semantics changes, declarative UI.
- Release or publish steps. The release decision stays the user's.
