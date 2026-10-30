# Tasks

## 1. Center the modal panel

- [x] 1.1 Switch `.overlay:target` to flex with `.overlay-panel { margin: auto }` in `pkg/public/styles.css`, regen `src/shell-css.ts`, and verify byte-identical plus one inline `<style>`, zero `<link>`
- [ ] 1.2 Verify on preview and device: short modals (clock) open vertically centered; tall modals scroll with the panel top reachable; open/close/backdrop behavior unchanged
- [ ] 1.3 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes
- [x] 1.4 Move the panel top to 25vh (supersedes centering, Oct 30, 2026): `.overlay-panel { margin: 25vh auto auto }` in `pkg/public/styles.css`, regen `src/shell-css.ts` via the verified byte-identical generator, and confirm the regen diff touches only the overlay panel rule; 1.2's verification now reads "panel top at 25vh, tall panels scroll with top reachable" instead of "vertically centered"
