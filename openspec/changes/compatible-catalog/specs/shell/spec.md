# shell — delta

## MODIFIED Requirements

### Requirement: App Store page is a data app

The App Store app page (`GET /apps/app-store`) SHALL be the generic app page for the installed store bundle, not a shell special case. The bundle SHALL render a catalog-only list as defined in the app-registry spec: one row per catalog id, in alphabetical-by-id order, each row showing the app's icon, label, and description, with a status badge where its status is not plain not-installed (not-installed rows carry no badge). The App Store itself appears as a row like any other app; it is not excluded from its own list. The list is unfiltered, so hidden apps appear in it. Rows SHALL be fetched through the shell management API, and install/update/restore SHALL be management API calls (see app-registry), re-rendering the rows on success and showing an error on failure without changing storage for a failed id. A row for an app that is not installed SHALL offer an Add control and no Open link, no Pin, Hide, or Home control, and no Update or Restore control — no launching from the catalog. An installed catalog app with a snapshot SHALL additionally show its update status under the app-registry spec: behind-and-clean and catalog-differing rows offer an Update control; behind-and-modified rows offer a confirmed Overwrite control (see below), not a plain Update control; modified-at-current-version rows offer Restore catalog version; ahead rows offer Restore catalog version, never Update; up-to-date rows offer a Remove control. A row for an installed catalog app without a snapshot SHALL show Installed and offer a confirmed Overwrite control under this scheme. Installed apps with no catalog entry do not appear in the list. The Store SHALL require JavaScript: without it, the page shows a note pointing at agent `add_app`, with no rows. The Store SHALL display the declared catalog source it is reading, labeling a cached manifest as cached with its source. When the store app is not installed, the page SHALL render a short fallback note plus the Store install path, with no rows and no other controls. The Help page SHALL present the App Store as the browser path for installing shipped apps, with the agent/`add_app` path retained for custom apps. While a row action, Update All, or the confirm dialog's Confirm is in flight, its button SHALL be disabled and show a working label naming the action (Adding…, Updating…, Overwriting…, Restoring…, Removing…, Updating all…, Confirming…); when the action settles without re-rendering the rows, the button SHALL be re-enabled with its original label. No rotating or timer-driven spinner is used: the shell forbids animation.

**Amendment (compatible-catalog):** the App Store itself SHALL NOT
appear as a row in its own list. Its update lives in a separate
section above the list, showing the installed Store
`catalogVersion`, the resolved snapshot (tag, and the running
shell version), and the latest compatible Store version found,
with one update control. Update All SHALL NOT include the Store
itself. The separate section carries the Store's own controls
with the same confirmation behaviour as a row (including
Remove for a gated row, per `catalog-robustness-fixes`). When
no resolver plugin is installed, the separate section degrades
to the current behaviour: the latest compatible Store is read
from the declared (`main`) base, the apps list comes from
`main`, and no resolved snapshot is claimed. The Store SHALL
display the resolved snapshot (tag, and stale labelling with
age when the durable snapshot is being served) instead of the
`main` URL when a snapshot is resolved.

#### Scenario: Store list shows catalog apps once each, without the Store itself
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus the App Store itself
- **THEN** every catalog id except `app-store` appears exactly once, in alphabetical-by-id order, with its icon, label, and description, and a status badge where applicable — and `app-store` does not appear in the list.

#### Scenario: Store self-update is a separate section
- **WHEN** the App Store page is fetched
- **THEN** a section above the list shows the installed Store version, the resolved snapshot, and the latest compatible Store version, with one update control, and Update All does not include the Store.

#### Scenario: Separate section degrades without the plugin
- **WHEN** no resolver plugin is installed
- **THEN** the separate section reads the latest Store from the declared (`main`) base, the apps list comes from `main`, and no resolved snapshot is claimed.

## ADDED Requirements

### Requirement: Catalog resolution is plugin-provided, conditional on the plugins spec

Catalog resolution (reading `catalog/releases.json`, picking
the highest snapshot at or below the running shell, and
installing from that snapshot's SHA base) SHALL be provided
by an installed catalog-resolver plugin through the
interface the plugins spec defines. The shell core SHALL
ship no resolver, no pin, and no releases-index reader.
This requirement is conditional on the plugins spec (see
proposal.md, Dependencies): its manifest shape, route
namespace, storage namespace, and lifecycle are that
spec's call, and if that spec settles a different
interface, this requirement follows it. A plugin failure
SHALL NOT take down the whole shell: a resolver failure
SHALL degrade to the durable last-good snapshot (see
app-registry) or to installed-only with an honest error,
and other apps SHALL keep working. The shell SHALL NOT
auto-install a plugin, and the Store SHALL NOT one-click
install a plugin.

#### Scenario: No plugin means no resolution
- **WHEN** no resolver plugin is installed
- **THEN** the shell ships no resolver, the Store reads
  from its declared base as today, and nothing in the
  shell claims a resolved snapshot.

#### Scenario: Resolver failure does not take down the shell
- **WHEN** the resolver plugin fails (fetch failure,
  invalid index, invalid snapshot)
- **THEN** the Store degrades to the durable snapshot or
  to installed-only with an honest error, and other apps
  keep working.
