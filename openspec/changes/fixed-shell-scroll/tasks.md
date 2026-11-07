# Tasks

## 1. Prove inner scroll on the Scribe

- [ ] 1.1 Add a scrollable-div + `scrollTop` beacon row to the probe (`pkg/catalog/probe/definition.json` — the probe is a catalog app; there is no `pkg/src/probe.ts` and no `probe.bundle.json`) and verify the row reports scrollable on the Scribe before any CSS work (Kept Nov 6, 2026: checks the specific unknown this change exists to prove — whether inner scroll works on the Scribe — before any CSS work.)
## 2. Lock the shell

- [ ] 2.1 Make `body` a fixed `100vh` flex column with `.os-window` at `flex: 1; min-height: 0` and `main` as the single `overflow-y: auto` region in `pkg/public/styles.css`, regen `src/shell-css.ts`, and verify byte-identical plus one inline `<style>`, zero `<link>`
- [ ] 2.2 Verify on preview and device: menubar/titlebar/statusbar stay visible on over-viewport pages (Home, Apps, app, Help, locked/404); modal overlays behave as before; no `dvh`, no JS, no flexbox `gap` (Kept Nov 6, 2026: checks the specific named behavior — shell chrome staying visible on over-viewport pages, modal behavior — not a routine check.)
- [ ] 2.3 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes
