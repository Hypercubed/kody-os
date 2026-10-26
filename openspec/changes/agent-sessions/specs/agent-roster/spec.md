## ADDED Requirements

### Requirement: Agent roster
Agents SHALL self-register over MCP with identity taken from the authenticated session (never a parameter), stored as `{ agent_id, label, registered_at, last_seen }` under `kody-os.agents.*`. Re-registration SHALL upsert and refresh `last_seen`. Roster listing SHALL order by recency with human-readable last-seen; unregistered agents SHALL never appear.

#### Scenario: Double registration updates instead of duplicating
- **WHEN** an agent registers twice
- **THEN** one row exists with a refreshed `last_seen`.

#### Scenario: UI picker matches MCP list
- **WHEN** an opponent picker renders
- **THEN** it shows exactly the MCP-visible roster in the same order.
