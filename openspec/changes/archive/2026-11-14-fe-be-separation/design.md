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

### 1. The FE is organized by concern, and the BE contract is explicit

The browser code is organized as a coherent, self-contained
layer under `pkg/src/client/`, grouped by what it does — not
split into one file per UI piece. (User direction 2026-11-14:
"You dont have to create component for every peice of code.
Use best practices for organizing FE. Treat it as if the FE
may eventually be run on a different BE.") The FE modules are:

- `index.ts` — the shell client entry: loads the bridge, defines
  the shared `os-*` elements, enhances forms. The single wiring
  point.
- `bridge.js` — the bridge adapter (`window.KodyBridge`), moved
  from `pkg/src/bridge/bridge.js` (Decision 3). The FE's only
  interface to BE state.
- `os-elements.ts` + `os-stepper.ts` — the shared element
  library, one file per custom element (the shell-islands split,
  kept).

The server still renders the shell + JSON seed + section
skeleton (the islands model, no-JS baseline kept); the BE keeps
building that HTML in TS (`shellChrome` in `app.ts`, the
renderers in `apps/render.ts`). The HTML text is BE code that
produces the FE's host document — it is not split into
component files. The earlier "each component its own JS file"
approach was implemented, then reverted at the user's direction
2026-11-13, and is now dropped: splitting every renderer into
its own file added files without adding separation, and the
FE/BE boundary is the directory plus the contract, not the
HTML-string location.

**The FE/BE contract.** The FE talks to the BE only through a
small, documented surface, so a different BE could serve the
same FE:

- The bridge (`window.KodyBridge`): state reads / writes /
  dispatch. The FE's only interface to BE state.
- The JSON state seed the BE renders before each bundle (read
  once at mount; the bridge reads it, falling back to the spans
  only when no seed is present).
- The action URLs (`data-action-base`, GET forms) the FE
  submits or fetches (`format=json` fast path, same-origin).
- The `data-*` attributes the FE reads (`data-app-id`,
  `data-field`, `data-client-module`).

The FE imports nothing from the BE and reads no BE-only state.
The contract is recorded in `pkg/AGENTS.md` alongside the
boundary rule (Decision 4). This is a design principle for the
layering, not a deployment change: the package stays one Kody
package, and a hosting split is out of scope.

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
  app.ts              BE  fetch handler (renders shell + seed + skeleton)
  apps/               BE  registry, definition, storage, render.ts (server rendering)
  feeds.ts            BE
  shell-theme.ts      BE
  shell-pages.ts      BE
  shell-css.ts        BE (generated, from pkg/public/styles.css)
  client/             FE  everything that runs in the browser
    index.ts          FE  shell client module (entry: bridge + elements + forms)
    bridge.js         FE  bridge adapter (the FE's only interface to BE state)
    os-elements.ts    FE  shared os-* elements (registry)
    os-stepper.ts     FE  os-stepper element
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

The FE/BE contract (Decision 1) is recorded alongside the
boundary rule in `pkg/AGENTS.md`: the bridge, the JSON state
seed, the action URLs, and the `data-*` attributes the FE reads.
A different BE could serve the same FE as long as it honors
that contract.

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
- The FE is a coherent layer organized by concern (entry,
  bridge, elements), not split into one file per UI piece.
- The FE depends only on the documented BE contract (bridge,
  seed, action URLs, `data-*` attributes), so a different BE
  could serve the same FE.
- `apps/client.ts` no longer exists under a misleading name.
- The served HTML, routes, and bridge contract are unchanged.

## Non-goals

- Hosting split, deep client-rendering, client-side routing, SPA.
- Changing the served HTML, the routes, or the bridge contract.
- New features or new effect operators.
- A static enforcement check for the boundary (grep + review,
  per Decision 4).

## Risks

- A missed import after the rename or the bridge move breaks the
  typecheck or a harness. Mitigated by typecheck + all harnesses
  green before the change is accepted.
- The Counter bundle comment names the bridge path; updating it
  changes the bundle, so its `catalogVersion` bumps by the
  catalog rule and the catalog index is regenerated. Mitigated by
  the catalog harness (index/directory/manifest match) and the
  Counter harness.
- The FE/BE contract is documented but not enforced by a check,
  so a future FE change could quietly reach past it. Mitigated
  by the boundary grep (Decision 4) and by review: the contract
  is short and the FE is small.

## Migration plan

None. This is an internal refactor: no stored data changes, no
definition changes, no app is migrated, no install is affected.
Rollback is a revert of the reorganization commit.

## Open questions

None. The FE organization by concern (entry, bridge, elements),
the explicit BE contract, the bridge move, and the rename are
decided above. The component-per-file approach is dropped (see
Decision 1); if a future change needs a new FE module, it is
added under `pkg/src/client/` by concern, not by UI piece.
