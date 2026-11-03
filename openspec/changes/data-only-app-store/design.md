# Design: data-only-app-store

## Context

See proposal.md (Why). Today `GET /apps/app-store` in
`pkg/src/app.ts` is intercepted before the generic
`GET /apps/:id` route: it calls `list_apps()`,
`get_hidden()`, and `get_store_rows()`, renders the
combined list via `renderCombinedList()` in
`pkg/src/apps/client.ts`, and handles `?install=`,
`?update=`, `?restore=`, `?confirm=`, `?pin=`, `?hide=`,
and `?home=` itself with 303s. (Pin/hide/home are
removed from the Store by `apps-edit-and-store-split`
before this change.) The installed store definition
is stateless with no actions, and in the installed
case the page renders the list only, not the bundle
panel — the `app.ts` comment saying "bundle panel
plus list" is stale. The page works even when the
store app is not installed, showing a note plus the
same list. A bundle today can only mutate its own
state through `act()`; it receives only its own
state seed and no catalog, installed list, or
snapshot status.

## Goals / Non-Goals

- Goals: a Store that is an ordinary data app; a
  management API that reuses the existing registry
  logic; no shell-rendered Store list; a defined
  fallback when the Store is not installed.
- Non-goals: changing the catalog source (see
  `public-pinned-catalog`); changing snapshot,
  `catalogVersion`, or status-classification rules;
  adding a browser remove control (removal stays
  MCP-only); changing launcher management (Apps
  Edit); sandboxing bundles.

## Decisions

1. **The API reuses the registry, it does not reimplement
   it.** Read returns the `get_store_rows()` shape
   (id, label, name, icon, category, description,
   installed, inCatalog, status, modified). Write
   calls `store_install_from_catalog` and
   `store_update_from_catalog` (restore is the
   update path for modified apps, as today). Snapshot
   writes, state preservation on update, and the
   modified-app distinction all stay exactly as
   implemented in `registry.ts`.
2. **The API is GET-based and session-gated, like every
   other browser mutation in this shell.** Kody's edge
   rejects mutating POSTs to the package-app subdomain
   when the browser reports a foreign or null Origin,
   so management mutations are GET routes dispatched
   inside `fetch()` after the device gate, alongside
   the `/feed/` route. No POST route is added. The
   API checks declared `manageApps` in the acting
   app's stored definition and returns the feed-style
   plain 404 for undeclared callers, with no
   capability detail.
3. **The bundle owns rendering and confirmation.**
   The new store bundle fetches rows on load, renders
   them, and re-renders after each mutation. For a
   behind-modified app, the API returns a
   needs-confirmation response naming what updating
   will lose (the same loss warning as today's shell
   confirm page), and the bundle shows its own confirm
   UI; only an explicit confirm submission from that
   UI applies the update. The bundle handles loading
   (rows not yet fetched), error (API failure, with
   retry), and empty (no catalog and no installed
   apps) states explicitly, never a blank page.
4. **Exposure is through the bridge if it fits, else
   documented routes — not both.** The implementation
   SHALL pick one: either `window.KodyBridge` gains
   management methods that call the API with the
   bridge's single-flight and rebase behavior, or the
   bundle calls documented same-origin management
   routes directly with `credentials: 'same-origin'`
   and `format=json`. Whichever is picked, the other
   path SHALL NOT also be added, so there is one
   supported way for a bundle to manage apps.
5. **The not-installed Store keeps a shell fallback.**
   The generic app page 404s for an uninstalled id,
   so `/apps/app-store` when the store app is not
   installed SHALL NOT become a dead 404. It renders
   a short note (the Store is not installed) plus a
   plain link to install it — either a link to the
   management install action for `app-store` itself,
   or the agent instruction to run
   `install_from_catalog('app-store')`, with the
   implementation picking the form that does not
   require the Store bundle to render. This fallback
   is shell code, but it is not a Store list: it
   carries no rows and no controls beyond the
   install path for the Store itself.
6. **The old Store query URLs stop being Store actions.**
   After this change, `GET /apps/app-store?install=`
   and its update/restore siblings are no longer
   handled by the shell Store route (which no longer
   exists). A request carrying them on the generic
   app page falls through to the generic action
   handling and errors there, as an unknown action
   would for any app — the spec does not require a
   special redirect, because the Store bundle's own
   controls are the supported path and MCP catalog
   tools are unchanged.

## Open Questions

- Bridge vs documented routes (Decision 4) is left to
  implementation, because it depends on how much of
  the bridge's dispatch behavior the Store bundle
  actually needs; the requirement is one supported
  path, not a particular one.
- No-JS: whether the Store bundle's static HTML also
  carries plain GET forms to the management routes
  (preserving a no-JS Store) or the Store becomes
  JS-required is left to implementation, with the
  constraint that the choice is stated in the
  implementation commit and in the bundle's README
  entry. The shell's generic app-page forms are not
  a substitute: they act on the Store app's own
  state, which is empty.
