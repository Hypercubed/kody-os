# Proposal

## Why

Pinned apps are the apps the owner reaches for most, but on the Apps screen they render as the same small tiles as everything else — six across, icon-over-label, no description. Wide pinned tiles with the description visible make the section scannable at a glance, and tooltips give desktop hover text everywhere with zero Scribe impact.

## What Changes

- Pinned tiles span two grid columns (3 per row at full width) at the same tile height; icon fixes left with label + description stacked right (horizontal tile variant, Pinned only; Recent and All apps unchanged).
- Every tile link on the Apps screen (Pinned, Recent, All apps) gains a `title` tooltip with the app description; invisible on Scribe, zero visual change.
- On the narrow breakpoint each pinned tile takes the full row (natural result of span-2 in the 2-column grid).
- Fix the stale clock example description (still mentions the removed note feature) since descriptions become visible on pinned tiles.

## Capabilities

### New Capabilities

(none — behavior change to an existing capability)

### Modified Capabilities

- `shell`: Pinned section renders wide tiles with descriptions; Apps-screen tile links carry tooltips.

## Impact

- `pkg/src/apps/client.ts` (pinned tile variant markup with description span + `title` on all tile links), `pkg/public/styles.css` + `src/shell-css.ts` regen (span-2 rule, horizontal tile layout), `example-apps/clock.bundle.json` (description fix).
- No storage change, no MCP surface change, no export format change. Tooltips are attributes only; Scribe rendering unaffected.
