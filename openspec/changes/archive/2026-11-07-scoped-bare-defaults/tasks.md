# Tasks

Implementation already exists in the working tree (PC repo, main
at 30b0c24, committed as `ef654da` and published to Kody as v2.6.0 build 31 (2026-11-04). Phases 1–4 are done and are
marked as such; they are recorded here so the change is reviewable,
not so they can be redone. Phase 5 is the only open phase (its ship decisions, 5.4-5.5, have since happened; see the notes there), and
every task in it is an owner decision. No task in this file commits,
pushes, or publishes anything, and no task bumps the package
version; the version decision is recorded at commit time.

## 1. Shell defaults

- [x] 1.1 Add scoped bare defaults to `pkg/public/styles.css`
  under `.bundle` only: button (48px min height/width, shell
  font, 20px, normal weight, paper/ink, 1px border, 2px hard
  shadow, `0 16px` padding; hover stays paper; active inverts,
  no shadow, no transform; disabled greys) and fields
  (`input`/`select`/`textarea`: 48px min height, 16px, paper/ink,
  1px border, 4px radius, `10px 12px` padding; disabled greys),
  plus `.bundle button.os-btn--dark` pinned against the hover
  rule. Leave the shell's global bare rules and all shell
  chrome untouched.
- [x] 1.2 Regenerate `pkg/src/shell-css.ts` with the repo's
  generator and verify its diff reflects only the styles change.

## 2. Bundle cleanup

- [x] 2.1 Delete per-app button look rules and wrapper
  font/color/background re-declarations in all 17 bundles
  (about, app-store, arrow-game, calculator, calendar,
  cellular-playground, clock, counter, daily-feed, eight-ball,
  hoodie-weather, link-drop, mac-puzzle, news, probe,
  three-bit-art, xkcd); keep layout (padding, max-width,
  margin, text-align) and variant deltas only. Help untouched.
- [x] 2.2 Normalize markup to bare elements or shared variant
  classes: Calculator display to `os-display`, keys container
  to `os-keypad`, keys to `os-key`/`os-key--wide`/`os-key--tall`
  (JavaScript className strings updated; `calc-display` /
  `calc-keys` element IDs kept); cellular toggles to bare +
  `os-btn--dark` when on; news active tab to
  `news-tab news-tab-on os-btn--dark`; three-bit gallery
  `load`/`del` className assignments removed.
- [x] 2.3 Dual-select state/variant rules that must win over
  the default and over `:disabled`: arrow-game cells,
  puzzle tiles (disabled ink/border pinned), three-bit
  swatches. Keep hook/marker classes with look CSS deleted
  (see design.md Decision 5).
- [x] 2.4 Increment each touched bundle's `catalogVersion` by
  exactly 1 (see design.md Decision 8); no other bundle's.
  Link-drop kept to a 4-line diff by raw-text surgery after
  a JSON re-dump rewrote its non-standard indentation.

## 3. Docs

- [x] 3.1 Rewrite the style guide's rule (status paragraph,
  principle 6, section 5 intro, Buttons note, minimal example)
  to "bare defaults; classes only for variants", and correct
  the Daily Brief → Daily Feed reference inside the edited note.
- [x] 3.2 Rewrite the adding-an-app skill's one sentence
  stating the old class rule to the bare-defaults rule.

## 4. Verification

- [x] 4.1 Catalog harness: ALL PASSED (18 apps), same as
  baseline.
- [x] 4.2 Full `.cjs` suite vs. a clean-tree baseline
  (temporary HEAD worktree, removed after): identical
  outcomes except the pre-existing failures listed in
  design.md Decision 10. Two introduced regressions (hoodie
  result selector, daily-feed version expectation) fixed, not
  hidden; only selectors and that one version expectation
  changed in tests.
- [x] 4.3 `kody dev` (mock, same pid, no restart, no
  mock-store writes): after the styles edit the served page
  contained the new defaults — live-reload confirmed.
- [x] 4.4 Read the change back: `git status` / `git diff
  --stat` shows 24 files, 149 insertions, 67 deletions, and
  no file outside the implementation's scope.

## 5. Review and ship decisions (owner only)

- [x] 5.1 Visual check on Scribe and/or preview: 20px buttons,
  1px borders (was 2px `#111` in many apps), 2px shadows,
  flattened Puzzle New Game, Calculator keys, Hoodie Weather
  (16px input, buttons in the 2-column actions grid),
  Cellular/News dark toggle states, one page and one widget. (Kept Nov 6, 2026: checks the named visual outcomes of this change per app — 20px buttons, 1px borders, 2px shadows, specific toggle states — not a routine check.)
- [x] 5.2 News active tab bold: restore it with a marker rule,
  or accept inversion-only as the state cue.
- [x] 5.3 Pill variants: confirm Counter and Eight Ball pills
  stay variants and Puzzle New Game stays flattened, or
  reverse either call.
