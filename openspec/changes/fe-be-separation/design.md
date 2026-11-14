# Design

## Context

The shell is a Kody package: `pkg/src/index.ts` is the entry, and
the fetch handler in `pkg/src/app.ts` returns HTML responses. That
is the Kody model — the TS is the server — and this change does not
alter it. What it alters is where the HTML text lives and which
files are FE (run in the browser) versus BE (run on Kody).

Current mixing, verified against the tree (main, `ecef0f7`):

| File | Runs on | What it does |
| --- | --- | --- |
| `pkg/src/app.ts` | Kody (BE) | Fetch handler + `shellChrome` (line 290) builds the HTML document by string concatenation (`'<html lang="en"\n' +`, `'<head>\n' +`, …), called from ~10 routes |
| `pkg/src/apps/client.ts` | Kody (BE) | Renders all app-section HTML server-side (`renderAppSection`, `renderAppPanel`, `renderOverlaySection`, `renderPinnedSection`, `renderRecentSection`, `tileItem`, `tilesList`) + `renderStateSeed`. Named "client" but is not client code |
| `pkg/src/client/index.ts` | Browser (FE) | Shell client module (form enhancement, bridge load, `os-*` wiring) |
| `pkg/src/bridge/bridge.js` | Browser (FE) | Bridge adapter (`window.KodyBridge`), loaded by the shell client |
| `pkg/src/client/os-elements.ts` | Browser (FE) | Shared `os-*` elements (shell-islands) |
| `pkg/src/shell-css.ts` | Kody (BE, generated) | FE CSS inlined into a TS string by the build (`pkg/public/styles.css` is the source) |

The shell-islands change (open) added the islands model and the
bridge-only state rule, but left this layout untouched: `app.ts`
still builds the document, `apps/client.ts` is still misnamed, and
the browser code still sits beside the BE with no boundary.

## Decisions

### 1. Each component is its own JS file, imported by the BE

Each UI component — the shell chrome, and each app-section
renderer — moves to its own JS file under
`pkg/src/client/components/`, exporting a render function that
takes data and returns an HTML string. The BE imports these
functions and calls them; it no longer builds HTML by string
concatenation in TS. (User direction 2026-11-13: "put each
component in its own file. These can be js files." This supersedes
the earlier HTML-template-file approach — JS functions carry the
markup and the branching together, with no placeholder syntax to
invent and no `fillTemplate` helper to maintain.)

The component files are ES2019 JS (no TS), each a single
component:

- `shell-chrome.js` — the HTML document (`shellChrome` from
  `app.ts`).
- `app-section.js` — `renderAppSection`.
- `app-panel.js` — `renderAppPanel`.
- `overlay-section.js` — `renderOverlaySection`.
- `pinned-section.js` — `renderPinnedSection`.
- `recent-section.js` — `renderRecentSection`.
- `tiles.js` — `tileItem`, `tilesList`, `renderHomeTiles`.
- `bundle-content.js` — `renderBundleContent` (+ the bundle
  helpers it needs).
- `state-seed.js` — `renderStateSeed`.
- `edit-section.js` — `renderEditSection` (+ its toggle helpers
  and `editAppsLink`).
- `all-section.js` — `renderAllSection`.
- `widget-section.js` — `renderWidgetSection`.
- `empty-help.js` — `renderEmptyHelp`.
- `helpers.js` — the shared helpers (`escapeHtml`, `str`,
  `isRecord`, `looksLikeSvg`, `isModalApp`,
  `packageRefForHost`).

Each JS file carries JSDoc for its function signatures (referencing
the shared types in `apps/types.ts`), so the signatures stay
documented. The tsconfig gains `"allowJs": true` so the TS BE can
import the JS component files; `checkJs` stays off (the JS files
are not typechecked, only imported — the byte-identical
verification is the check that matters). The components have no
runtime imports (they only build HTML strings from data), so they
stay browser-safe, exactly as `apps/client.ts` is today.

Component files are the FE's HTML. The BE owns the data (title,
body, theme, seed, menu apps) and calls the functions; it does
not own the markup text. This is the light version: the server
still renders the seed + skeleton (no-JS baseline kept), so the
components are called server-side. The deep version — the client
rendering the section from the seed — is a separate change.

### 2. `apps/client.ts` becomes `apps/render.ts`

The file is server-side rendering code. It is renamed to
`apps/render.ts`. Exported function names (`renderAppSection`,
`renderStateSeed`, `renderBundleContent`, etc.) stay the same to
minimize churn; only the file path changes. All imports (in
`app.ts` and anywhere else that references it) are updated in the
same change. The adding-an-app SKILL.md and any harness that
references the path are updated in the same change.

