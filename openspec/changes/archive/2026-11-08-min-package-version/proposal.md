# Proposal: min-package-version

## Why

The shell should not care what store or catalog you use. Another user
can install another store, and the primary install path is asking your
agent to install an app directly from a repo. The safety mechanism for
that world is not a pinned catalog release in the shell — it is a real
compatibility check: an app declares the minimum shell version it
needs, and the shell refuses to install it when the running shell is
too old.

Today there is no such check. An app that uses a shell feature (an MCP
export, a capability, a route, a `schemaVersion` behavior) added in a
newer shell can be installed on an older shell and then fail
confusingly, or silently do the wrong thing. The catalog pin
(`public-pinned-catalog`) was the previous answer to that risk, but it
ties the shell to one catalog source and forces a pin-move publish for
catalog updates to reach users.

This change adds the compatibility check itself, in the shape Herdr
already uses for plugins: a minimum-version field on the installable
unit, enforced at install time by the host. Herdr's
`herdr-plugin.toml` requires `min_herdr_version`, and Herdr "refuses
to link or install a plugin when its minimum version is newer than
the current binary" (herdr.dev Plugins docs). This change brings the
same mechanism to kody-os app definitions.

Note on scope: the `min_herdr_version` mechanism lives in Herdr's TUI
plugin system (`herdr-plugin.toml`). Herdr-app mods (the desktop app's
plain-JS mods under `~/.config/herdr-app/mods/`) have no enforced
equivalent — compatibility there is only a README note ("Requires the
Herdr desktop app 0.1.9+") plus a `herdr-app check` validation. This
change goes beyond what Herdr-app mods do, by enforcing the check in
the shell, in the TUI plugin pattern.

## What

- A new optional definition field, `minPackageVersion` (a
  `MAJOR.MINOR.PATCH` string), declaring the minimum kody-os package
  (shell) version the app requires. Absent means no minimum.
- Enforcement in the shell's install path (`add_app`, which backs
  `install_from_catalog` and the Store's install/update): when the
  running shell version is older than the app's minimum, the install
  is refused with an error naming the app, the required minimum, and
  the running shell version.
- The Store surfaces the incompatibility instead of offering a
  one-tap install/update for an app the shell is too old for.
- The check applies to installs and to updates (a newer definition
  that raises the minimum is refused the same way).

## Non-goals

- No catalog pin is added or required by this change, and it does not
  depend on one. Whether the `public-pinned-catalog` pin constant
  stays or goes is a separate decision.
- No change to the catalog source, the Store's catalog, or where
  definitions are fetched from.
- No sandboxing. Capabilities remain disclosure plus a server-side
  allowlist, not a sandbox — same as today.
- No retroactive check: already-installed apps keep running. The
  check is install/update-time only.
- No change to `schemaVersion` (definition format era) or to
  `catalogVersion` (per-app release version), except that adding or
  changing `minPackageVersion` is a definition change, so it follows
  the existing `catalogVersion` +1 rule.
