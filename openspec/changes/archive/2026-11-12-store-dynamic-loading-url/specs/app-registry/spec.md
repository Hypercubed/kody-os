# app-registry — delta

## MODIFIED Requirements

### Requirement: Bundle management API

The shell SHALL expose a GET-only management API for bundles declaring
`manageApps`: read store rows, install, update, and restore, reusing
the store install/update paths with snapshot, state-preservation, and
status rules unchanged. The acting app SHALL be named by the request,
and an app whose stored definition does not declare `manageApps`
SHALL receive the feed-style plain 404 with no write and no
capability detail. A behind-modified update, a snapshot-less
overwrite, any restore, and any update adding a capability SHALL
return a needs-confirmation response naming what is at stake, and
SHALL NOT apply until the bundle submits an explicit confirmation.
The management API is a browser path only; agents keep using
`install_from_catalog` / `update_from_catalog`, and the agent is
the installer that surfaces capabilities before calling them.

**Amendment (store-dynamic-loading-url):** the management API SHALL
also expose an `info` action (`GET /manage/info?app=<id>`) under
the same permission rule: the acting app must declare `manageApps`
or the response is the feed-style plain 404. `info` SHALL return
`{ ok: true, listingUrl, discoveryUrl, discoveryRef, pinnedLabel }`
where `listingUrl` is the display URL of the catalog directory the
apps list is read from (the listing base, or the discovery base
when no separate listing base is declared) and `discoveryUrl` is
the display URL of the discovery base (null when the Store
declares no catalog source). GitHub raw bases render in tree form
(`https://github.com/<owner>/<repo>/tree/<ref>/<tail>`, no trailing
slash); non-GitHub bases render as the base URL itself.
`discoveryRef` and `pinnedLabel` are the existing labels from the
Store self-update. `info` SHALL perform no upstream fetch: it
resolves the declared bases locally.

#### Scenario: `info` returns the resolved bases
- **WHEN** the Store calls `GET /manage/info?app=app-store`
- **THEN** the response names the listing URL (`https://github.com/Hypercubed/kody-os/tree/4.2/catalog` for the `4.2` pin) and the discovery URL (`https://github.com/Hypercubed/kody-os/tree/main/catalog` for `main`), with the pinned label `4.2` and the discovery ref `main`.

#### Scenario: `info` from an undeclared app is refused
- **WHEN** an app without declared `manageApps` calls the `info` action
- **THEN** the response is a plain 404, and no definition or state write occurs.

#### Scenario: `info` with no catalog source
- **WHEN** the Store declares no catalog source
- **THEN** `info` returns `listingUrl: null` and `discoveryUrl: null`, and the bundle shows the generic loading text.
