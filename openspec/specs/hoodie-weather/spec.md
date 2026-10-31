# hoodie-weather Specification

## Purpose
The Weather app answers one question from the next hour's forecast —
raincoat, jacket, hoodie, or t-shirt — and establishes how an app resolves
*where*: a declared default place through the feed proxy, a place set directly
by search or MCP, and enhance-only automatic discovery, each degrading to the
next.

## Requirements

### Requirement: Next-hour verdict display

The app SHALL render, for the location in effect, the location label, the
next-hour temperature in °F, a short conditions line, and one of four verdicts
chosen by this classifier applied in order: chance of rain greater than 30%
→ raincoat; otherwise apparent temperature below 51 °F → jacket; otherwise
apparent temperature below 65 °F → hoodie; otherwise → t-shirt. Apparent
temperature SHALL come from the data source when it provides one, otherwise
be computed from temperature and wind speed with the standard wind-chill
formula. The verdict SHALL be shown as one of the four original HoodieWeather
PNG images inlined in the bundle as a data URI — never a remote or external
image file, never an emoji — so the bundle stays self-contained. The app SHALL refresh
only on page load and on an explicit user-triggered Refresh control; it SHALL
NOT poll, timer-refresh, or auto-refresh.

#### Scenario: Hoodie band

- **WHEN** the next hour has at most 30% chance of rain and apparent
  temperature is at least 51 °F and below 65 °F
- **THEN** the verdict is the hoodie icon and the readout shows the
  temperature and conditions for that hour.

#### Scenario: Rain beats temperature

- **WHEN** the next hour has more than 30% chance of rain regardless of
  temperature
- **THEN** the verdict is the raincoat icon.

#### Scenario: Cold and warm edges

- **WHEN** rain is at most 30% and apparent temperature is below 51 °F
- **THEN** the verdict is the jacket icon; and when apparent temperature is
  at least 65 °F the verdict is the t-shirt icon.

#### Scenario: No data, no verdict

- **WHEN** the forecast cannot be retrieved at all
- **THEN** no verdict icon is presented as current; the app shows a loading
  or error state with a Retry control.

#### Scenario: Manual refresh only

- **WHEN** the app has been open for a long time with no interaction
- **THEN** nothing re-fetches on its own; only the Refresh control or a
  navigation triggers a new fetch.

### Requirement: Default place from a declared feed

The definition SHALL declare exactly one default-place forecast feed in
`capabilities.feeds`: an HTTPS URL fixed at install time, never derived from
user input or a request, with a TTL between 600 and 900 seconds and a
`maxBytes` large enough for the payload. The bundle SHALL fetch weather for
the default place through the shell's feed proxy (`GET /feed/hoodie-weather/<name>`).

#### Scenario: Works with no saved place and no device support

- **WHEN** no place has been saved, geolocation is absent or denied, and the
  app renders
- **THEN** it shows the default place's label and verdict using the proxied
  feed, without any user configuration.

#### Scenario: Proxy failure degrades to an error state

- **WHEN** the proxy returns an error and has no cached entry
- **THEN** the app shows an error state with a Retry control rather than a
  stale or blank verdict.

### Requirement: NWS names a discovered place

When the saved place's label is exactly `Current location`, the app SHALL make
one direct request to `https://api.weather.gov/points/{lat},{lon}` and read
`properties.relativeLocation`. On success with a non-empty city or state, the
app SHALL persist the same coordinates with that name as the label through
`set_location`. The request SHALL NOT supply or replace the forecast, SHALL
NOT block the Open-Meteo render, and SHALL fail silently, leaving the label
`Current location`. A default or explicitly named place SHALL NOT contact
`api.weather.gov`. The declared feed SHALL remain Open-Meteo.

#### Scenario: Discovered place gets named

- **WHEN** the saved place came from geolocation and its label is
  `Current location`, and the points request succeeds
- **THEN** the label becomes the response's city and state (for example
  `Louisville, CO`), persisted with the same coordinates, while the forecast
  remains the Open-Meteo verdict already shown.

#### Scenario: Naming failure is silent

- **WHEN** the points request fails or returns no usable relative location
- **THEN** the label stays `Current location`, the forecast is unaffected, and
  no notice or error is shown for the naming attempt.

#### Scenario: No naming request for a named place

- **WHEN** the place is the default or was chosen by search or MCP
- **THEN** no request to `api.weather.gov` is made.

### Requirement: Location set directly

