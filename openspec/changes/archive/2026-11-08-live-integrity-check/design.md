# Design: Live integrity check against the published package

## Decisions

### Decision 1 — The check runs against the live published package, via cloud execute

The incident was specifically that the *published build* resolved a `kody:` import differently from what the repo source suggested. A mock check cannot catch that: the mock runs repo source (or a local build) and does not exercise the published package's module resolution. A `be-quite-900` (local PC) check cannot catch it either — it runs local source, not the published build.

The check therefore runs via cloud execute on the MCP bridge (the same `execute` tool used for live app management), with no `context` that would route it to a local machine. It imports from `kody:@hypercubed/kody-os` exactly as an agent would, so it exercises the published package's module resolution. If the publish has not propagated yet, the check fails honestly (the imports resolve to the previous build) rather than passing against a stale build — the runner waits for / re-checks after the publish completes.

### Decision 2 — The check is read-only

The check installs nothing, writes no app state, and does not mutate the live instance. It verifies by importing and reading only: namespace/named imports, `list_apps()`, `list_catalog()` (with the declared base), `get_app_state()` on an installed app, and a fingerprint comparison for the installed App Catalog.

Rationale: a post-publish gate must be safe to run after every publish, including publishes that change nothing about the installed apps. Installing a canary app to prove install works would mutate live state (a new app, a new snapshot, a changed app list) and would need cleanup — cleanup that itself could fail and leave the live instance dirty. The fingerprint comparison proves the App Catalog install path produced a correct, current install without writing anything; the import check proves the install *entry points* resolve, which is the failure the incident exposed.

### Decision 3 — The import-resolution check is the core assertion

The single check that would have caught the v4.1.0 incident is the import check, so it is the core of this change and it runs first (fail fast):

- A namespace import (`import * as pkg from 'kody:@hypercubed/kody-os'`) in cloud execute SHALL return the expected named keys — at minimum `install_from_catalog`, `add_app`, `list_apps`, `get_app`, `get_app_state`, `act` — and not just `default`.
- Single named imports SHALL resolve for the same set (a named import of any one of them succeeds; the build does not fail with "No matching export").

If the namespace import returns only `default`, the check fails immediately with that fact named. This is the exact signature of the incident (the module resolved to the app entry, which only exports `default` and `getTheme`).

### Decision 4 — The App Catalog is verified by fingerprint, not by re-installing it

Re-installing the App Catalog as a test would write an install snapshot and touch live state. Instead the check verifies the installed `app-store` is current: it reads the installed definition (via `get_app`) and the catalog manifest entry (via `list_catalog` / `get_catalog_definition` from the declared base) and compares `fingerprintDefinition(installed)` to the manifest entry's `fingerprint`, plus `catalogVersion` equality. A match means the Store was installed from the current catalog and is up to date; a mismatch means the live Store is stale or differs, and the check fails naming the app and the mismatch.

This is the same comparison the Store itself uses for its up-to-date rows, applied from the outside as a read-only assertion.

### Decision 5 — The check is a gate before the package goes public

The check runs after every publish (it is part of the release procedure, alongside the catalog harness and the manifest regeneration). It SHALL pass before the package is made public or a release is announced. If it fails, the package stays private, the failure is reported (which check, and the observed value — e.g. "namespace import returned only `default`"), and no public announcement is made. Fixing the failure is a new publish (with its own version bump), followed by a re-run of the check.

This does not change who decides to make the package public — that remains the user's explicit call. It only adds the condition that the call is made on a passing check.

### Decision 6 — The check is a versioned script, not a manual procedure

The check lives as a script in the repo (`scripts/live-integrity-check.py`, run from the VM via the MCP bridge client), so it is versioned, reviewable, and runnable the same way every time. It exits `0` on all checks passing and non-zero on any failure, printing the failed check name and the observed value. The script takes the bridge client path as a parameter (or environment variable) because that path is VM-specific and does not belong hardcoded in the repo.

The implementer picks the exact script form (Python over the MCP `client.py`, or a `kody execute --local` equivalent) as long as it runs the assertions in Decision 3–4 against the *live published* package via cloud execute and reports pass/fail per check.

### Decision 7 — Relationship to the owed browser end-to-end (handoff 09) and public-pinned-catalog 3.1

Handoff 09's owed post-tag check (a real `kody dev` browser end-to-end against the tagged release) and `public-pinned-catalog` 3.1 (verify end-to-end against a real public release: manifest/definitions fetch, install/update/restore round-trip through the App Store, snapshots classify correctly) are the browser-UI half of release verification. This live integrity check is the MCP/API half. They are complementary: the browser check proves a human can use the Store in a browser; this check proves an agent can import and call the package. Neither subsumes the other, and this change does not close 3.1 — it adds the gate that runs first (fast, read-only, no browser needed) before the browser check.

## Version decision

Deferred to publish. This change is specs plus a repo script (`scripts/`, outside `pkg/`), so per the version policy it does not bump the version on its own. No MCP export is added, removed, renamed, or reshaped; no catalog app definition changes.
