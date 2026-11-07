# Generic RSS Feed App Specification

## Purpose

TBD - created by syncing change generic-rss-feed. Update Purpose after archive.

## Requirements

## ADDED Requirements

### Requirement: Generic RSS feed app in the shipped catalog

The catalog SHALL contain a Generic RSS Feed app (id `generic-rss-feed`, label `Generic RSS Feed`, category `reading`) that reads one RSS or Atom feed live from a URL the user supplies. It SHALL declare no `feeds`/`proxy` capability: the fetch goes through `GET /user-feed/generic-rss-feed` (see User-supplied feed URL route). Its `stateSchema` SHALL be one field, `feedUrl` (string, maxLength 2048, initial `""`); its `actions` SHALL be one action, `set_feed_url`, which sets the URL, validates it as a bare HTTPS URL with no credentials before writing, fails with no write on an invalid URL, and clears the URL when given `""`. Its `installMode` SHALL be `recipe-or-json` and its `catalogVersion` SHALL be 1. It SHALL NOT depend on any registry change, effect op, server state, or MCP surface change beyond the user-feed route.

#### Scenario: Unattended install lands unconfigured

- **WHEN** the app is installed from the catalog without an agent
- **THEN** it installs from the JSON alone and lands unconfigured with the setup prompt.

#### Scenario: No URL set shows the setup prompt

- **WHEN** the app is opened with no URL set
- **THEN** it shows the Help-style setup prompt naming the app id, the `set_feed_url` action, and a blank `RSS feed URL: [paste the RSS feed URL here]`.

#### Scenario: URL set hides the prompt and fetches live

- **WHEN** a URL has been set
- **THEN** the prompt hides, the viewer header shows the configured URL/host as plain text, and the app fetches the feed live through `GET /user-feed/generic-rss-feed`.

#### Scenario: Invalid URL fails the action with no write

- **WHEN** `set_feed_url` is called with an http URL or a URL carrying credentials
- **THEN** the action fails and nothing is written.

#### Scenario: Empty string clears the URL

- **WHEN** `set_feed_url` is called with `""`
- **THEN** the URL clears and the app returns to its empty state.

#### Scenario: Feed loads newest first

- **WHEN** the feed loads
- **THEN** the app shows the latest entry with Previous/Next, newest first, at most 14 items; each item shows the title (HTML-escaped), a link, and a plain-text description stripped of markup and truncated to 350 characters; no feed-supplied HTML, script, or inline style reaches the page; tapping an item opens the source. Position text shows the device-local date.

#### Scenario: Feed failure is recoverable

- **WHEN** the live fetch fails with items already rendered
- **THEN** the rendered items stay and an error with a retry is shown; when the live fetch fails with nothing rendered and no device-local cache, an error state with a retry is shown instead.

#### Scenario: Widget shows the latest item only

- **WHEN** the app is shown as a Home widget
- **THEN** it shows the latest item only; navigation and Refresh hide in the widget.

### Requirement: Generic RSS feed hosting constraints

The app SHALL fit the catalog bundle constraints (entry `index.html`, relative `.html`/`.js`/`.css` only, within the 256 KiB cap) and the 16 MiB storage budget. It SHALL NOT add any shell route beyond `GET /user-feed/<app>`, SHALL NOT store the fetched feed in app state (the server-side route cache and the device-local cache are the durability layers), and SHALL render within the Kindle ceiling (Chromium 75 / ES2019) like the other feed apps.

#### Scenario: Bundle fits the cap

- **WHEN** the definition is submitted to `add_app`
- **THEN** it validates and installs, satisfying the bundle manifest shape and the 256 KiB cap.
