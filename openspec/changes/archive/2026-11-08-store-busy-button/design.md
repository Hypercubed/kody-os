# Design: Store buttons show a busy state while an async action runs

## Decisions

### 1. No rotating spinner — the e-ink rule forbids it

`pkg/public/styles.css` carries a global e-ink discipline rule:

```css
/* E-ink discipline: never animate, never transition. */
*,
*::before,
*::after {
	animation: none !important;
	transition: none !important;
}
```

`pkg/docs/scribe-limitations.md` states it as a binding constraint: "No animations/transitions (`transition: none !important; animation: none !important`, per ReKindle). No canvas tricks, no auto-refresh, no polling." A `@keyframes` spinner in the Store bundle would be inert under the `!important` rule, and a `setInterval` text spinner would need repeated DOM updates that the same doc rules out (timers and re-render churn ghost on a 1–10 FPS e-ink display). So the busy state is a disabled button with a working label — one text change, no animation, no timer.

### 2. A busy-button helper in `store.js`

A small helper wraps any Store button that starts an async action. On click it disables the button and swaps its label to the working label, runs the action, and restores the button (enabled, original label) when the action's promise settles — unless the rows were re-rendered in the meantime, in which case the button is already gone and the restore is a no-op. The handler must return the action's promise so the helper knows when it settles; a click while disabled is ignored.

Working labels, per action:

| Button | Working label |
|---|---|
| Add | Adding… |
| Update | Updating… |
| Overwrite | Overwriting… |
| Restore | Restoring… |
| Remove | Removing… |
| Update All | Updating all… |
| Confirm (dialog) | Confirming… |

### 3. Where it applies

- Row action buttons, built by the `mutate` helper in `render()` (Add, Update, Overwrite, Restore, Remove). Today `mutate` creates a plain `storeButton` and fires `storeApi` without returning the promise; it is refactored to use the busy helper and return the promise chain.
- The "Update All" button (`updateAllNow`): disabled with "Updating all…" while the sequential updates run, restored when the run finishes and the rows reload.
- The confirm dialog's Confirm button (`showConfirm`): disabled with "Confirming…" while the confirmed call runs, restored on error; on success the rows reload.
- The status line ("Working…") is unchanged and stays as the second signal.

### 4. Restore paths

- Success: `load()` re-renders the rows, destroying the button — no restore needed (the helper's settle restore is a no-op on a detached button).
- Error: the status shows the error and the rows do not re-render, so the button is re-enabled and its label restored.
- Needs confirmation: the confirm dialog appears and the status clears; the row button is re-enabled and its label restored (the dialog's own Confirm button carries the busy state from there).

### 5. Spec delta: shell only

The canonical shell spec's "App Store page is a data app" requirement gains the busy-button rule and a scenario. The app-registry spec needs no delta: the management API and its responses are unchanged.

### 6. Version

- App Catalog bundle changed (`store.js`, and `store.css` only if a disabled-button style is needed — the shell's default disabled styling applies, so likely no CSS change), so app-store `catalogVersion` 19 → 20, and `catalog/catalog.json` is regenerated.
- Package PATCH 4.1.2 → 4.1.3, build 37 → 38. This is a fix for a UX defect (a button that gives no feedback while its action runs); no app definition, MCP export, state field, or action behavior changes, and nothing that worked before stops working. The bump rides in the same commit as the change, per the version policy.

## Verification

- Catalog harness + store harness pass. The store harness gains checks: clicking a row Add disables that button and changes its label to "Adding…"; the button is re-enabled with its original label after a failed install; a second click while disabled fires no second request.
- `bun build` passes; ES2019 clean (the helper uses only `var`, function declarations, and promise `.then`, matching the existing bundle style).
- `openspec validate --changes` passes for this change.
- On a live/mock Store page, pressing Add shows the button disabled with "Adding…" until the install completes or fails.
