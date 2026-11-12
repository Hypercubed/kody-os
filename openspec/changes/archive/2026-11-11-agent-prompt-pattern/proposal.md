# Agent prompt pattern - proposal

## Problem

Store rows and the Help page show agent prompts that are long, inconsistent, and partly wrong for the job:

1. The prompts embed the how. The Absorb prompt is a multi-sentence procedure (backup, export, compare, merge plan, absorb, verify) that exists nowhere else: `absorb_from_catalog` and `get_catalog_definition` have zero mentions in the only skill file (`pkg/.agents/skills/adding-an-app`, 476 lines), which documents install, update, and remove but not absorb. Every other prompt names one MCP call plus an "Ask me before…" tail.
2. The prompts name tool calls instead of pointing at a procedure. The Install prompt says "Use the package's `install_from_catalog`…" when the recipe is the install source.
3. The prompts name a fixed package. The Help text hardcodes `package:kody-os#…`, so a fork or rename (for example the planned `kody-os-private` hard fork) sends its agents to the wrong package's file.
4. The prompts are inconsistent: Remove uses a bare id while the rest use `label (id)`; the Install prompt's shape changed twice in a week (tool call, then recipe URL).
5. Recipe-only rows have no prompt at all: they show a controls span ("Ask an agent to install via its recipe.") with no copyable details element, even though installing via the recipe is exactly the agent operation.

The user asked for short, consistent prompts in the herdr-app shape — one file to read, then one line naming the operation and a URL — covering all Store cases and the Help text.

## Change (summary)

- New file `pkg/OPERATIONS.md` (pkg root, alongside `pkg/AGENTS.md` and `pkg/README.md`): all store-operation details inline, one section per operation, no per-operation skills. It documents the standalone path (operations work with no App Store installed) and, for adding a brand-new app, only a pointer to `pkg/.agents/skills/adding-an-app/SKILL.md`.
- One-line prompts in the herdr shape: `Read package:<slug>#OPERATIONS.md, then <verb> this app: <folder URL>`. The package slug is derived at render time from the running package's own mount; the folder URL is the app's catalog folder (GitHub tree form), built from the resolved catalog base. No label or id text in any prompt.
- `StoreRow.recipeUrl` becomes `StoreRow.folderUrl` (rename across `remote-catalog.ts`, `registry.ts`, `store.js`), with `folderUrlForBase` generalizing the `recipeUrlForBase` conversion. The install branch's "Follow the recipe at <RECIPE.md URL>" text is replaced by the Install one-liner.
- Help's three gate-hint prompts rewritten in the same shape; intro and closing unchanged. Recipe-only not-installed rows gain the Install details.

## Versioning

App Store `catalogVersion` 26 to 27 (definition.json plus regenerated catalog.json). No package version change: the Help text, the new pkg file, and the `pkg/src` changes are MINOR-grade but fold into the pending 4.2.0, which already is the MINOR for this uncommitted batch (`pkg/package.json` stays 4.2.0 / build 46). The counter 5 to 6 demo bump in the same tree is unrelated (mock-only, from the behind-modified setup) and must be reverted before any real commit.

## Out of scope

- Any change to status derivation, the button mapping, row layout, badge text, or the caret.
- Per-operation skills, or any change to `adding-an-app` (it is only pointed at, never edited).
- Release and publish steps: the user decides when to release. No verify-on-Scribe task: the changed surfaces are the mock-verified Store page and `/help`, rendered in the same Chromium the Scribe uses.
