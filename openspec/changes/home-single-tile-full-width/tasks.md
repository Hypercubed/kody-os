# Tasks

## 1. Full-width lone widget on Home

- [ ] 1.1 Add `.widgets > :last-child:nth-child(odd) { grid-column: 1 / -1; }` rule to `pkg/public/styles.css` (desktop scope, above the `30rem` media query), regen `pkg/src/shell-css.ts`, and verify `openspec validate --change home-single-tile-full-width` passes
- [ ] 1.2 Verify on Home: single widget spans full width; 3 widgets render 2+1-full-width; 2 and 4 widgets unchanged; narrow viewport single-column unchanged; Apps `.tiles` grid unchanged
