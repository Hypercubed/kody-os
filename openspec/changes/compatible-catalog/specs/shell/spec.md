# shell — delta

## MODIFIED Requirements

### Requirement: App Store page is a data app

The App Store app page (`GET /apps/app-store`) SHALL be the generic app page for the installed store bundle, not a shell special case. The bundle SHALL render a catalog-only list as defined in the app-registry spec: one row per catalog id, in alphabetical-by-id order, each row showing the app's icon, label, and description, with a status badge where its status is not plain not-installed (not-installed rows carry no badge). The App Store itself appears as a row like any other app; it is not excluded from its own list. The list is unfiltered, so hidden apps appear in it. Rows SHALL be fetched through the shell management API, and install/update/restore SHALL be management API calls (see app-registry), re-rendering the rows on success and showing an error on failure without changing storage for a failed id. A row for an app that is not installed SHALL offer an Add control and no Open link, no Pin, Hide, or Home control, and no Update or Restore control — no launching from the catalog. An installed catalog app with a snapshot SHALL additionally show its update status under the app-registry spec: behind-and-clean and catalog-differing rows offer an Update control; behind-and-modified rows offer a confirmed Overwrite control (see below), not a plain Update control; modified-at-current-version rows offer Restore catalog version; ahead rows offer Restore catalog version, never Update; up-to-date rows offer a Remove control. A row for an installed catalog app without a snapshot SHALL show Installed and offer a confirmed Overwrite control under this scheme. Installed apps with no catalog entry do not appear in the list. The Store SHALL require JavaScript: without it, the page shows a note pointing at agent `add_app`, with no rows. The Store SHALL display the declared catalog source it is reading, labeling a cached manifest as cached with its source. When the store app is not installed, the page SHALL render a short fallback note plus the Store install path, with no rows and no other controls. The Help page SHALL present the App Store as the browser path for installing shipped apps, with the agent/`add_app` path retained for custom apps. While a row action, Update All, or the confirm dialog's Confirm is in flight, its button SHALL be disabled and show a working label naming the action (Adding…, Updating…, Overwriting…, Restoring…, Removing…, Updating all…, Confirming…); when the action settles without re-rendering the rows, the button SHALL be re-enabled with its original label. No rotating or timer-driven spinner is used: the shell forbids animation.

**Amendment (compatible-catalog, Phase 1):** the App Store itself SHALL NOT
appear as a row in its own list. Its update lives in a separate
section above the list, showing the installed Store
`catalogVersion`, the pinned snapshot (tag, and the running
shell version), and the latest compatible Store version found
on the discovery (`main`) base, with one update control.
Update All SHALL NOT include the Store itself. The separate
section carries the Store's own controls with the same
confirmation behaviour as a row (including Remove for a
gated row, per `catalog-robustness-fixes`). The Store SHALL
display the pinned snapshot (tag) instead of the `main` URL
when a listing base is pinned.

**Amendment (compatible-catalog, Phase 2):** when a resolver
plugin is installed, the separate section shows the resolved
snapshot instead of the pinned one, and the Store SHALL
display the resolved snapshot (tag, and stale labelling with
age when the durable snapshot is being served) instead of
the pinned tag. When no resolver plugin is installed, the
section behaves as in Phase 1: the latest compatible Store
is read from the declared (`main`) base, the apps list comes
from the pinned listing base (or from `main` when no listing
base is declared), and no resolved snapshot is claimed.

#### Scenario: Store list shows catalog apps once each, without the Store itself
- **WHEN** the App Store page is fetched with catalog apps installed and uninstalled, plus the App Store itself
- **THEN** every catalog id except `app-store` appears exactly once, in alphabetical-by-id order, with its icon, label, and description, and a status badge where applicable — and `app-store` does not appear in the list.

#### Scenario: Store self-update is a separate section
- **WHEN** the App Store page is fetched
- **THEN** a section above the list shows the installed Store version, the pinned or resolved snapshot, and the latest compatible Store version, with one update control, and Update All does not include the Store.

#### Scenario: Separate section degrades without the plugin
- **WHEN** no resolver plugin is installed
- **THEN** the separate section reads the latest Store from the declared (`main`) base, the apps list comes from the pinned listing base (or from `main` when no listing base is declared), and no resolved snapshot is claimed.

## ADDED Requirements

### Requirement: Split-base routing in the management API (Phase 1, no plugin)

The management API SHALL route by target (see
app-registry, "Pinned listing base"): a Store
self-update uses the discovery base, every other app
uses the listing base when the installed Store declares
one, falling back to the discovery base when it declares
none. This requirement is Phase 1 and is NOT gated
behind the plugins spec.

#### Scenario: App install uses the listing base
- **WHEN** the installed Store declares a `catalog-apps`
  entry pinned to a tag
- **THEN** a management install of any app other than
  `app-store` fetches from that tag's base.

#### Scenario: Store update uses the discovery base
- **WHEN** the installed Store declares a `catalog-apps`
  entry pinned to a tag
- **THEN** a management update of `app-store` fetches
  from the `main` base.

### Requirement: Catalog resolution is plugin-provided, conditional on the plugins spec (Phase 2)

Catalog resolution (reading `catalog/releases.json`, picking
the highest snapshot at or below the running shell, and
installing from that snapshot's SHA base) SHALL be provided
by an installed catalog-resolver plugin through the
interface the plugins spec defines. The shell core SHALL
ship no resolver and no releases-index reader; the pin
lives in the Store definition (Phase 1), not in shell
core. This requirement is conditional on the plugins spec (see
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
  from its pinned listing base as in Phase 1, and nothing
  in the shell claims a resolved snapshot.

#### Scenario: Resolver failure does not take down the shell
- **WHEN** the resolver plugin fails (fetch failure,
  invalid index, invalid snapshot)
- **THEN** the Store degrades to the durable snapshot or
  to installed-only with an honest error, and other apps
  keep working.
