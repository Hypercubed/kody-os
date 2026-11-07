# Shell theme settings

The shell theme (name, title, icon, background) has two layers: file
defaults and a stored override. The file layer is `pkg/settings.json`
(name `kody-os`, empty title, empty icon, background `desk`); the
override layer is one storage key, `kody-os.shell.theme`, holding only
the fields that differ. The effective theme is the per-field merge of
the two: a field is overridden exactly when it appears in the override,
and every other field falls back to the file value. The title falls
back to the name when the file title is empty.

## Set semantics

A set payload is a partial override (design Decision 4):

- An absent key leaves that field unchanged.
- A null value clears that field's override.
- Title `''` clears (the effective title then falls back to the name).
- Name must be a non-empty string of at most 200 characters.
- Icon is a string; `''` means the stock mark, and a value starting
  with `<svg` must pass the SVG sanitizer.
- Background is `desk`, `paper`, or `{ grid: [r0..r7] }` — eight
  integers from 0 to 255.
- Unknown keys are errors on write and are ignored on read.
- Any invalid field fails the whole payload with no write.

Reset deletes (design Decision 5): resetting one field removes it from
the override; resetting the last field, or resetting all, deletes the
`kody-os.shell.theme` key. Removing an app never touches the override;
reinstalling it shows the same overrides.

## Reading the override

`fetch()` resolves the file theme once per publish, then reads the
override fresh on every request and merges it in-process. There is no
cache across requests in v1: the per-request read was measured at a
sub-microsecond mean (0.8µs with no override stored, 0.9µs with one,
n=2000 each on the PC, bun 1.3.13) and the locked dashboard page stays
around 6ms, so no cache was added.

## Agent access (MCP exports)

Thin wrappers over `pkg/src/shell-theme.ts`, exported from
`pkg/src/index.ts`. They resolve file defaults first
(`fileThemeToValues(await getTheme())`) and reimplement no validation:

- `get_shell_theme()` returns `{ defaults, override, effective }`.
- `set_shell_theme(payload)` returns `{ ok: true, override, effective }`,
  or `{ ok: false, error }` with no write when any field is invalid.
- `reset_shell_theme(field?)` returns `{ ok: true, effective }`, or
  `{ ok: false, error }` for an unknown field.

MCP exports are not routed through `fetch()`'s device gate (the
existing MCP trust model).

## Browser access (theme routes)

GET-only routes in `pkg/src/app.ts`, dispatched after `/feed/` and
before the 404 fallthrough, behind the device gate in `fetch()` and
then the app's `capabilities.theme` flags:

- `GET /theme/:app` — read. Requires `theme.view`. Returns
  `{ ok: true, defaults, override, effective }`, no-store.
- `GET /theme/:app?action=set&name=...&title=...&icon=...&background=...`
  — set. Requires `theme.set`. `background_grid` takes eight
  comma-separated integers instead of `background`. Returns
  `{ ok: true, override, effective }` when `format=json`, else a 303
  to `from` (defaulting to the app's page).
- `GET /theme/:app?action=reset[&field=...]` — reset one field, or
  all when `field` is absent. Requires `theme.set`. Returns
  `{ ok: true, override, effective }` when `format=json`, else a 303
  to `from` (defaulting to the app's page).
- No POST route. Mutation URLs are never rendered as plain `<a href>`
  links.

Gate failures (unknown app, malformed slug, no declaration, or a
view-only caller of set/reset) are feed-style plain 404s with no theme
detail. A gated app with an invalid value gets JSON
`{ ok: false, error }` (400) and writes nothing. Unauthenticated
requests get the locked page, never theme data.

## Declaring theme access

`capabilities.theme` is `{ view: boolean, set: boolean }`, next to
`feeds`, `proxy`, and `manageApps` in `AppCapabilities`. Missing flags
normalize to `false` at install; a definition with neither flag true
is treated as not declaring theme. The declaration appears in the
Store installer disclosure and in the capability-expansion
confirmation gate (a theme addition on update needs confirmation).

## Settings panel

The catalog `settings` app is the browser path for changing the shell
theme (see the built-in Help page). It is stateless — no theme in app state, no
`act()` — and is not installed by default. Each field shows its
effective value with its source (file default or override). Controls:
background desk/paper buttons, name/title text inputs (title blank
clears), icon glyph input with a stock-mark button, per-field reset,
and one reset-all button. A custom grid background or custom SVG mark
shows a notice instead of an editor ("custom grid / custom mark, set
via file or agent") while still offering desk/paper or glyph/stock/reset
to replace it. Core controls are plain GET forms (no POST, no JS
required); JavaScript may enhance in place with `format=json`, never
required. Sessions ride the cookie; no `?k=` is rendered in any
link or form.

## Out of scope

- No grid or SVG editor in v1 (replace only, via desk/paper or
  glyph/stock/reset, or via file or agent).
- No owner-only gate for set/reset yet (open question 1); no
  auto-install of Settings yet (open question 2).
- No write-through cache for the override read (open question 3,
  answered no by the timing measurement above).
