# Store row details layout - design

## Context

Current row rendering (catalog/app-store/store.js, 345 lines, v22 bundle; store.css, 23 lines). render() starts at store.js:196. Each row is li.store-row with three children in order:

1. span.store-main (store.js:204-217): icon (store-icon) + label (store-label), width 6.5rem, column, centered (store.css:4).
2. span.store-body (store.js:218-253), flex 1 (store.css:8), children in order:
   - span.store-badge (store.js:221-227), shown only when the badge text is not Installed, Not installed, or Up to date (for example 'Ahead of catalog', 'Absorbed', 'Modified')
   - span.store-desc (store.js:229-234): the catalog description
   - span.store-caps (store.js:236-242): the capabilities text
   - details.store-details (store.js:244-252): summary (the agent-text title) + code (the copyable prompt), built by storeAgentPrompt(row)
3. span.store-controls (store.js:254 onward): the action buttons (fixed width from store-row-layout, store.css:13), or requirement text when the app needs a newer shell or schema.

Current row CSS (store.css:3): display flex, flex-wrap wrap, align-items flex-start, min-height 6.5rem, border 2px solid, margin 0 0 12px 0, padding 0 0.7rem. The padding has no top or bottom component, so the main, body, and controls touch the row's top and bottom borders.

The details element is created and attached in exactly one place (store.js:244-252, body.appendChild(details) at line 252); no other code in store.js references it, and the bundle tests assert nothing about its parentage. The summary keeps min-height 48px and the caret triangle from store-row-layout (store.css:19-22).

## Decision 1: badge moves below description and capabilities

In render(), move the badge creation block to after the capabilities block inside .store-body. New body order: description, capabilities, badge, then (until Decision 3 moves it) the details element. No CSS change for the badge: its margin (store.css:9, 0 0 0.2rem 0) still separates it from what follows.

Rows without a badge (Up to date, Not installed) are unaffected: they render description, capabilities, and no badge, exactly as today. The badge remains conditional on the same rule (store.js:221).

## Decision 2: row padding top and bottom

.store-row padding becomes 0.7rem 0.7rem: the new top and bottom values match the existing 0.7rem horizontal padding, keeping one rhythm around the row. min-height stays 6.5rem, and box-sizing border-box (store.css:3) keeps the padding inside that minimum, so short rows do not grow. The bottom padding also gives the details element breathing room below its code block.
## Decision 3: the details element becomes a full-width row child

Move the details element out of .store-body to be the last child of li.store-row, appended after .store-controls. In store.css, .store-details gains flex: 0 0 100%. The row already wraps (flex-wrap: wrap, store.css:3), and the top line (main 6.5rem + body flex 1 + controls fixed-width buttons) leaves no room for a 100%-basis item, so the details wraps to its own line spanning the full row width, under the buttons. This is a flex-wrap move, not a grid rewrite: the top line keeps the existing flex layout untouched, and only the details changes parent.

Alternatives considered: making .store-row a grid with a full-width second row would do the same job but replaces the row layout the previous change just settled (flex, wrap, flex-start pinning); the flex-basis move is smaller and keeps the top line identical. Keeping the details inside .store-body and stretching it is not possible: a flex item cannot exceed its flex container's width, and the body column is bounded by the controls column.

The details keeps its margin (store.css:18, 0.4rem 0 0.2rem 0): the 0.4rem top margin separates it from the top line, and the row's new bottom padding handles the space below the code block. The summary (min-height 48px, caret triangle) and the code block (white-space pre-wrap, word-break break-word) are unchanged; the code block now wraps at the full row width instead of the body column width, which is the point of the change.

DOM validity: details is flow content and li accepts flow content, so a details element as a direct child of li is valid. The summary and code children are unchanged.

## What does not change

Badge text, the status to badge mapping (storeBadge), the status to button mapping (store.js, in the prior change's numbering around lines 291-295; verify at implementation), the storeAgentPrompt summaries and prompt text, button labels and busy labels, the caret, the 48px tap target, the fixed button width, Update All, and the confirm dialog.

## Versioning

App Store catalogVersion 22 to 23 (definition.json, plus regenerated catalog.json). No package version change: pkg/src is untouched, package stays 4.2.0 / build 46. No spec delta: no canonical spec covers the App Store bundle layout (same as store-row-layout); bundle-styles is untouched because its bare-button default and version rule are not changed by this.

## Constraints

ES2019 only; no flexbox gap (grid gap is allowed but unused here); system fonts only; no emoji; pure CSS and HTML restructure - no JavaScript for layout. The only store.js change is element order and parentage inside render(); storeAgentPrompt and the button logic are untouched.

## Open questions

None. The padding value (0.7rem) follows the existing horizontal padding; if the user wants a different value it is one line in store.css.
