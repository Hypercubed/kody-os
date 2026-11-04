# Proposal

## Why

The Oct 31 App Store change folded launcher management into the Store:
the Apps page lost its Edit mode and the Store's combined list gained
Pin/Unpin, Hide/Unhide, and Add to home/Remove from home controls for
installed rows. That folding conflates two different jobs: the Store
manages the catalog (install, update, restore), while the Apps page
manages the launcher (which installed apps are pinned, hidden, or on
the home dashboard). Splitting them back apart makes each surface's
job obvious, and it narrows the later data-only App Store change,
which then only has to do catalog work.

This change reverses only the launcher-controls part of the archived
`2026-10-31-app-store` change (its Decisions 12-15, as far as they
folded Edit into the Store). It does not reverse the combined
catalog-plus-installed Store list itself, and it does not change
what the Store installs, updates, or restores.

## What Changes

- The Apps page (`GET /apps`) regains an Edit toggle. Browse mode
  stays the launcher it is today (Pinned, Recent, All tiles). Edit
  mode shows every installed app as a row — including hidden apps,
  which are otherwise invisible — with Pin/Unpin, Hide/Unhide, and
  Add to home/Remove from home controls for each row, as plain GET
  forms through the existing `/apps` mutation route, which already
  handles `?pin=`, `?hide=`, and `?home=` and 303s back.
- The App Store page loses its pin, hide, and home controls, and
  its route loses its `?pin=`, `?hide=`, and `?home=` handling.
  Store rows offer install, update, and restore only (plus status
  badges and descriptions), as decided by their catalog/installed
  state.
- The Manage apps link in the All apps header stays. Edit and
  Manage apps are separate controls with separate jobs, not
  replacements for each other.
- The "All apps are hidden" hint changes from pointing at the Store
  to pointing at Apps Edit, since Edit is again where an app is
  unhidden.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shell`: the Apps page gains an Edit mode again; the App Store
  page loses launcher controls. No new route family, no storage-key
  change, no MCP change. The `/apps` pin/hide/home mutation
  endpoints, retained today for existing links, become the Edit
  mode's backend again.

## Impact

- `pkg/src/app.ts`: Apps route gains Edit-mode rendering and an
  `?edit=` mode parameter; Store route drops pin/hide/home
  handling; comments saying Edit is retired are corrected.
- `pkg/src/apps/client.ts`: `renderAllSection` gains an Edit
  rendering (rows, not tiles, in Edit mode); the Store's
  `renderCombinedList` drops its toggle forms; the Manage apps
  link is unchanged.
- `pkg/src/apps/registry.ts`: no change. `set_pin`, `set_hide`,
  and `set_home` are reused unchanged.
- `pkg/docs/` and `pkg/AGENTS.md` copy that says management lives
  on the Store is corrected at implementation time to say launcher
  management lives on Apps Edit and catalog management lives on
  the Store.
- BREAKING: Store URLs carrying `?pin=`, `?hide=`, or `?home=`
  stop working (see design.md for the error behavior). No
  installed app, definition, or agent script breaks. Version:
  MINOR at implementation (new UI surface restored, nothing
  existing breaks in the registry sense) — this spec draft
  itself, outside `pkg/`, bumps nothing.
