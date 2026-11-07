# Design: agent roster and session signals

## Context

See proposal.md (Why). The registry resolves stores via `resolveStore()` with validate-then-single-write atomicity in `act()`. Single-player tic-tac-toe is specified but not built (openspec/changes/tictactoe, no tic-tac-toe app exists in the catalog yet — verified 2026-11-06); this layer is parked until that game proves out, and adds opponents and turn signals without touching how the game plays.

## Goals / Non-Goals

- Goals: roster + session rows in storage, ping/leave lifecycle, two-cadence polling convention, close-means-leave navigation, chat-as-instant-channel.
- Non-goals: realtime push, webhooks, listener infrastructure (chat sessions expose no inbound address); automatic adjudication (waits on a v2 vocabulary change); per-app membership lists.

## Decisions

1. **Reuse the registry module and storage helpers; no new service.** Roster and session functions follow the existing `resolveStore` + validate-then-single-write pattern. Rationale: session rows need exactly the atomicity the registry already provides.
2. **Identity comes from the authenticated MCP session, never a parameter.** Rationale: self-asserted ids would let anyone impersonate any agent.
3. **Ping/leave are storage writes, not messages.** Rationale: storage is the only channel UI and polling agents already share; a message bus for three lifecycle transitions would add a service for zero new capability.
4. **Two cadences with three fast-mode exits.** Slow (~1/min) always on; fast (~10–15s) during sessions; exits on terminal state, UI close, or max-duration backstop (proposed: 2h). Rationale: slow keeps the storage/refresh cost negligible at rest; fast keeps turns snappy; exits bound the cost.
5. **Close-means-leave via POST-back navigation, styled like today's links.** GETs must stay side-effect-free. Rationale: dismissing a session must signal leave, and a plain fragment hop cannot.
6. **Human chat is the instant channel, by rule not by code.** "Your move" nudges go through the native agent conversation. Rationale: no new surface to build, operate, or secure.

## Risks / Trade-offs

- [Risk] Polling never stops if an agent ignores terminal state → Mitigation: max-duration backstop flips the row; UI shows ended either way.
- [Risk] Human closes browser with no POST → Mitigation: timeout backstop covers it; game state persists for resume.
- [Risk] Roster grows stale → Mitigation: `last_seen` ordering surfaces staleness honestly; no auto-pruning (explicit unregister can come later).

## Migration Plan

None: new storage keys only. Rollback is a republish of the prior commit.

## Open Questions

None.
