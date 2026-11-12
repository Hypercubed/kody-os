# Store row details layout - proposal

## Problem

Three user-directed refinements to the Store rows, on top of store-row-layout (already implemented, uncommitted):

1. Badge position. The status badge (for example 'Ahead of catalog' or 'Absorbed') is the first element of the row body, above the description. The user wants it below the description and capabilities, and above the agent-text details element.
2. Row padding. Rows have no top or bottom padding: .store-row padding is '0 0.7rem', so content touches the row's top and bottom borders.
3. Agent text width. The agent-text details element is confined to the body column, beside the controls column, so its prompt wraps at the body width. The user wants it to flow under the button on the right - full row width beneath the controls.

## Change (summary)

- store.js render(): move the badge creation to after the capabilities element inside .store-body; move the details element out of .store-body to be the last child of li.store-row.
- store.css: .store-row gains top and bottom padding (0.7rem); .store-details gains flex 0 0 100% so it wraps to its own full-width line under the controls.
- Nothing else changes: badge text, the status to badge/button/prompt mapping, prompt text, button labels, the caret, the 48px tap target, and the fixed button width are all untouched.

## Versioning

App Store catalogVersion 22 to 23 (definition.json plus regenerated catalog.json). No package version change (pkg/src is untouched). The 22 base is the uncommitted store-row-layout state. The counter 5 to 6 demo bump in the same tree (mock-only, from the behind-modified setup) is unrelated and must be reverted before any real commit.

## Out of scope

- Any change to status derivation, prompt text, the button mapping, or the caret.
- The Apps page list (server-rendered shell rows, not Store rows).
- The confirm dialog buttons and Update All (already out of scope in store-row-layout).
- Release and publish steps: the user decides when to release. No verify-on-Scribe task.
