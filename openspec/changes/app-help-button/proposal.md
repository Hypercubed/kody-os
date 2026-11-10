# Proposal

## Why

Every app page carries the same two title-bar boxes: a close box at the
upper left and an expand box at the upper right. An app has nowhere to
say, in its own words, how to use it — the `description` field is a
one-line "what this app is for" shown on the app page body and as a
tile tooltip, not a "how to use this" note, and there is no per-app
help surface at all. (The shell's built-in Help page at `/help` is
about the shell itself — adding apps, removing apps, installing the
catalog — not about any one app.)

This change adds a third box: a simple help button, `[?]`, sitting
immediately to the left of the expand box. It appears only when the
app defines help, and opening it shows that help in a dialog. For
this release the help is plain text in the app definition — no markup,
no markdown, no links — so an app author writes one string and the
shell does the rest.

## What Changes

**Definition — a new optional field, `ui.help`.** An app definition
MAY carry `ui.help`, a plain-text string. It lives under `ui` with the
other shell-rendered presentation fields (`title`, `openAs`,
`hideState`, `menuBar`), not at the top level: it is shell chrome
content, and putting it next to `description` would confuse it with
the tile/body text that already exists. Validation, canonicalization,
fingerprinting, and export/import follow the `ui.menuBar` precedent
exactly (see the app-registry delta). A non-string `ui.help` is
rejected with no write; an empty or whitespace-only value is treated
as absent. No `schemaVersion` bump: this is an optional `ui` field,
the same as `menuBar` and `minPackageVersion` were.

**Button — `[?]` left of expand, only when help is defined.** On an
app page the shell window titlebar gains a help box immediately to
the left of the expand box; in a modal overlay the panel titlebar
gains the same box immediately to the left of the modal-expand box.
Both places are the same "app header" from the user's point of view
— close at the left, expand at the right — so the button appears in
both or the header would be inconsistent between the two ways of
opening an app. Where neither close nor expand exists (dashboard,
Apps page, Help and About pages, home widgets, 404), no help button
appears. The button is the literal text `?` in the same outlined-square
box as close and expand, with the same 48px hit slot. Apps without
`ui.help` render byte-identical headers to today.

**Dialog — server-rendered, `:target`-revealed, no JavaScript.** The
help button is a plain link to a fragment (`#help-<id>`) that reveals
a dialog already present in the server-rendered page: the app title,
the help text (HTML-escaped, line breaks preserved), and a close
link that returns to the view that opened it. No new route, no
storage write, no state change, no JavaScript — the same mechanism
the modal overlay already uses (`:target`), and the same no-JS
baseline the shell keeps everywhere else. A native `<dialog>` with
`showModal()` was rejected: it needs JavaScript and would leave the
dialog unusable without it.

## Capabilities

### New Capabilities

- `app-help-button`: per-app help — the `ui.help` definition field,
  the title-bar help button, and the help dialog.

### Modified Capabilities

- `shell`: the app-page titlebar and the modal-overlay panel
  titlebar each gain a conditional help box; the expand requirement
  gains the fragment interaction (opening help drops `#os-full`).
- `app-registry`: definition validation, canonicalization, and
  fingerprinting gain the optional `ui.help` field.
- `authoring`: the adding-an-app skill documents `ui.help` in the
  definition table.

## Impact

- Code: `pkg/src/apps/types.ts` (`UiDef`), `pkg/src/apps/definition.ts`
  (validate + canonicalize), `pkg/src/app.ts` (`shellChrome` help
  slot + dialog markup on app pages), `pkg/src/apps/client.ts`
  (`renderAppPanel` help slot + dialog markup in overlays),
  `pkg/public/styles.css` plus the regenerated
  `pkg/src/shell-css.ts` (help box, dialog, `has-help` padding).
- Data: one catalog app (Counter, the smallest) gains a short `help`
  string as the reference consumer, with its `catalogVersion` +1 by
  the existing rule — help is fingerprinted, so adding it changes the
  fingerprint. No installed app is migrated or restamped; apps
  without `ui.help` are unaffected.
- Version: MINOR at implementation — a new optional field plus a new
  chrome control, nothing existing breaks. This spec-only change
  bumps nothing, and build increments by one only on a Kody publish,
  per `pkg/AGENTS.md`.
- BREAKING: none. Additive field, additive chrome, additive docs.
  Existing definitions validate exactly as before, existing headers
  render exactly as before when no help is defined.

## Dependencies

None. The change touches only the shell, the definition validator,
and docs. It does not depend on any open change, and no open change
depends on it. It is independent of `systemcss-title-bars` (open):
if that change lands first, the help box takes the landed box look;
if this lands first, that change's phases pick the help box up with
the other boxes. Either order works because the help box is specified
as "the same box as close/expand", not as a fixed drawing.

## Non-goals

- Rich text in help: no markup, no markdown, no links, no images.
  Plain text only, in this release.
- Help anywhere without a close+expand header: no help button on
  home widgets, tiles, the Apps page, or the Help/About pages.
- A help route, a help MCP export, or help in `list_apps()`
  summaries — the dialog reads the stored definition on the app
  page and in the overlay, which already have it.
- A JavaScript dialog, a native `<dialog>` with `showModal()`, or
  the browser Fullscreen API.
- Release or publish steps. The release decision stays the user's.
