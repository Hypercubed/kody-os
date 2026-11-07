# Spec Delta

## REMOVED Requirements

### Requirement: Help is a catalog app, not a static page

Help stops being a catalog app. It becomes a built-in shell page rendering the shared help text (see the ADDED requirement below); the 303 redirect to `/apps/help` is gone, and the setup-guide pointer the old requirement carried is dropped with the bundle (the shared text does not mention the setup guide).

## ADDED Requirements

### Requirement: Help is a built-in shell page

The shell SHALL serve a built-in Help page at `GET /help` rendering the shared help text — the exact output of the shell's shared empty-state help block (`renderEmptyHelp`), identical on the Help page, the empty Home page, and the empty Apps page: the intro, and the "Add your own apps" and "Install the App Store" prompts (the App Store one pointing at `pkg/catalog/app-store/RECIPE.md` and stopping there). The Help page SHALL omit the empty-state closing line ("Once an app is installed your apps show up on the Apps page."); the empty Home and empty Apps pages keep it. `GET /help` SHALL respond 200; the 303 redirect to `/apps/help` is gone, and `/apps/help` SHALL fall through to the existing unknown-app handling (plain 404). The Help page SHALL NOT list installed apps. Help SHALL NOT appear in the Apps list, Edit mode, pin/hide/home controls, home widgets, or the App Store list. The header SHALL link Help when the page is enabled, as a built-in menu link — not a menu-app link. When Help is disabled via the settings file, `GET /help` SHALL respond 404 and the menu SHALL show no Help link. The Help page is a shell page, not an app page, so it SHALL NOT carry the page-mode expand control. The shared help text SHALL NOT name the Settings app or any other browser path for changing settings; the Settings app is reached from the Apps page like any catalog app.

#### Scenario: Help renders the shared help text
- **WHEN** `/help` is opened with Help enabled
- **THEN** it responds 200 with the shared help text — the same intro and the same two prompts shown on the empty Home page and the empty Apps page, without their closing line.

#### Scenario: Help omits the empty-state closing line
- **WHEN** `/help`, the empty Home page, and the empty Apps page are fetched
- **THEN** the Help page shows no "Once an app is installed" line, and the empty Home and empty Apps pages still show it.

#### Scenario: Help URL no longer redirects
- **WHEN** `/help` is opened
- **THEN** it responds 200 directly; there is no 303 to `/apps/help`.

#### Scenario: Help app URL is unknown
- **WHEN** `/apps/help` is opened
- **THEN** the shell responds 404 (unknown app), and Help appears in no app listing.

#### Scenario: Disabled Help hides page and link
- **WHEN** Help is disabled and `/help` is opened
- **THEN** it responds 404, and no page shows a Help menu link.

#### Scenario: Help page lists no apps
- **WHEN** `/help` is opened with apps installed
- **THEN** it shows the shared help text and no installed-apps list.

#### Scenario: Disabling Help leaves the empty-state text alone
- **WHEN** Help is disabled and the Apps page is fetched with no apps installed
- **THEN** it still shows the shared help text (first-run guidance), with no Edit button.
