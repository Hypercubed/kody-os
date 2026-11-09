# Store row agent prompts, including absorb — design

## Context

The Store row renderer (`catalog/app-store/store.js`, `render()`)
builds each row from a manage row (`StoreRow` in
`pkg/src/apps/registry.ts`): icon + label, a body with badge,
description, and capabilities, and controls chosen by status —
Add, Update, Overwrite, Restore, Remove. The status derivation
(`get_app_status`) compares the installed fingerprint (I), the
snapshot fingerprint (S), the catalog fingerprint (C), and the
installed / catalog versions (Iv / Cv). The only modified-in-both
states are `behind-modified` (I != S, I != C, Iv < Cv) and
`modified-current` (Iv == Cv); both are handled today by replacing
the installed definition with the catalog copy — Overwrite for the
first, Restore for the second — and in both cases local changes are
lost.

Agent prompts already exist in two places, and this change follows
both: the Help page's copyable prompts (`renderEmptyHelp` in
`pkg/src/apps/client.ts` — plain selectable text in `gate-hint`
`<code>` blocks, no copy button, no Clipboard API, because
`navigator.clipboard` is denied on-device) and the `recipe-only`
row prompt (`store-recipe-prompt` change — a `<span>` with a
`<code>` child, text set via `textContent`, never `innerHTML` for
text built from a row id or label).

## Goals / Non-Goals

Goals:

- A user with a `behind-modified` (or `modified-current`) app can
  absorb the catalog changes into their local definition, keeping
  their customizations, by copying a prompt from the row and giving
  it to an agent — without losing the local changes to Overwrite.
- Every other Store row offers the same convenience: a copyable
  prompt for the action that row is about.
- An absorbed app is not immediately offered a plain Update that
  would undo the absorb.
- The absorb finishes cleanly: after it, the row reads as absorbed,
  not as still modified.

Non-Goals:

- A one-tap Absorb button in the browser. The merge is judgment
  work (which differences are local customizations, which are
  catalog changes); v1 is prompt-only, the agent does it.
- A true three-way merge. The stored snapshot holds only a
  fingerprint, not the base definition, so there is no base to
  diff against (Decision 3).
- The Apps page list. Its rows are server-rendered shell, not
  Store rows, and their actions (pin / hide / home) are not
  agent prompts of this shape (Decision 8).
- Any change to the agent install / update path, the catalog
  source model, or the management API's other gates.

## Decisions

### Decision 1: rendering — one `<details>` per row, at the bottom of the description

In `store.js` `render()`, after the capabilities element inside
the row's `.store-body` span (badge, description, capabilities),
append a `<details class="store-details">` holding a `<summary>`
and a `<code>` child with the prompt text, set via `textContent`
(escape-first, as the renderer already does for label and
description). The summary names the action, e.g. "Absorb with an
agent", "Install with an agent", "Remove with an agent". The
`<details>` is collapsed by default, so rows keep their current
height until the user opens one.

`store.css` gains a scoped rule for `.store-details` (readable on
the Scribe; the summary is a tap target, so it meets the 48px
minimum like the row buttons). `<details>` / `<summary>` need no
JavaScript of their own and have been supported since Chrome 12,
far below the shell's Chromium 80 ceiling. There is no copy button
and no Clipboard API use for the prompt, matching the Help and
recipe prompts.

No new row fields are needed: the bundle derives the prompt from
fields the row already carries (`id`, `label`, `status`,
`installMode`). Versions are not embedded in the prompt; the agent
reads them itself.

### Decision 2: prompt mapping — one prompt per row status

| Row status | Details summary | Prompt (agent call) |
|---|---|---|
| not-installed, `json` | Install with an agent | Install (`install_from_catalog`) |
| not-installed, `recipe-only` | — (no details; see Decision 6) | recipe prompt (existing) |
| behind-clean, catalog-differing | Update with an agent | Update (`update_from_catalog`) |
| behind-modified, modified-current | Absorb with an agent | Absorb (Decision 4) |
| modified-ahead | Restore with an agent | Restore (`update_from_catalog` to the catalog copy) |
| snapshot-less | Overwrite with an agent | Overwrite (`update_from_catalog`) |
| up-to-date, absorbed | Remove with an agent | Remove (`remove_app`, Help wording, id filled in) |
| absorbed-behind | Absorb with an agent | Absorb again (Decision 5) |
| needsNewerShell / needsNewerSchema | — (no details) | requirement shown instead of any control |

The one-tap buttons stay exactly as they are; the details element
is an additional path, never a replacement. The Store never
auto-acts on a prompt — the user copies it and the agent acts.

Prompt drafts (exact wording finalized at implementation; tests
assert the parts, not the full string — the app id, the export
name, and the ask-before-writing clause):

