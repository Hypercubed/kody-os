# Design: app-help-button

## Context

The two header boxes the user named are in two different renderers,
and the spec has to cover both or the header is inconsistent between
the two ways of opening an app:

- **App page** — the shell window titlebar (`.os-titlebar` in
  `shellChrome`, `pkg/src/app.ts`): close box (`.os-box`) at the left,
  expand/collapse boxes (`.os-expand` / `.os-collapse`) at the right,
  on `expandable: true` pages only. `renderAppPage` calls
  `renderAppPanel` with `withHeader=false`, so the panel draws no
  second header — the shell titlebar is the only header.
- **Modal overlay** — the app panel titlebar (`.app-titlebar` in
  `renderAppPanel`, `pkg/src/apps/client.ts`): close box (`.os-box`,
  when `closeHref` is set) at the left, modal-expand box
  (`.modal-expand`, when `expandHref` is set) at the right. The
  overlay keeps its own header because the underlying page chrome
  shows the Apps title, not the app's (shell spec, "App pages render
  definition plus live state").

The shell's existing no-JS reveal mechanism is the CSS `:target`
overlay: modal tiles link to `#app-<id>` and the overlay section is
hidden until it matches `:target`; page-mode expand links to
`#os-full` and the expanded layout is a `:target`-adjacent fragment
state. The help dialog reuses that mechanism rather than inventing
one — a plain link, a server-rendered element, CSS reveal, no
JavaScript, no route, no storage.

`description` is not the help field. It already renders on the app
page body and as a tile `title` tooltip, and its contract is "what
the app is for" (`pkg/src/apps/types.ts`). Reusing it for the dialog
would change what tiles and app pages show today. The new field is
separate, and its placement follows the `ui.menuBar` precedent: a
shell-rendered presentation option lives under `ui`.

## Decisions

1. **Field: `ui.help?: string`, plain text.** Under `ui`, alongside
   `title`, `openAs`, `actions`, `hideState`, `menuBar`. Plain text
   means: rendered with `escapeHtml`, never interpreted as HTML or
   markdown, no links in v1. Line breaks in the string are preserved
   in the dialog (`white-space: pre-wrap` on the dialog body).
   Rationale: `ui` is where shell-rendered presentation lives; a
   top-level `help` would sit beside identity fields (`id`, `name`,
   `label`) that the shell never renders as chrome.
2. **Empty or whitespace-only `ui.help` is absent.** Canonicalize
   drops it, and no button renders. Rationale: "defines help" has to
   be crisp — an app that ships `help: ""` or `help: "  "` has not
   defined help, and a button opening an empty dialog is a defect,
   not a feature. A non-string value is a validation error with no
   write, mirroring `ui.menuBar`.
3. **No length cap in v1.** `description` carries no cap and neither
   does `ui.help`. Rationale: the user asked for plain text with no
   size rule, and inventing a number here would be an arbitrary
   authoring restriction. Recorded cost: the text rides in every
   render of the app page and the overlay, so a very long help string
   bloats those pages. If a cap is ever needed it is a new decision —
   adding one later rejects definitions that are valid today, so it
   would need the MAJOR treatment, not a silent validator tweak.
4. **Button in both headers, immediately left of expand.** App page:
   shell titlebar, help box in the slot at `right: 3rem`, expand
   still at `right: 0`. Modal overlay: panel titlebar, help box in
   the slot at `right: 3rem`, modal-expand still at `right: 0`. The
   panel bar gains a `has-help` class (like `has-close` /
   `has-expand`) widening its right padding to make room for two
   3rem slots, so the title plate is never covered. Rationale: the
   user asked for "to the left of the expand button", and the two
   headers are the same header from the user's point of view.
5. **The button is the literal text `?` in the shared box look.**
   Same outlined-square box as close/expand, same 48px hit slot,
   `aria-label="Help"`, `title="Help"`. The `?` is element text
   content, not a pseudo-element glyph — it reads at Scribe
   resolution in the system font with no drawing code, and it is the
   glyph the user asked for (`[?]`). Class: one shared `.os-help`,
   positioned per bar (`.os-titlebar .os-help`, `.app-titlebar
   .os-help`). Rationale: one class, two placements — the same shape
   as `.os-box`, which is already shared between the two bars.
6. **Dialog is `:target`-revealed, server-rendered, no JavaScript.**
   The button links to `#help-<id>`; the dialog is a `<div
   role="dialog">` already in the page HTML, hidden by default and
   revealed only when it matches `:target`. It shows the app title,
   the escaped help text, and a close link. No new route, no storage
   write, no state change. Rationale: the no-JS baseline binds this
   change like every other — a native `<dialog>` with `showModal()`
   needs JavaScript and would leave the dialog unusable without it,
   and a GET-form round-trip to a help route would navigate away
   from the app. The `:target` overlay is the proven mechanism on
   this exact page (modal overlays already do this).
