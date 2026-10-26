# Proposal

## Why

App pages render the app title twice: once in the shell window's striped titlebar and again in an identical striped bar inside the app panel. On a small e-ink screen that duplication wastes vertical space and reads as a rendering bug.

## What Changes

- App pages (`GET /apps/:id`) render the panel without its inner titlebar; the shell window's titlebar carries the app title (it already does).
- Modal overlays keep their inner titlebar, since the underlying page chrome still shows the home title, not the app's.
- The same duplicate existed on the Help, Locked-gate, and Access-code pages (chrome title + identical panel titlebar); their panels lose the inner titlebar too. Widgets keep theirs — each widget names its app while the home chrome says Home.
- No visual change to home, 404, or dashboard widgets, and no change to behavior, routing, or state handling.

## Capabilities

### New Capabilities

(none — this removes duplication, it adds no behavior)

### Modified Capabilities

- `shell`: the "App pages render definition plus live state" requirement gains a single-titlebar rule — one title per app view, owned by the shell chrome on full pages and by the panel on overlays.

## Impact

- `pkg/src/apps/client.ts` (`renderAppPanel` gains a headerless mode; overlay path unchanged), inline panel titlebars removed from the Help/Locked/Access-code bodies in `pkg/src/app.ts`, possibly a small theme touch-up in `public/styles.css` + `src/shell-css.ts` regen if spacing shifts.
- No MCP, storage, export, or routing changes. Sequenced after all current work: applies cleanly on top of the other in-flight UI changes.