- Install: `Install [label] ([id]) on my hosted kody-os app on
  Kody. Use the package's ` + "`install_from_catalog`" + ` through
  the Kody MCP execute wrapper. Ask me before installing if any
  detail is missing or ambiguous.`
- Update: `Update [label] ([id]) to the latest catalog version on
  my hosted kody-os app on Kody. Use the package's
  ` + "`update_from_catalog`" + ` through the Kody MCP execute
  wrapper. Ask me before updating if any detail is missing or
  ambiguous.`
- Restore / Overwrite (agent path): same shape, naming the action
  and `update_from_catalog` — the agent path lands the definition
  on the catalog copy, so the row reads up-to-date afterwards
  (I == C wins over the stale snapshot; no snapshot write needed).
- Remove: the Help wording verbatim with the id filled in:
  `Remove [id] from my hosted kody-os app on Kody. Use the
  package's ` + "`remove_app`" + ` through the Kody MCP execute
  wrapper. Ask me before removing if any detail is missing or
  ambiguous.`
- Absorb: see Decision 4.

### Decision 3: absorb is a two-way merge — no base definition exists to diff against

A mechanical three-way merge needs the base: snapshot (S),
installed (I), catalog (C). The stored snapshot
(`kody-os.apps.snapshot.<id>`) holds only `catalogVersion` and a
fingerprint of the stored definition — never the definition
itself. And the agent cannot read even that much through MCP:
`get_app` and `get_app_status` are TypeScript exports, not MCP
exports (the MCP list in `pkg/src/index.ts` has `list_apps`,
`get_app_state`, `export_app`, `list_catalog`,
`get_catalog_definition`, `install_from_catalog`,
`update_from_catalog`, and the rest — no `get_app`, no
`get_app_status`).

So the absorb prompt works with what the agent can actually read:

1. `backup` first, so the absorb can be undone (whole-install
   named snapshot; the absorb export itself does not back up).
2. Read the installed definition with `export_app` and the
   catalog definition with `get_catalog_definition`.
3. Compare the two and decide, field by field, which differences
   are local customizations to keep and which are catalog changes
   to take. Where a field differs and the agent cannot tell which
   side it came from, it asks the user instead of guessing.
4. Show the merge plan — every field kept, taken, and in conflict
   — and ask the user before writing anything.
5. Write the merged definition with `absorb_from_catalog`
   (Decision 4), with its `catalogVersion` set to the catalog
   version, and verify afterwards by exporting the app again and
   confirming the stored definition matches the merged one.

Considered and rejected: storing the full base definition in the
snapshot so a future absorb could be three-way. That changes the
snapshot format, its size (a definition is kilobytes, not a
fingerprint), and the export contract (snapshots are never part of
exports today) for a merge the agent already performs by judgment
in step 3. Deferred; revisit if absorb merges prove unreliable in
practice. Also rejected: having the agent fetch the old catalog
version from GitHub history to reconstruct the base — fragile
(`catalogVersion` is per-app, not a git tag) and outside the
package's catalog-source model.

### Decision 4: new MCP export `absorb_from_catalog(id, definition)` finishes the absorb

A prompt alone cannot finish an absorb, and no existing export
can: `add_app` writes the merged definition but never records a
snapshot, so the row would stay modified; `update_from_catalog`
overwrites with the catalog copy, which is what absorb exists to
avoid. So the change adds one export, parallel in shape to
`install_from_catalog` / `update_from_catalog`:

`absorb_from_catalog(id, definition, catalogBase?)` —

- Refuses (no write) unless the app is installed, is in the
  catalog, and its status is absorbable: `behind-modified`,
  `modified-current`, or `absorbed-behind`. Any other status
  returns `{ ok: false }` naming the status.
- Validates the merged definition through the `add_app` path
  (schema floor, `minPackageVersion`, definition validation), so
  a bad merge writes nothing. Refuses unless the merged
  definition's `catalogVersion` equals the catalog's (Cv);
  otherwise the row would still read as behind afterwards.
- Writes the merged definition via `add_app` (state preserved by
  the existing rule; pins, hidden flags, homepage placement, and
  recency untouched), then records a new snapshot at Cv holding
  the fingerprint of the definition as actually stored plus the
  catalog fingerprint absorbed from (Decision 5).
- Resolves the catalog base the same way `install_from_catalog`
  does (explicit `catalogBase`, else the installed App Store's
  declared base; refuses with no-source error when neither
  exists).
