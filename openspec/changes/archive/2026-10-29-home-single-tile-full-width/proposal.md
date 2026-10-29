# Proposal

## Why

On the Home dashboard (`GET /`), a widget that sits alone in its grid row renders at half width, leaving an empty gap beside it. With the current 2-column desktop grid this happens for any odd widget count (including the common single-widget home), wasting container space and looking unfinished.

## What Changes

- On Home only (`.widgets` dashboard grid), a widget that is alone in its row spans the full container width.
- Desktop grid behavior unchanged otherwise: 2-column grid, even rows render side-by-side as today.
- Narrow breakpoint (`max-width: 30rem`, single-column) unchanged — everything is already full width there.
- Apps page `.tiles` grid untouched.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `widget-home`: widget dashboard grid gains a full-width rule for a lone widget in its row (extends "Widget dashboard as landing page").

## Impact

- `pkg/public/styles.css` — source of truth, ~5 line CSS rule scoped to `.widgets`.
- `pkg/src/shell-css.ts` — generated mirror, must be regenerated after theme edit (per file header).
- No server logic, no state, no API, no spec changes beyond layout rendering.
