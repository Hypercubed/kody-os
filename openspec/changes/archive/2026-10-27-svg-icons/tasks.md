# Tasks

## 1. Validator + types

- [x] 1.1 Add `isSvgIcon` + `sanitizeSvgIcon` allowlist in `pkg/src/apps/registry.ts` and verify `node --experimental-strip-types --check` passes plus hostile SVG returns `{ ok: false }`
- [x] 1.2 Widen `icon?: string` docs in `pkg/src/apps/types.ts` to plain-text OR sanitized SVG and verify typecheck passes

## 2. Render + theme

- [x] 2.1 Branch `tileItem` in `pkg/src/apps/client.ts` to insert sanitized SVG unescaped and verify preview tile shows SVG with no escaped markup
- [x] 2.2 Add `.tile-icon svg` sizing in `pkg/public/styles.css`, regen `src/shell-css.ts`, and verify byte-identical plus one inline `<style>`, zero `<link>`

## 3. Examples + docs + verify

- [x] 3.1 Update `example-apps/clock.bundle.json`, `eight-ball.bundle.json`, `hello-counter.json` with monochrome SVG icons and verify each installs via `add_app` and renders on preview
- [x] 3.2 Update `pkg/docs/adding-an-app.md` icon section and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --strict` passes
- [x] 3.3 Final sweep: every `example-apps/*.json` (`clock`, `eight-ball`, `hello-counter`, `probe`) carries a real monochrome inline SVG icon (no single-char placeholders left) and verify each installs via `add_app` and renders its SVG tile on preview
