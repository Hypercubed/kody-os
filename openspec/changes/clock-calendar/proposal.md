# Proposal

## Why

The widget home page (widget-home, in progress) needs live widgets to test against, the same way Phase 2 used counter as its validation app. A clock and a month-grid calendar are the two smallest widgets that prove the pattern end to end: one needs the current time, the other needs navigable derived content — both must work with zero new per-app code paths.

## What Changes

- New `now` time source for `set` effects: an action can stamp the current time into a string field (e.g. `effect: { op: 'set', field: 'time', fromNow: true }`). Time flows through ordinary state like everything else — no template, no eval.
- New `hello-clock` test app: string `time` field refreshed by a Refresh action via `fromNow`, plus an optional `greeting`-style label field. Generic rendering only.
- New `hello-calendar` test app: integer `monthOffset` plus a monospace month-grid string recomputed by a deterministic `calendar` effect op on prev/next-month actions. No events, no sync — grid only, per agreed scope.
- Both apps are test fixtures like `counter` (not shippable products); shipping decision explicitly deferred.
- Template cleanup is explicitly out of scope — it follows as its own change after this one. These apps MUST NOT depend on template-specific rendering; generic fields + forms only.
- BREAKING: none. Additive schema fields with defaults; existing definitions validate unchanged.

## Capabilities

### New Capabilities

(none — test apps are fixtures, not durable system behavior)

### Modified Capabilities

- `app-registry`: `set` effects gain an optional time source (`fromNow`), so actions can stamp the current time into string fields with the same validation + atomicity guarantees as every other effect. Calendar month-grid recomputation rides the same navigation actions deterministically.

## Impact

- `pkg/src/apps/types.ts`, `registry.ts` (time source, grid recompute), `test-app.ts` (two new definitions).
- `pkg/src/apps/forms.ts`, `client.ts`: no changes expected (generic rendering already covers both).
- No MCP surface changes, no export-format change, no storage-key changes. Widget rendering itself belongs to the widget-home change; these apps are its test doubles.
