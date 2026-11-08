# Design: App Catalog intro points to Help; Help gains a remove-app prompt

## Decisions

### 1. Store intro: keep the first two sentences, point to Help

`catalog/app-store/index.html`, first paragraph. Current text:

> Install and update apps from the catalog, right here in the browser — no agent needed. Updates never run on their own. For a custom app that is not in the catalog, ask an agent to add it with MCP `add_app`. Up-to-date apps have a Remove button below. For any other app, ask an agent to remove it with MCP `remove_app`. Pin, hide, and home are managed from Apps Edit.

New text:

> Install and update apps from the catalog, right here in the browser — no agent needed. Updates never run on their own. For adding or removing apps, see Help.

"See Help" is plain text, not a link: the Help page is the built-in menu item in the top menu bar, so the pointer needs no path. The no-JavaScript note (`store-nojs`, still pointing at agent `add_app`) is unchanged.

### 2. Help gains a "Remove an app" section

`pkg/src/apps/client.ts`, `renderEmptyHelp`. New section, placed after "Add your own apps" and before "Install the App Catalog", in the same `h3` + `gate-hint` copy-prompt shape as the existing sections:

> ### Remove an app
> `Remove [app id] from my hosted kody-os app on Kody. Use the package's `remove_app` through the Kody MCP execute wrapper. Ask me before removing if any detail is missing or ambiguous.`

The prompt names the app id (the caller supplies it; ids are visible in the Apps page and in app URLs) and asks the agent to confirm before removing, matching the "Ask me before writing" guard in the add prompt. It does not restate the `remove_app` deletion semantics (definition, state, and all reference lists scrubbed); that contract lives in the app-registry spec and the adding-an-app skill, not in the user-facing prompt.

Because `renderEmptyHelp` is shared, the section appears on the Help page, the empty Home page, and the empty Apps page — identical everywhere, per the help-page spec. The Help page keeps omitting the empty-state closing line.

### 3. Spec delta: help-page only

The canonical help-page spec currently lists the shared help block as the intro plus two prompts ("Add your own apps" and "Install the App Store"). It becomes three prompts, and the stale "App Store" name becomes "App Catalog" (the rename landed Nov 7; the spec never caught up). The shell spec needs no delta: its Store scenario only requires the intro to say "Install and update apps from the catalog…" and to use app wording, both of which still hold.

### 4. Version

- App Catalog bundle changed, so app-store `catalogVersion` 18 → 19, and `catalog/catalog.json` is regenerated.
- Package PATCH 4.1.1 → 4.1.2, build 36 → 37. This is a copy/content correction: no app definition, MCP export, state field, or behavior changes, and nothing that worked before stops working. The bump rides in the same commit as the change, per the version policy.

## Verification

- Catalog harness + store harness pass (the store harness renders the help block and the Store intro; any test asserting the old intro wording or a two-prompt help block must be updated to the new text, not waved through).
- `bun build` passes; ES2019 clean.
- `openspec validate --changes` passes for this change.
- The App Catalog page renders the shortened intro; `/help` renders three prompts (Add, Remove, Install the App Catalog) with no closing line; empty Home/Apps still show the closing line.
