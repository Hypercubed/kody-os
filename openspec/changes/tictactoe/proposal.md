# Proposal

## Why

Tic-tac-toe was scoped as human-vs-agent plus a roster and session layer, but the operator engine cannot express game rules (no conditionals, no randomness, no win detection) and the signals layer deserves its own proposal. What we need first is much smaller: a simple single-player game — human vs. a random computer — proving a bundle can carry real interactive behavior the operator model cannot.

## What Changes

- Single-player tic-tac-toe ships as a **bundle app** (see archived `2026-10-26-app-bundles` change): board rendering, random computer moves, and win/draw detection all in vanilla bundle JS. No server state, no MCP play loop, no roster.
- Bundle hosting from the archived `2026-10-26-app-bundles` change has landed, so this dependency is satisfied; this change builds directly on bundle hosting.
- BREAKING: none. New app only; operator registry untouched.
- Explicit non-goal: agent opponents, roster, sessions, polling cadences — all of that moves to the `agent-sessions` change, which is parked until this game proves out.

## Capabilities

### New Capabilities

- `tictactoe-game`: single-player reference game (practice vs. random computer) as a bundle app.

### Modified Capabilities

(none)

## Impact

- One bundle definition plus its files (installed via `add_app`, no shell changes).
- `pkg/.agents/skills/adding-an-app/SKILL.md`: tictactoe joins the 8-ball as a canonical bundle example.
- No registry, shell, or export changes.
