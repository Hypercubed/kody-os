# Design: apps-edit-and-store-split

## Context

See proposal.md (Why). Today the Apps page is a launcher only:
`pkg/src/app.ts` renders Pinned, Recent, and All tiles, and its
comment says Edit mode is retired because management lives on the
App Store combined list. The `/apps` route still handles `?pin=`,
`?hide=`, and `?home=` mutations (retained for existing links),
so the backend for Edit already exists; only the UI was removed.
The Store route in the same file handles the same three mutations
for its own rows, plus install, update, and restore.

## Goals / Non-Goals

- Goals: one obvious place for launcher management (Apps Edit),
  one obvious place for catalog management (the Store); hidden
  apps recoverable without the Store; no-JS operation throughout.
- Non-goals: a Store that is a data app (see
  `data-only-app-store`); removal from the browser (removal stays
  MCP-only, `remove_app`); any change to pin/hide/home semantics,
  storage keys, or MCP exports; any change to install, update, or
  restore behavior.

## Decisions

1. **Edit is a mode of the Apps page, not a separate page.**
   `GET /apps?edit=1` renders Edit mode; `GET /apps` without it
   renders browse mode. The toggle is a plain link in the All apps
   header, next to Manage apps. Edit mode is a full-page render,
   not a client-side toggle, so it works without JavaScript.
2. **Edit covers every installed app, including hidden ones.**
   Browse mode shows only visible apps (as today). Edit mode
   lists all installed apps, alphabetical by label (id breaks
   ties, matching the All-apps sort), each as a row with its
   label, icon, and current pinned/hidden/homepage state
   reflected in the control labels (Pin vs Unpin, and so on).
   Pinned and Recent sections stay launcher tiles in both modes;
   Edit applies to the All-apps list, which is the complete set.
3. **Edit mutations 303 back to Edit mode.** After a pin, hide,
   or home mutation from Edit, the response redirects to
   `/apps?edit=1`, not to browse mode, so the user can keep
   editing. Mutations from any other surface keep their current
   redirect behavior.
4. **Edit toggle appears only when there is something to edit.**
   With an empty registry, the Apps page keeps its honest empty
   state and no Edit toggle. With at least one installed app,
   the toggle appears in browse and in Edit mode (as a Done /
   back-to-browse link in Edit mode).
5. **Store launcher params become an error, not a silent no-op.**
   After this change, `GET /apps/app-store?pin=...`,
   `?hide=...`, or `?home=...` renders the Store page with an
   inline error naming that launcher management moved to Apps
   Edit. Silently ignoring a mutation the user asked for would
   be worse than an error, and a redirect would hide where the
   control went.
6. **Store rows keep everything except launcher controls.**
   A Store row still shows its label, icon, description, status
   badge (not installed, up to date, update available, modified,
   and so on), and, as its state allows, Install, Update, or
   Restore. Nothing else about row ordering, deduplication, or
   status classification changes.

## Open Questions

- None that block implementation. The `?edit=1` parameter name
  is a detail the implementation may rename if it collides with
  an existing query meaning on `/apps`; the spec's requirement
  is mode persistence across Edit mutations, not the parameter
  spelling.
