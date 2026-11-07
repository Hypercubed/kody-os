# Spec Delta

## MODIFIED Requirements

### Requirement: Pinned section

The shell SHALL render a Pinned section above Recent listing pinned apps in pin order. A pinned app that is also hidden SHALL still appear in Pinned. An empty pinned list SHALL omit the section entirely. Pinned tiles SHALL span two grid columns (three per row at full width) at the standard tile height, with the icon fixed left and the label plus description stacked right. Every tile link on the Apps screen (Pinned, Recent, All apps) SHALL carry the app description as a `title` tooltip.

#### Scenario: Hidden pinned app stays visible in Pinned only
- **WHEN** a pinned app is hidden via Apps Edit
- **THEN** it remains in the Pinned section and disappears from the All apps section.

#### Scenario: Pinned tiles are double-wide with descriptions
- **WHEN** the Apps page renders with pinned apps
- **THEN** each pinned tile is twice as wide as a standard tile at the same height, showing the icon left and label plus description right, three per row.

#### Scenario: Tiles carry tooltips
- **WHEN** any Apps-screen tile is inspected
- **THEN** its link carries a `title` attribute with the app description, with no visual change.

### Requirement: App Store page is a data app

The App Store app page (`GET /apps/app-store`) SHALL be the generic app page for the installed store bundle, not a shell special case. The bundle SHALL render a catalog-only list as defined in the app-registry spec: one row per catalog id, in alphabetical-by-id order, each row showing the app's icon, label, and description, with a status badge where its status is not plain not-installed (not-installed rows carry no badge). The App Store itself appears as a row like any other app; it is not excluded from its own list. The list is unfiltered, so hidden apps appear in it. Rows SHALL be fetched through the shell management API, and install/update/restore SHALL be management API calls (see app-registry), re-rendering the rows on success and showing an error on failure without changing storage for a failed id. A row for an app that is not installed SHALL offer an Add control and no Open link, no Pin, Hide, or Home control, and no Update or Restore control — no launching from the catalog. An installed catalog app with a snapshot SHALL additionally show its update status under the app-registry spec: behind-and-clean and catalog-differing rows offer an Update control; behind-and-modified rows offer a confirmed Overwrite control (see below), not a plain Update control; modified-at-current-version rows offer Restore catalog version; ahead rows offer Restore catalog version, never Update; up-to-date rows offer a Remove control. A row for an installed catalog app without a snapshot SHALL show Installed and offer a confirmed Overwrite control under this scheme. Installed apps with no catalog entry do not appear in the list. The Store SHALL require JavaScript: without it, the page shows a note pointing at agent `add_app`, with no rows. When the store app is not installed, the page SHALL render a short fallback note plus the Store install path, with no rows and no other controls. The Help page SHALL present the App Store as the browser path for installing shipped apps, with the agent/`add_app` path retained for custom apps.

#### Scenario: Behind-and-clean row offers update
- **WHEN** an installed catalog app matches its snapshot at a lower version than the catalog
- **THEN** its row shows Update, and submitting it updates the app and re-renders the rows.

#### Scenario: Snapshot-less row offers Overwrite
- **WHEN** an installed catalog app has no snapshot
- **THEN** its row shows Installed and offers Overwrite, and confirming replaces its definition with the catalog copy and records a snapshot.

#### Scenario: Store list shows catalog apps once each
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus an installed app with no catalog entry, plus the App Store itself
- **THEN** every catalog id appears exactly once, in alphabetical-by-id order, with its icon, label, and description, and a status badge where applicable — including `app-store` itself — and the installed app with no catalog entry does not appear.

#### Scenario: Catalog-only row has no launch control
- **WHEN** a catalog app that is not installed is rendered in the Store list
- **THEN** its row offers Add and no link to its app page, since there is nothing installed to open.

#### Scenario: Store requires JavaScript
- **WHEN** the App Store page is fetched with JavaScript unavailable
- **THEN** it shows a note pointing at agent `add_app`, with no rows, and changes nothing.

#### Scenario: Installed rows offer no Install or launcher control
- **WHEN** an installed catalog app's row is rendered
- **THEN** it shows its status and no Add form for that id, and no Pin, Hide, or Home control.

#### Scenario: Unknown install id is a clean error
- **WHEN** an install is requested for an unknown id
- **THEN** the Store shows an error, the rows still render, and storage is unchanged.

#### Scenario: Store page keeps shell constraints
- **WHEN** the App Store page is fetched
- **THEN** it carries the normal chrome, exactly one `<style>` block, zero external stylesheets, and no mutating POST form.
