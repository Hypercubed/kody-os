# Change: Bundle files on disk

## Why

An app definition today carries its whole UI as one JSON string:
`bundle: { entry: "index.html", files: { "index.html": "<one giant escaped string>" } }`.
The counter's entire UI — markup, `<style>`, `<script>` — is a single
string full of newline and double-quote escapes. It cannot be read or
edited by hand as HTML, JS, or CSS: no syntax highlighting, no real diffs,
no editor support, and every edit risks breaking the JSON escaping.

Apps are now one directory each (`pkg/catalog/<id>/`, since
catalog-restructure), so each app has a place to hold real files. The
bundle's own `files` map already allows `.html`, `.js`, and `.css` paths,
one level deep, within a 256 KiB total cap — the bundle was designed as a
file set that just happens to be stored inline. Only the App Store uses
more than one file today (`index.html` + `store.js` + `store.css`), and it
already references the other two explicitly (`<script src="store.js">`,
`<link rel="stylesheet" href="store.css">`).

This change moves the bundle files out of `definition.json` onto disk as
real files, keeps `definition.json` as metadata plus a manifest, and has
the loader assemble the bundle at serve time. The served document stays a
single self-contained HTML document, exactly as today.

## What changes

- On-disk layout: each app directory holds `definition.json` (metadata +
  bundle manifest) plus `index.html` (required) plus optional `.js` / `.css`
  files, flat next to `definition.json` and `RECIPE.md`.
- Manifest: `definition.json`'s `bundle` becomes `{ entry, files: [...] }`
  (a list of paths) instead of carrying file contents inline. The loader
  assembles `bundle.files` from disk; the runtime, canonical, and stored
  forms stay the inline files map, so validation, fingerprinting, snapshots,
  and update detection are unchanged.
- References: the entry HTML explicitly references the JS/CSS files by
  relative path; the loader resolves those references by inlining at serve
  time (the inliner already exists in `pkg/src/apps/client.ts`).
- Validation: a reference that does not resolve is an error; an
  unreferenced `.js`/`.css` file is an error (dead file); the existing
  constraints stand (one level of nesting, 256 KiB total cap, ES2019
  ceiling on bundle JS, no external references).
- Catalog index: each entry records the bundle file paths alongside
  `definitionPath`; the generator assembles each definition before
  fingerprinting and fails the build on a missing file.
- Migration: the 18 catalog apps' bundle files are extracted to real files
  by a script, verified by fingerprint equality (no `catalogVersion` bump).
- Docs: the adding-an-app skill and the catalog README describe the new
  layout; `RECIPE.md` files are untouched.

## Non-goals

- No change to the install model: install stays static-import (see design
  Decision 5 — the brief's fetch premise does not describe the code).
- No `DEFINITION_SCHEMA_VERSION` bump: the inline form stays valid, so this
  is not a breaking definition change.
- No splitting of inline `<style>` / `<script>` blocks during migration:
  an author may split a block into a referenced file later, as a separate
  edit.
- No change to state, actions, capabilities, recipes, or the Store UI.
- `catalog-out-of-pkg` is untouched; this change does not move the catalog.

## Impact

- 18 catalog apps migrate (extraction only; content-identical).
- `pkg/src/apps/types.ts`, `pkg/src/apps/registry.ts`,
  `pkg/src/apps/catalog.ts`, `pkg/src/apps/client.ts`,
  `scripts/build-catalog-index.ts`, `tests/catalog-harness.ts`,
  the adding-an-app skill, and the catalog README change.
- The App Store's `store.js` / `store.css` are the first multi-file
  example; every other app gains a real `index.html` file.
