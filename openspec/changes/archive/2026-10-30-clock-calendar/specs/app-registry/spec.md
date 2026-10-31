## MODIFIED Requirements

### Requirement: App definition schema
Every app definition SHALL carry: `id` (stable slug `^[a-z0-9][a-z0-9-]{0,63}$`, used for routes and storage keys), `name` (display name), `label` (tile label, defaults to `name`), optional `icon` (plain-text glyph, never emoji), optional `category`, optional `description` (help text for humans and agents), `ui` (template `counter` | `hello` | `generic`, optional title, action buttons each referencing a declared action), `stateSchema` (typed fields: `integer` with optional min/max, `string` with optional maxLength, `boolean`; plus `initial` state covering exactly the declared fields), and `actions` (args schema plus one declarative effect: `increment` | `set` | `toggle` | `reset` | `calendar`). A `set` effect MAY declare `fromNow: true` instead of `value`/`fromArg`, writing the current time as an ISO 8601 UTC string; `fromNow` requires a string target field and is rejected with any `value` or `fromArg` present. A `calendar` effect recomputes a monospaced month-grid string field deterministically from an integer month-offset field, so navigation actions (`increment`/`decrement` on the offset plus grid refresh) stay fully declarative with no per-app code.

#### Scenario: Invalid definition is rejected with a reason
- **WHEN** `add_app` receives a definition with a bad id, unknown template, undeclared state field, or a UI action referencing no declared action
- **THEN** it returns `{ ok: false, error }` naming the problem and writes nothing.

#### Scenario: Unknown template still rejected with reason
- **WHEN** `add_app` receives a definition with a template outside the closed set
- **THEN** it returns `{ ok: false, error }` naming the template and writes nothing.

#### Scenario: Stale version on a new id is rejected with the current version named
- **WHEN** `add_app` receives a new id whose `schemaVersion` is missing or older than current
- **THEN** it returns `{ ok: false, error }` naming the current version and writes nothing.

#### Scenario: Overwrite restamps to current
- **WHEN** `add_app` re-adds an existing id
- **THEN** the stored definition carries the current `schemaVersion` regardless of what was submitted.

#### Scenario: Unified app round-trips
- **WHEN** a unified app is exported then imported into a blank install
- **THEN** definition and state are deep-equal to the originals, including `schemaVersion`.

#### Scenario: Pre-version installs backfill on read
- **WHEN** an app installed before versioning is read back
- **THEN** it reports the current version if it validates against the current shape, else the oldest known version — so stale apps are listable.

#### Scenario: SVG icon accepted
- **WHEN** `add_app` receives a definition with a sanitized inline-SVG icon
- **THEN** it returns `{ ok: true, id }` and the icon renders as SVG on tiles.

#### Scenario: fromNow stamps the current time into a string field
- **WHEN** `act` runs a `set` action with `fromNow: true` targeting a string field
- **THEN** the field holds the action-time as an ISO 8601 UTC string and the write is atomic like every other effect.

#### Scenario: fromNow on a non-string field is rejected at validation
- **WHEN** a definition declares `fromNow: true` on an integer or boolean target, or alongside `value`/`fromArg`
- **THEN** `add_app` returns `{ ok: false, error }` naming the conflict and writes nothing.

#### Scenario: Calendar grid is deterministic per offset
- **WHEN** the same month offset is rendered twice via `act` navigation (or re-imported and re-rendered)
- **THEN** the grid strings are byte-identical, the grid reflects that offset month, and a bad offset type is rejected with no partial state change.
