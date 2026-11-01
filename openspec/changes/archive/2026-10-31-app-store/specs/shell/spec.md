# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher only, with no Edit mode — SHALL live behind the Apps menu link instead of at `/`. App management (pin, hide, home, install, update, restore) lives on the App Store combined list (see below); the Apps page's former Edit mode is retired. Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with the App Store installed (see app-registry); with no apps installed at all (seeding has failed or not yet run), both `/` and the Apps page SHALL render honest empty states with guidance toward adding apps, including the App Store path.

#### Scenario: Fresh install opens with the App Store
- **WHEN** a blank install receives its first shell request
- **THEN** the Apps page shows the App Store tile, and `/` shows its honest no-widgets state (the store is not on the homepage by default).

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Landing is the dashboard
- **WHEN** apps are pinned to the homepage
- **THEN** `/` shows their live widgets, and the Apps grid (with pins on top) is one menu tap away.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one app is installed, pinned, and acted on
- **THEN** the Apps page shows it in Pinned, in Recent, and in All apps, in that section order.

#### Scenario: Modal tile opens overlay without leaving the Apps page
- **WHEN** a modal-capable app's tile is followed
- **THEN** the overlay section becomes visible on the Apps page (no navigation), showing current state with working forms, and the back link hides it again.

#### Scenario: Unified app renders UI plus state
- **WHEN** a unified app page is fetched
- **THEN** bundle UI, live state, and action forms all render in the single panel with no template branch.

#### Scenario: SVG tile renders mark
- **WHEN** an app with a sanitized SVG icon is listed
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

#### Scenario: Apps page has no Edit mode
- **WHEN** the Apps page is fetched
- **THEN** it shows Pinned, Recent, and All tiles with no Edit control; pin, hide, and home controls are on the App Store combined list instead.

## ADDED Requirements

### Requirement: App Store page is the single combined list

The App Store app page (`GET /apps/app-store`) SHALL render, server-side in
the normal shell chrome, a single combined list as defined in the
app-registry spec delta: one row per id from the union of catalog ids
and installed ids, deduplicated by id, in alphabetical-by-id order, each
row showing the app's icon, label, description, and status badge. The
App Store itself appears as a row like any other app; it is not excluded
from its own list. The list is unfiltered, so hidden apps appear in it.
A row for an app that is not installed SHALL offer an Install control as
a plain GET form (`?install=<id>`, carrying whatever session credential
the auth transport in force at implementation requires, no `app-action`
class) and no Open link, no Pin, Hide, or Home control, and no Update or
Restore control — no launching from the catalog. A row for an installed
app SHALL show its status plus a link to the app, and Pin/Unpin,
Hide/Unhide, and Add to home/Remove from home controls as plain GET
forms (no `app-action` class), each responding 303 back to the store
page. An installed catalog app with a snapshot SHALL additionally show
its update status under the app-registry spec delta: behind-and-clean and
catalog-differing rows offer an Update control; behind-and-modified rows
offer a confirmed update (see below), not a plain Update control;
modified-at-current-version rows offer Restore catalog version;
ahead rows offer Restore catalog version, never Update; up-to-date rows offer neither.
A row for an installed catalog app without a snapshot SHALL show
Installed with no update control under this scheme. A row for an
installed app with no catalog entry SHALL show Storage only (formerly
in the catalog where a snapshot exists, otherwise custom/storage-only)
with launcher controls only. Submitting an
Install form SHALL install the app through the registry's
install-from-catalog path and respond 303 back to the store page. An
unknown `install` id SHALL respond 400, re-render the store page with an
inline `role="alert"` error, and change nothing. The listing SHALL require
no JavaScript. The Help page SHALL present the App Store as the browser
path for installing shipped apps and for managing installed apps, with
the agent/`add_app` path retained for custom apps.

#### Scenario: Behind-and-clean row offers update
- **WHEN** an installed catalog app matches its snapshot at a lower version than the catalog
- **THEN** its row shows Update, and submitting it updates the app and returns 303 to the store page.

#### Scenario: Snapshot-less row offers no update
- **WHEN** an installed catalog app has no snapshot
- **THEN** its row shows Installed with a link to the app and no Update or Restore control.

### Requirement: Confirmed update for a modified app

Submitting an update (or restore) for a modified catalog app SHALL NOT
apply the update immediately. It SHALL first render a confirmation page
(server-rendered, no JavaScript required, normal shell chrome) stating
that updating will replace the app's definition — bundle files,
stateSchema, actions, capabilities, and metadata — with the catalog copy
and that the user's custom definition changes will be lost and cannot be
recovered afterwards unless the app was exported first, and stating that
state is preserved for fields still declared in the new definition while
dropped fields reset to their initial values. Only an explicit
confirmation submission on that page SHALL apply the update, through the
registry update path, and respond 303 back to the store page. Declining
or leaving the confirmation page SHALL change nothing. An update or
restore for an unknown id, an uninstalled id, or a non-catalog id SHALL
respond 400, re-render the store page with an inline `role="alert"`
error, and change nothing.

#### Scenario: Modified update waits for confirmation
- **WHEN** a confirmed update is requested for a modified catalog app
- **THEN** the store renders the confirmation page with the loss and state-preservation wording, and storage is unchanged until confirmation.

#### Scenario: Confirmed update replaces definition and keeps surviving state
- **WHEN** the confirmation is submitted for a modified catalog app
- **THEN** its definition is replaced with the catalog copy, state for surviving fields is preserved, dropped fields reset, pins and homepage placement are untouched, and a new snapshot is recorded.

#### Scenario: Declined update changes nothing
- **WHEN** the confirmation page is left without confirming
- **THEN** the installed definition, state, and snapshot are unchanged.

#### Scenario: Ahead app offers restore, not update
- **WHEN** an installed catalog app is modified and ahead of the catalog
- **THEN** its row offers Restore catalog version with the confirmation and warning, never an Update control.

#### Scenario: Combined list shows catalog, installed, and storage-only apps once each
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus an installed app with no catalog entry, plus the App Store itself
- **THEN** every id from the union appears exactly once, in alphabetical-by-id order, with its icon, label, description, and status badge — including `app-store` itself.

#### Scenario: Catalog-only row has no launch control
- **WHEN** a catalog app that is not installed is rendered in the combined list
- **THEN** its row offers Install and no link to its app page, since there is nothing installed to open.

#### Scenario: Install round-trips without JavaScript
- **WHEN** an Install form is submitted with JavaScript unavailable
- **THEN** the server responds 303 to the store page, the app is installed, and its row now shows Installed with a link to the app.

#### Scenario: Installed rows offer no Install control
- **WHEN** an installed catalog app's row is rendered
- **THEN** it shows Installed plus a link to the app, and no Install form for that id.

#### Scenario: Installed row offers launcher controls
- **WHEN** an installed app's row is rendered in the combined list
- **THEN** it offers Pin/Unpin, Hide/Unhide, and Add to home/Remove from home controls, each responding 303 back to the store page without changing its definition, state, or snapshot.

#### Scenario: Storage-only row offers launcher controls only
- **WHEN** an installed app with no catalog entry is rendered in the combined list
- **THEN** its row shows Storage only with launcher controls, and no Install, Update, Restore, or catalog status control.

#### Scenario: Unknown install id is a clean error
- **WHEN** the store page is requested with an unknown `install` id
- **THEN** it responds 400 with an inline error, the store page still renders, and storage is unchanged.

#### Scenario: Store page keeps shell constraints
- **WHEN** the App Store page is fetched
- **THEN** it carries the normal chrome, exactly one `<style>` block, zero external stylesheets, and no mutating POST form.
