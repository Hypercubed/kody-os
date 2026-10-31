# Design: shell-settings

## Context

See proposal.md (Why). The shape to copy is the
capability pattern already used twice in this
package: a generic, server-side capability the
package implements once, declared data-only by an
app, served same-origin from the shell's fetch
handler. Feeds do it for upstream URLs
(`capabilities.feeds` + `GET /feed/:app/:name`);
email does it for platform mail
(`capabilities.email` + `GET /email/:app/...`).
Theme overrides do it for shell settings
(`capabilities.theme` + `GET /theme/:app`).

The one part that is not a copy of feeds/email is
the storage layer itself, because the theme has
two layers and the others do not: a published
file that must keep working as the default, and a
durable override that must survive republishes.
Everything else in this design is about keeping
those two layers honest — per-field precedence,
per-field fallback, and a reset that really means
"back to the file", not "set to today's value".

## Goals / Non-Goals

- Goals: file-as-default with a durable per-field
  override; agent access and app access over the
  same module and the same validation; a panel
  app built like any other app (catalog bundle,
  no special chrome, no `act()`); Scribe-safe
  controls (GET forms, no POST, no JS required
  for the core controls); settings that survive
  removing and reinstalling the panel.
- Non-goals: new theme fields, grid/SVG editing
  in the panel, per-user/device themes, an
  owner-only gate, an `act()` effect for shell
  settings, a Settings homepage widget, and
  auto-install on fresh installs (see proposal
  Out of Scope).

## Decisions

1. **One new module, one storage key.**
   `pkg/src/shell-theme.ts` owns the override:
   key `kody-os.shell.theme`, the partial shape,
   validation, merge, and get / set / reset.
   The key and its read / write helpers may live
   in `pkg/src/apps/storage.ts` next to the
   `kody-os.apps.*` keys if that reads better at
   implementation time, but the validation and
   merge live in the module, not scattered across
   `app.ts`, `index.ts`, and the routes. The
   module is server-side only and ES2019, like
   `feeds.ts`. No caller in Phases 2–4 reimplements
   validation; all of them call the module.
2. **Partial override, per-field precedence.**
   The stored value is a partial theme object:
   only the fields present are overrides. The
   effective theme for a request is, per field:
   stored override if present and valid, else the
   resolved file value, else the stock fallback
   the file path already applies. There is no
   whole-object override: setting `background`
   must not silently reset `name` to the file
   value, and a corrupt or invalid stored field
   must not take down the other three fields.
   The file itself is still resolved exactly as
   today (`resolveTheme` in `app.ts`), including
   its once-per-publish cache; only the override
   is read fresh on every request, because an
   override can change without a republish and a
   cached override would lie about exactly the
   change the user just made.
3. **Write path rejects, read path forgives.**
   Set (MCP or route) validates the whole payload
   first and writes nothing on any invalid field —
   the same validate-all-first rule as `act()` and
   `add_app`. Read (every page render) is
   defensive: corrupt stored JSON reads as no
   override, and an invalid stored field falls
   back to the file value for that field only.
   The asymmetry is deliberate: a bad write must
   never land, and a bad stored value must never
   break a page.
4. **Set semantics, per field.** A set payload is
   partial; an absent key leaves that field
   unchanged. A key present with value `null`
   clears that field's override. Otherwise the
   value is validated as a new override, with
   these per-field rules:
   - `name`: non-empty string, at most 200
     characters. Empty string is an error.
   - `title`: non-empty string, at most 200
     characters, or empty string, which clears
     the override (effective title then falls
     back to the name, exactly as the file path
     treats an empty title).
   - `icon`: a string. Empty string is a valid
     override meaning the stock mark (distinct
     from clearing, which restores the file
     icon). A glyph is stored as-is. A value
     starting with `<svg` must pass the existing
     app-icon sanitizer; a sanitizer failure is
     an error on the write path and a fallback
     to the file icon on the read path.
   - `background`: the closed tokens `desk` or
     `paper`, or a grid object `{ grid: [r0..r7] }`
     of eight integers 0–255, using the existing
     grid check. Empty string and any other value
     are errors on the write path and fall back
     to the file background on the read path.
   Unknown keys are errors on the write path
   and ignored on the read path. The 200-character
   cap applies to the write path only; a longer
   value already in the file is not re-validated
   against it on read (the file is
   author-controlled, the override is not).
