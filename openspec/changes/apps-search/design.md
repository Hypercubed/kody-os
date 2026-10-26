# Design

## Context
See proposal.md Why. Current state: `renderAllSection` (`pkg/src/apps/client.ts:287`) renders one Edit toggle form (`?edit=1`); the `/apps` dispatch (`pkg/src/app.ts:682`) reads `pin/hide/clear/home/edit` params, applies mutations with a 303 redirect preserving only `?edit=1`, then renders Pinned / Recent / All-apps from `list_apps()`.

## Goals / Non-Goals
- Goals: toggleable server-side query filter on the All-apps browse list, query preserved across mutation redirects, zero JS.
- Non-Goals: no live-as-you-type filtering (a later enhancement may add it without changing this contract); no filtering of Pinned/Recent/edit-mode rows; no persisted query (URL-only).

## Decisions
1. **`?search=1` shows the box, `?q=` filters** — Search toggle submits `search=1` (mirrors the `edit=1` toggle); the box submits `q=<query>` (keeps `edit`, `k` hidden fields). Why: identical to the proven edit-toggle round-trip; empty `q` with `search=1` shows the unfiltered list, so clearing is just emptying the box.
2. **Filter in dispatch, not in render** — `/apps` dispatch applies a case-insensitive substring match over `label + name + id + category` before calling `renderAllSection`. Why: render stays dumb; the same filtered list flows to any future consumer.
3. **Preserve `q` + `search` in mutation redirects** alongside the existing `edit` chaining. Why: pinning from a filtered list must return to the filtered list, or the feature fights the user.
4. **Edit mode ignores the query** — opening Edit shows the full list. Why: pin/hide decisions need the whole registry visible; mixing filter state into edit rows doubles the test matrix for no asked benefit.

## Risks / Trade-offs
- [Risk] Query string grows across chained redirects → Mitigation: single short `q` value, same pattern as `edit=1` already does.
- [Risk] Special regex characters in query → Mitigation: plain substring `indexOf`, never regex.

## Migration Plan
1. Land dispatch filtering + redirect preservation + render changes together (one coherent unit).
2. Verify on preview: toggle, filter, empty-match, edit interplay, mutation round-trips.
3. Rollback: republish prior commit; `search`/`q` params ignored by old code.

## Open Questions
- None.
