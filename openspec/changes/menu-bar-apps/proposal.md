# Proposal

## Why

The top menu bar is the one surface a user sees on every page, but today
it is hard-coded: Home, Apps, and (until the 1.3.2 logout move) Logout,
plus a static Help page that is not an app at all. Utility apps that a
user wants always within reach — Help and About are the first two —
have no way to get there except by opening the Apps launcher. Pin to
home is not the answer: it puts a tile on the home dashboard, it is a
per-install user choice with its own order list, and it says nothing
about the menu bar.

## What Changes

- An app bundle can carry a flag, `ui.menuBar: true`, that also puts
  the app in the top menu bar. The flag is author-controlled, not a
  user toggle: there is no menu on/off control in Apps Edit, no menu
  order list, and no new MCP export.
- The menu is derived from installed definitions, never stored
  separately. Installing a flagged app puts it in the bar; uninstalling
  it (`remove_app`) removes it, because the definition is gone. No
  list needs scrubbing on uninstall, unlike pin, hide, homepage, and
  recent.
- Hidden apps stay out of the menu (user decision, 2026-10-31). A
  flagged app that is hidden appears nowhere in the menu, even though
  a hidden app can still appear in Pinned. Hiding is the way to take
  a menu app out of the bar without uninstalling it.
- Help becomes a real catalog app (`help`, stateless, no actions,
  `ui.menuBar: true`) carrying the current static Help content.
  `GET /help` redirects to `/apps/help`, preserving the query
  string, so existing Help bookmarks and `?k=` links keep working.
  The static Help link in the shell chrome goes away; Help appears
  in the bar only when the help app is installed, like any other
  menu app.
- About (`about`, already a catalog app in the working tree, not yet
  published) gets `ui.menuBar: true` in the same change.
- Menu apps render in the nav after Apps, alphabetically by label,
  as text links like the existing Home and Apps links. Logout stays
  where 1.3.2 put it — the footer, with its confirm modal — it does
  not come back into the menu bar.

## Non-goals

- No user menu toggle, no menu ordering control, no dropdowns or
  submenus, no icons in the menu bar (text links only, matching the
  existing nav).
- No menu-only apps: the flag is "also in the menu". A flagged app
  still appears in the Apps launcher like any installed app.
- No seeding: Help and About are not installed on a fresh fork.
  A fresh install has no Help link until the help app is installed,
  which is a deliberate consequence of Help becoming an app, not an
  oversight to paper over.
- No new MCP export: the shell derives the menu internally from
  `list_apps` with hidden apps excluded. Agents already install and
  remove apps; the menu follows.
- No change to pin, home, hide, or recent lists, and no change to
  `remove_app`'s list scrubbing (the menu needs none of it).
- No live change in this change itself: the spec, the code, and the
  publish are separate steps. This change is spec-only until its
  tasks are approved and implemented, and it goes live only with a
  Kody publish, like any shell change.
