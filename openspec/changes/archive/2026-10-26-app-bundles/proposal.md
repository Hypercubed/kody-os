# Proposal

## Why

Phase 2 proved apps can appear with no republish — but only as JSON composed
from four fixed registry operators (`increment`, `set`, `toggle`, `reset`).
That model cannot express a Magic 8-ball: a stateless toy that just needs a
little JS. Forcing toys through stored state, MCP args, or new operators is
overcomplication. The intended end state was always agent-authored,
self-contained apps: HTML plus JS/CSS as needed, own actions and state, hosted
by the shell with zero shell changes per app.

## What Changes

- New additive app kind: a **bundle** — one manifest plus files
  (`index.html` entry, optional JS/CSS), authored by an agent, installed via
  MCP `add_app` with no shell or package changes. The JSON-operator registry
  keeps working unchanged; bundles are a second, parallel app kind.
- The shell hosts bundles at the existing `GET /apps/:id` route inside the
  normal chrome (title, nav, Scribe-safe styles). Bundle HTML is inlined into
  the page; first version is stateless-first — the 8-ball reference app needs
  no storage at all.
- Trust model stated up front: the package is private and only the owner's
  agents can install bundles (same MCP gate as `add_app` today — no new auth).
  Agent-written JS runs in the owner's own browser; that is the explicit
  trust boundary, documented in the guide, not a sandbox claim.
- Authoring docs ship in the package: the Scribe capability findings move
  to `pkg/docs/scribe-limitations.md`, linked from the authoring guide,
  README, and AGENTS so Kody-connected agents can open them by file path.
  No behavior change; docs only.
- Example apps live in-repo under `example-apps/`: installable reference
  definitions with a README covering install via `add_app`. Ships
  `hello-counter.json` (operator form, retained as the operator-path
  contract fixture — smoke tests, guide, and fast-path verification depend
  on an operator app), plus bundles `eight-ball.bundle.json` (true random
  shake) and `clock.bundle.json` (live ticking clock, modal placement). The orphaned
  seed files `pkg/app.json` (operator eight-ball) and `pkg/apps/clock.json`
  (template-form snapshot clock, referenced nowhere) are retired; the
  preview seeds from `example-apps/` instead so every file proves verbatim
  install.
- The `ui.template` system is frozen and deprecated: `hello` | `generic` |
  `clock` keep working exactly as today, no new template values and no new
  per-app render branches ever again. Docs say so and point at bundles.
  (This also supersedes the clock-calendar change's `counter`-template
  direction — flagged for archive, not done here.)
- House-app migration (preview mock store + Kody prod store): inventory
  both stores via `list_apps`, then convert in place with same-id
  `add_app` overwrite — routes, pins, and homepage placement survive
  (reference lists are id-keyed; only `remove_app` scrubs them), state
  resets to initial (acceptable: every convert is stateless; hello-counter
  state is a test counter). Eight-ball gets true random shake (killing the
  20-button hack); clock ticks live; counter-modal exercises the bundle
  overlay path. `hello-counter` stays operator-form as the contract
  fixture (see above) — everything user-facing becomes a bundle.
- BREAKING: none to the code or the operator contract. House definitions
  migrate operator→bundle via same-id overwrite as above; no routes,
  pins, or exports break. Rollback is re-adding a prior definition (or a
  republish for code). The probe converts to a bundle in Phase 2 once the
  storage bridge lands (it needs beacon persistence); custom `/probe`
  routes and `kody-os.probe.*` keys retire then.

## Capabilities

### New Capabilities

- `app-bundles`: bundle manifest format + size caps, MCP install path,
  shell hosting route, and the Scribe posture for bundle JS (vanilla,
  guarded, same ES2019 ceiling as the shell).
- `bundle-store` (Phase 2 of this change): per-app namespaced storage bridge
  for bundles that need persistence. Explicitly after stateless hosting
  proves out; the 8-ball does not wait for it.

### Modified Capabilities

- `app-registry`: `add_app`/`validateDefinition` accept the bundle form
  alongside the operator form. Operator validation rules apply unchanged.

## Impact

- `pkg/src/apps/types.ts` + `registry.ts`: bundle manifest type, validation
  (path allowlist, size caps, entry-point rules), namespaced storage keys.
- `pkg/src/app.ts` + `client.ts`: bundle hosting render path (inline entry
  HTML into the app panel/overlay); no chrome changes.
- `pkg/docs/adding-an-app.md` + README prompt + new `pkg/docs/scribe-limitations.md`: bundle authoring contract — what agents may assume (Scribe JS posture), size budgets, trust boundary; Scribe findings readable by agents via Kody file path; template-freeze + example-apps pointers.
- `example-apps/` (new, in-repo): `hello-counter.json`, `eight-ball.bundle.json`, `clock.bundle.json` (modal), README with `add_app` install steps; preview seeds from it instead of `pkg/app.json` + `pkg/apps/` + the inline modal def.
- Delete orphaned `pkg/apps/clock.json` (superseded by the example bundle; referenced nowhere).
- No new dependencies. Export format gains a bundle variant; v1/v2 operator
  payloads import unchanged.