- Removed Nov 6, 2026 per the no-release / no-generic-Scribe-verify rule: task 5.4 "Commit scope: spec and implementation together or separately, and the version decision for that commit" — a commit-scope task; the commit already landed as ef654da, so the decision is moot.
- Removed Nov 6, 2026 per the no-release / no-generic-Scribe-verify rule: task 5.5 "Push destination and publish: GitHub only, Kody publish, both, or neither" — a push/publish task, already done: pushed to GitHub as ef654da and published to Kody as v2.6.0 build 31; live has since moved to v2.7.0 build 32.
  - Done Nov 7, 2026 (owner decisions): 5.1 deleted `.hw-results button { display: block; width: 100%; text-align: left; }` from hoodie-weather (v8->v9); `.hw-results button small` kept; `hw-btn` hooks kept; no other bundle shares that full-width result-button cause (other `button` layout rules — `.ag-row button`, `.cal-bar button`, `.cp-row button`, `.feed-nav button`, `.tb-row button`, game tiles/palette — differ for layout/game-state reasons, left unchanged); bundle buttons verified in-memory (3x .hw-btn + results now all bare-default inline; shell `restore_default` form remains shell chrome outside `.bundle`, unchanged — no shell change allowed). 5.2 added bundle-only `.bundle button.news-tab-on { background: #000; color: #fff; box-shadow: none; transform: translate(3px, 3px); }` to news (v3->v4), matching `.edit-toggle-btn-on` exactly, no bold; JS active classes unchanged. 5.3 deleted `.bundle button.counter-step` pill (counter v4->v5) and `.bundle button.ball-shake` pill (eight-ball v4->v5); `counter-step`/`ball-shake` classes kept as JS hooks; both verified bare-default (square radius 0, 48px). Catalog index regenerated (`build-catalog-index.ts`, 18 apps). Evidence: `bun tests/catalog-harness.ts` ALL PASSED (18 apps); `bun tests/store-harness.ts` ALL PASSED; `bun build pkg/src/app.ts --target=browser --external 'kody:*'` succeeds; in-memory `renderAppSection` checks per app (see turn log); mock server not reinstalled per handoff (running mock serves pre-edit installed defs, so in-memory render is the verification).
- [ ] 5.6 Future consideration, not part of this change: a
  harness check that fails a bundle button look rule
  duplicating a default, so the drift this change removed
  cannot return silently. The original proposal named this
  as a backstop; the implementation does not include it,
  and no such check is claimed here.

## 6. Review fixes (Nov 4, done during owner review)

- [x] 6.1 Bundle buttons square: `.bundle button` gets
  `border-radius: 0` in `pkg/public/styles.css`, fields keep
  the 4px token, pill variants keep their radius;
  `pkg/src/shell-css.ts` regenerated (regen method proven
  byte-identical first); style guide and spec updated to
  match (see design.md Decision 11).
- [x] 6.2 Modal panels get their border back:
  `.os-window main .overlay .app` restores `var(--rule)` and
  `var(--lift)` in `pkg/public/styles.css`, regenerated into
  `shell-css.ts`; app pages, narrow-screen framing, and the
  logout modal are unchanged.

## 7. Archive (Nov 7, 2026)

- [x] 7.1 Sync + archive: DONE Nov 7, 2026 — delta `specs/bundle-styles/spec.md` synced into new canonical spec `openspec/specs/bundle-styles/spec.md` (validates valid) at CURRENT state: pill scenario reframed (Counter/Eight Ball pills removed per task 5.3 / design Correction 2026-11-07 — classes kept as JS hooks only), News active-tab scenario states the Apps-page Edit treatment per task 5.2 (not inversion-only), reconciliation recorded in the canonical spec's sync note; folder moved via `git mv` to `openspec/changes/archive/2026-11-07-scoped-bare-defaults/`; close-out note appended.

## Close-out note (Nov 7, 2026)

Synced and archived per the handoff. Implementation was committed as `b1af854` and verified by Tessa (Nov 7, 2026): tasks 5.1/5.2/5.3 done with the Nov 7 owner decisions — 5.1 deleted the hoodie-weather full-width result-button rule (v8->v9); 5.2 added bundle-only `.bundle button.news-tab-on` matching `.edit-toggle-btn-on` exactly, no bold (v3->v4); 5.3 deleted the Counter and Eight Ball pill rules (v4->v5 each), both buttons now bare-default; catalog index regenerated (18 apps). Evidence: `bun tests/catalog-harness.ts` ALL PASSED (18 apps), `bun tests/store-harness.ts` ALL PASSED, `bun build pkg/src/app.ts --target=browser --external 'kody:*'` succeeds, plus in-memory `renderAppSection` checks per app. Ship decisions 5.4/5.5 recorded as done — pushed as `ef654da`, published as v2.6.0 build 31. Design corrections applied: Decision 6 (pills removed) and Decision 7 (Edit treatment) supersede the delta's earlier pill-variant and inversion-only text; the canonical sync reflects the corrected state.

Leftover: task 5.6 stays unchecked by design — it is explicitly future consideration, not part of this change (a harness check failing duplicated button-look rules). It is the only unchecked box in this file.
