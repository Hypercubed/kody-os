# Spec Delta

## MODIFIED Requirements

### Requirement: Home launcher lists installed apps

The shell SHALL render a home page at `GET /` showing the widget dashboard (see widget-home), and the Mini-apps grid — Pinned, Recent, and All-mini-apps sections, as a launcher, plus Edit mode — SHALL live behind the Mini-apps menu link instead of at `/`. Launcher management (pin, hide, home) lives in Mini-apps Edit (see below); catalog management (install, update, restore) lives in the Mini-App Store data app (see App Store page below). Deep links at `/apps/:id` SHALL be unchanged. The Mini-apps page SHALL render the three sections in order: Pinned (user-chosen tiles, omitted when empty), Recent (behavior-driven tiles with a Clear control, omitted when empty), and All mini-apps (every installed mini-app except hidden ones; pinned mini-apps included). Each tile links to `/apps/:id` — except modal-capable apps, whose tiles link to an inline overlay section on the same page opened by fragment (`#app-<id>`) via CSS `:target` and closed by a back link. The overlay SHALL contain the same section HTML as the app page (bundle UI, live state, action forms), fully present in the server-rendered HTML; JS may enhance it. Every tile SHALL show the mini-app's icon glyph or sanitized SVG mark and label. A fresh install SHALL open with an empty registry — no mini-apps are seeded, including no Mini-App Store; with no mini-apps installed, both `/` and the Mini-apps page SHALL render the same Help-style help text with two copy-paste prompts (install the Mini-App Store, agent-only via `install_from_catalog`; add your own mini-apps) instead of an empty tile list, rendered from the same shared shell block. The help text SHALL also carry the glossary line from `mini-apps-user-facing`: "A mini-app is an installed app: in the browser it is called a mini-app, and agents call it an app (`add_app`, `list_apps`)." With mini-apps installed but none on Home, `/` SHALL instead show a short message prompting the user to add mini-apps to Home from the Mini-apps page via Mini-apps Edit's Add to home control.

#### Scenario: Empty registry is honest
- **WHEN** no mini-apps are installed
- **THEN** both `/` and the Mini-apps page respond 200 with honest empty states and guidance toward adding mini-apps.

#### Scenario: Empty Mini-apps page shows two prompts
- **WHEN** the Mini-apps page is fetched with no mini-apps installed
- **THEN** it shows Help-style help text with a prompt for installing the Mini-App Store and a prompt for adding your own mini-apps, each as selectable text in a gate-hint code block, with no copy button and no Clipboard API use, and with no Edit button. The Mini-App Store prompt is agent-only (`install_from_catalog('app-store')`, verified with `list_apps`); it SHALL NOT name a browser install path. The help text also carries the glossary line "A mini-app is an installed app: in the browser it is called a mini-app, and agents call it an app (`add_app`, `list_apps`)."

#### Scenario: Empty Home page shows the same help
- **WHEN** `/` is fetched with no mini-apps installed
- **THEN** it shows the same help text as the Mini-apps page — same intro, same two prompts — rendered from the same shared shell block, not a second copy.

#### Scenario: Home with mini-apps but none on Home prompts Add to home
- **WHEN** `/` is fetched with at least one mini-app installed and an empty homepage list
- **THEN** it shows "No widgets yet" with a short message prompting the user to add mini-apps to Home from the Mini-apps page via Mini-apps Edit's Add to home control, and it does NOT show the two install prompts.

#### Scenario: Apps page offers Edit mode
- **WHEN** the Mini-apps page is fetched with at least one mini-app installed
- **THEN** the All mini-apps header shows an Edit button (a GET form, matching the Clear control); with no mini-apps installed it shows no Edit button.

#### Scenario: Landing is the dashboard
- **WHEN** mini-apps are pinned to the homepage
- **THEN** `/` shows their live widgets, and the Mini-apps grid (with pins on top) is one menu tap away.

#### Scenario: Sections render in order with an app installed and pinned
- **WHEN** one mini-app is installed, pinned, and acted on
- **THEN** the Mini-apps page shows it in Pinned, in Recent, and in All mini-apps, in that section order.

#### Scenario: Modal tile opens overlay without leaving the Apps page
- **WHEN** a modal-capable mini-app's tile is followed
- **THEN** the overlay section becomes visible on the Mini-apps page (no navigation), showing current state with working forms, and the back link hides it again.

#### Scenario: Unified app renders UI plus state
- **WHEN** a unified mini-app page is fetched
- **THEN** bundle UI, live state, and action forms all render in the single panel with no template branch.

#### Scenario: SVG tile renders mark
- **WHEN** a mini-app with a sanitized SVG icon is listed
- **THEN** the tile shows the SVG mark at icon size with no color or animation.

## REMOVED Requirements

### Requirement: Fresh install opens with the App Store

#### Scenario: Fresh install opens with the App Store
- **WHEN** a blank install receives its first shell request
- **THEN** the Apps page shows the App Store tile, and `/` shows its honest no-widgets state (the store is not on the homepage by default).

(Removed: a fresh install no longer seeds the App Store. Replaced by the "Empty Apps page shows two prompts" scenario above. NOTE: `openspec validate` flags this one dropped scenario — a MODIFIED requirement must carry every scenario the current spec has, and a requirement may not appear in both MODIFIED and REMOVED, so there is no supported syntax for dropping a single scenario from a retained requirement. This is the same class of failure as the pre-existing `shell-settings` os-theme delta, which omits two scenarios the canonical spec still has; the failure is recorded here rather than worked around by keeping a false scenario.)
