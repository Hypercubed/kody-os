# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Apps grid — Pinned, Recent, and All-apps sections, as a launcher, plus Edit mode — SHALL live behind the Apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Apps Edit (see below); catalog management (install, update, restore) lives in the App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All apps (every installed app except hidden ones; pinned apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no apps are seeded, including no App Store; with no apps installed, both `/` and the Apps page SHALL render honest empty states, and the Apps page SHALL show Help-style help text with two copy-paste prompts (install the App Store; add your own apps) instead of an empty tile list.

#### Scenario: Empty registry is honest
- **WHEN** no apps are installed
- **THEN** both `/` and the Apps page respond 200 with honest empty states and guidance toward adding apps.

#### Scenario: Empty Apps page shows two prompts
- **WHEN** the Apps page is fetched with no apps installed
- **THEN** it shows Help-style help text with a prompt for installing the App Store and a prompt for adding your own apps, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button.

#### Scenario: Apps page offers Edit mode
- **WHEN** the Apps page is fetched with at least one app installed
- **THEN** the All apps header shows an Edit button (a GET form, matching the Clear control); with no apps installed it shows no Edit button.

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

## REMOVED Requirements

### Requirement: Fresh install opens with the App Store

#### Scenario: Fresh install opens with the App Store
- **WHEN** a blank install receives its first shell request
- **THEN** the Apps page shows the App Store tile, and `/` shows its honest no-widgets state (the store is not on the homepage by default).

(Removed: a fresh install no longer seeds the App Store. Replaced by the "Empty Apps page shows two prompts" scenario above. NOTE: `openspec validate` flags this one dropped scenario — a MODIFIED requirement must carry every scenario the current spec has, and a requirement may not appear in both MODIFIED and REMOVED, so there is no supported syntax for dropping a single scenario from a retained requirement. This is the same class of failure as the pre-existing `shell-settings` os-theme delta, which omits two scenarios the canonical spec still has; the failure is recorded here rather than worked around by keeping a false scenario.)
