# Tasks

## 1. Markup and dispatch

- [ ] 1.1 Extend `shellChrome` opts with an `expandable` flag. When true, write
  `id="os-full"` on `<body>` and render two titlebar anchors at the far right,
  opposite the close box: `.os-expand` (`href="#os-full"`, label/title "Expand
  app to fill window") and `.os-collapse` (`href="#"`, label/title "Collapse
  app"). When false, render neither and keep the body id absent; verify Home,
  Apps, Help, 404, widget, and modal markup is unchanged.
- [ ] 1.2 Pass `expandable: true` from `renderAppPage` only. Verify the app page
  HTML contains the body id and both anchors, and that `withAccessCodeInHtml`
  leaves the `#os-full` and `#` hrefs unstamped (no `?k=` on fragment links).

## 2. Styles

- [ ] 2.1 Add the expanded-view rules to `pkg/public/styles.css` under a
  `#os-full:target` scope: hide `.os-menubar` and `.os-statusbar`; make
  `.os-window` `width: 100%`, `max-width: none`, `margin: 0`, no border, no
  shadow; remove the `main` gutter; drop the app panel's side borders; remove
  body bottom padding. Swap `.os-expand`/`.os-collapse` visibility. Add the
  collapse inward-bracket icon mirroring `.widget-expand`/`.modal-expand`, and
  add the new marks to the `prefers-contrast: more` block. Do not set height or
  overflow. Verify the normal page renders unchanged.
- [ ] 2.2 Regenerate `pkg/src/shell-css.ts` from `public/styles.css` and confirm
  the two are byte-identical.

## 3. Docs

- [ ] 3.1 Note the page-mode expand control and full-window view in
  `pkg/docs/adding-an-app.md` (page chrome section), keeping the widget/modal
  expand description accurate.

## 4. Verification

- [ ] 4.1 Manual no-JS check on `kody dev` (mock): open an app from the Apps
  grid and from a home widget, expand, collapse, and use the browser back
  button; confirm menubar/status bar hide, the window spans the viewport from
  the top, and height/scroll follow content.
- [ ] 4.2 Confirm a no-JS action round trip drops the fragment and returns the
  normal page, while the enhanced fast-path action keeps the expanded view; also
  confirm no storage, cookie, or server state is written by expanding.
- [ ] 4.3 Check the narrow breakpoint (`max-width: 30rem`), where the window is
  already full width: the control still hides the chrome and removes the gutter,
  and the app panel stays edge-to-edge.
- [ ] 4.4 Run `kody check --offline` and the existing harnesses; confirm no
  route, storage, export, MCP, or bundle-contract change.
- [ ] 4.5 Apply the MINOR version bump in the same commit as the code per
  `pkg/AGENTS.md` (reset PATCH, sync the `pkg/AGENTS.md` and `pkg/README.md`
  version headers, BUILD +1 on publish).
