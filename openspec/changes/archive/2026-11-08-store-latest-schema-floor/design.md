# Design: store-latest-schema-floor

## Decisions

### Decision 1: The Store's declared base is the main branch

The App Store's `capabilities.proxy` entry named `catalog` points
at the `main` branch catalog base
(`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`),
not a fixed release tag. The Store follows the latest catalog (the
latest commit), so it sees the newest version of itself and offers
its own update. A fixed tag freezes the catalog: the Store's
definition comes from the catalog at that tag, so a Store pinned to
a tag can never discover a newer catalog or a newer Store. The
update is gated by `minPackageVersion` (handoff 10): if the new
Store version requires a newer shell than the one running, the
update is refused. The agent path is unaffected — the agent
supplies its own base and can point at a specific tag for a stable
snapshot.

### Decision 2: The shell names its minimum supported schema version

The shell names its minimum supported schema version as
`MIN_SUPPORTED_SCHEMA_VERSION`, currently 3, the minimum of
`SUPPORTED_SCHEMA_VERSIONS` (today `[3, 4, 5]`, enforced in
`validateDefinition`). When the shell drops support for an old
schema (a MAJOR change by the version policy), it raises this
floor. The floor is a single named constant in the shell source,
next to `SUPPORTED_SCHEMA_VERSIONS` and `DEFINITION_SCHEMA_VERSION`.

### Decision 3: The schema floor is an install gate in add_app, alongside minPackageVersion

`add_app` enforces the schema floor as an install gate, in the same
place and the same shape as the `minPackageVersion` gate (handoff
10). When `definition.schemaVersion` is below
`MIN_SUPPORTED_SCHEMA_VERSION`, `add_app` returns
`{ ok: false, error }` naming the app, its schema version, and the
minimum supported schema version, and writes nothing. The gate
covers install and update, Store and agent, since all funnel
through `add_app`. This is in addition to (not a replacement for)
`validateDefinition`'s supported-list check: validation ensures the
definition is well-formed, and the gate is the compatibility check
that belongs alongside `minPackageVersion`, with a consistent error
shape. Equal is compatible: an app whose schema equals the floor
installs.

### Decision 4: The Store does not offer install below the schema floor

The Store does not offer a one-tap install or update for an app
whose `schemaVersion` is below the shell's floor; it shows the
schema requirement instead. An update to a definition whose schema
is below the floor is refused the same way. This mirrors the
`minPackageVersion` Store behavior (handoff 10). The two
incompatibilities are distinct: `minPackageVersion` means the shell
is too old for the app; the schema floor means the app is too old
for the shell.

### Decision 5: The two gates are complementary, not redundant

`minPackageVersion` catches an app that is too new for the shell
(it requires a newer shell). The schema floor catches an app that
is too old for the shell (the shell dropped its schema). No
separate upper bound on the schema is needed: an app declaring a
schema newer than the shell knows would have to come from a newer
shell, and that newer shell is exactly what its `minPackageVersion`
would require, so the package gate catches it.

### Decision 6: Version decision deferred to publish

Naming the schema floor and enforcing it in `add_app` does not
remove, rename, or reshape an MCP export, and does not invalidate
any app definition (no shipped app is below the floor). The
Store's definition change (its catalog base URL) bumps app-store
`catalogVersion` 16 -> 17 by the existing rule. No
`pkg/package.json` change in this change; the release version
decision is deferred to publish.
