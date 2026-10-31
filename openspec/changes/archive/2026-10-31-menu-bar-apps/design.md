# Design: menu-bar-apps

## Context

Today the menu bar is rendered by `shellChrome()` in
`pkg/src/app.ts`: a brand mark, a `<nav>` with Home, Apps, and a
static Help link, and a clock at the far right. (Logout was in that
nav until 1.3.2, which moved it to the footer with a confirm modal;
this change does not touch logout.) `shellChrome()` is a synchronous
string builder called from authenticated route handlers that already
run in promise chains, so the menu list has to be loaded before
rendering, not inside `shellChrome()` itself.

App definitions carry `ui` in `pkg/src/apps/types.ts`
(`title`, `openAs`, `actions`, `hideState`), validated in
`pkg/src/apps/registry.ts` (`validateDefinition`) and canonicalized
on `add_app` (the stored `ui` is rebuilt field by field, so a new
field must be added to that rebuild or it is silently dropped).
`list_apps()` builds an `AppSummary` per installed definition and
already accepts `includeHidden: false` to exclude hidden apps.
`remove_app()` deletes the definition and state and scrubs the
pinned, hidden, recent, and homepage lists; the menu needs no
scrubbing because it reads definitions, not a list.

The catalog is an explicit import list in
`pkg/src/apps/catalog.ts` (the Worker cannot list directories), and
`tests/catalog-harness.ts` fails if the directory contents and the
import list disagree. Help today is a static body string in the
`/help` route in `pkg/src/app.ts`, not a bundle, not in the
catalog, and not installable.

## Goals / Non-Goals

- Goals: a definition flag, a derived menu, Help as a catalog app,
  About flagged, docs and harness coverage, and a MINOR version
  bump in the same commit as the code.
- Non-goals: see proposal.md. In particular, this change does not
  add a menu toggle, an order list, seeding, or an MCP export, and
  it does not re-add Logout to the menu bar.

## Decisions

1. **Field name and place: `ui.menuBar: boolean`, optional,
   default false.** It sits next to `hideState` in `UiDef`, the
   other boolean `ui` flag. A non-boolean value is a validation
   error, like `hideState`. Old definitions without the field read
   as false, so nothing already installed gains a menu entry
   unless its definition is re-added.
2. **Summary carries it: `AppSummary.menuBar: boolean`, always
   present in `list_apps()` output.** Additive only; existing
   consumers ignore the extra field. The shell reads the summary,
   never the raw definition, to build the menu.
3. **Derivation, not storage.** Menu = `list_apps()` with
   `includeHidden: false`, filtered to `menuBar === true`,
   sorted by label case-insensitively, ties broken by id.
   No storage key, no order list, no migration. Uninstalling
   removes the entry because the definition is gone; hiding
   removes it because the derivation excludes hidden apps
   (decision, 2026-10-31, confirmed by the user).
4. **Placement: after Apps, alphabetical, text links.** The nav
   becomes Home, Apps, then menu apps in label order, then the
   clock. The static Help link is deleted; Help's position is
   whatever alphabetical order gives it (About before Help).
   Menu links go to `/apps/<id>` (the full page, even for a
   modal-default app, since `/apps/<id>` always renders the
   full page). The link for the app currently being viewed
   carries `aria-current="page"`, matching Home/Apps.
5. **Only Home, Apps, and app pages render menu apps.**
   `shellChrome()` gains optional `menuApps` and `currentApp`
   options; routes that already load installed apps pass them.
   Locked, 404, logout-confirm, and unlocked pages omit menu
   apps — locked pages must not leak installed app names to an
   unauthenticated visitor, and the others are transient.
   This is a deliberate scope cut, not an oversight: adding the
   menu to every transient page would mean loading the registry
   on every one of them for no navigation benefit.
6. **Help becomes an app, `/help` redirects.** New catalog
   bundle `help` (stateless, no actions, page, `ui.menuBar:
   true`) carries the current static Help content verbatim in
   substance: what the OS is, the agent `add_app` prompt, and
   the setup-guide pointer, with no installed-apps list (as
   the current Help spec requires). `GET /help` responds 303
   to `/apps/help` with the request's query string preserved,
   so `?k=` bookmarks keep working. Help then appears in the
   Apps launcher, Pinned, and Recent like any app — that is
   the consequence of being an app, not a special case.
   Consequence to name plainly: a fresh install without the
   help app installed has no Help link anywhere. No seeding
   is added to fix that; seeding is the app-store change's
   job, and it is not implemented.
7. **About is flagged in the same change.** `about.bundle.json`
   gains `ui.menuBar: true`. About's live installed copy does
   not gain the flag from the repo file; it gains it only when
   re-added after the shell change is published, because live
   installs are stored copies.
8. **Version: MINOR, in the same commit as the code.**
   Per `pkg/AGENTS.md`, a new optional `ui` field that breaks
   nothing existing is MINOR, PATCH resets to 0, and the
   `pkg/AGENTS.md` + `pkg/README.md` headers are updated in
   the same commit. At the time of writing the package is
   1.3.2, so the bump is 1.3.2 → 1.4.0, determined again at
   implementation time if the package version has moved.
   BUILD increments by 1 only on publish, never in the
   spec or code commit.
9. **No MCP surface change.** The menu derivation stays
   internal to the shell. `main()`'s export list in
   `pkg/src/index.ts` is unchanged. If a future change wants
   an agent-readable menu list, that is a separate change
   with its own version decision.

## Open Questions

None that block the spec. The two questions the proposal left
open — hidden behavior and Help's fate — are decided above
(hidden out, Help becomes an app) by the user on 2026-10-31.
The remaining judgment call, menu apps on transient pages
(Decision 5), is decided as "omit" for the scope reasons given;
revisit only if a transient page turns out to need navigation.
