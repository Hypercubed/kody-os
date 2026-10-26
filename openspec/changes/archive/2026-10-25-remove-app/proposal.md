# Proposal

## Why

The registry can install apps but never remove them — test artifacts (like the hosted `hello-counter-copy`) are already undeletable, and users have no way to uninstall anything, including apps they didn't ask for.

## What Changes

- New `remove_app` registry call: deletes an app's definition and state and scrubs all references (pinned, hidden, recency, homepage order) atomically. Unknown ids return `{ ok: false }` with no writes. Removing a prebuilt/seeded app is allowed — it is an uninstall, not a lock-in.
- MCP-only: the browser shell exposes hide, never remove. There is no UI removal control; deleting an app requires an agent to call `remove_app`.
- Explicit non-goal: seeding/prebuilt sets stay in the `prebuilt-apps` change; this change is removal only.
- BREAKING: none. Additive API; existing installs and exports are unaffected.

## Capabilities

### New Capabilities

(none — removal extends the registry lifecycle)

### Modified Capabilities

- `app-registry`: lifecycle gains removal (definition + state + reference scrubbing, atomic). Validation and atomicity rules apply unchanged. The call is MCP-only.
- `shell`: edit mode stays pin + hide only and explicitly exposes no remove/delete control.

## Impact

- `pkg/src/apps/registry.ts` (`remove_app`), export from the package index. No new storage keys, no theme/client changes.
- No migration needed. Rollback is a republish of the prior commit.
