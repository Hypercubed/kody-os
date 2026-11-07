# Proposal

## Why

Shell UI settings today live only in a published file:
`pkg/settings.json` is bundled at publish time, loaded once
per publish in `pkg/src/app.ts`, and supplies the shell's
name, title, icon, and background. Changing any of them
means editing the file and republishing. There is no way
to adjust the look from the running shell, no way for an
agent to adjust it without a republish, and no panel for
it — the only shell preferences that can change at
runtime are app placement lists (pinned, hidden,
homepage, recent), which already live in durable
`packageStorage()`.

This change keeps the published file, but demotes it to
what it already is in practice: the default. A durable
storage override, merged field by field over the file
values, becomes the live theme. Agents get MCP access
to that override, apps get a declared, gated route to
it, and a catalog app — a panel built like any other
app — gives the browser a control panel for it.

## What Changes

- `pkg/src/shell-theme.ts` (new, modelled on
  `pkg/src/feeds.ts`): the server-side theme-override
  module. It owns one storage key,
  `kody-os.shell.theme`, the partial-override shape,
  the per-field validation, the file-over-override
  merge, and get / set / reset. It reuses the
  validation already in `pkg/src/app.ts`
  (background tokens and the 8x8 grid check) and
  the icon sanitizer already in
  `pkg/src/apps/registry.ts`; it introduces no new
  allowlist.
- `pkg/src/app.ts`: `fetch()` reads the override on
  every request (not from the file's once-per-publish
  cache) and merges it over the resolved file theme
  before rendering any page. No existing route, app,
  or action changes behavior when no override is
  stored.
- `pkg/src/apps/storage.ts` (or the new module, if
  the implementer prefers — see design Decision 1):
  the storage key and the read / write helpers the
  module uses, following the existing
  `kody-os.apps.*` key pattern.
- `pkg/src/index.ts`: MCP exports
  `get_shell_theme`, `set_shell_theme`, and
  `reset_shell_theme`, listed in `main()` alongside
  `get_pinned` / `set_pin` and friends. Agents
  already reach the same storage through no other
  path; this is the agent path.
- `pkg/src/apps/types.ts` +
  `pkg/src/apps/registry.ts`: a data-only
  declaration, `capabilities.theme`, that an app
  must carry before the theme routes will serve
  it — the same allowlist pattern as `capabilities.feeds`, `capabilities.proxy`, and `capabilities.manageApps`.
- `pkg/src/app.ts` dispatch, after the `/apps/`
  branches and alongside the `/feed/` route, and
  therefore inside the device gate `fetch()` already
  runs: `GET /theme/:app` (read) and GET-action
  routes for set and reset (see design.md).
- One catalog app, id `settings`: a stateless bundle
  (empty `stateSchema`, `actions: {}`) that renders
  the theme controls from the live routes. It keeps
  no theme in app state and calls no `act()`.
- Docs: a `pkg/docs/shell-settings.md` doc and a
  `capabilities.theme` row in
  `pkg/.agents/skills/adding-an-app/SKILL.md`.

The work is phased, in order, and each phase is
usable on its own:

1. Storage-based overrides (module + `fetch()` merge).
2. Agent access (MCP exports over the same module).
3. App access (capability declaration + routes over
   the same module).
4. The control panel app (a catalog app using the
   Phase 3 routes).

## Capabilities

### New Capabilities

- `shell-theme-overrides`: a durable, per-field
  storage override of the published theme file,
  surviving republishes.
- `shell-theme-mcp`: `get_shell_theme`,
  `set_shell_theme`, `reset_shell_theme`.
- `shell-theme-routes`: same-origin, device-gated,
  capability-gated theme routes for declared apps.
- `settings-app`: a shell theme control panel in
  the shipped catalog (id `settings`).

### Modified Capabilities

- `shell`: `fetch()` merges the storage override
  over the file theme on every request; no existing
  route, app, or action changes behavior.
- `authoring`: `capabilities` gains the `theme`
  declaration; existing `feeds`, `proxy`, and `manageApps` declarations are unchanged.
- `os-theme`: `pkg/settings.json` becomes the documented default layer, not the only layer.

## Impact

- `pkg/src/shell-theme.ts` (new),
  `pkg/src/app.ts` (fetch merge + route dispatch
  + one Help line), `pkg/src/apps/storage.ts`
  (key + helpers, unless folded into the module),
  `pkg/src/index.ts` (MCP exports + `main()`
  list), `pkg/src/apps/types.ts`,
  `pkg/src/apps/registry.ts` (declaration +
  validation), `pkg/catalog/settings.bundle.json`
  (new), `pkg/src/apps/catalog.ts` (one import
  line, alphabetical), `pkg/catalog/README.md`
  (one entry), `pkg/docs/shell-settings.md` (new),
  `pkg/.agents/skills/adding-an-app/SKILL.md` (one row),
  `pkg/AGENTS.md` (capability paragraph, rides
  with the version bump).
- No `act()` change, no effect-operator change, no
  registry effect change, no export-format change,
  no auth-mechanism change, no new
  `kody.app.capabilities` entry (theme storage is
  `packageStorage()`, not a Kody capability), and
  no change to any existing app, route, or action.
- Publish as MINOR (a new capability, new MCP
  exports, and a new catalog app, per
  `pkg/AGENTS.md`), in the same commit as the code,
  with BUILD +1 on publish. It is its own MINOR
  relative to whatever version is current when it
  lands. If the phases land in separate publishes,
  each publish bumps per `pkg/AGENTS.md` at that
  time; the phases are implementation order, not a
  promise of one publish.

## Out of Scope

- New theme fields. Only the four existing file
  fields are overridable in v1: `name`, `title`,
  `icon`, `background`. Fonts, clock format, and
  any other UI setting are a follow-on change.
- Grid and SVG editing in the panel (Phase 4).
  A grid background or SVG mark set via the file
  or MCP is honoured and shown as custom, but the
  panel's own controls offer desk / paper, a glyph
  input, the stock mark, and reset. Grid and SVG
  editing in the panel are follow-ons.
- Per-user or per-device themes. Storage is per
  installed package, shared by every session that
  passes the device gate — the same sharing model
  as pinned / hidden / homepage today.
- An owner-only gate in v1. Browser writes use
  the existing device gate and MCP writes use the
  existing MCP trust model, exactly as pin / hide /
  home do today. A stricter gate is a follow-on
  (design Open Question 1), not a silent addition
  here.
- A shell-theme effect operator in `act()`.
  Deliberately not added: `act()` writes one
  app's own state, and this change keeps that
  invariant. Apps reach the override through the
  routes, not through `act()` (see design.md).
- A homepage widget for Settings, and
  auto-installing Settings on fresh installs.
  Settings is an Apps-page app in v1, installed
  via the App Store or an agent like any other
  catalog app. Its widget rendering is not
  verified in v1.
- Removing the panel app must not remove the
  settings. That is the point of separate storage:
  `remove_app('settings')` deletes the panel's
  definition and (empty) state only; the
  `kody-os.shell.theme` key is untouched, and a
  later reinstall of Settings shows the same
  overrides.
