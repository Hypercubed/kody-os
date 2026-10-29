## ADDED Requirements

### Requirement: Launcher lists are readable through the package root

The package SHALL expose the launcher lists through the same root import agents already use for every other registry read: `get_pinned`, `get_hidden`, `get_recent`, and `get_homepage`, plus an aggregate `get_launcher_state()` returning `{ pinned, hidden, recent, homepage }`. Each reader SHALL return the stored ordered id list for its key, and `[]` when the key is missing, without writing anything. The aggregate SHALL return the four lists in their stored orders. The readers SHALL be listed in `main()`'s `exports` array. No launcher write surface is added by this requirement.

#### Scenario: Agent imports the readers from the package root
- **WHEN** an agent imports `get_pinned`, `get_hidden`, `get_recent`, `get_homepage`, and `get_launcher_state` from `kody:@hypercubed/kody-os` via `execute`
- **THEN** every import resolves and each call returns an array (or the aggregate object) with no bundle/import error.

#### Scenario: Aggregate matches the individual readers
- **WHEN** a store holds known pinned, hidden, recent, and homepage lists
- **THEN** `get_launcher_state()` returns exactly those four lists, in stored order, equal to the four individual reader results.

#### Scenario: Blank store reads empty without writing
- **WHEN** the readers and the aggregate are called against a blank store
- **THEN** each returns `[]` (aggregate: four empty lists) and the store is byte-identical before and after the calls.

#### Scenario: Readers track UI changes and removal scrubbing
- **WHEN** an app is pinned, hidden, and added to the homepage through the shell UI, then removed via `remove_app`
- **THEN** before removal the readers report it in the pinned, hidden, and homepage lists (matching what `/` and `/apps` render), and after removal no reader lists it in any list, while the other apps' memberships are unchanged.

#### Scenario: Reads are ungated like other registry reads
- **WHEN** an agent calls the readers over MCP
- **THEN** no device access code is required, matching `list_apps` and `get_app_state`.
