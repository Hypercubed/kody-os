## ADDED Requirements

### Requirement: User-supplied feed URL route

The shell SHALL serve a user-supplied feed URL for one app at `GET /user-feed/<app>` (GET only, inside the device gate, next to `/feed/` and `/proxy/`). The route takes only the app id from the request: the handler (`serveUserFeed` in `pkg/src/feeds.ts`, mirroring `serveFeed`) reads the app's stored state, takes the `feedUrl` field, and fetches it. The route SHALL NOT take a URL from the request: no query parameter, body field, or header may supply a URL, and a URL supplied in the request SHALL be ignored. The stored URL SHALL be validated at write time (by the `set_feed_url` action) and re-validated at serve time: a bare HTTPS URL with no credentials and a non-empty hostname, the same rule as declared upstream entries. No URL set, or a stored URL that fails serve-time validation, SHALL be a plain 404. The fetch SHALL reuse the declared-feed machinery: 8 s timeout, User-Agent `kody-os-feed-proxy/1`, TTL 3600 s, maxBytes 65536, storage cache key `kody-os.feeds.cache.<app>.rss`, response `application/rss+xml` with an `X-Feed-Cache: hit | miss | stale` header; a fresh cache entry SHALL be served without an upstream fetch, an upstream failure SHALL serve a stale entry if one exists, and an upstream failure with no cache SHALL be a plain 502 (`feed unavailable`). The app using this route SHALL declare no `feeds`/`proxy` capability for the user-supplied URL, so the Store discloses no publisher host for it; the app's own page SHALL show the configured host from state. Changing the stored URL is a state write: it SHALL NOT change the definition fingerprint, the install snapshot, or the update status, and SHALL NOT require update confirmation. The trust decision for the URL is the user's own, not the publisher's.

#### Scenario: No URL set is a 404

- **WHEN** the route is called for an app with no URL set
- **THEN** it returns a plain 404, the same as an undeclared feed.

#### Scenario: URL set returns the feed, cached within the TTL

- **WHEN** the route is called for an app with a valid URL set
- **THEN** it returns the fetched feed with `X-Feed-Cache: miss` on the first call and `X-Feed-Cache: hit` on a repeat call within the TTL, without an upstream fetch.

#### Scenario: Upstream failure serves stale, else 502

- **WHEN** the upstream fetch fails and a stale cache entry exists
- **THEN** the stale body is served with `X-Feed-Cache: stale`; when no cache entry exists, the route returns a plain 502.

#### Scenario: URL in the request is ignored

- **WHEN** the route is called with a URL supplied in the request (for example a `?url=` query parameter)
- **THEN** the supplied URL is ignored and only the stored URL is fetched.

#### Scenario: Credentialed or http URL in state is a 404

- **WHEN** the stored URL carries credentials or uses http
- **THEN** serve-time validation rejects it and the route returns a plain 404.

#### Scenario: Changing the URL changes no definition state

- **WHEN** the stored feed URL changes
- **THEN** the definition fingerprint, the install snapshot, and the update status are unchanged, and no update confirmation is required.

## MODIFIED Requirements

### Requirement: Recipe install mode

A catalog definition MAY carry `installMode`: `"json"`, `"recipe-only"`, or `"recipe-or-json"`. Absent means `"json"` — unattended install from the JSON alone. `"recipe-only"` means the app MUST be installed via its recipe: it still appears in the App Store list, but the Store shows the recipe prompt (selectable text for the user to supply to their agent) in place of one-tap install. `"recipe-or-json"` means the app has a non-trivial recipe for full configuration AND can be installed unattended from JSON: in the Store it installs without the prompt message (one-tap install works); it lands unconfigured and the app's built-in empty-state prompt guides setup, while the recipe fully configures it at install time. Only an app with a non-trivial recipe SHALL carry `installMode`; most definitions SHALL carry no such property. A definition with `installMode` present SHALL fail validation unless the value is `"json"`, `"recipe-only"`, or `"recipe-or-json"`. The canonical stored definition SHALL preserve `installMode` through `add_app` normalization, and `installMode` SHALL be excluded from the definition fingerprint, exactly like `catalogVersion`, so adding it SHALL NOT change any installed app's fingerprint, snapshot, or update status.

#### Scenario: Unattended install is the default

- **WHEN** a catalog definition carries no `installMode`
- **THEN** it installs from the JSON alone with no recipe step, and its listing reports install mode `json`.

#### Scenario: Recipe-only app declares its mode

- **WHEN** a catalog definition carries `"installMode": "recipe-only"`
- **THEN** it validates, its stored definition preserves the field, its listing reports install mode `recipe-only`, and the Store lists it with the recipe prompt in place of one-tap install.

#### Scenario: Recipe-or-json app declares its mode and installs unattended

- **WHEN** a catalog definition carries `"installMode": "recipe-or-json"`
- **THEN** it validates, its stored definition preserves the field, its listing reports install mode `recipe-or-json`, and it installs unattended from the JSON alone without the prompt message, landing unconfigured with its built-in empty-state prompt guiding setup.

#### Scenario: No app is recipe-only today

- **WHEN** the catalog is listed
- **THEN** no entry reports install mode `recipe-only`; `daily-feed`, `generic-feed`, and `generic-rss-feed` report `recipe-or-json` and the other 16 report `json`.

#### Scenario: Invalid install mode fails validation

- **WHEN** a definition carries an `installMode` other than `"json"`, `"recipe-only"`, or `"recipe-or-json"`
- **THEN** validation rejects it.

#### Scenario: installMode does not change fingerprints

- **WHEN** the fingerprint of an app's definition is computed with and without its `installMode` field
- **THEN** the two fingerprints are identical, and no installed copy of the app changes update status.

### Requirement: Declared capabilities

An app definition MAY declare `capabilities`: `feeds` (up to 8 allowlisted HTTPS upstream feeds, as before), `proxy` (up to 8 allowlisted generic HTTPS upstreams, same limits as feeds, served via `GET /proxy/<app>/<name>`), and `manageApps` (boolean). Unknown capability keys, non-boolean `manageApps`, non-HTTPS or credentialed upstream URLs, duplicate upstream names, and out-of-range TTL/size values SHALL fail validation with no write. Sanitization SHALL store the canonical defaults-applied form. Store rows SHALL disclose declared capabilities in plain words (manageApps as a statement, feed and proxy hosts listed) before install. An update adding a capability — `manageApps`, a new feed host, or a new proxy host — SHALL require confirmation naming the additions; removing a capability or changing only TTL/size parameters SHALL NOT. A user-supplied feed URL is not a declared capability: it lives in the app's own state and is fetched by the user-feed route (see User-supplied feed URL route), so it is never disclosed as a publisher host and changing it never requires update confirmation.

#### Scenario: Unknown capability key fails validation

- **WHEN** a definition declares an unknown capability key
- **THEN** validation fails and nothing is written.

#### Scenario: Capability expansion requires confirmation

- **WHEN** a Store update would add a new proxy host
- **THEN** the API returns needs-confirmation naming that host, and declining changes nothing.

#### Scenario: User-supplied URL is not a capability addition

- **WHEN** the stored feed URL of an installed app changes
- **THEN** no confirmation is required, the definition fingerprint is unchanged, and the update status does not change.
