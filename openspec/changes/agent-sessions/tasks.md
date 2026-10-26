## 1. Roster

- [ ] 1.1 Add `register_agent` (identity from the authenticated session, never a parameter; upsert keyed by identity, refresh `last_seen`) and verify double-registration updates instead of duplicating
- [ ] 1.2 Add roster listing ordered by recency with human-readable last-seen and verify unregistered agents never appear and the UI picker renders the same list MCP sees
- [ ] 1.3 Export the roster surface from the package index alongside the existing registry exports and verify it is callable via MCP

## 2. Session lifecycle and cadences

- [ ] 2.1 Add session-row ping on invite and verify both UI reads and MCP reads observe `joined`
- [ ] 2.2 Add leave on app-defined terminal condition, POST-back home/modal navigation, and max-duration backstop, and verify each path flips the row to `left` with the game state itself untouched
- [ ] 2.3 Verify slow/fast cadence behavior and all three fast-mode exits (terminal state, UI close, backstop), plus single-use semantics: a finished session cannot reactivate
- [ ] 2.4 Verify turn nudges flow through the existing agent chat with no new surface, and UI close ends polling without ending the game (state persists, play resumes on reopen)

## 3. Verification

- [ ] 3.1 Run a full human-vs-agent game end to end over MCP against single-player tic-tac-toe and verify invite → fast play → declared result → leave
- [ ] 3.2 Verify `openspec validate` passes for the change
