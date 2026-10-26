# Proposal

## Why

Two app shapes exist today: operator apps (state + `increment|set|toggle|reset` actions, template UI) and bundles (self-contained HTML, no server actions). Authors must pick one, probe cannot persist, and every new behavior needs package ops. One type fixes this.

## What Changes

- Single `AppDefinition`: meta (`id/name/label/icon/category`) + UI files (`bundle: { entry, files }`) + `stateSchema` + `actions`. No `kind` split, no template branch.
- All apps get state + actions. Bundle JS writes via `act()` bridge (same handler UI + MCP use).
- Actions collapse to validated data writes: `set` (plus `append` for lists like probe reports) with args coercion, schema re-validation, single write, atomic. `increment/toggle/reset` become sugar over `set`, then retire.
- Probe converts to unified app: beacon JS calls `act(probe, append, {tag,d})` to namespaced list, custom `/probe*` routes retire.
- Example apps (`hello-counter`, `eight-ball`, `clock`) migrate to unified shape, same ids.

## Capabilities

### New Capabilities

- `unified-apps`: single app type with UI files, state schema, and generic set-data actions plus JS-to-act bridge.

### Modified Capabilities

- `app-registry`: schema loses `kind`/template split, `act()` accepts all apps, effect vocabulary becomes generic set/append.
- `shell`: renders one app view (bundle UI + state + forms) for page/modal/widget placements, no operator-vs-bundle branch.

## Impact

- `pkg/src/apps/types.ts` (single type, generic effects), `pkg/src/apps/registry.ts` (unified validate + `act` + bridge), `pkg/src/apps/client.ts` (single render path), `pkg/src/app.ts` (retire `/probe*`, template code).
- No storage migration beyond additive keys; export format `kody-os-app/3` with `/2` import compat.
- **BREAKING**: `kind: bundle` discriminator removed, `increment/toggle/reset` ops deprecated, template `hello|generic|clock` retired.
