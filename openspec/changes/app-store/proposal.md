# Proposal

## Why

Every fresh install still starts empty in the browser: the only way to get an
app is to ask an agent to call MCP `add_app`. The definitions that would make
a new OS immediately useful already ship in the package (`pkg/examples/`),
but nothing in the browser can reach them. The superseded `prebuilt-apps`
change would have auto-installed that whole set on first run; this change
installs one app instead and lets the user choose the rest.

## What Changes

- `pkg/examples/` is renamed `pkg/catalog/`. The directory is the shipped
  catalog: every `*.bundle.json` in it is an app the user can install from
  the browser. The name `examples` described reference fixtures; `catalog`
  describes the source the App Store lists.
- The package ships with exactly one prebuilt app, installed on first
  shell use after the fork is published (first authenticated shell
  request against an empty registry): the **App Store** (`app-store`).
  It is an ordinary data-driven app, installed through the validated
  `add_app` path like any other app. Kody's separate "adopt" step
  (an owner-only secret-access grant for a reviewed fork) is not this
  moment and is not the seeding trigger; see design.md.
- Opening the App Store lists every catalog app. Installing one reads its
  bundled definition and loads it into the data store through `add_app` —
  the same validation, atomicity, and state rules as every other registry
  write. No agent, no MCP call, and no republish is needed.
- Explicit non-goals: no remote catalog, no third-party submissions, no
  ratings or search/filter in the store listing (the `apps-search` change
  covers filtering the All-apps list, not the store), no seeded-app update
  mechanics (a republish ships new catalog definitions; installed apps keep
  their state until re-installed from the store), no MCP call needed for
  a browser store install. Custom apps still arrive via an agent and
  `add_app`, unchanged. (Correction 2026-10-30: the earlier "no change
  to the MCP surface" wording is superseded — catalog tools including
  `install_from_catalog` were exported from `pkg/src/index.ts` on
  2026-10-30 outside this change; see tasks 5.2.)

## Capabilities

### New Capabilities

(none — both behaviors extend existing capabilities)

### Modified Capabilities

- `app-registry`: lifecycle gains the shipped catalog and install-from-catalog
  through the existing validated `add_app` path, plus first-run seeding of
  the single App Store app.
- `shell`: the App Store app page gains a server-rendered catalog listing
  with install controls; Help and empty-state copy gain the browser install
  path. No new chrome, no new route family.
- `authoring`: catalog membership rules (what a file in `pkg/catalog/` must
  satisfy, and how a new app joins the catalog) replace the `pkg/examples/`
  contents requirement.

## Impact

- `pkg/src/apps/catalog.ts` (new; explicit per-file imports of the catalog
  definitions — the Worker has no directory listing), `pkg/src/apps/registry.ts`
  (install-from-catalog + seeding helper), `pkg/src/apps/client.ts` (store
  listing section), `pkg/src/app.ts` (seed-on-first-use + install handling on
  the store page), `pkg/catalog/app-store.bundle.json` (new; the store
  definition), `pkg/catalog/README.md` (rewritten), `pkg/docs/adding-an-app.md`
  and `pkg/AGENTS.md` (catalog + browser-install copy, path updates).
- `pkg/examples/` and every reference to it move to `pkg/catalog/` in the
  same change, verified by a repo-wide grep. No storage-key changes; no
  export-format change; seeded definitions install via `add_app`, so the
  existing validation, atomicity, and export rules apply unchanged.
- This change supersedes `prebuilt-apps` in full: that change (spec only,
  never implemented — no code imports the example bundles today) is archived
  as `openspec/changes/archive/2026-10-29-prebuilt-apps/`. Its lazy-seeding
  rationale is kept, narrowed to the one store app; its seed-the-whole-set
  behavior and its "no gallery/catalog UI" non-goal are retired. The shipped
  `app-registry` spec's "seeded/prebuilt" wording in the `remove_app`
  requirement now refers to the App Store.
- BREAKING: none for installed apps or agent scripts. The directory rename
  moves files agents and docs read by path; the rename is covered by the
  reference sweep in the tasks. Version: MINOR at implementation (new
  capability, nothing existing breaks) — see design.md. This spec draft
  itself, outside `pkg/`, bumps nothing.
