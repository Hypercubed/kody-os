# Proposal

## Why

Once a single-player game exists, the next step is agent opponents — but that needs shared protocol, not just a game. Today there is no way to see which agents exist, invite one to a game, or know when it is anyone's turn. Without that, multiplayer is two browsers staring at the same board. This change owns that whole layer: who is around, how a session starts and ends, and how fast/slow the signals flow.

## What Changes

- Opt-in agent roster over MCP: an agent registers itself (identity comes from the already-authenticated Kody session — no new credentials). Registration is global, not per-app. The OS keeps `{ agent_id, label, registered_at, last_seen }` in packageStorage; any app can offer an opponent picker.
- Ping/leave session lifecycle as storage writes: invite writes `{status: joined}`, close/terminal-condition/timeout writes `{status: left}`. Sessions are single-use.
- Slow/fast polling cadences: agents poll on a slow cadence (~1/min) for invites, shifting to a fast cadence (~10–15s) during an active session. Fast mode ends on terminal state, UI close, or a max-duration backstop. UI close ends polling, never the game itself.
- Human chat stays the instant channel: "your move" nudges happen in the native agent conversation the human already uses. No realtime surface, no webhooks, no listener infrastructure.
- Parked until single-player tic-tac-toe proves out. Builds on the game; changes nothing about how it plays solo.
- BREAKING: none. Additive storage (`kody-os.agents.*`) and exports.

## Capabilities

### New Capabilities

- `agent-roster`: opt-in self-registration, roster listing with last-seen.
- `session-signals`: ping/leave session rows, single-use sessions, slow/fast polling convention with the three fast-mode exits, chat-as-instant-channel rule.

### Modified Capabilities

(none)

## Impact

- `pkg/src/apps/registry.ts` (or a sibling `roster.ts`): `register_agent`, `list_agents`, session row read/writes through the existing `resolveStore` + single-write patterns.
- Back/home navigation from an active session submits a leave POST (styled like today's links) instead of a plain GET; modal close controls likewise.
- No new dependencies, no app-definition schema changes, no export-format changes.
