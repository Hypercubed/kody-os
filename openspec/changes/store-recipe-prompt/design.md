# Store recipe prompt rendering — design

## Context

`catalog-restructure` landed the data: every catalog definition may
carry `installMode` (`json` | `recipe-only` | `recipe-or-json`, absent
means `json`, fingerprint-excluded like `catalogVersion`), the index
carries it per entry, and the listing summaries carry it
(`pkg/src/apps/catalog.ts:55,97,120`). The canonical
`app-registry` requirement "Recipe install mode" already states the
Store behavior: a `recipe-only` app "still appears in the App Store
list, but the Store shows the recipe prompt (selectable text for the
user to supply to their agent) in place of one-tap install."

What is missing is the rendering. The App Store bundle
(`pkg/catalog/app-store/definition.json`, files `index.html`,
`store.js`, `store.css`) renders rows from `/manage/rows`. Its row
renderer (`store.js`, around the `if (!row.installed)` branch) offers
one-tap Add on every not-installed row, whatever the mode. The rows
themselves do not yet carry `installMode`: `AppStoreStatusInfo`
(`pkg/src/apps/registry.ts`) has status, installed, inCatalog,
modified, and versions, and the row assembly copies those fields —
`installMode` is not among them. The test fixtures in
`pkg/catalog/tests/app-store-tests.cjs` likewise carry no
`installMode`, and the bundle's `store.css` has no rule for a prompt
element (and no `code` rule).

No app is `recipe-only` today, so the rendering cannot be exercised
against a live row; it is tested with a fixture instead.

## Goals / Non-Goals

Goals:

- A not-installed `recipe-only` row shows the recipe prompt and no
  Add button.
- `recipe-or-json` and `json` rows keep one-tap Add, with no prompt.
- The prompt follows the shell's agent-prompt pattern: selectable
  text, no copy button, no Clipboard API.
- The change is testable without a live `recipe-only` app.

Non-Goals:

- `installMode` semantics (unchanged — defined by
  `catalog-restructure`).
- Index/generator changes (none — the index already carries
  `installMode`; it only regenerates for the version bump).
- Agent install path (unchanged).
- Update behavior for installed `recipe-only` rows (unchanged —
  updates use the normal path; whether updates re-run recipes is
  still open in `catalog-restructure`).
- The Help/About built-in change (separate change, untouched).

## Decisions

### Decision 1: prompt content — a short instruction naming the recipe file, not the full recipe text

The prompt names the app and its recipe file and the verify step, in
this form (exact string finalized at implementation; tests assert the
parts, not the full string):

`Install <label> using its recipe: ask your agent to follow pkg/catalog/<id>/RECIPE.md and verify with list_apps.`

The full recipe text is deliberately NOT embedded. The agent reads
the recipe file itself — that is what a recipe is for. The index
carries `recipePath`, not recipe text, and the bundle has no route to
fetch recipe files: the Worker has no directory listing, and the
bundle's only data sources are `/manage/rows` and the management API.
Baking the text into the definition would duplicate it (and drift
from the file), and adding a fetch route would be a new capability
and a new endpoint for one row. The short prompt keeps the bundle
data-only, as it is today.

### Decision 2: data source — the row carries `installMode`, copied from the catalog definition

The row assembly in `get_store_rows` (`pkg/src/apps/registry.ts`)
copies `installMode` from the catalog definition into each row,
defaulting to `json` when the definition carries none. The bundle
treats a missing `installMode` on a row as `json`, so rows built by
older code or hand-written fixtures without the field still render
Add. No index/definition change is needed: the row builder already
loads the catalog definition for each row (`get_app_status`), so no
new lookup is required.

Considered and rejected: joining the index at render time (the
definition is already in hand; a second lookup buys nothing), and
carrying `recipePath` on the row as well (the prompt names the recipe
by the catalog convention `pkg/catalog/<id>/RECIPE.md`, which the
agent already knows from the catalog README and the adding-an-app
skill; revisit if the catalog moves out of `pkg/`, which is the
`catalog-out-of-pkg` change's problem, not this one's).

### Decision 3: rendering — branch the not-installed case in `store.js`, prompt as selectable `<code>`

In the row renderer, the `if (!row.installed)` branch checks
`row.installMode === 'recipe-only'` first: it renders a prompt
element (`<span class="store-recipe-prompt"><code>...</code></span>`)
in place of the Add button, with the prompt text set via
`textContent` (escape-first, as the renderer already does for label
and description — never `innerHTML` for prompt text built from a row
id or label). `store.css` gains a scoped rule for the prompt element
(selectable text). There is no copy button and no Clipboard API use
in the bundle for the prompt.

The prompt replaces Add only on not-installed rows. An installed
`recipe-only` row keeps its existing controls (Update / Overwrite /
Restore / Remove per status): the prompt is an install path, not a
persistent banner, and install already happened via the recipe.

### Decision 4: testing without a `recipe-only` app — fixture rows in `app-store-tests.cjs`

The jsdom tests construct rows by hand, so a `recipe-only` row is a
test-only fixture, not a catalog app. The tests gain fixture rows for
`recipe-only` (not-installed), `recipe-or-json` (not-installed),
`json` (not-installed), and `recipe-only` (installed, up-to-date),
and assert prompt presence/absence, button presence/absence, the
selectable `<code>` element, and no copy button or Clipboard API use.
The test file header comment is updated to document the new checks.
The catalog harness is unaffected (the App Store definition still
validates and installs); the store harness is unaffected (its
prompt-sync checks concern the empty-state prompt, not Store rows).

### Decision 5: version — App Store 13 to 14, index regenerates

The App Store bundle changes (`store.js` + `store.css`), so its
`catalogVersion` bumps 13 to 14 per the version policy (any change
to that app's definition file). The index is regenerated with the
generator; the App Store entry's new version and fingerprint follow
from the bundle change, as expected.

## Open Questions

- Exact prompt wording. The form in Decision 1 is the
  recommendation; the implementer finalizes the string, and the
  tests assert its parts (app, recipe file, verify step), not the
  full string, so wording tweaks do not break tests.
- Should an installed `recipe-only` row ever re-show the prompt?
  Recommendation: no — the prompt is install-time only, and updates
  use the normal path.
- `recipePath` on the row. Not carried now (Decision 2); revisit if
  the catalog moves out of `pkg/`.
