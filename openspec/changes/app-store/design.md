# Design: app-store

## Context

See proposal.md (Why). Today the registry resolves stores via `resolveStore()`
(hosted `packageStorage()` with in-memory fallback), validates + applies
atomically in `add_app`/`act()`, and round-trips definitions through
`export_app`/`import_app`. Nothing in the browser can install an app: the
Help page says so ("the browser has no add control"), and no code imports
`pkg/examples/*.bundle.json` at runtime — the files are installed only when
an agent reads one and calls `add_app` (verified: all seven current bundles
validate and install through `add_app` against a memory store). The shell
already has the pattern this change reuses: pin/hide/home mutations are
plain GET forms on `/apps` that mutate server-side and 303 back, because
Kody's edge rejects mutating POSTs to the package-app subdomain. The client
enhancement only intercepts `form.app-action`, so install forms must not
carry that class.

## Goals / Non-Goals

- Goals: one seeded store app; a server-rendered catalog listing the user
  can install from with no agent; install through the existing validated
  `add_app` path; catalog membership as a checkable rule.
- Non-goals: remote/third-party catalogs; store search, ratings, or
  reviews; per-app update prompts; a store that is itself a bundle-JS
  listing (a static bundle cannot know installed state — the listing is
  shell-rendered, like the state readout). (Correction 2026-10-30: the
  earlier "an MCP install export (agents already have `add_app`)"
  non-goal is superseded — `install_from_catalog` now exists as the MCP
  install path, added 2026-10-30 outside this change; the store reuses
  it and needs no further MCP export.)

## Decisions

1. **Seed exactly one app, lazily, on first shell use — not on any registry
   read.** "First use" is the first authenticated shell request (home, Apps,
   or app page) against an empty registry, after the fork has been
   published as a live saved package. A fork copies source only (the
   listing snapshot at fork time); the fork's storage starts empty, so
   the first shell request is the first moment seeding can run — no
   code runs at fork/publish time, and there is no Kody install-time
   hook in this package. (The empty-storage premise is an inference
   from the Kody docs' fork model — `communityFork` copies HEAD and
   creates no saved package row until publish, and the docs list only
   listing snapshot, ratings, and profiles as cross-user flows — not a
   sentence stating it outright; the setup-guide change records the
   verification step.) Kody's "adopt" step is a different, later,
   owner-only action (Settings page, grants the fork self-authored-like
   secret access) and is NOT the seeding trigger; this spec avoids the
   word "adoption" for seeding so the two are never confused. Rationale:
   scoping seeding to shell dispatch keeps MCP reads pure
   (`list_apps` on a blank store stays a read, the launcher-reads blank-store
   scenario stays byte-identical, and `import_install` into a blank store is
   unaffected). The `prebuilt-apps` design seeded on any registry read for
   uniformity across surfaces; that uniformity is worth less than keeping
   reads side-effect-free now that the seed set is one app the browser
   owns. Alternative (seed inside `list_apps()`) rejected for those
   side effects; if a future surface needs the store without the browser,
   it calls the same ensure helper explicitly. Seeding runs through
   `add_app` (validation applies to the store definition too) and is
   idempotent: same id, same definition, overwrite-identical.
2. **The store is a catalog member.** Its definition lives at
   `pkg/catalog/app-store.bundle.json` alongside the apps it lists, and the
   catalog module imports it the same way. Rationale: one import mechanism,
   one validation gate, no second seed source to drift. The listing
   excludes the store itself (it is already installed by definition of
   being open; an Install button for it inside itself is noise). The
   exclusion is one explicit rule, scenario-pinned.
3. **Catalog = explicit import list, alphabetical by id.** The Worker
   cannot list package files at runtime, so `catalog.ts` imports each
   `*.bundle.json` by path (the same JSON-import form `app.ts` already uses
   for `package.json`/`os-theme.json`). Listing order is import-list order,
   kept alphabetical by id. Adding a catalog app means adding the file, one
   import line, and a README entry — recorded as a checklist, not discovered
   by convention. A file present without an import is not listed; the
   verification harness fails when the directory and the import list
   disagree.
