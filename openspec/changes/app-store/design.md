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
  `add_app` path; catalog membership as a checkable rule; for catalog apps
  with an install snapshot, a store that can tell behind from modified
  and offer a confirmed update (Decisions 7–10).
- Non-goals: remote/third-party catalogs; store search, ratings, or
  reviews; a store that is itself a bundle-JS
  listing (a static bundle cannot know installed state — the listing is
  shell-rendered, like the state readout). (Correction 2026-10-30: the
  earlier "an MCP install export (agents already have `add_app`)"
  non-goal is superseded — `install_from_catalog` now exists as the MCP
  install path, added 2026-10-30 outside this change; the store reuses
  it and needs no further MCP export.) (Correction 2026-10-31: the
  earlier "per-app update prompts" non-goal is superseded for versioned
  catalog apps with an install snapshot — update controls and the
  modified-app confirmation are now goals, scoped by Decisions 7–11.
  Auto-update remains a non-goal: every update is user-chosen.)

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
7. **Catalog version: one monotonic integer per app, not the shell
   version.** Every catalog definition carries `catalogVersion`: an
   integer starting at 1 on that app's first versioned release, incremented
   by exactly 1 on any change to that app's definition file (bundle,
   stateSchema, actions, capabilities, or metadata — any file change counts,
   because the installed copy is the whole definition). It is never
   reused, never decreased, and never bumped for an unrelated app or for
   a shell change. Rationale: ordering is all the store needs, so an
   integer avoids inventing per-app MAJOR/MINOR semantics, and it must
   not be confused with the shell's package version (which moves when
   anything in the package changes) or with `schemaVersion` (which only
   says which definition format era the definition uses). The canonical
   stored definition preserves `catalogVersion` through `add_app`
   normalization; a catalog definition without a valid `catalogVersion`
   fails catalog validation.
8. **Modification is detected by an install snapshot, not by comparing
   installed to current catalog alone.** When the store installs or
   updates a catalog app, it records a snapshot separate from the
   definition: the app's `catalogVersion` at install time and a
   deterministic fingerprint of the definition as actually stored. The
   fingerprint is computed on the canonical stored form — after `add_app`
   normalization (schema version restamp, effects migration, icon
   sanitization, open-mode derivation) — never on the raw catalog file,
   or a clean install would immediately mismatch its own snapshot.
   Rationale: installed-vs-current-catalog comparison alone cannot
   distinguish the two cases that matter. A clean old app and a
   user-modified old app both differ from the new catalog, and both
   usually still carry the old version number. Only the third value —
   what the app looked like when it was installed — separates them.
9. **Status is derived from three values, and the store never
   auto-updates.** Let I be the installed definition's fingerprint, S the
   snapshot fingerprint, C the current catalog definition's fingerprint
   (canonicalized the same way), Iv the installed `catalogVersion`, and
   Cv the catalog `catalogVersion`:
   - I == C: up to date, clean. No update is offered, whatever the
     version fields say — content equality wins.
   - I == S, Iv < Cv: behind, clean. Offer Update.
   - I == S, Iv == Cv, I != C: the catalog changed without a version
     bump. Classify as catalog-differing, not as modified — the user did
     not change anything. Offer Update, with no modification warning.
   - I != S, I != C: modified. Subclass by version: Iv < Cv is behind
     and modified; Iv == Cv is modified at the current version; Iv > Cv
     is modified and ahead of (diverged from) the catalog. A modified
     app is never presented as a plain update, and a catalog copy is
     never presented as an update to an ahead app.
   - No snapshot: no status is claimed (Decision 11).
   An update is always user-chosen. There is no background, first-visit,
   or publish-time update of installed apps.
10. **A modified app's update is a confirmed update with an exact loss
    warning.** Updating (or restoring) a modified app replaces its
    definition — bundle files, stateSchema, actions, capabilities, and
    metadata — with the catalog copy, so the user's custom definition
    changes are lost and cannot be recovered afterwards unless they
    exported the app first. State is preserved by the existing `add_app`
    rule: fields still declared in the new definition carry forward,
    dropped fields reset to `initial`; pins, hidden flags, homepage
    placement, and recency are untouched. The store's confirmation step
    SHALL state both halves (definition changes lost; state carried
    forward for surviving fields, dropped fields reset) before the
    update runs, and the update SHALL NOT run without that explicit
    confirmation. The confirmation is a store-UI layer around the
    registry update path, not a change to the agent `update_from_catalog`
    call, which is already an explicit agent-directed action. For a
    modified app at the current version, the control is Restore catalog
    version, not Update; for a modified app ahead of the catalog, the
    control is likewise Restore, never Update, since taking the catalog
    copy would be a downgrade.
11. **Snapshot-less installs are out of scope for this change.**
    Apps installed before versioning — and any app whose snapshot is
    missing for any other reason — have no baseline to compare against,
    so old vs. modified is genuinely unknowable for them. The store
    SHALL NOT infer a status for such an app and SHALL NOT offer it an
    update control under this scheme; its row keeps the existing
    Installed behavior. Migrating snapshot-less installs (including
    whether to baseline them, and what that would launder) is deferred
    to a later change and is deliberately not decided here. A snapshot
    is created only by a store install or store update; generic
    `add_app` and `import_app` SHALL NOT write it, and `remove_app`
    SHALL delete it with the app.

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
  until re-installed. Mitigation (updated 2026-10-31, superseding the
  earlier out-of-scope stance for versioned apps): for catalog apps with
  an install snapshot, the store classifies the divergence (Decisions
  7–9) and offers a user-chosen, confirmed update; for snapshot-less
  installs the store claims no status and offers no update control
  (Decision 11). The store never auto-updates, so it cannot promise —
  or perform — an update the user did not choose.
- [Risk] A confirmed update destroys a user's live modifications by
  design. Mitigation: the update runs only after an explicit
  confirmation naming exactly what is lost (definition changes) and what
  is kept (state for surviving fields); a modified app is never offered
  a plain, unconfirmed Update control, and the confirmation states that
  the loss is unrecoverable unless the app was exported first.
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

MINOR at implementation, in the same commit as the code, per
`pkg/AGENTS.md` (new capability, nothing existing breaks; PATCH reset
to 0, BUILD +1 on publish). `pkg/AGENTS.md` and `pkg/README.md` headers
state the new version in that same commit. (Correction 2026-10-31: the
earlier pinned `0.1.7` → `0.2.0` line is stale and is superseded by this
paragraph — the implementation bump is determined at implementation
time from the then-current package version.) This spec draft does not
bump anything.

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
