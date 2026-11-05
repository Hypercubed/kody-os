# Design: hide-content-in-widgets

## Context

See proposal.md (Why). This change is spec
only. No shell code, bundle, or doc is
written by this change itself; tasks 1-4 do
the verification and the reference
implementation, and task 5 checks that this
change document changed nothing outside its
own folder.

## Research

Research below is prior work, verified
2026-11-04 against the local checkout
(`pkg/src/apps/client.ts`,
`pkg/src/apps/types.ts`,
`pkg/src/apps/registry.ts`). It is
summarized so this change stands on its
own; tasks re-check every claim they depend
on before shipping.

### 1. One render path, three wrappers

- `renderAppSection` renders one app's bare
  content: the bundle UI, then every state
  field, then one plain form per UI action.
  Its own comment states the design: the
  shell's `<section class="app">` is "the
  single box on app pages, modal overlays,
  and (later) widgets, so content renders
  identically in every placement."
- The app page renders that section through
  `renderAppPanel`; the modal overlay
  (`renderOverlaySection`) wraps the same
  panel in a `div.overlay`; the home widget
  (`renderWidgetSection`) wraps the same
  section in `<section class="widget"
  data-app-id="...">`, adding shell chrome
  around it (titlebar, expand link, reorder
  controls). The widget doc states it
  renders "the app's own compact view
  (same bare content as the app page)".
- Home tiles (`renderHomeTiles`) are links
  to apps, not bundles; widget visibility
  only concerns pinned widgets, not tiles.
- The bundle therefore receives no context
  value: `renderBundleContent` stamps only
  `data-bundle` (the app id) and
  `data-action-base` (its action path) on
  the bundle container. A bundle that wants
  to know its context must read the DOM
  around it; this change standardizes the
  CSS half of that read and forbids
  nothing about the JS half.

### 2. Bundle CSS is verbatim and global

- `inlineBundleAssets` inlines bundle CSS
  as a `<style>` block with no scoping,
  prefixing, or rewriting. A selector with
  a `section.widget` ancestor therefore
  matches when the bundle sits inside a
  widget section, and does not match when
  it sits inside a page or modal section.
- Because the style block is unscoped, it
  applies document-wide. On the home page,
  several widgets share one document, so a
  generic widget rule (for example
  `section.widget p { display: none; }`)
  would hide matching content in other
  apps' widgets too. Widget rules must be
  qualified with app-specific selectors.
- Modal panels use `section.app`, the same
  class as the app page, so a
  `section.widget` rule does not affect
  modals: modal content stays full, like
  the page. That matches the intent —
  a modal is a full-app view, not a widget.

### 3. Open mode is not visibility

- `ui.openAs` (`page` or `modal`) is "how
  an app opens by default from the Apps
  page. A default, not a restriction: every
  app is allowed in every context."
- `ui.placements` is deprecated: "kept
  only so old definitions still validate;
  it gates nothing." Neither field
  restricts where a bundle renders, and
  neither is the mechanism for this change.

## Decisions

### Decision 1: CSS-only in v1, no JS context API

The need as stated is hiding content, and
CSS ancestor selectors already do that
with no shell change. A bridge field or
`data-context` attribute would be a new
shell surface with its own versioning and
testing; it is deferred to open question
0.1 and is not part of v1.

### Decision 2: The context signal is `section.widget`

No new attribute is stamped in v1. The
widget wrapper class already exists in
rendered markup, is stable across the
three render paths, and is the smallest
signal that distinguishes widget from
page/modal. If the shell ever renames
that class, the spec's shell contract
(Requirement: Shell widget wrapper) is
the place that must change with it.

### Decision 3: App-specific selectors are mandatory

Because bundle styles are global, every
widget rule in this convention MUST be
qualified with an id or class unique to
the app (for example `#ld-install`, or a
`<app-id>-page-only` class). Unqualified
element or shared-class selectors in
widget rules are a defect, not a style
choice: they leak into other widgets on
the same home page. Harness checks in
tasks section 4 enforce this for the
reference implementation.

### Decision 4: Two patterns, one mechanism

- Page-only content: visible by default,
  hidden under `section.widget`
  (`section.widget #ld-install { display:
  none; }`).
- Widget-only content: hidden by default
  (`display: none` in the base rule),
  revealed under `section.widget` with an
  explicit display value matching the
  element (block, flex, or whatever the
  element needs). The reveal rule must
  state its display value; relying on the
  browser default after `display: none`
  is fragile across element types.

### Decision 5: Link Drop install block is the reference

Link Drop's install block (drag link plus
agent prompt) is page-only content in the
clearest sense: it explains how to install
a bookmarklet, which is meaningless
inside a widget for an app the user
already has. Hiding it in widgets while
keeping the link list and Clear All
visible demonstrates the convention
without changing any behavior, state, or
action. The reference is bundle-only; it
does not change link-drop's definition,
state schema, or actions.

### Decision 6: Shell guarantees are guardrails, not code

This change writes no shell code, but it
does write down what future shell work
must preserve: the widget wrapper class
and `data-app-id`, the `app` class on
page/modal panels, and verbatim unscoped
bundle CSS. If a future change scopes
bundle CSS, it must preserve ancestor
matching or ship an equivalent context
signal in the same change, or it breaks
this contract.

## Open Questions

### 0.1 Should the shell stamp an explicit context attribute?

For example `data-context="widget"` on
widget sections and `data-context="page"`
on page/modal panels, as a more explicit
signal than the wrapper class. Default in
use: no — the wrapper class suffices in
v1, and an attribute would be a shell
change for no new capability. Revisit if
the wrapper class ever becomes unstable
or if a JS context read is proposed.

### 0.2 Should the shell theme provide a shared utility class?

For example a theme-level `.page-only`
rule (`section.widget .page-only {
display: none; }`) so authors need not
write the rule per app. Default in use:
no — a shared class name across unscoped
stylesheets invites the same leaking
Decision 3 guards against, and per-app
rules are one line each. Revisit if many
apps adopt the convention and the
duplication becomes the complaint.

### 0.3 Should the adding-an-app skill gain a widget section?

Default in use: yes, as a docs task
(tasks section 2), not as a code change.
The skill is where bundle authors learn
the contract, so the convention belongs
there once the reference implementation
proves it. The skill edit itself needs
its own user direction at commit time,
like any `pkg/` doc change.
