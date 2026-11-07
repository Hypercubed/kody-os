# Tasks

## 1. Query filter in dispatch

- [ ] 1.1 Read `search`/`q` params in the `/apps` dispatch (`pkg/src/app.ts`), filter the All-apps browse list by case-insensitive substring over label, name, id, and category, and verify a filtered fetch returns only matching tiles
- [ ] 1.2 Preserve `q` (and `search`) in pin/hide/clear/home mutation redirects alongside the existing `edit` chaining and verify a pin round-trip returns to the filtered list

## 2. Header toggle and empty state

- [ ] 2.1 Add the Search toggle left of Edit plus the query box below the All-apps header in `renderAllSection` (`pkg/src/apps/client.ts`, hidden `edit` field preserved; no `k` field exists) and verify toggle-on shows the box prefilled and toggle-off hides it
- [ ] 2.2 Render the honest empty-match state with a clear-filter control and verify a non-matching query shows it with no tiles
- [ ] 2.3 Verify edit mode ignores the query (full list), ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(`, `node --experimental-strip-types --check` passes, and `openspec validate --changes` passes
