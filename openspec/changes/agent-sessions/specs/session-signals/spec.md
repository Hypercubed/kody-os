## ADDED Requirements

### Requirement: Ping/leave session rows
Inviting an agent SHALL write a session row with `{status: joined}`; closing the app, reaching the app-defined terminal condition, or hitting the max-duration backstop SHALL flip it to `{status: left}` without touching game state. Sessions SHALL be single-use: a finished session cannot reactivate.

#### Scenario: Leave paths all flip the row
- **WHEN** a session ends via app close, terminal condition, or timeout
- **THEN** the row reads `left` and the game state is untouched.

#### Scenario: Single-use sessions
- **WHEN** a finished session is polled or written to
- **THEN** it stays `left`; a new game requires choosing the agent again.

### Requirement: Slow/fast polling with chat as the instant channel
Agents SHALL poll slow (~1/min) at rest and fast (~10–15s) during sessions, ending fast mode on terminal state, UI close, or the backstop. Turn nudges to the human SHALL go through the native agent chat, never a new surface.

#### Scenario: Fast mode has three exits
- **WHEN** a session reaches terminal state, the UI closes, or the backstop hits
- **THEN** fast polling stops while the game state persists for resume.
