# Tasks

## 1. Center the modal panel

- [x] 1.1 Switch `.overlay:target` to flex with `.overlay-panel { margin: auto }` in `pkg/public/styles.css`, regen `src/shell-css.ts`, and verify byte-identical plus one inline `<style>`, zero `<link>`
- [ ] 1.2 Verify on preview and device: short modals (clock) open vertically centered; tall modals scroll with the panel top reachable; open/close/backdrop behavior unchanged
- [ ] 1.3 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes
