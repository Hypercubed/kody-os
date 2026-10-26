# Design: remove-app

## Context

See proposal.md (Why). The registry resolves stores via `resolveStore()` (hosted `packageStorage()` with in-memory fallback) and already validates + applies atomically in `act()`; `export_app`/`import_app` round-trip definitions. There is no delete path.

## Goals / Non-Goals

- Goals: atomic `remove_app` with full reference scrubbing; same validation + atomicity guarantees as every other registry write; MCP-only exposure — the browser UI exposes hide, never remove.
- Non-goals: seeding (stays in the `prebuilt-apps` change), gallery/catalog UI, export-before-delete prompts (deletion is an explicit MCP/agent action, and exports already exist for backup), any UI removal control.

## Decisions

1. **Removal reuses the act()-style validate-then-single-mutation pattern**: resolve id → validate installed → compute the full key set (def, state, plus filtered registry/pinned/hidden/recency/homepage lists) → write all changes, with any failure leaving prior state untouched. No new storage keys.
2. **No export-before-delete gate**: deletion is explicit and agent-initiated; `export_app` already exists for anyone wanting a backup first. Keeps `remove_app` a single predictable operation.
3. **Removal stays off the browser surface**: hide is reversible and safe for e-ink mis-taps; deletion is destructive and cannot be confirmed without JavaScript. The edit UI has no remove control, so an agent must be asked explicitly. This also keeps the no-JS baseline free of an irreversible one-tap action.

## Risks / Trade-offs

- [Risk] A UI control calling remove_app by mistake deletes user data → Mitigation: there is no UI removal control; hide is the only UI lifecycle action. `remove_app` stays MCP-only and unconditional like every other registry write.

## Migration Plan

None — additive API, no existing data shape changes. Rollback is a republish of the prior commit.

## Open Questions

None.