5. **Reset means delete, not set-to-initial.**
   `reset_shell_theme()` with no argument deletes
   the whole key; with a `field` argument it
   deletes just that field's override (dropping
   the last field deletes the key). After a reset,
   a later change to the file default shows up
   again — which is exactly what "reset to file
   defaults" must mean, and what a set-to-today's-
   value reset would silently break. The panel's
   per-field reset buttons and its "reset all"
   button both call this, never a set.
6. **Phase 2 is thin wrappers, nothing more.**
   `get_shell_theme` returns `{ defaults,
   override, effective }`: `defaults` are the
   file-resolved values, `override` is the stored
   partial (only fields actually set), and
   `effective` is the merge from Decision 2, all
   in file terms (`name`, `title`, `icon`,
   `background` — not the internal `bodyStyle`).
   `set_shell_theme` takes the partial payload
   from Decision 4 and returns `{ ok: true,
   override, effective }` or `{ ok: false, error }`
   with no write. `reset_shell_theme` takes an
   optional `field` and returns `{ ok: true,
   effective }`. The exports are listed in
   `main()` like the pin / home exports. Like
   every other MCP export, they are not routed
   through `fetch()`'s device gate; that is the
   existing MCP trust model, not a new hole.
7. **Phase 3 is routes, not an `act()` effect.**
   `act()`'s invariant is that it validates
   against one app's own `stateSchema` and writes
   one key, `kody-os.apps.state.<id>`. A shell-
   theme effect would break both halves of that
   invariant (theme schema, shell key) and would
   need special-casing in the middle of the act
   engine. The routes keep `act()` untouched and
   follow feeds/email instead. The panel app is
   therefore stateless for theme purposes: its
   bundle calls the routes, it does not store
   theme in its own state, and there is nothing
   for `act()` to mirror or sync.
8. **Two flags, like email.** `capabilities.theme`
   is `{ view: boolean, set: boolean }`. `view`
   allows the read route; `set` allows set and
   reset. A route checks exactly the flag it
   needs, and a definition with neither flag true
   is treated as not declaring theme. Validation
   in `registry.ts`, next to `feeds` and `email`,
   rejects any other shape, and install-time
   sanitizing normalizes missing flags to `false`.
   The catalog Settings app declares both.