7. **The dialog close returns to the view that opened it.** On an
   app page the close link points at the app page URL without a
   fragment; in an overlay it points at `#app-<id>`, the overlay's
   own fragment. Rationale: closing help must not close the app —
   the overlay's own close box already goes to `#apps`, and help's
   close must not be confused with it.
8. **Opening help from the expanded view collapses the window.**
   Expand state lives in the `#os-full` fragment and help lives in
   the `#help-<id>` fragment; a URL carries one fragment, so
   following the help link replaces `#os-full` and the window
   returns to its normal layout. Accepted, not fixed: it is the same
   class of limitation as every other fragment mechanism on the
   page, the app's state is untouched (fragments are never
   submitted), and re-expanding is one tap. The dialog itself works
   identically in either layout.
9. **Help is fingerprinted; `list_apps()` summaries do not carry it.**
   `fingerprintDefinition` canonicalizes then deletes only
   `catalogVersion` and `installMode`, so `ui.help` is fingerprinted
   like every other `ui` field — a catalog app gaining or changing
   help bumps `catalogVersion` +1 by the existing rule. Summaries do
   not need it: tiles never show help, and the two surfaces that do
   (app page, overlay) already hold the full stored definition.
   Rationale: fingerprinting is the default for definition content;
   excluding help would silently let a catalog app's help change
   without a version bump, which is exactly what `catalogVersion`
   exists to catch.
10. **No `schemaVersion` bump; MINOR at implementation.** An
    optional `ui` field is MINOR by the version policy ("a new
    optional `ui` or definition field"), the same as `menuBar` and
    `minPackageVersion`. Old definitions keep validating, old
    installs keep working, no migration, no restamp.
11. **Counter is the reference consumer.** One catalog app gains a
    short help string so the feature is verifiable end to end on a
    real app, with its `catalogVersion` +1 and the catalog index
    regenerated. Counter is the smallest app and the usual reference
    (the shell-islands Counter port, the harness reference app).
    Exact wording is written at implementation; the shape is "what
    the controls do, in one or two short lines".

## Goals / Non-Goals

- Goals: an app author writes one plain-text string and gets a
  help button in the app header and a working dialog, with no
  JavaScript, no route, and no change to any app that does not
  define help.
- Non-goals: rich text, links, or images in help; help on widgets,
  tiles, or the Apps/Help/About pages; a help route or MCP export;
  a JavaScript or native-`<dialog>` implementation; help text in
  `list_apps()` summaries.

## Risks / Trade-offs

- [Risk] Two fragments, one URL: help and expand cannot be active
  at once (Decision 8) → Mitigation: accepted and specified — the
  dialog works in the normal layout, state is untouched, and the
  scenario pins the collapse so it is a known behavior, not a bug
  found later.
- [Risk] Fragment collision: `#help-<id>` must not collide with
  `#app-<id>` (overlays) or `#os-full` (expand) → Mitigation: the
  `help-` prefix is distinct from both, and the verification tasks
  check the three fragments on one page.
- [Risk] A long help string bloats every app-page and overlay
  render (Decision 3, no cap) → Mitigation: recorded openly; a cap
  later is a MAJOR-gated decision, not a silent fix.
- [Risk] The `?` glyph reads poorly at Scribe resolution, or the
  dialog is cramped on the narrow e-ink screen → Mitigation: a
  dedicated, narrowly-scoped Scribe verification task for exactly
  that (glyph legibility + dialog readability), the only Scribe
  task in this change.
- [Risk] `systemcss-title-bars` (open) restyles the boxes after
  this lands → Mitigation: the help box is specified as "the same
  box as close/expand", so it follows that change's landed look in
  either order; no fixed drawing is pinned here.
- [Risk] An app author confuses per-app help with the shell Help
  page (`/help`) → Mitigation: the design names the distinction
  explicitly, and the authoring docs describe `ui.help` as the
  app's own how-to-use text, not shell help.

## Migration Plan

None. Additive optional field; no stored definition changes, no
restamp, no migration. Apps without `ui.help` render byte-identical
headers. The only data change is the Counter reference consumer,
which follows the normal catalog update path (`catalogVersion` +1,
index regen, harness pass).

## Open Questions

1. **Should the help dialog also appear on the home widget?**
   Widgets have an expand box but no close box and no titlebar pair,
   so there is no "left of expand" slot in the same sense — and a
   widget is a compact rendering, not the app itself. This change
   says no; if a widget-help need appears later it is its own
   change, with its own placement decision.
2. **Should `ui.help` accept a list of paragraphs instead of one
   string?** The user asked for plain text; one string with line
   breaks covers the release. A structured form (list, sections) is
   a later change if authors ask for it — it would be a new field
   shape, not a silent widening of this one.