- Joins the MCP export list in `pkg/src/index.ts` (name +
  `useWhen`: "Install an agent-merged definition for a modified
  catalog app, keeping local customizations and recording it as
  the new baseline; refuses unless the app is modified against a
  newer catalog copy.") and the TypeScript export list in
  `pkg/src/apps/index.ts`.

The export does not itself take a backup and does not itself
decide the merge — both are the prompt's job (Decision 3). It is
deliberately a thin "install this merged definition and make it
the baseline" primitive, so the same export also serves a future
one-tap Absorb button if one is ever wanted.

### Decision 5: snapshot gains `catalogFingerprint`; status gains `absorbed` and `absorbed-behind`

Without a status change, an absorbed app would land as
`catalog-differing` (I == S, Iv == Cv, I != C) and be offered a
plain Update — which would replace the merged definition with the
catalog copy and silently undo the absorb. So:

- `InstallSnapshot` gains an optional `catalogFingerprint:
  string`, set only by `absorb_from_catalog` to the fingerprint
  of the catalog definition absorbed from. Store install / store
  update snapshots do not set it (after either, I == C, so the
  status is up-to-date regardless). Old snapshots without the
  field behave exactly as today — no migration.
- Status derivation (`get_app_status`) checks the absorbed cases
  before the existing branches, when a snapshot carries
  `catalogFingerprint`:
  - I == S and `catalogFingerprint` == C fingerprint:
    `absorbed`. Badge "Absorbed". Controls: Remove only — never
    Update, Overwrite, or Restore. Update All skips it (its
    safe-updatable set is unchanged: behind-clean and
    catalog-differing only).
  - I == S and `catalogFingerprint` != C fingerprint:
    `absorbed-behind`. Badge "Absorbed · update available".
    Controls: confirmed Overwrite button (via `manage_update`,
    kind `update`) plus the Absorb details prompt. Never a plain
    Update — the local customizations are still in the merged
    definition, so a plain Update would still lose them.
  - I != S (the user edited after absorbing): the absorbed
    markers no longer apply; derivation falls through to the
    existing modified statuses (`behind-modified`,
    `modified-current`, `modified-ahead`), where the Absorb
    details prompt appears for the absorbable ones per
    Decision 2.
- `manage_update` (kind `update`) refuses plain Update for
  `absorbed` ("has no update available") and accepts
  `absorbed-behind` as an overwrite case (confirmed, like
  `behind-modified`). `manage_restore` refuses both (nothing to
  restore to: the merged definition is the baseline). The
  `AppStoreStatus` type and the Store badge map gain both values.

Considered and rejected: landing an absorbed app as
`catalog-differing` and relying on the user not to click Update.
That leaves the exact footgun absorb exists to remove — one tap
undoes the merge with no modification warning, because the row
reads as clean. Also rejected: a persistent "diverged" flag
separate from the snapshot — it would be a second source of truth
for the same fact the snapshot already records.

### Decision 6: `recipe-only` rows get no extra details element

A not-installed `recipe-only` row already shows its recipe prompt
in place of the Add button (the `store-recipe-prompt` change).
That prompt *is* the row's agent prompt; wrapping the same text
in a `<details>` as well would duplicate it. Installed
`recipe-only` rows follow the normal mapping by status (their
install already happened via the recipe).

### Decision 7: version — package MINOR, App Store 20 to 21

A new MCP export is a MINOR bump by the version policy (new
feature, nothing existing breaks): package 4.1.11 to 4.2.0,
PATCH reset to 0, `build` +1 at publish time (not in this
change — no publish here). The App Store bundle changes
(`store.js` + `store.css`), so its `catalogVersion` bumps 20
to 21; verify the current number at implementation time and
regenerate the index. No `catalogVersion` bump for any other app:
the snapshot and status changes are shell code, not definitions.

### Decision 8: scope — Store rows only, not the Apps page

"Almost all of the app lists" in the request is read as "almost
all Store rows": the mapping in Decision 2 covers every row
status except requirement-blocked rows (which show a requirement
instead of any control) and `recipe-only` not-installed rows
(Decision 6). The Apps page list is out of scope: its rows are
server-rendered shell markup for launcher actions (pin / hide /
home), not Store actions, and adding per-row agent prompts there
would be a second change with its own rendering and wording. If
the Apps page turns out to be what was meant, that is a follow-up
change, not a silent expansion of this one.

## Open Questions

- Summary wording: per-action ("Absorb with an agent") as
  specified, or one uniform summary ("Agent prompt") for every
  row? Recommendation: per-action — the summary is the only thing
  visible while the details element is collapsed, so it should
  say what the prompt does.
- `modified-current` absorb: the catalog changed without a version
  bump, so the merge target is a moving one. Included in scope
  (the merge works the same way); confirm this is wanted, or
  restrict absorb to `behind-modified` only.
- Absorbed badge wording: "Absorbed" / "Absorbed · update
  available" as specified, or "Merged" / "Merged · update
  available"? Recommendation: "Absorbed", matching the Kody
  package term the feature borrows.
- Exact prompt wording. The drafts in Decision 2 / Decision 3
  are the recommendation; the implementer finalizes the strings,
  and the tests assert their parts (app id, export name, the
  ask-before-writing clause), not the full strings, so wording
  tweaks do not break tests.
