# Design: single-player tic-tac-toe bundle

## Context

See proposal.md (Why). Bundle hosting comes from the archived `2026-10-26-app-bundles` change (landed): the shell inlines the bundle entry HTML into the app panel, bundle JS runs vanilla ES2019, no server state required. The operator model is deliberately not used — it cannot express random moves or win detection.

## Goals / Non-Goals

- Goals: a playable human-vs-random-computer game in one bundle; new-game reset; win/draw announcement.
- Non-goals: difficulty levels, score persistence (a feature decision, not a bridge dependency - bundle state persistence via actions already exists), agent opponents, roster/sessions (all `agent-sessions`).

## Decisions

1. **All game logic in bundle JS.** Board state lives in page-local JS; the computer picks a uniform random empty cell after each human move; win/draw is checked against the 8 lines after every move. Rationale: nothing here needs the server — a round-trip per move would add latency for zero benefit, and the operator engine cannot do any of it.
2. **Human is always X and moves first; New Game resets.** Rationale: simplest understandable rules; no settings UI to build.
3. **Illegal moves are no-ops with a visible message.** Clicking a taken cell or playing after game over does nothing except a status line. Rationale: no engine to enforce rules, so the UI must fail soft and loud.

## Risks / Trade-offs

- [Risk] Bundle JS quirks on Scribe → Mitigation: ES2019 only, no frameworks, no timers; all rendering is synchronous DOM updates on tap.
- [Risk] No persistence across reloads → Mitigation: accepted and documented; bundle state persistence (actions) can add scores later.

## Migration Plan

None: one additive bundle install. Rollback is `remove_app`.

## Open Questions

None.
