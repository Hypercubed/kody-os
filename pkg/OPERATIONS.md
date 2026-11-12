# kody-os operations

This file is the operations runbook for an agent working on a kody-os install: install, update, absorb, overwrite, restore, and remove apps, and add a brand-new app. The Store renders one-line prompts that point here; the procedure lives here, not in the prompt.

## How to read this file

- A catalog folder URL names an app: its last segment is the app id, and the folder holds `RECIPE.md` (the install recipe) and `definition.json` (the catalog definition). Follow the recipe to install; read `definition.json` to compare versions.
- A catalog base is the directory containing `catalog.json`. The public base is `https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`; a pinned tag replaces `main` with the tag.
- References of the form `package:<slug>#…` use the reader's own package slug, rendered by the prompt. This file names no slug.

## Shared rules

These apply to every operation below.

- Ask the user before writing when anything is missing or ambiguous.
- Never publish or change the package source. These operations change installed apps and their state, never the package itself.
- Verify after every write: `list_apps`, and `export_app` where the operation writes a definition.
- On definition replacement, state for surviving fields carries forward; dropped fields reset to `initial`.

## Working without an App Store

These operations are package MCP functions; the Store is only one UI that renders prompts for them. They work with no App Store installed.

The catalog base rules: an explicit `catalogBase` parameter wins; with none, the installed Store's declared base is used; with neither, the call is refused with a no-catalog-source error naming the app id and writes nothing. So with no Store installed, pass the base explicitly.

Prefer the `store_*` variants for Store-managed installs and updates: they record the install snapshot that makes rows read up-to-date. The plain `install_from_catalog` / `update_from_catalog` do not record snapshots.


## Install

Follow the recipe (`RECIPE.md` in the folder), or call `store_install_from_catalog(id, undefined, catalogBase)`. `install_from_catalog(id, undefined, catalogBase)` is the generic form without a snapshot. Verify with `list_apps` (and `get_app_state`). Recipe-only apps have no JSON install path: follow the recipe. Ask before installing if any detail is missing or ambiguous.

## Update

`store_update_from_catalog(id, undefined, catalogBase)`. `update_from_catalog(id)` takes no base parameter — it resolves the installed Store's declared base and refuses without one. Verify by exporting / `list_apps`.

## Absorb

Merge the catalog changes into an installed definition, keeping local customizations. Take a `backup` first with `backup(name)` so the absorb can be undone. Read the installed definition with `export_app(id)` and the catalog definition with `get_catalog_definition(id, catalogBase?)`. Compare the two field by field, keep local customizations and take the catalog changes. Show the merge plan (every field kept, taken, and in conflict) and ask before writing anything, and ask which value to keep for any field in conflict. Then write the merged definition with `absorb_from_catalog(id, definition, catalogBase?)` at the catalog version. Verify afterwards by exporting the app again and confirming the stored definition matches the merged one.

The absorb is refused, with no write, unless the app is installed, is in the catalog, and its status is `behind-modified`, `modified-current`, or `absorbed-behind`; and unless the merged definition's `catalogVersion` equals the catalog's.

## Overwrite

`store_update_from_catalog(id, undefined, catalogBase)` with an explicit confirmation — it discards local definition changes. Export first if keeping them. Same call as Update; the difference is confirmation and the row's status.

## Restore

Same call as Update / Overwrite (`store_update_from_catalog` with an explicit base, or `update_from_catalog` when a Store is installed). It restores the catalog copy. Export first if keeping local edits. Ask first.

## Remove

`remove_app(id)` — deletes the definition, state, registry entry, install snapshot, and pinned / hidden / recent / homepage references. Verify with `list_apps`. Ask before removing if anything is missing or ambiguous.

## Add a new app

Adding a brand-new app is authoring, not a store operation. Follow the adding-an-app skill in this same package: `.agents/skills/adding-an-app/SKILL.md`.
