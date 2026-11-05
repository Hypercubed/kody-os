# Send Link App Specification

## Purpose

A kody-os app that collects links sent from
any browser via a bookmarklet, and shows
them most-recent-first for opening later,
including on the Kindle Scribe. This spec
delta is new: there is no existing
send-link spec to modify.

## Requirements

### Requirement: Send Link app definition

The app SHALL be defined as a data app with
no shell route, no MCP export, and no
capability declaration.

- Id: `send-link`.
- Label: "Send Link".
- Category: `utilities`.
- `schemaVersion`: 5.
- Placements: `page` only.
- `ui.hideState`: true.
- State field `links`: array of strings,
  initial `[]`, `maxItems` 500.
- Action `send`: one required string arg
  `entry`; one effect, `append` field
  `links` from arg `entry`, `cap` 500,
  `maxEntryBytes` 2048.
- Action `clear`: no args; one effect,
  `set` field `links` to `[]`.
- `ui.actions` SHALL list `clear` only.
  `send` takes an argument and SHALL NOT
  appear as a shell button.

#### Scenario: Install in a blank store

- WHEN the definition is installed via
  `add_app` into a store with no `send-link`
  app
- THEN `add_app` returns `{ ok: true, id:
  "send-link" }`, `list_apps` includes
  `send-link`, and `get_app_state` returns
  `{ links: [] }`.

#### Scenario: Existing apps untouched

- WHEN `send-link` is installed, sent to,
  or cleared
- THEN no other app's definition or state
  changes, and no shell route, capability,
  or MCP export is added or modified.

### Requirement: Append via the GET-action path

A send SHALL be a top-level navigation to
the app's GET-action URL, in the Probe
pattern, with the entry as one encoded
string argument. The action SHALL apply
atomically: one action, one appended entry,
no read-modify-write in the sender.

- URL form:
  `/apps/send-link?action=send&entry=<encoded>`
  with the app base derived from the app
  page's location, never hardcoded.
- The entry SHALL be JSON text with keys
  `t` (ISO 8601 timestamp), `title`, and
  `url`. Unknown keys SHALL be ignored by
  the bundle.
- A send that fails validation (for example
  an entry over `maxEntryBytes`) SHALL
  return `{ ok: false, error }` and SHALL
  leave stored state untouched.
- A send from a browser with no kody-os
  session SHALL save nothing.

#### Scenario: Send lands on the list, newest on top

- WHEN a signed-in browser navigates to
  the send URL with a well-formed entry
- THEN the browser lands on the app page,
  the list renders with the new entry on
  top, and a second send appears above the
  first (no dedupe).

#### Scenario: Over-cap entry rejected, state unchanged

- WHEN a send carries an entry over 2048
  bytes
- THEN the action rejects it and the stored
  list is byte-identical to before the
  send.

#### Scenario: Unsigned send saves nothing

- WHEN a browser with no kody-os session
  follows a send URL
- THEN it lands on the Locked page and the
  stored list is unchanged.

### Requirement: Viewer, most-recent-first

The bundle SHALL render stored entries in
reverse storage order (newest first),
after DOMContentLoaded with a readyState
fallback, reading state bridge-first,
seed-second, span-fallback, and hiding the
state fields once rendered.

- Each entry SHALL show its title, its URL
  text, and its timestamp in device-local
  form.
- Tap targets SHALL be at least 48px.
- The bundle SHALL be ES2019, system fonts
  only, zero emojis.

#### Scenario: Order and fields

- WHEN the stored list is `[A, B, C]` in
  append order
- THEN the page shows C, then B, then A,
  each with its title, URL, and timestamp.

#### Scenario: Plain entries render as text

- WHEN an entry is not valid JSON, or
  parses without a usable URL
- THEN the bundle renders it as plain text
  with no link, and the rest of the list
  still renders.

#### Scenario: No-JS fallback

- WHEN JavaScript does not run
- THEN the shell still shows the `links`
  field as readable plain text (the raw
  stored strings), and no bundle viewer or
  install block is shown. That is the honest
  no-JS state, not a second viewer to
  maintain.

#### Scenario: Bundle renders after state fields

- WHEN the page loads
- THEN the bundle does not render an empty
  list before state is available, and the
  state fields are hidden once the viewer
  has rendered (no duplicate content).

### Requirement: Sanitized rendering and scheme allowlist

The bundle SHALL escape all entry text
before inserting it into the page, and
SHALL create an anchor only when the
parsed URL's scheme is exactly `http` or
`https`.

#### Scenario: Well-formed entry, single anchor

- WHEN an entry has an `https` URL
- THEN its title renders as exactly one
  anchor whose href is that URL, and the
  URL text is shown escaped, not wrapped
  in a second anchor.

#### Scenario: Dangerous schemes are text, not links

- WHEN an entry's URL scheme is
  `javascript:`, `data:`, `file:`, or any
  scheme other than `http`/`https`
- THEN the entry renders as plain text
  with no anchor.

#### Scenario: Entry HTML is not rendered

- WHEN an entry title or URL contains HTML
  markup, script tags, quotes, or `&`
- THEN the page shows those characters as
  text and executes nothing from the entry.

### Requirement: Bookmarklet install block

The app page SHALL render a bookmarklet
install block built from the page's own
location, with no hardcoded host and no
secret, OTP, code, or session token in it.

- The block SHALL contain a draggable link
  whose href is the `javascript:` snippet,
  the same code as selectable text (no copy
  button), desktop install steps (drag to
  the bookmarks bar), and mobile install
  steps (create a bookmark, edit its URL
  to the code).
- The block SHALL state, in plain words,
  that the sending browser must already be
  signed into kody-os, and that a send
  opens a new tab and does not return to
  the original page.
- The bookmarklet SHALL open the send URL
  in a new tab, leaving the original page
  untouched in its tab.
- The bookmarklet SHALL truncate the title,
  never the URL, so the encoded entry fits
  `maxEntryBytes`.

#### Scenario: Empty app shows the install block

- WHEN the list is empty
- THEN the page shows the install block in
  place of the list, with the draggable
  link, the selectable code, both sets of
  install steps, and both requirements.

#### Scenario: Non-empty app still offers install

- WHEN the list is non-empty
- THEN the page shows the list first and a
  compact install section under it, with
  the same draggable link and code.

#### Scenario: Bookmarklet targets its own install

- WHEN the install block is rendered on the
  mock preview
- THEN its target is the mock host; and
  WHEN rendered on the hosted install
- THEN its target is the hosted host.
  Neither hardcodes the other.

### Requirement: Clear-all

The `clear` action SHALL empty the list,
and the app SHALL accept new sends after a
clear.

#### Scenario: Clear empties, sends resume

- WHEN the list holds entries and `clear`
  runs
- THEN `get_app_state` returns
  `{ links: [] }`, the page shows the empty
  state with the install block, and a later
  `send` appears as the only entry.

### Requirement: Hosting constraints

The definition and bundle SHALL fit the
kody-os hosting constraints: bundle under
256 KiB, state within the 16 MiB package
storage budget, ES2019 and Chromium 80
compatible, system fonts only, zero emojis.

#### Scenario: Ceiling scan

- WHEN the bundle is scanned for ceiling
  violations
- THEN it contains no `?.` / `??`, no
  external assets, no emojis, no non-system
  fonts, and its size is under 256 KiB;
  and the maximum possible `links` state
  (500 entries at 2048 bytes) is about
  1 MiB, inside the package budget.
