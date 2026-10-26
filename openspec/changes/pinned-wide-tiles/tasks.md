# Tasks

## 1. Wide pinned tiles

- [ ] 1.1 Add the pinned tile variant with description span in `pkg/src/apps/client.ts` (Recent/All markup unchanged) and verify the Pinned section renders icon-left, label-plus-description-right tiles
- [ ] 1.2 Add the span-2 rule plus horizontal pinned-tile layout in `pkg/public/styles.css`, regen `src/shell-css.ts`, and verify byte-identical plus 3-per-row at full width, same 6.5rem height, and full-row stacking under the 30rem breakpoint
- [ ] 1.3 Fix the stale clock example description (drop the removed-note claim) in `example-apps/clock.bundle.json` and verify `validateDefinition` returns null

## 2. Tooltips and verify

- [ ] 2.1 Add the escaped-description `title` to every Apps-screen tile link and verify the attribute is present with no visual change
- [ ] 2.2 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes
