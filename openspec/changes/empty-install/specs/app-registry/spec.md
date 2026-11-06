# Spec Delta

## ADDED Requirements

### Requirement: Empty registry stays empty

A shell request against an empty registry SHALL NOT install any app. Removing the last installed app SHALL leave the registry empty on the next shell request; no seeding, flag, or explicit-removal state SHALL re-install anything.

#### Scenario: Fresh install stays empty
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** `list_apps` still returns an empty list and no app is installed.

#### Scenario: Removing the last app stays empty
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the registry is still empty and no catalog app is installed.

## MODIFIED Requirements

### Requirement: remove_app uninstalls cleanly

`remove_app` SHALL delete the app's definition and state and scrub all of its references (pinned, hidden, recency, homepage order) atomically: either everything is gone or nothing changed. Removing an unknown id SHALL return `{ ok: false }` with a naming error and write nothing. Removing any installed app, including the App Store, SHALL be allowed exactly like any other app. `remove_app` SHALL be exposed only through the MCP surface; the browser shell SHALL NOT call it or render a removal control.

#### Scenario: Full uninstall leaves no references
- **WHEN** `remove_app` runs on an installed app that is pinned, hidden, and recently used
- **THEN** it returns `{ ok: true, id }`, the definition and state keys are gone, and no list anywhere in storage still names the id.

#### Scenario: Removing an unknown app is a clean error
- **WHEN** `remove_app` is called with an id that is not installed
- **THEN** it returns `{ ok: false }` naming the id and writes nothing.

(Changed wording only: "a seeded/prebuilt app" becomes "any installed app, including the App Store", because seeding no longer exists. The final two sentences are intentionally untouched in this change: they conflict with the Store's Remove button (bundle v10, commit `08b81cd`), which is pre-existing drift for a separate change — see design.md Open Questions.)

## REMOVED Requirements

### Requirement: First use seeds only the App Store

On the first authenticated shell request against an empty registry, the shell SHALL install exactly one app — the App Store (`app-store`), whose definition ships in `pkg/catalog/` — through the validated `add_app` path, before serving the request. "First use" means after the package has been forked and published as a live saved package; a fork's storage starts empty (source-only copy), so the first shell request is the first moment seeding can run. Kody's "adopt" step (owner-only secret-access grant) is a separate action and is NOT the seeding trigger. Seeding SHALL never run when the registry is non-empty, SHALL never install any other catalog app, and SHALL be idempotent (re-running it against a store that already holds the App Store changes nothing). Seeding SHALL NOT run from MCP registry reads or from `import_install` into a blank store. Removing the App Store via `remove_app` SHALL be allowed exactly like any other app; if the registry later becomes empty, the next shell request SHALL seed the App Store again.

#### Scenario: Blank install opens with only the App Store
- **WHEN** a blank store receives its first authenticated shell request
- **THEN** exactly one app is installed (`app-store`), and subsequent shell requests show it without re-seeding.

#### Scenario: Seeding never overwrites user state
- **WHEN** the registry already contains any app
- **THEN** seeding does not run and the user's registry is untouched.

#### Scenario: Empty registry restores the store
- **WHEN** every app including the App Store has been removed and a shell request arrives
- **THEN** the App Store is installed again and no other catalog app is installed.

#### Scenario: MCP reads do not seed
- **WHEN** `list_apps` is called against a blank store with no shell request having run
- **THEN** it returns an empty list and the store is byte-identical before and after the call.

(Removed in full: seeding is deleted, not made conditional. The "MCP reads do not seed" behaviour is preserved by the new "Empty registry stays empty" requirement above — MCP reads never wrote anything, and now shell requests do not either.)
