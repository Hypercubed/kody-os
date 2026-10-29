# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections with edit mode — SHALL live behind the Apps menu link instead of at `/`. Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with the App Store installed (see app-registry); with no apps installed at all (seeding has failed or not yet run), both `/` and the Apps page SHALL render honest empty states with guidance toward adding apps, including the App Store path.

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

## ADDED Requirements

### Requirement: App Store page lists the catalog and installs from it

The App Store app page (`GET /apps/app-store`) SHALL render, server-side in
the normal shell chrome, a catalog section listing every catalog app
except the App Store itself, in catalog order, each row showing the app's
icon, label, and description. A row for an app that is not installed SHALL
offer an Install control as a plain GET form (`?install=<id>`, carrying
whatever session credential the auth transport in force at
implementation requires, no `app-action` class); a row for an
installed app SHALL show Installed plus a link to the app. Submitting an
Install form SHALL install the app through the registry's
install-from-catalog path and respond 303 back to the store page. An
unknown `install` id SHALL respond 400, re-render the store page with an
inline `role="alert"` error, and change nothing. The listing SHALL require
no JavaScript. The Help page SHALL present the App Store as the browser
path for installing shipped apps, with the agent/`add_app` path retained
for custom apps.

#### Scenario: Store lists every catalog app except itself
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled
- **THEN** every catalog app except `app-store` appears once, in catalog order, with its icon, label, and description.

#### Scenario: Install round-trips without JavaScript
- **WHEN** an Install form is submitted with JavaScript unavailable
- **THEN** the server responds 303 to the store page, the app is installed, and its row now shows Installed with a link to the app.

#### Scenario: Installed rows offer no Install control
- **WHEN** an installed catalog app's row is rendered
- **THEN** it shows Installed plus a link to the app, and no Install form for that id.

#### Scenario: Unknown install id is a clean error
- **WHEN** the store page is requested with an unknown `install` id
- **THEN** it responds 400 with an inline error, the store page still renders, and storage is unchanged.

#### Scenario: Store page keeps shell constraints
- **WHEN** the App Store page is fetched
- **THEN** it carries the normal chrome, exactly one `<style>` block, zero external stylesheets, and no mutating POST form.