The app SHALL let a place be set directly, without geolocation, through two
equivalent paths: (a) in-bundle city search, where typing queries a CORS-open
geocoding endpoint via bundle direct fetch — the query SHALL NOT be placed in
any declared feed URL — and selecting a result persists the place; and (b) the
`set_location` action with `lat`, `lon`, and `label` args, callable through
MCP `act()` with no UI. The saved place SHALL persist in durable state and
apply on the app page, the modal view, and the home widget. A no-argument
shell action SHALL restore the default place, so the path works without
bundle JavaScript.

#### Scenario: Search and select

- **WHEN** the user opens the location control and types a city name
- **THEN** suggestions appear from the geocoding lookup and selecting one
  saves the place, updates the label, and re-fetches weather for it directly
  without a page navigation.

#### Scenario: Set via MCP

- **WHEN** `act("hoodie-weather", "set_location", { lat, lon, label })` is
  called
- **THEN** the state stores that place and the next render shows it; when an
  arg is missing or out of range the action returns an error and state is
  unchanged.

#### Scenario: Saved place survives reload in every context

- **WHEN** a place is saved and the user later opens the app page, opens it
  as a modal, or views it as a home widget
- **THEN** all three show the saved place, not the default.

#### Scenario: Shell reset stays in sync

- **WHEN** the shell's restore-default action fires — natively in a no-JS
  browser, patched in place in a capable one
- **THEN** state returns to the default place, the no-JS path shows it after
  reload, and the capable path updates the bundle display without navigation
  per the bundle/shell interaction contract.

### Requirement: Automatic location discovery

When no place has been saved, the bundle MAY attempt automatic discovery via
`navigator.geolocation`, at most once per page load. On success it SHALL
persist the coordinates through `set_location` and use them as the effective
place. On absence, denial, timeout, or error it SHALL fall back silently to
the default place: no repeated permission prompts, no error screen, and no
delay or block of the verdict render. Geolocation is an enhancement only —
the app's behavior MUST NOT depend on it, because the permission flow is
untested on the Kindle Scribe and the device has no GPS chip (network-level
accuracy is acceptable).

#### Scenario: Discovery succeeds

- **WHEN** no place is saved, `navigator.geolocation` is present, and the
  browser resolves a position
- **THEN** the coordinates are persisted as the effective place and weather
  for them is fetched directly.

#### Scenario: Discovery unavailable or denied

- **WHEN** the geolocation API is absent, the permission is denied, or the
  lookup fails
- **THEN** the app renders the default place's verdict immediately after the
  fallback, prompts at most once for the session, and shows no error about
  location discovery.

### Requirement: Layer precedence and honest labeling

The effective place SHALL resolve in this order: an explicitly saved place,
then a discovered place, then the default place. The label SHALL always name
the place whose data is actually on screen. When the saved or discovered
place cannot be reached (direct fetch blocked or failing), the app SHALL fall
back to the default place AND show a visible notice that the saved place
could not be reached, with a Retry control — it SHALL NOT present
default-place weather under the saved place's label.

#### Scenario: Direct fetch blocked

- **WHEN** a saved place exists but its direct weather fetch fails
- **THEN** the default place's data is shown under the default place's label
  with a notice naming the unreachable saved place, and Retry attempts the
  saved place again.

#### Scenario: Direct fetch recovers

- **WHEN** Retry succeeds for the saved place
- **THEN** the label and data switch to the saved place and the notice
  clears.

### Requirement: Hosting and state constraints

The bundle SHALL meet the catalog hosting constraints: ES2019 ceiling (no
post-ES2019 syntax or APIs such as `?.`, `??`, `replaceAll`, `.at(`), one
inline `<style>`, all assets inlined, no external stylesheets or scripts,
system fonts, high-contrast black-on-white with no animation or transitions,
zero emojis, a plain-glyph or sanitized-SVG tile icon, and total bundle files
under 256 KiB. All persistence SHALL go through `act()` — bundle writes
resolve against the container's `data-action-base` with `credentials:
'same-origin'`, `?format=json`, and a full-navigation fallback — and the app
SHALL NOT use `localStorage` or cookies as functional storage. No declared
feed URL may ever be built from user input.

#### Scenario: Ceiling and asset scan

- **WHEN** the bundle is scanned
- **THEN** there are zero hits for post-ES2019 syntax, exactly one inline
  `<style>`, no external `src`/`href` references, no emoji, and the files
  total under 256 KiB.

#### Scenario: Feed allowlist integrity

- **WHEN** the definition is validated
- **THEN** it declares exactly one HTTPS feed with a static URL and a
  600–900 second TTL, and no geocoding or weather query string for a
  non-default place appears in any declared feed.

#### Scenario: Install in a blank store

- **WHEN** the definition is installed via `add_app` in a blank store
- **THEN** validation passes, `list_apps` includes `hoodie-weather`, and the
  app page renders with the default place before any place is saved.