4. **Install is a shell GET form + 303, handled in dispatch, executed by
   `add_app`.** The store page renders one GET form per not-yet-installed
   catalog app (`?install=<id>`, carrying whatever session credential the
   auth transport in force at implementation requires — today a hidden
   `k` field on the query-auth path, following the pin/hide precedent;
   if the auth-rethink change lands first, the form follows the new
   transport and carries no query key — see Open Question 6). Dispatch validates the id against
   the catalog, calls the install helper, and 303s back to the store page
   so the user can install more. Unknown ids fail closed (400 + store page
   with an inline error, no write), mirroring bad-action handling.
   Re-installing an installed app is not offered in the listing (the row
   shows Installed + a link to the app); under the hood the helper is plain
   `add_app`, so a re-install through any path preserves state by default
   and never wipes it — the store SHALL NOT pass `resetState: true`.
   Install changes nothing else: no pin, no homepage entry, no recency
   entry for the installed app. The user pins/adds to home from Edit, as
   today.
5. **The store app itself is stateless and page-only.** No state fields,
   no actions, `placements: ["page"]`. Its bundle is minimal descriptive
   HTML; the catalog listing is a shell-rendered section on the same page
   (server-rendered, no-JS-safe, same as every other shell section). A
   bundle-JS listing was rejected: bundles are static, installed-state is
   server state, and a JS-only listing would break the shell's
   server-rendered contract. Modal/widget placements are excluded: a store
   needs a full page, and a widget listing would duplicate the Apps page.
6. **Rename, don't duplicate.** `pkg/examples/` becomes `pkg/catalog/` in
   this change, with a full reference sweep (docs, `AGENTS.md`, `README.md`,
   authoring spec, counter harness header). `catalog` was chosen over
   `store` (collides with storage/`packageStorage` vocabulary) and over
   `library` (implies a collection the user owns, not the shipped set).
   The counter harness stays runnable from its new path.

## Risks / Trade-offs

- [Risk] A user removes the store (MCP `remove_app`, allowed like any app),
  then removes everything else: the next shell visit re-seeds the store,
  because "empty registry" is the only seed marker. Mitigation: stated
  explicitly in the spec — fresh-start restores the store, which is the
  desired behavior for a fresh install; permanently removing the store
  would need a seeded-once marker key, deliberately not added here.
- [Risk] Catalog definitions are trusted code: a bundle runs same-origin
  with session authority, so shipping a definition in the catalog is
  trusting its bundle JS, exactly as `add_app` trusts any definition.
  Mitigation: catalog files ship in the publisher's package and pass the
  same validator; no third-party or remote definitions ever enter the
  catalog by this change. The catalog README states the trust rule.
- [Risk] Catalog and installed copies diverge: a republish ships a newer
  catalog definition, but installed apps keep their stored definition
  until re-installed. Mitigation: out of scope by design (same rule as
  `prebuilt-apps`); the store listing shows Installed state only, never
  an update badge, so it cannot promise an update it does not perform.
- [Risk] The store definition fails validation at runtime (bad publish).
  Mitigation: seeding fails closed like any bad definition and the shell
  degrades to the honest empty state with guidance; the dev-time harness
  (task 1.2) must catch this before publish, since a blank install with a
  broken store has no browser install path.

## Migration Plan

None for data: no storage-key or export-format changes; populated stores
are untouched (seeding fires only on empty registries), and installed apps
keep definitions and state byte-identical. The directory rename is a file
move + reference sweep in the same change; agents reading definitions by
the old path must use the new one after this change ships. Rollback is a
republish of the prior commit (old code ignores `install` params and the
catalog directory; the store app, if installed, remains as an ordinary
app removable via `remove_app`).

## Version

MINOR at implementation, in the same commit as the code: `0.1.7` →
`0.2.0`, PATCH reset to 0, BUILD +1 on publish, per `pkg/AGENTS.md`
(new capability, nothing existing breaks). `pkg/AGENTS.md` and
`pkg/README.md` headers state the new version in that same commit. This
spec draft does not bump anything.

## Open Questions

1. Confirm the rename target is `pkg/catalog/` (vs. `pkg/store/`).
2. Confirm seeding stays shell-dispatch-only (Decision 1) rather than
   also firing from `list_apps()`.
3. Confirm the store listing excludes the store itself (Decision 2).
4. Confirm no MCP export for install-from-catalog (agents keep `add_app`).
5. Counter (`category: Tests`, "validation app" description) and Probe
   (diagnostics) read as fixtures in a user-facing listing. Confirm
   whether task 1.3 polishes their label/description/category for the
   store, or the listing ships their current copy unchanged. No catalog
   app is excluded either way — the catalog is every file in the
   directory.
6. Ordering with the auth-rethink change: whether the store lands
   before or after query-auth (`?k=`) is removed, and which auth
   transport the install forms and the "authenticated shell request"
   in Decision 1 follow. The store's behavior is the same either way;
   only the session-credential detail in Decision 4 changes.
