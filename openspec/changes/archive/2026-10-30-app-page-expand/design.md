# Design: app-page-expand

## Context

The app page renders `renderAppPanel(..., withHeader = false)`, so the shell
window's `.os-titlebar` is the only title header: close box left, app title
centered, right side empty (`pkg/src/app.ts:354-360`,
`pkg/src/apps/client.ts:225-228`). The window is `width: calc(100% - 2rem)`,
`max-width: 48rem`, `margin: 1.5rem auto 0`, with a border and hard shadow
(`pkg/public/styles.css:186-192`). `main` adds a `1rem` gutter. Widgets and
modal overlays already use an upper-right expand box (`.widget-expand`,
`.modal-expand`, `pkg/public/styles.css:822-919`) that opens the normal app
page. The shell also already uses CSS `:target` for the modal overlay on the
Apps page, so fragment-driven view state is an established pattern.

## Goals / Non-Goals

- Goals: page-mode-only expand control; full-width, top-flush app view; no JS,
  no server state, no Fullscreen API; trivial collapse back.
- Non-goals: forced viewport height; persisted maximize preference; changes to
  widget or modal expand links; a new route or query param; bundle contract
  changes.

## Decisions

1. **URL fragment + `:target` instead of `?full=1`.** The expand link is
   `href="#os-full"`, the collapse link `href="#"`; CSS reacts to
   `#os-full:target`. Why: no server render branch, no action-form hidden-field
   propagation, no storage, and it matches the existing overlay `:target`
   pattern. Trade-off: a full navigation (no-JS action fallback) drops the
   fragment and collapses; accepted because the state is a view toggle, not a
   preference. The browser's own back button toggles it for free.
2. **Anchor id only exists on app pages.** `shellChrome` takes an `expandable`
   flag set only by `renderAppPage`; when true it puts `id="os-full"` on `<body>`
   and renders both controls. Why: the selector can never fire on Home, Apps,
   Help, or 404 pages even if a stray fragment is present.
3. **Keep the titlebar, hide menubar and status bar.** The titlebar carries the
   app title, the close box, and the swapped expand/collapse control, so the exit
   affordance never disappears. Why: option B chosen over immersive (no chrome)
   and full-bleed (chrome retained).
4. **Width and top only; never force height.** Expanded CSS sets
   `width: 100%`, `max-width: none`, `margin: 0`, removes the window border and
   shadow, and removes the `main` gutter so the app panel is edge-to-edge. It
   does not set a viewport height or `overflow`, so content height and scrolling
   stay as they are today. Why: keeps the change independent of the in-flight
   `fixed-shell-scroll` layout change; if that change later makes `main` the
   scroll region, expand inherits it without new rules.
5. **Two anchors rendered, CSS swaps them.** Both controls are server-rendered
   on app pages; `#os-full:target` hides `.os-expand` and shows `.os-collapse`.
   Distinct `aria-label`s ("Expand app to fill window", "Collapse app") and
   `title`s. Why: no JS, and the visible control always has an accessible name.
6. **Icons reuse the existing corner-bracket language.** Expand uses the same
   outward bracket as `.widget-expand` / `.modal-expand`; collapse uses an
   inward bracket. Why: no new font glyphs or SVGs, and consistent with the
   shell's e-ink icon discipline.

## Risks / Trade-offs

- [Risk] `href="#"` and `#os-full` make the browser scroll to top. Mitigation:
  accepted; expand is expected to jump to the top, and the shell starts pages at
  the top anyway.
- [Risk] The fragment is lost on full navigation, so the app returns to normal
  width after a no-JS action. Mitigation: accepted by the requirement; the
  enhanced fast path does not navigate, so JS-capable sessions keep the view.
- [Risk] Two layout changes touch the same CSS (`fixed-shell-scroll`). Mitigation:
  this change never sets height/overflow; it only narrows width and hides
  chrome, so the two can land in either order.
- [Risk] Hiding the menubar also hides Home/Apps/Help. Mitigation: the titlebar
  close box and the collapse control both remain; one tap restores the shell.

## Migration Plan

No stored state or data model, so no migration. On rollback, republishing the
prior commit removes the control and the expanded CSS; old bookmarks with
`#os-full` simply land on a normal page.

## Open Questions

- None.
