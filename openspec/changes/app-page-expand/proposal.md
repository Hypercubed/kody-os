# Proposal

## Why

App pages are capped at `48rem` and centered with a `1.5rem` top gap, so a
data-dense app (tables, long lists, wide layouts) leaves most of the browser
window unused. Home widgets and modal overlays already have an expand box that
reaches the full app page, but the full page itself has no way to grow. This
adds a page-mode-only expand control that lets the app fill the browser window
edge-to-edge, without the browser Fullscreen API and without JavaScript.

## What Changes

- On an app page (`GET /apps/:id`) only, the shell titlebar gains an expand box
  at the far right, mirroring the close box on the left. Widgets and modal
  overlays keep their current expand boxes and behavior.
- Activating it makes the window span `100%` of the viewport width, flush with
  the top, hides the menubar and status bar, and removes the main-content gutter
  so the app panel reaches the left and right edges. Height is not forced;
  content scrolls as it does today.
- The control swaps to a collapse affordance in the expanded view and returns
  the normal centered chrome.
- Expanded state is carried in the URL fragment and rendered by CSS `:target`.
  It needs no server state, no storage, and no JavaScript, and it does not
  survive a full navigation (accepted: the state is a view toggle, not a
  preference).
- Explicit non-goals: no Fullscreen API (`requestFullscreen`), no JS toggle, no
  persisted preference, no forced viewport height, no change to widget or modal
  expand links, no server route or query-param state.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shell`: app pages gain a page-mode expand/collapse control and a
  full-window view state; the rest of the chrome contract is unchanged.

## Impact

- `pkg/src/app.ts` (`shellChrome` gains an expandable flag, body anchor id, and
  the titlebar controls; `renderAppPage` opts in), `pkg/public/styles.css` and
  `pkg/src/shell-css.ts` (regen after the CSS edit), `pkg/docs/adding-an-app.md`
  (page chrome note).
- No storage-key, export-format, route, MCP, or bundle-contract change. No
  action-form propagation: the fragment is not sent to the server.
- Version: MINOR at implementation (new feature, nothing existing breaks) per
  `pkg/AGENTS.md`.
