# Widget Visibility

## Purpose

A kody-os app author can hide chosen
bundle content when the app is displayed
as a widget on the home screen, and show
it on the app's full page and in modals,
using CSS, with bundle JS only where CSS
has no hook (shell action forms). This
spec was promoted from the
hide-content-in-widgets change delta;
related specs (`widget-home`,
`unified-apps`, `authoring`) are unchanged
by it.

## Requirements

### Requirement: Shell widget wrapper

Home widget sections SHALL carry the
`widget` class and a `data-app-id`
attribute with the app's id. App-page
and modal panels SHALL carry the `app`
class. The bundle HTML rendered inside
each wrapper SHALL be identical across
widget, page, and modal, apart from the
shell chrome around it (widget titlebar,
expand link, and reorder controls;
modal titlebar and close/expand boxes).

#### Scenario: Same bundle, three wrappers

- WHEN one app is rendered as a home
  widget, as an app page, and as a modal
  overlay
- THEN the widget markup contains
  `<section class="widget"
  data-app-id="<id>">` around the same
  bundle content, and the page and modal
  markup contain `<section class="app">`
  around the same bundle content.

### Requirement: Bundle CSS passthrough

Bundle CSS SHALL be inlined verbatim and
unscoped, so a selector with a
`section.widget` ancestor matches when
the bundle sits inside a widget section
and does not match when it sits inside a
page or modal section. Future shell work
that scopes bundle CSS SHALL preserve
ancestor matching or SHALL ship an
equivalent context signal in the same
change.

#### Scenario: Widget rule matches only in widgets

- WHEN a bundle's CSS contains
  `section.widget #example { display:
  none; }`
- THEN the `#example` element is hidden
  in the home widget rendering and
  visible in the app-page and modal
  renderings.

### Requirement: Authoring convention for hiding

Bundle authors SHALL hide
widget-inappropriate content with a
`section.widget` ancestor selector
qualified by an id or class unique to
the app. Widget rules SHALL NOT use
unqualified element selectors or
shared class names, because bundle
styles apply document-wide and such
rules would hide matching content in
other apps' widgets on the same home
page. Page-only content hidden this way
SHALL remain visible on the app page
and in modals.

#### Scenario: One app's widget rule does not leak

- WHEN two apps are pinned as home
  widgets and one app's CSS contains
  `section.widget #its-own-block {
  display: none; }`
- THEN the other app's content is
  unaffected, including content with the
  same element type or generic class.

#### Scenario: Link Drop install block (reference)

- WHEN the link-drop app is rendered as
  a home widget
- THEN its install block (drag link and
  agent prompt) and its Clear All control
  are hidden, and its link list remains
  visible.
- WHEN the link-drop app is rendered as
  a full page or modal
- THEN its install block and Clear All
  control are visible.

#### Scenario: Hoodie Weather buttons and note (reference)

- WHEN the hoodie-weather app is rendered
  as a home widget
- THEN its buttons (refresh, retry, search
  toggle) and its "A kody-os rewrite of"
  note are hidden, and its forecast readout
  and verdict remain visible.
- WHEN the hoodie-weather app is rendered
  as a full page or modal
- THEN its buttons and note are visible.
- The shell "Restore default place" form
  is hidden by bundle JS, not CSS: the
  bundle's claim function hides the form
  when its section is a widget, and
  leaves it visible on the full page and
  in modals. Bundle CSS alone cannot hide
  it, because the form carries no
  app-specific hook.

### Requirement: Widget-only content (inverse pattern)

Content intended only for widgets SHALL
be hidden by default (`display: none`
in its base rule) and revealed under
`section.widget` with an explicit
display value matching the element.
The reveal rule SHALL state its display
value rather than relying on the browser
default after `display: none`.

### Requirement: Hiding semantics

Hiding under this convention SHALL mean
`display: none` only. Hidden content
SHALL remain in the DOM, bundle JS
SHALL keep running, and hidden content
SHALL NOT be treated as private,
access-controlled, or unrendered. No
state, action, capability, or permission
SHALL change as a result of a widget
visibility rule.

#### Scenario: Hidden content is still live

- WHEN a bundle hides a block in widgets
  that contains a control bound to an
  action
- THEN the action still exists and still
  works from the full page, and the
  widget rendering changes no stored
  state by hiding the block.

## Out of Scope

- A JavaScript context API, a
  `data-context` attribute, or any new
  shell surface (see the archived
  change's design.md, open question 0.1).
- A shell theme utility class for
  page-only content (see the archived
  change's design.md, open question 0.2).
- Hiding shell chrome, widget-specific
  layouts, conditional rendering, or any
  change to `ui.openAs` or
  `ui.placements`.