9. **Routes sit behind both gates, in that order.**
   The theme routes are dispatched from `app.ts`
   after the `/apps/` branches and alongside the
   `/feed/` route, so the device gate in `fetch()`
   has already run, and so an app id of `theme`
   still renders its app page (the `/feed/` note,
   applied again). Then the route loads the
   `:app` app's stored definition and requires
   the flag from Decision 8. Any gate failure —
   unknown app, malformed slug, app without the
   declaration, view-only app calling set/reset —
   returns the feed-style plain 404, with no
   theme and no capability detail. Only a gated
   app with an invalid value gets a JSON
   `{ ok: false, error }` (400), because at that
   point the caller is known-legitimate and the
   error is actionable. Read returns JSON
   `{ ok: true, defaults, override, effective }`
   with `no-store`. Set / reset return JSON
   `{ ok: true, override, effective }` when
   `format=json` is present, and otherwise 303
   back to the `from` path (defaulting to the
   app's page) — the same dual shape as the
   `actFromForm` JSON path, so the panel's plain
   GET forms work with no JavaScript and its
   bundle fetch path works in place. No POST
   route is added. Mutation URLs are never
   rendered as plain `<a href>` links, so
   nothing prefetches them; the bundle calls
   them only on an explicit tap, from a form
   submit or a fetch.
10. **The panel shows source, not just values.**
    The panel's first job, after the controls
    themselves, is to make the two-layer model
    visible: for each field, the current effective
    value and whether it comes from the file
    default or an override. Without that, the
    known gotcha — editing the file and
    republishing, and seeing no change because an
    override is in force — looks like a broken
    publish. The read route's `defaults` /
    `override` / `effective` split exists to make
    this display trivial: a field is overridden
    exactly when it appears in `override`.
11. **Panel scope is deliberately narrow in v1.**
    The bundle offers: background desk / paper
    buttons; name and title text inputs (title
    blank = clear, per Decision 4); icon as a
    glyph text input, a "stock mark" button
    (sets icon to `""`), and a per-field reset;
    per-field reset buttons for every field; and
    one "reset all to file defaults" button. When
    the effective background is a grid, or the
    effective icon is SVG, the panel says so
    ("custom grid / custom mark, set via file or
    agent") and offers desk / paper or glyph /
    stock / reset to replace it — it does not
    offer a grid editor or an SVG editor. That
    keeps the bundle small, Scribe-typable, and
    honest about what it cannot edit yet.
12. **MINOR, additive only.** Adding a module, a
    storage key, MCP exports, a declaration,
    routes, and a catalog app breaks nothing
    existing, so this is a MINOR bump per
    `pkg/AGENTS.md`, in the same commit as the
    code, with BUILD +1 on publish and
    `pkg/AGENTS.md` / `pkg/README.md` headers
    updated in that commit. No new
    `kody.app.capabilities` entry is needed, so
    no owner capability re-approval is expected
    for this change; if Kody's publish check
    disagrees, the agent records it and stops
    rather than approving anything on the
    owner's behalf.

## Risks

- **An override hides a file change.** Mitigation:
  Decision 10 (source display in the panel) plus
  the same split in `get_shell_theme`, so both
  surfaces can answer "why didn't my file edit
  show up?" without guessing.
- **GET mutations get prefetched or replayed.**
  Mitigation: no plain links to set / reset
  URLs, bundle-only form / fetch on tap,
  `no-store` responses. A replayed set is
  idempotent; a replayed reset is the residual
  risk, which is the same trade the shell already
  makes for `act()` GET forms — and reset is
  recoverable, because the file defaults are
  still there.
- **A routing bug breaks the whole shell.**
  Mitigation: theme routes are placed after the
  `/apps/` branches, match only the `/theme/`
  prefix, and fall through to the existing 404
  on any mismatch, so an unknown theme path
  cannot shadow an app page.
- **A stored override breaks a page.** Mitigation:
  Decision 3 (read path forgives per field) plus
  reuse of the existing grid and SVG checks, so
  the worst a bad stored value can do is fall
  back to the file value for one field.
- **The capability gate is an allowlist, not a
  sandbox.** A malicious installed bundle already
  runs same-origin with full session authority
  (the package's own trust statement for
  bundles), so it could call a theme route with
  the Settings app's id. The declaration stops
  unrelated legitimate apps and agents from
  reaching theme by accident or by `act()`; it
  does not, and cannot, sandbox a bundle the
  owner chose to install. This is the same
  limitation as the feeds and email gates.

## Alternatives considered

- **Settings app state *is* the override (shell
  reads one app's state).** Rejected for this
  change, not as unworkable: it needs almost no
  new machinery and is literally "like any other
  app" today. It loses on durability — removing
  that app deletes the settings — and on
  validation, because a `stateSchema` cannot
  express the grid check or the SVG allowlist,
  so the shell would have to re-validate app
  state defensively on every render anyway.
  Separate storage keeps both problems in one
  module instead of spread across the shell.
- **A shell-theme effect operator in `act()`.**
  Rejected: it breaks `act()`'s single-state-key
  invariant (Decision 7) and would make every
  future act-engine change reason about a second
  write target. Routes give apps the same access
  without touching the engine.
- **A special shell page instead of a catalog
  app.** Rejected for this change: it would need
  special chrome, a header link, and a second
  place where settings UI lives, while the
  catalog app gets install, pinning, and the
  Apps-page listing for free. The header-link
  page remains a possible later presentation
  change; it would reuse the same module and
  routes, not replace them.
- **One blanket `capabilities.theme: true`.**
  Rejected in favor of view / set: a viewer-only
  app (for example, a future app that shows the
  current theme) should not be able to reset it
  just by declaring theme, and the two-flag
  shape costs one validation branch, as with
  email.

## Open Questions

1. Should set / reset gain an owner-only gate in
   a later change, beyond the device gate (browser)
   and MCP trust model (agents) used in v1? v1
   ships with the existing gates; this question
   does not block any phase.
2. Should Settings be auto-installed on fresh
   installs in a later change, like the App Store
   is? v1 does not auto-install it.
3. Does the per-request override read measurably
   slow the dashboard? Phase 1 verification
   measures it; if it does, a write-through
   cache with invalidation on set / reset is a
   follow-on, not a silent cache added here.
4. Should the panel gain a grid editor and an SVG
   editor in a later change? v1 deliberately
   does not offer them (Decision 11).
