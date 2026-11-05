# Proposal

## Why

Reading happens on a phone or a desktop browser,
but the device you want to read on later is often
a different one — in this case, the Kindle Scribe
running kody-os. Browser bookmarks do not follow
you there: they are local to one browser, and the
Scribe's browser is not that browser. What does
follow you is kody-os app state, stored in the
package and visible on every device that opens
the same install.

This change specs a small app that turns "send
this page to kody-os" into one bookmarklet tap:
the sending browser opens kody-os in a new tab
with the page's title and URL as one appended
entry, and the app shows the saved links
most-recent-first, ready to open on the Scribe
or anywhere else kody-os runs. The mechanism is
not new — it is the Probe app's `append_report`
pattern, reused for links instead of test
reports.

## What Changes

- One new app, id `send-link`, label "Send
  Link", category `utilities`, delivered in v1
  as a registry write via `add_app`, exactly
  like Daily Brief, Daily Feed, and the other
  data apps. Per `pkg/AGENTS.md` ("Adding an
  app"), that is no package change, no commit,
  and no republish: the definition is data in
  `packageStorage()`, and it appears in
  `list_apps()` and on the Apps page as soon as
  `add_app` returns `{ ok: true }`.
- The definition follows the existing contract:
  `schemaVersion` 5, one state field, two
  actions, no shell route, no MCP export, no
  capability declaration (see design.md,
  Decision 1).
  - State: `links`, an array of strings,
    initial `[]`, `maxItems` 500.
  - Action: `send`, arg `entry` (string,
    required), effect `append` field `links`
    from arg `entry`, `cap` 500,
    `maxEntryBytes` 2048.
  - Action: `clear`, no args, effect `set`
    field `links` to `[]`.
- A bundle that renders the stored entries
  most-recent-first (storage order is append
  order, oldest first; the bundle reverses it
  for display). Each entry is one JSON string
  with `t` (ISO 8601 timestamp), `title`, and
  `url`. The title renders as a link when the
  URL's scheme is `http` or `https`; anything
  else renders as plain text, never as a link
  and never as HTML.
- A bookmarklet, built by the app page itself
  from the page's own location — never with a
  hardcoded host, so the same app works on the
  hosted install, the mock preview, and a dev
  install. The bookmarklet opens kody-os in a
  new tab at
  `/apps/send-link?action=send&entry=<encoded>`,
  so the original page stays open and the
  landing on the app page, showing the new
  entry on top, is the confirmation that the
  send worked. The app page shows the
  bookmarklet as a draggable link plus
  selectable code text, with install steps for
  desktop (drag to the bookmarks bar) and
  mobile (create a bookmark, then edit its URL
  to the code).
- An empty state that, instead of a blank list,
  shows the bookmarklet install block: what the
  app is for, how to install the bookmarklet,
  and the two requirements stated plainly —
  the sending browser must already be signed
  into kody-os, and the send opens a new tab
  and does not return to the original page.

## Capabilities

### New Capabilities

- `send-link-app`: a bookmarklet-fed link list,
  appended one entry at a time over the
  shell's GET-action path, rendered
  most-recent-first.

### Modified Capabilities

- None in v1. No existing app, route, action,
  MCP export, or shell behavior changes.
- Catalog shipping (Phase 2, optional, tasks
  section 6) modifies `app-registry` only by
  adding one catalog bundle, one `catalog.ts`
  import line, and one README entry, in the
  same pattern as the existing catalog apps.

## Impact

- v1: one `add_app` definition, written to the
  live store and to the local mock store
  separately (the two stores are separate, per
  `pkg/.agents/skills/adding-an-app/SKILL.md`).
  No file in `pkg/` changes, so no version
  decision is triggered by v1 at all.
- Phase 2 (only on user direction):
  `pkg/catalog/send-link.bundle.json` (new,
  `catalogVersion` 1), one import line in
  `pkg/src/apps/catalog.ts` (alphabetical by
  id), one entry in `pkg/catalog/README.md`.
  That is a new feature with nothing existing
  breaking, so it is a MINOR bump per
  `pkg/AGENTS.md`, with BUILD +1 on publish,
  in the same commit as the catalog files.
- Storage budget: the links field holds at most
  500 entries of at most 2048 bytes each, so
  at most about 1 MiB of entry text, inside
  the 16 MiB package storage budget. The bundle
  is under the 256 KiB bundle cap, checked by
  the catalog harness before shipping and by
  definition validation for an `add_app` v1.

## Out of Scope

- Per-item delete, edit, dedupe, folders,
  tags, or search in v1. The fixed action
  operators provide no remove-one-element
  effect (see design.md, Decision 8); v1
  offers clear-all only. Sending the same link
  twice creates two entries, and the bundle
  does not hide that.
- Returning to the original page after a send,
  or saving silently in the background. The
  send is a top-level navigation to kody-os in
  a new tab; there is no cross-origin save,
  and no return trip is promised.
- Fetching, archiving, or rendering the linked
  page's content. The app stores a title and a
  URL, not the page. A reader/archiver is a
  different app, and would need a declared
  proxy capability and storage of its own.
- A share-sheet target, browser extension, or
  mobile app integration. The bookmarklet is
  the whole install story in v1, awkward on
  mobile by nature; the app page says so
  instead of pretending otherwise.
- Any shell change, route, capability, or MCP
  export. The app needs none of them: the
  GET-action path already exists, and Probe
  already proves it.
