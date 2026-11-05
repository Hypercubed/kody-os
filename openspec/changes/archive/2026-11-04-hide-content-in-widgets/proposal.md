# Proposal

## Why

A home widget shows the same full bundle content
as the app's own page. That is the shell's
single-render-path design, and it is usually
what you want. But some content only makes
sense on the full page: install instructions,
setup prompts, large controls, and other
page-sized chrome. In a small home widget
that content is clutter, and in some cases it
is actively misleading — an install block
inside a widget for an app that is already
installed, for example.

The user wants per-app control: an app author
should be able to hide chosen parts of an app
when it is displayed as a widget on the home
screen, while showing them in full on the app
page and in modals. The mechanism for this
already exists in the shell, and this change
specs it as a guaranteed contract plus an
authoring convention, rather than building a
new context API.

## What Changes

- A shell contract, stated in the spec delta
  and verified by tasks, not new shell code
  in v1: home widget sections keep the
  `widget` class and their `data-app-id`;
  app-page and modal panels keep the `app`
  class; bundle CSS keeps being inlined
  verbatim and unscoped, so ancestor
  selectors keep matching. Any future CSS
  scoping work must preserve ancestor
  matching or ship an equivalent context
  signal — that is a guardrail on future
  work, not a change made here.
- An authoring convention: hide
  widget-inappropriate content with a
  `section.widget` ancestor selector plus an
  app-specific selector, for example
  `section.widget #ld-install { display:
  none; }`. The inverse pattern — content
  meant only for widgets, hidden by default
  and revealed under `section.widget` — is
  supported by the same mechanism.
- A reference implementation in one existing
  app: the link-drop bundle hides its
  install block when rendered as a home
  widget, and keeps showing it on the full
  app page and in modals. Link Drop is the
  first use because its install block is the
  clearest case of page-only content, and
  because its bundle already lives in
  `link-drop-wip/` as a registry-write app,
  so the reference change is bundle-only.

## Capabilities

### New Capabilities

- `widget-visibility`: a CSS-only convention
  for hiding or revealing bundle content by
  render context (widget vs page/modal),
  backed by the shell wrapper-class contract
  above.

### Modified Capabilities

- None in v1. No shell behavior, route,
  action, capability, or MCP export changes.
  No existing app changes except the
  link-drop reference bundle.

## Impact

- v1: no `pkg/` code change, so no version
  decision is triggered by the contract
  itself. The link-drop reference bundle is
  a bundle-only change in `link-drop-wip/`,
  applied as a registry update, not a
  catalog change and not a publish, unless
  the user directs otherwise.
- If the authoring guidance lands in the
  adding-an-app skill (tasks section 2),
  that is a docs change inside `pkg/`,
  bundled with whatever commit the user
  directs for it; it is not a behavior
  change and does not by itself force a
  version bump.
- Hiding is visual only: hidden content
  stays in the DOM, bundle JS keeps running,
  and nothing about state, actions, or
  permissions changes.

## Out of Scope

- A JavaScript context API (for example a
  bridge field saying "you are a widget").
  The CSS mechanism covers the stated need;
  a JS API is a different change, to be
  proposed only if a case arrives that CSS
  cannot cover.
- Conditional rendering: not rendering
  content at all in widgets, skipping bundle
  JS in widgets, or treating hidden content
  as private or access-controlled. Hidden
  means `display: none`, nothing stronger.
- Widget-specific layouts, sizes, or
  per-widget configuration. This change is
  about visibility of existing content, not
  about new widget shapes.
- Hiding shell chrome (widget titlebar,
  expand link, reorder controls, modal
  titlebar). Shell chrome is the shell's,
  not the bundle's, and is out of the
  bundle author's reach by design.
- Any change to `ui.openAs` or the
  deprecated `ui.placements`. Open mode
  (page vs modal default) is a separate
  concern from widget visibility, and this
  change does not touch it.