### 3. The bridge moves into `pkg/src/client/`

`pkg/src/bridge/bridge.js` runs in the browser, so it belongs on
the FE side. It moves to `pkg/src/client/bridge.js`. Every
reference is updated in the same change: the shell client module
that loads it, the adding-an-app SKILL.md, the bundle harnesses
that load it, and any doc that names the path. The bridge's
exports and behavior do not change.

After this change the layout is:

```
pkg/src/
  index.ts            BE  entry, exports
  app.ts              BE  fetch handler (calls component functions, no HTML strings)
  apps/               BE  registry, definition, storage, render.ts (server rendering)
  feeds.ts            BE
  shell-theme.ts      BE
  shell-pages.ts      BE
  shell-css.ts        BE (generated, from pkg/public/styles.css)
  client/             FE  everything that runs in the browser
    index.ts          FE  shell client module
    bridge.js         FE  bridge adapter
    os-elements.ts    FE  shared os-* elements
    components/       FE  one JS file per UI component (data -> HTML string)
```

### 4. The boundary rule

No FE module imports a BE module. Concretely: nothing under
`pkg/src/client/` imports `packageStorage`, the registry, a
server type, or any file outside `pkg/src/client/` except the
vendored Lit (`window.KodyLit`, loaded as a script, not an
import). The rule is recorded in `pkg/AGENTS.md` (the canonical
package-behavior doc) and in the adding-an-app SKILL.md's
provided-surface section. It is verified by a grep at
implementation time (no FE file contains `packageStorage`,
`from '../apps/`, `from '../index`, or `from '../app'`), recorded
in the tasks; a static enforcement check is not shipped (the
same reasoning as the shell-islands bridge-only check: the
pattern is greppable and review catches it, and a broader check
would false-positive on the documented no-bridge fallback).

### 5. Verification is byte-identical output

This is a refactor, so the verification is that nothing
observable changes. Before the reorganization, capture the served
pages from `kody dev` (Home, an app page, the App Store, Help,
About, the Apps list) and save the bytes. After the
reorganization, serve the same pages and diff. The diff must be
empty. If any page differs, the reorganization is wrong, not the
baseline — fix the templates, do not update the baseline.

In addition: typecheck clean (`bun run typecheck` in `pkg/`),
all harnesses green (counter, link-drop, catalog, store,
isolation, bundle tests), and `openspec validate` passes for this
change. The change carries `skip_specs: true` (pure refactor, no
canonical requirement changes — the served HTML, routes, and
bridge contract are unchanged).

## Goals

- A reader can tell FE from BE by looking at the tree: browser
  code is under `pkg/src/client/`, Kody code is everywhere else
  in `pkg/src/`.
- No HTML is built by string concatenation in a BE TS file; each
  component lives in its own JS file under
  `pkg/src/client/components/`.
- `apps/client.ts` no longer exists under a misleading name.
- The served HTML, routes, and bridge contract are unchanged.

## Non-goals

- Hosting split, deep client-rendering, client-side routing, SPA.
- Changing the served HTML, the routes, or the bridge contract.
- New features or new effect operators.
- A static enforcement check for the boundary (grep + review,
  per Decision 4).

## Risks

- A component typo or a missed import breaks a page (the shell
  chrome is on every page). Mitigated by the byte-identical
  verification: the pages are diffed before the change is
  accepted.
- A missed import after the rename or the bridge move breaks the
  typecheck or a harness. Mitigated by typecheck + all harnesses
  green before the change is accepted.
- Adding `allowJs` to the tsconfig widens what the typechecker
  accepts. Mitigated by keeping `checkJs` off and JSDoc on the
  component signatures, and by the byte-identical verification
  (the JS components are verified by output, not by types).
- The component split makes a future edit touch a component file
  instead of a BE file. Accepted: that is the point of the
  separation — the markup is owned by the FE, the data by the BE.

## Migration plan

None. This is an internal refactor: no stored data changes, no
definition changes, no app is migrated, no install is affected.
Rollback is a revert of the reorganization commit.

## Open questions

None. The component-file approach (one JS file per component,
`allowJs` in the tsconfig), the bridge move, and the rename are
decided above. If implementation finds a component that cannot
be expressed as a standalone JS function (e.g. one whose
rendering depends on BE-only state that cannot be passed as
data), the implementation records the exception in the design
and keeps that one renderer in TS with a dated note — it does
not silently widen the scope.
