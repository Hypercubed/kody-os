# Spec Delta

## NEW Requirements

### Requirement: News app in the shipped catalog

The catalog SHALL contain a News app (id `news`) that renders
a multi-section headline list entirely from bundle JavaScript,
with no persistent state: `stateSchema` is `{ type: "object",
initial: {}, fields: {} }` and `actions` is `{}`. It SHALL NOT
depend on any registry change, effect op, server state, shell
route change, or MCP surface change.

#### Scenario: World on open

- **WHEN** the News app is opened
- **THEN** it shows the World section ("Top Headlines") with
  the device-local date in long form (weekday, month, day,
  year), without requiring any account or sign-in.

#### Scenario: Six sections, one feed each

- **WHEN** a section button is tapped
- **THEN** the section title and active button update, and the
  list is replaced by that section's feed, fetched through
  `GET /feed/news/<name>` for the matching declared feed
  (`world`, `technology`, `business`, `science`, `arts`,
  `finance`), in feed order.

#### Scenario: At most ten headlines, plain-text summaries

- **WHEN** a section's feed is rendered
- **THEN** at most the first 10 items appear; each item shows
  the headline (HTML-escaped), a summary that is the feed
  description stripped to plain text and truncated to 350
  characters, and a thumbnail only when the feed supplies one.
  No feed-supplied HTML, script, or inline style reaches the
  list.

#### Scenario: Loading never shows stale headlines as current

- **WHEN** a section fetch is in progress
- **THEN** a loading state is shown and the previous section's
  articles are not left on screen as if they were current.

#### Scenario: Article opens at the source

- **WHEN** a headline is tapped
- **THEN** the source article opens externally (host browser
  view / new tab). The bundle SHALL NOT fetch article content
  and SHALL NOT call an external readability worker.

#### Scenario: Feed failure is recoverable

- **WHEN** a section feed fails or the proxy returns an error
- **THEN** the list is replaced by an error state
  ("Could not fetch the wires for this section." plus a
  connection hint) with a Retry button that re-fetches the
  current section.

#### Scenario: Stateless install

- **WHEN** the News definition is installed via `add_app` in a
  blank store
- **THEN** validation passes, the app appears in `list_apps`,
  and its state is the empty initial state.

### Requirement: News hosting constraints

The News bundle SHALL meet the same hosting constraints as
every catalog bundle: ES2019 script, one inline `<style>`,
inlined assets only, no external stylesheets or scripts,
system fonts, high-contrast black-on-white, and an icon that
is a plain glyph or sanitized SVG, never emoji. Its feeds
SHALL be declared in `capabilities.feeds` (at most 8; 6 used),
HTTPS only, with a 900-second proxy TTL, and the bundle SHALL
NOT take a feed URL from user input or from a request.

#### Scenario: Ceiling scan

- **WHEN** the bundle script is scanned
- **THEN** there are zero hits for `?.`, `??`, `replaceAll`,
  `.at(`, or template literals.

#### Scenario: Feed declaration limit

- **WHEN** the definition is validated
- **THEN** it declares exactly six feeds, all HTTPS, and
  validation passes under the registry's feeds rules.

## Open Questions (recorded, not decided by this change)

- If a BBC HTTPS feed variant does not serve RSS, what HTTPS
  source replaces that section? (Task 2.1 must answer this
  before implementation is treated as done.)
- Does the future reader change add a shell reader route, or
  reuse another extraction service? That decision belongs to
  the reader change (Tasks §3), not this one.
- Should sections cache per section for the session, or
  always re-fetch through the proxy on switch? V1 default in
  this change: re-fetch through the proxy; the proxy's TTL
  is the only cache.
