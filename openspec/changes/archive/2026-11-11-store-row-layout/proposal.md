# Store row layout: caret, top pinning, fixed button width

## Why

The App Catalog (Store) rows gained a `<details>` agent prompt in the absorb change (`openspec/changes/store-row-agent-prompts/`, uncommitted on branch `close-v4-tail`). Looking at the live rows in the mock dev env, three layout defects show:

1. The prompt's `<summary>` shows no expand/collapse caret, so a row with a prompt does not look expandable.
2. Opening a `<details>` grows the row and the icon, label, and buttons move — they are vertically centered, not pinned to the top.
3. The row action buttons are all different widths (Add / Update / Overwrite / Restore / Remove), so the button column is ragged.

The Store is a catalog app (`catalog/app-store/`), not shell code, so all three fixes land in its bundle (`store.css`) with no `pkg/src` change and no behaviour change.

## What changes

- A visible CSS caret on every `.store-details summary`, right-pointing when closed, down-pointing when open; the native marker hidden so there is exactly one marker.
- Icon/label/buttons pinned to the top of the row container: the row's flex alignment goes from `center` to `flex-start`, and the icon column stops stretching-and-centering.
- One fixed width for every row action button, sized to the longest (busy) label, so the button column is uniform and clicking a button never resizes it.

## What does not change

- Button labels and busy labels, the status → button mapping, badge text, prompt text and summaries, the `<details>` placement and content, and every row's status derivation. No `store.js` change at all: all three fixes are pure CSS.
- The confirm-dialog buttons and the "Update All" header button are out of scope (design.md, Decision 4).
- No package version change. The Store's `catalogVersion` goes 21 → 22 (design.md, Versions).

## Non-goals

- Any change to the absorb behaviour, the prompt wording, or the status model.
- Any change to the shell's own rows (the server-rendered Apps page) or to `pkg/public/styles.css`.
- A visual redesign of the Store rows beyond these three fixes.

## Open questions

None. The current-code references and the sizing basis are verified in design.md; the only judgment call left to implementation is the caret's exact triangle size, bounded in the design.
