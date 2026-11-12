# Store row layout — design

## Context

### The rows today (read from branch `close-v4-tail`, uncommitted)

The Store row renderer is `catalog/app-store/store.js`, `render()` (lines 196-300). Each `<li class="store-row">` holds three children, in order:

1. `<span class="store-main">` — icon (`.store-icon`) + label (`.store-label`), built at store.js:204-219.
2. `<span class="store-body">` — badge (`.store-badge`), description (`.store-desc`), capabilities (`.store-caps`), then the agent-prompt `<details class="store-details">` with `<summary>` + `<code>`, built at store.js:220-253. The summary text is set with `textContent` (store.js:247).
3. `<span class="store-controls">` — one action button per row, built by `mutate()` (store.js:257-267) via `storeButton` (store.js:39-45) / `storeBusyButton` (store.js:46-68).

The controls are chosen by status (store.js:291-295):

| Status | Button (kind) |
|---|---|
| not-installed | Add (`install`) |
| behind-clean, catalog-differing | Update (`update`) |
| behind-modified, absorbed-behind, snapshot-less | Overwrite (`update`) |
| modified-current, modified-ahead | Restore (`restore`) |
| up-to-date, absorbed | Remove (`remove`) |

**Restore vs Overwrite**, for the record: Overwrite is offered when the installed definition differs from its snapshot (or there is no snapshot) *and* the catalog has moved on — behind-modified (installed v < catalog v), absorbed-behind, snapshot-less. It replaces the installed definition with the catalog copy and discards local changes. Restore is offered when the installed definition differs from its snapshot but the catalog is at the same version (modified-current) or behind the installed one (modified-ahead): restoring returns to the catalog copy *at the same version* — it undoes local edits without a version change. (Status derivation: `get_app_status` in `pkg/src/apps/registry.ts`; prompt mapping: `store.js` `storeAgentPrompt`, lines 80-104, and the absorb change's design.md Decision 2.)

The bundle stylesheet is `catalog/app-store/store.css` (20 lines, read in full). The rules this change touches:

- store.css:3 — `.store-row { display: flex; flex-wrap: wrap; align-items: center; box-sizing: border-box; min-height: 6.5rem; border: 2px solid #111; margin: 0 0 12px 0; padding: 0 0.7rem; }`
- store.css:4 — `.store-main { float: none; display: flex; flex-direction: column; flex-shrink: 0; align-self: stretch; align-items: center; justify-content: center; width: 6.5rem; margin: 0; padding: 0.5rem; text-align: center; }`
- store.css:8 — `.store-body { flex: 1; min-width: 0; margin: 0 0.9rem; }`
- store.css:12 — `.store-controls { float: none; display: flex; flex-wrap: wrap; justify-content: flex-end; margin: 0 0 0 0.75rem; }`
- store.css:13 — `.store-controls button { margin: 4px 4px 4px 0; }`
- store.css:16 — `.store-dialog-panel button { margin: 4px 4px 4px 0; }`
- store.css:17 — `.store-update-all { margin: 0 0 12px 0; }`
- store.css:18-20 — `.store-details { display: block; margin: 0.4rem 0 0.2rem 0; }` / `.store-details summary { min-height: 48px; display: flex; align-items: center; cursor: pointer; }` / `.store-details code { display: block; white-space: pre-wrap; word-break: break-word; }`

There is no width, no marker, and no caret rule anywhere in store.css today.

### Sizing basis for the fixed width

Store buttons are plain `<button>` elements inside `<div class="bundle">`, so they take the scoped bare-button default (`openspec/specs/bundle-styles/spec.md`, "Scoped bare defaults inside the bundle"): 20px shell font, `0 16px` padding (16px each side), 1px border, minimum height 48px. The labels, resting and busy (store.js:291-295):

- Resting: Add (3), Update (6), Overwrite (9), Restore (7), Remove (6).
- Busy: Adding… (7), Updating… (9), Overwriting… (12), Restoring… (11), Removing… (10).

The longest label in either state is the busy "Overwriting…" — 12 characters including the ellipsis. The shell already reserves button widths this way for its own rows (`pkg/public/styles.css:704-733`): `.store-control-* button { min-width: calc(Nch + 0.8rem + 4px); }`, with the comment "Reserve the width of each control's longest label … so toggling never resizes the row."

### Ceiling and conventions that bind this change

- ES2019 only, system fonts only, zero emojis, 48px minimum tap targets, no flexbox gap (root `AGENTS.md`, "Shell constraints"). This change adds no JavaScript, so ES2019 is vacuous; the caret is a CSS border triangle in `currentColor`, not an emoji or an image.
- Bundle classes carry only their delta from the scoped defaults (`openspec/specs/bundle-styles/spec.md`, "Classes only for variants"): the new rules set only the properties that differ (width, alignment, caret), never a re-stated button look.
- `catalogVersion` increments by exactly 1 on any change to a definition (root `AGENTS.md`, "Catalog rules"; `openspec/specs/bundle-styles/spec.md`, "Catalog version follows bundle changes").

### Live mock state at spec time (read-only check, 2026-11-11)

The live mock dev env (pid 245902, `kody dev --target mock`, port 4302) reports, via `GET /manage/rows?app=app-store`:

- 13 installed rows: 11 up-to-date (Remove), counter `absorbed` (Remove), probe `snapshot-less` (Overwrite). 5 not-installed rows (Add).
- **No row is behind-modified, modified-current, or absorbed-behind**, so no row currently carries the "Absorb with an agent" summary. The single Overwrite row is probe, `snapshot-less`, whose details in the v21 bundle read "Overwrite with an agent" by design — a snapshot-less install has no snapshot to absorb against, so no absorb prompt is offered for it (absorb change design.md Decision 2).
- The served Store page inlines the **v20** bundle, not v21: the page contains no `storeAgentPrompt`, no `store-details`, no `Absorbed`, and no `min-height: 48px` summary rule; the on-disk mock state has the installed App Store definition at `catalogVersion` 20 with a v20 snapshot. The earlier v21 mock update did not persist to the disk state or the served page. Consequence: **no absorb text is visible in the browser right now at all**, and the mock visual check in tasks.md §7 must re-update the mock Store to v21 (then to v22 with this change) with the stopped-dev sequence before it can prove anything. This change does not perform that update.
- Unexplained observation, not a claim: in the v20 bundle counter (status `absorbed`) renders with no button at all (v20 `render()` has no `absorbed` branch), and probe has a snapshot row on disk (`catalogVersion` 9) yet derives `snapshot-less`. Both are pre-existing v20/mock-state facts, not something this change needs to explain; the mock visual check (§7) re-verifies them against the v22 bundle.

## Decisions

### Decision 1: caret — hide the native marker, draw a CSS triangle on `summary::before`

Why there is no caret today: store.css:19 sets `.store-details summary { display: flex; ... }`. In Chromium the disclosure marker is rendered only for the summary's default display; making the summary a flex container drops the marker. Nothing in store.css restores or replaces it (no `list-style`, no `::-webkit-details-marker`, no `::before` rule).

Change (store.css only):

```css
.store-details summary { list-style: none; }
.store-details summary::-webkit-details-marker { display: none; }
.store-details summary::before {
  content: "";
  flex-shrink: 0;
  width: 0; height: 0;
  margin-right: 0.5rem;
  border-top: 0.35em solid transparent;
  border-bottom: 0.35em solid transparent;
  border-left: 0.55em solid currentColor;
  transition: transform 0.15s ease;
}
.store-details[open] > summary::before { transform: rotate(90deg); }
```

- One marker only: the first two rules suppress the native marker in every engine (Chromium 80 honors `::-webkit-details-marker`; Firefox honors `list-style: none` on summary). The custom triangle is then the only marker.
- Rotation is pure CSS on the native `open` attribute — no JavaScript, no emoji, no image. A closed row points right; an open row points down. `currentColor` keeps the caret readable in the shell theme on paper and on the Scribe.
- `::before` is a pseudo-element, so `store.js:247` (`summary.textContent = agentPrompt.summary`) is unaffected — no `store.js` change.
- The `::before` becomes a flex item inside the flex summary; `flex-shrink: 0` keeps the triangle from collapsing on narrow rows, and the `0.5rem` right margin separates it from the summary text.
- Keep the existing `min-height: 48px` on the summary (store.css:19): the caret sits inside the existing 48px tap target; the target does not shrink.
- The triangle size (0.35em / 0.55em) is a starting value: the mock visual check (§7) may adjust it ±0.1em for legibility at the Store's font size; the tests assert the presence of the triangle rule and the rotation rule, not the exact em values.
- Ceiling: `::before`, border triangles, `transform`, `transition`, and the `[open]` attribute selector all predate Chromium 80.

### Decision 2: pinning — `flex-start` everywhere in the row

Why the row moves today: store.css:3 sets `.store-row { align-items: center; }`, which vertically centers `.store-main`, `.store-body`, and `.store-controls`. When the `<details>` inside `.store-body` opens, the row grows taller and all three children recenter — the icon, label, and buttons visibly shift down. Compounded by store.css:4, where `.store-main` has `align-self: stretch` (overriding the row) and `justify-content: center` (centering icon + label inside the stretched column).

Change (store.css only):

```css
.store-row { align-items: flex-start; }
.store-main { align-self: flex-start; justify-content: flex-start; }
.store-body { align-self: flex-start; }
.store-controls { align-self: flex-start; }
```

- `align-items: flex-start` on the row makes the top edge of every child sit at the top of the row's content box; opening the details grows the row downward from the body only, and the icon, label, and buttons do not move.
- `.store-main` needs both properties: `align-self: flex-start` (it currently overrides the row with `stretch`) and `justify-content: flex-start` (it currently centers its children vertically).
- The `align-self` rules on `.store-body` and `.store-controls` are explicit so the pinning does not depend on the row default alone.
- Unchanged: `.store-main` keeps `width: 6.5rem` and `padding: 0.5rem`; the row keeps `min-height: 6.5rem`, `flex-wrap: wrap`, and its border/margins. On narrow rows where `.store-controls` wraps to its own line, it sits at the top of that wrapped line (inherent to `flex-start`).
- Do not touch `pkg/public/styles.css`: its `.store-row` rules (display block, float layout, styles.css:664) belong to the shell's own server-rendered rows; the Store bundle rows are styled by `catalog/app-store/store.css`. If the cascade interaction between the two ever needs revisiting, that is a separate change.

### Decision 3: fixed width — one `width` for every row action button

Why the column is ragged today: store.css:13 (`.store-controls button`) sets only margins — no width. Labels range from "Add" (3 chars) to "Overwrite" (9 chars), and the busy labels to "Overwriting…" (12 chars).

Change (store.css only):

```css
.store-controls button {
  box-sizing: border-box;
  width: calc(12ch + 2rem + 2px);
  white-space: nowrap;
}
```

- `12ch` is the longest label in either state ("Overwriting…"); `2rem` is the bare-default horizontal padding (16px each side at the 20px button font); `2px` is the 1px border on both sides. The `ch` form follows the shell's own precedent (`pkg/public/styles.css:713-733`).
- `width`, not `min-width`, so every row button is the same width, not merely at-least as wide. `box-sizing: border-box` makes the `calc()` the total rendered width. `white-space: nowrap` guarantees a label can never wrap to a second line inside the fixed width.
- Because the width fits the longest *busy* label, clicking a button (label → busy label) never resizes it — the shell's "toggling never resizes the row" precedent, applied to the Store.
- The 48px minimum tap-target height comes from the scoped bare-button default (`.bundle button`, 48px min-height); the new rule does not restate it, per "classes carry only their delta".

### Decision 4: scope — dialog buttons and Update All are out

- The confirm-dialog buttons (`.store-dialog-panel button`, store.css:16; created by `showConfirm`, store.js:160-194) are OUT of scope. Their labels ("Confirm update" / "Confirm restore" / "Confirm remove", up to 15 characters) and busy label ("Confirming…") are longer than any row label, and they live in a fixed-width dialog panel, not the row button column — the ragged-column problem does not apply to them, and forcing them to the row width would clip "Confirm restore". They keep their current sizing.
- The "Update All" header button (`.store-update-all`, store.css:17) is OUT of scope: it is a server-rendered header control, not a row action button.
- The requirement-text spans (`needsNewerShell` / `needsNewerSchema`) and the recipe-only span inside `.store-controls` are not buttons; the width rule does not apply to them.

### Decision 5: no canonical spec delta

No file under `openspec/specs/` changes with this change:

- There is no canonical spec for the App Store bundle. Row layout, caret, and button width are bundle-internal presentation, not package behaviour.
- `openspec/specs/app-registry/spec.md` is untouched: statuses, the button mapping, and the management API do not change.
- `openspec/specs/bundle-styles/spec.md` is untouched: its "Catalog version follows bundle changes" requirement already covers the 21 → 22 bump (cited below), and its bare-button default already supplies the 48px tap target and the 20px/16px sizing basis. This change's rules carry only their delta, as that spec requires.
- If a future change alters the status → button mapping or the prompt model, that change owns the app-registry delta.

## Versions

- App Store `catalogVersion` **21 → 22** (`catalog/app-store/definition.json`, plus a regenerated `catalog/catalog.json`). Per root `AGENTS.md` ("Catalog rules"): `catalogVersion` increments by exactly 1 on any change to that definition. The absorb change set the same precedent (20 → 21 for its bundle change). No other app's `catalogVersion` changes.
- **No package version change**: `pkg/src` is untouched, so `pkg/package.json` stays at 4.2.0 / build 46 per `pkg/AGENTS.md` ("What does NOT bump the version" — and the version policy generally: no shipped package behaviour changes).
- `build` increments only on a Kody publish, which this change does not do.

## Risks

- Cascade: the shell's inlined `.store-row` rules and the bundle's store.css both target the same elements. The bundle's rules already win for Store rows today (the live Store renders as flex rows); this change only edits values inside the bundle's own rules, so it cannot change which stylesheet wins. The mock visual check (§7) confirms the rows still render as flex rows after the edit.
- `ch` sizing depends on the button font: if a future change alters the bare-button font size, the fixed width scales with it (ch is font-relative), so the fit holds.
- jsdom (catalog/tests/app-store-tests.cjs) does not lay out: it cannot render a caret or measure a pixel width. Bundle tests therefore assert the rules on the stylesheet text (and `getComputedStyle` where jsdom reports a specified value); the mock visual check is the rendering proof (tasks.md §5–§7).
