# Design: default-open-mode

## Context

See proposal.md (Why). Today, in `pkg/src/apps/`:

- `UiDef.placements?: AppPlacement[]` with `AppPlacement =
  'page' | 'modal' | 'widget'` (types.ts). Validation (registry.ts)
  requires a non-empty array drawn from that closed set, and
  normalization defaults an omitted field to `['page']`.
- `isModalApp` (client.ts) returns true when the summary's
  placements contain `'modal'`. The Apps-page tile then links to
  `/apps/<id>?touch=1&from=/apps`, and app.ts records the open in
  recent and 303s to `/apps#app-<id>`, revealing the overlay
  section rendered for that app. Any other tile links straight to
  `/apps/<id>`.
- The home dashboard (app.ts) renders `renderWidgetSection` for
  every id in the homepage list, with no placements check. The
  widget section carries `data-app-id` (fixed Oct 2026), so the
  bridge reads the right seed in every placement.
- The only live modal example is Clock (`placements: ["modal"]`).
  Counter, Eight Ball, and Probe omit the field and default to
  page; Calculator, Puzzle, and xkcd declare `["page"]`.

## Goals / Non-Goals

- Goals: one field, one meaning — the Apps-page default open mode;
  every app renderable in page, modal, and widget contexts; old
  definitions keep working without being re-saved.
- Non-goals: a per-context open preference (e.g. a separate home
  open mode); a user-facing setting to override an app's default;
  changing how overlays open/close (fragment `:target`, back link,
  close box) or how the homepage list works; removing the
  `placements` field from stored definitions in this change (that
  is a later cleanup, once re-export has migrated the live set).

## Decisions

1. **New field: `ui.openAs: 'page' | 'modal'`, default `'page'`.**
   Name chosen over `ui.defaultPlacement` (implies placements
   still exist) and `ui.defaultOpen` (vaguer verb). `openAs` reads
   as "open as a page / open as a modal", which is exactly what
   the tile does. The field lives on `UiDef` alongside `title`
   and `actions`, and on the app summary so tile rendering can
   read it without fetching the full definition.

2. **Tile behavior is the only behavior the field drives.**
   `openAs: 'modal'` produces today's modal tile link
   (`?touch=1`, recent recorded, 303 to `#app-<id>`); `openAs:
   'page'` (or omitted) produces today's page tile link. The
   overlay section itself is unchanged: same shared section
   HTML, same fragment open/close. Direct navigation to
   `/apps/<id>` always renders the full page, for either value
   — the field is a default, not a restriction, so a modal-default
   app is still fully reachable as a page.

3. **`ui.placements` is deprecated with a derivation rule, not
   deleted.** When a definition carries `placements` but no
   `openAs`, derive: `placements` contains `'modal'` and does
   not contain `'page'` → `'modal'`; otherwise → `'page'`.
   That maps Clock (`["modal"]`) to modal and every page-only
   definition to page, and maps a hypothetical `["page",
   "modal"]` or `["widget"]` to page (page is the safe default:
   it is the only mode that is a full, linkable view). When both
   fields are present and disagree, `openAs` wins and
   `placements` is ignored. Validation still rejects a
   `placements` array containing values outside
   page/modal/widget, so old garbage is not silently accepted;
   it just no longer gates anything. Normalization writes
   `openAs` into the stored definition and drops `placements`
   from the stored shape, so `export_app` output is already in
   the new form. (Whether the registry drops `placements` on
   read as well as on write is an implementation detail; the
   observable contract is that stored/exported definitions
   carry `openAs` and no longer need `placements`.)

4. **Unknown `openAs` is a validation error, not a fallback.**
   Any value outside page/modal makes `add_app` return
   `{ ok: false }` naming the bad value and writing nothing,
   matching today's unknown-placement behavior. Silently
   falling back to page would hide authoring mistakes and
   break the "definition defines the default" promise.

5. **Home widgets are untouched and need no field.** Widget
   presence stays governed by the homepage list, and widget
   rendering stays the shared section. The old spec sentence
   claiming the `widget` placements value "renders nothing"
   is corrected by this change: that sentence described a
   value that never had a renderer, not a context that was
   unavailable. After this change there is no widget value to
   declare, because widget presence is a pin, not a definition
   property.

6. **Overlay collection follows the same field, nothing more.**
   app.ts collects modal overlay sections for tiled apps whose
   default is modal — the same collection it does today for
   `placements`-modal apps, with the field name swapped. No
   change to which sections are collected (pinned + recent
   tiles), to fragment mechanics, or to the modal panel.

## Risks

- **An author relied on placements as a restriction.** E.g. an
  app author who declared page-only because the app is "not
  compact enough" for an overlay. Mitigation: the overlay
  renders the same shared section as the page, so a modal
  open is never a different UI — but the authoring guide
  should say plainly that `openAs` is a default, not a
  restriction, and that any app can be opened as a page by
  direct URL. If a future need for a real restriction appears,
  it is a new feature, not a reason to keep the allowlist.
- **Stale exported definitions.** Old exports carrying
  `placements` will still import fine through the derivation
  rule; they only look old, they do not behave old. The
  checklist should tell authors to re-export once to migrate.
- **Clock is the only modal-default app, so modal coverage is
  thin.** The verification tasks must exercise Clock end to
  end (tile → overlay → working forms → back link), not just
  the page-default majority.

## Alternatives considered

- **Keep `placements` and add a default.** Rejected: two fields
  saying overlapping things (an allowlist plus a default
  drawn from it) is the confusion this change exists to
  remove, and every allowlist entry except modal was already
  a no-op.
- **A single `ui.placement` (singular) field.** Rejected in
  favor of `openAs`: "placement" still suggests where the app
  is allowed to live, while the field only decides how the
  Apps-page tile opens it.
- **Hard-remove `placements` in one step.** Rejected: Clock's
  live definition and any saved exports would fail validation
  until re-saved. Deprecation with derivation costs one
  small rule and buys a silent migration.
