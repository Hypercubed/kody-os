## 1. Drop the duplicate titlebar on app pages

- [x] 1.1 Add the header flag to `renderAppPanel` (headerless vs with-header, default preserves current behavior) and verify both modes render via a node one-liner
- [x] 1.2 Wire the app page route to headerless mode and keep the overlay route with header, then verify a node render of each page: exactly one app title on the app page, overlay unchanged with its own title
- [x] 1.3 Check panel spacing after header removal and, only if the body sits flush against the panel border in a way the theme didn't anticipate, adjust `.app-body` top padding in `public/styles.css` + regen `src/shell-css.ts`; verify byte-identical regen either way

## 1b. Drop the duplicate titlebar on Help, Locked, and Access-code pages

- [x] 1.4 Remove the inline panel `<h2 class="app-titlebar">` from the Help, Locked-gate, and Access-code bodies in `pkg/src/app.ts` (chrome title already names each page) and verify one title per page

## 2. Verify

- [x] 2.1 Run the full change checks (node render of app page, overlay, home, help, gate, and 404 — one title per app view, zero `<section class="app">` regressions) and verify `openspec validate single-titlebar` passes
