# Proposal

## Why

The shell's frontend and backend are one tangled unit, and
shell-islands did not untangle the code — it untangled the state.
`pkg/src/app.ts` hand-builds the HTML document (`shellChrome`,
`pkg/src/app.ts:290`) as string concatenation interleaved with
fetch-handler logic, called from ~10 places (Home, app page, App
Store, Help, About, Apps list). `pkg/src/apps/client.ts` is named
"client" but runs on Kody: it renders every app-section HTML string
server-side (`renderAppSection`, `renderAppPanel`,
`renderOverlaySection`, `renderPinnedSection`,
`renderRecentSection`, `tileItem`, `tilesList`) plus the JSON state
seed. The actual browser code — the shell client module
(`pkg/src/client/index.ts`), the bridge adapter
(`pkg/src/bridge/bridge.js`), the shared elements
(`pkg/src/client/os-elements.ts`) — lives under `pkg/src/` right
alongside the BE, with no boundary marking what runs in the browser
from what runs on Kody. A reader (or an agent) cannot tell FE from
BE by looking at the tree, and the HTML the browser receives is
built by TS string concatenation in BE files.

Shell-islands (implementation done, Scribe verification passed,
all 18 tasks checked) delivered the state separation: components
read state only from the bridge store, never by scraping
server-rendered HTML. That is the foundation this change builds
on. What it did not deliver is the code separation: the BE still
builds the FE's HTML as TS strings, and there is still no
directory line between browser code and Kody code. This change
does the light version of that separation — reorganization, no
behavior change, no hosting change.

## What Changes

**Each component in its own JS file (light).** The shell chrome
HTML (`shellChrome` in `app.ts`) and the app-section HTML
(`renderAppSection` and friends in `apps/client.ts`) each move to
their own JS file under `pkg/src/client/components/`, exporting a
render function (data → HTML string) that the BE imports and
calls, instead of being built by string concatenation in TS.
(User direction 2026-11-13: "put each component in its own file.
These can be js files.") The served HTML is byte-identical before
and after — this is a refactor, not a redesign. The rendering
model does not change: the server still renders the shell + JSON
seed + section skeleton (the islands model, no-JS baseline kept);
only where the HTML text lives changes. The component JS files
are ES2019 with JSDoc signatures, and the tsconfig gains
`allowJs` so the TS BE can import them.

**Rename `apps/client.ts`.** It is server-side rendering code, not
client code. It becomes `apps/render.ts`. Exported function names
(`renderAppSection`, `renderStateSeed`, etc.) stay the same to
minimize churn; only the file path changes, and all imports are
updated in the same change.

**Directory boundary.** FE code lives in `pkg/src/client/`:
the shell client module, the bridge adapter (moved from
`pkg/src/bridge/bridge.js` to `pkg/src/client/bridge.js`), the
shared `os-*` elements, the component JS files, and the styles.
BE code lives in `pkg/src/` outside `client/`: the entry, the fetch
handler, `act()`, the registry, storage, MCP exports, feeds, theme.
The rule: no FE module imports a BE module (no `packageStorage`,
no registry, no server types). The boundary is the directory
layout plus that stated rule, recorded in `pkg/AGENTS.md`.

**The contract stays.** The BE renders the shell + seed + skeleton;
the FE (islands and bundles) mounts from the seed and the bridge.
Routes, the bridge contract, and the served HTML do not change.

## Capabilities

### New Capabilities

None. This is a reorganization, not a feature.

### Modified Capabilities

None. No observable behavior change.

## Impact

- Code: `pkg/src/` reorganization only (one JS file per
  component, one rename, one move, reference updates, `allowJs`
  in the tsconfig). No definition, state, or stored-data
  changes. No app is force-migrated; no bundle changes.
- Version: PATCH by the package policy — an internal refactor with
  no observable change. The bump lands in the implementation commit
  (never a separate "bump version" commit); build +1 on publish.
  `pkg/AGENTS.md` header updated in the same commit as the bump.
- BREAKING: none. The served HTML is byte-identical, routes and
  the bridge contract are unchanged, rollback is a revert of the
  reorganization commit.

## Dependencies

Builds on shell-islands (the islands architecture and the
bridge-only state rule are the foundation: the FE/BE boundary
assumes the bridge is the state contract). The reorganization
lands after shell-islands — it moves code shell-islands added
(`os-elements.ts`, the lit script emission in `app.ts`) — but it
does not require shell-islands to be published first.

## Non-goals

- Hosting split (FE on GitHub Pages, BE as a separate service) —
  explicitly out. This change keeps one Kody package; the FE and
  BE are separated by code layout, not by deployment.
- Deep version (server renders shell + seed only, client renders
  all UI) — out. That is a separate, larger change; this one keeps
  the server rendering the seed + skeleton for the no-JS baseline.
- Client-side routing / SPA, SSR, new features, new effect
  operators, `act()`/registry semantics changes.
- Changing the served HTML, the routes, or the bridge contract.
  Byte-identical output is the verification.
- Release or publish steps. The release decision stays the user's.
