# App Catalog intro points to Help; Help gains a remove-app prompt

## Why

The App Catalog page opens with a paragraph that duplicates agent instructions: how to add a custom app with MCP `add_app`, that up-to-date apps have a Remove button, how to remove any other app with MCP `remove_app`, and that pin/hide/home live in Apps Edit. That is help content, not catalog content — it crowds the page whose job is installing and updating catalog apps, and it goes stale whenever the agent flow changes.

The Help page is the right home for it. But Help currently documents only adding apps and installing the App Catalog; removing an app with an agent (`remove_app`) is documented nowhere in the shell UI, even though it is the only way to uninstall (the shell exposes hide, never remove).

## What

- Shorten the App Catalog intro to its job — install and update from the catalog, no agent needed, updates never run on their own — and point the reader to Help for adding or removing apps.
- Add a "Remove an app" section to the shared help block (`renderEmptyHelp`), a copy-prompt for an agent `remove_app` call, placed after "Add your own apps" so the two agent-driven app actions sit together.
- The no-JavaScript note on the App Catalog page is untouched: without JavaScript the Store cannot load, so it still has to point at agent `add_app`.

## Out of scope

- The Remove button itself and the management-API remove route: unchanged. This is copy only.
- Pin, hide, and home: the Apps Edit sentence is dropped from the Store intro as the user directed; Help does not gain a pin/hide/home section in this change.
- No change to `remove_app` behavior, its MCP-only exposure, or the rule that the shell renders no removal control (app-registry spec, unchanged).
