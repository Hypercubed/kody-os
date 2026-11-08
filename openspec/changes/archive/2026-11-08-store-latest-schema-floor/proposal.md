# Proposal: store-latest-schema-floor

## Why

Two install gates, both about version compatibility, and both
needed for an app to install.

**The Store must follow the latest catalog.** A Store's catalog
base is declared in its own definition, and that definition comes
from the catalog at that base. When the base is a fixed release tag
(`v4.1.0`), the Store only ever sees that tag's catalog, where the
Store is itself — so it can never discover its own update. The
Store is frozen at the tag it declares. The fix is for the Store's
declared base to track the latest catalog (the `main` branch, the
latest commit), so the Store sees the newest version of itself and
offers the update. The update is gated by `minPackageVersion`: if
the new Store needs a newer shell than the one running, the update
is refused, the same as any other app.

**The install needs a schema floor as well as a package floor.**
`minPackageVersion` (handoff 10) is one gate: the shell must be new
enough for the app. The other gate is the app's `schemaVersion`:
the shell supports schemas 3, 4, and 5 today, and drops old ones as
a MAJOR change. An app whose schema is below the shell's minimum
supported schema is too old for the shell, even though its
`minPackageVersion` is low and the package gate would pass. The
shell names its minimum supported schema version, and `add_app`
refuses an app whose schema is below it, with a clear error naming
the app, its schema, and the floor — the same shape as the
`minPackageVersion` refusal.

## What changes

- The App Store's declared catalog base moves from the fixed
  `v4.1.0` tag to the `main` branch
  (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`),
  so the Store follows the latest catalog. Its `catalogVersion`
  bumps by the existing rule (16 -> 17, since handoff 11 set it to
  16).
- The shell names its minimum supported schema version
  (`MIN_SUPPORTED_SCHEMA_VERSION`, currently 3, the minimum of
  `SUPPORTED_SCHEMA_VERSIONS`), and `add_app` enforces it as an
  install gate alongside `minPackageVersion`: an app whose
  `schemaVersion` is below the floor is refused, for install and
  update, Store and agent, writing nothing. The Store does not offer
  a one-tap install or update for an app below the schema floor.

## What does not change

- The catalog move, the remote fetch, the declared-source model
  (handoff 11), and `minPackageVersion` (handoff 10) are untouched.
- The agent path is unaffected: the agent supplies its own catalog
  base and can still point at a specific tag for a stable snapshot.
- The fetch discipline (HTTPS-only, timeout, caps, validation,
  cached fallback) is unchanged.
- No commit, push, publish, or version bump in this change; the
  version decision is deferred to publish.
