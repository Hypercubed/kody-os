# Daily Feed App Specification

## Purpose

A generic, agent-pushed daily feed viewer for
kody-os. One app, one feed, one entry at a
time, with an empty-state prompt that tells
the user how to get an agent to start pushing.

## Requirements

### Requirement: Daily Feed app definition

The app SHALL have id `daily-feed` (or the id
settled in tasks, section 0, question 1, used
consistently everywhere including the prompt),
label "Daily Feed", category `reading`,
`schemaVersion` 5, and placements `page` in
v1. Its state SHALL be exactly one field:
`feed`, a string, initial `""`, `maxLength`
250000. Its actions SHALL be exactly one:
`set_feed`, arg `value` (string, required,
`maxLength` 250000), effect `set` field
`feed` from arg `value`. It SHALL declare no
capabilities, no other state field, and no
other action in v1.

#### Scenario: Install in a blank store

- **WHEN** the definition is installed via
  `add_app` in a blank store
- **THEN** validation passes, `add_app`
  returns `{ ok: true }`, the app appears in
  `list_apps`, and its state is the empty
  initial state.

#### Scenario: Daily Brief untouched

- **WHEN** the Daily Feed app is installed
  and listed
- **THEN** the `daily-brief` app still lists,
  still renders, and still holds its own
  state, unchanged by this app's install.

### Requirement: RSS viewer, newest first

The bundle SHALL parse the stored `feed` as
RSS XML, with one `<item>` per entry, newest
first, each with `title`, `link`, `pubDate`,
and a plain-text `description`. It SHALL open
on the latest entry. Previous / Next SHALL
step through entries in page, with a nav
grid `auto 1fr auto`, the entry date plus
"N of M" centered, and 48px minimum tap
targets. Dates SHALL be device-local long
form (weekday, month, day, year) when a
pubDate is present. An entry without a
pubDate SHALL show its title, or its
position when it has no title either. The
bundle SHALL NEVER apply a feed-specific
title regex, and SHALL NEVER present an old
entry's date as today's.

#### Scenario: Latest on open, step both ways

- **WHEN** the app is opened with a
  three-entry feed
- **THEN** it shows the newest entry with
  "3 of 3", Previous shows "2 of 3", and
  Next returns to "3 of 3".

#### Scenario: Missing title or date

- **WHEN** an entry has no title and no
  pubDate
- **THEN** it still renders, showing its
  position, without crashing the viewer.

#### Scenario: No-JS fallback

- **WHEN** JavaScript does not run
- **THEN** the shell still shows the `feed`
  field as readable plain text, and the
  viewer does not leave duplicate feed
  content visible alongside itself.

#### Scenario: Bundle renders after state fields

- **WHEN** the bundle script runs
- **THEN** it waits for DOMContentLoaded
  (with a readyState fallback) before
  rendering, and hides the shell-rendered
  state fields after rendering, so only the
  viewer is shown.

### Requirement: Sanitized rendering and linkify

Descriptions SHALL be escaped plain text in
storage and SHALL stay plain text on render.
No feed-supplied HTML, script, iframe, or
inline style SHALL reach the viewer. Linkify
SHALL happen at render time only, escape
first then linkify in one pass: "Source:
<url>" SHALL become exactly one "Source"
link, any other bare URL SHALL become
exactly one link with the URL as its text,
and trailing punctuation SHALL stay outside
the link. No nested anchors SHALL be
produced.

#### Scenario: Source link, single anchor

- **WHEN** an entry description contains
  "Source: https://example.com/article."
- **THEN** the viewer shows exactly one
  "Source" link to that URL, with the
  trailing period outside the link.

#### Scenario: Feed HTML is not rendered

- **WHEN** an entry description contains
  `<script>`, `<iframe>`, or an inline style
- **THEN** none of it is executed, framed,
  or styled; it appears as escaped text or
  not at all.

### Requirement: Empty-state agent prompt

WHEN the feed is empty, or parses to zero
items, the bundle SHALL render, in place of
the viewer, a prompt in plain selectable
text, containing: what is missing (no daily
feed data has been pushed yet); a sentence
the user can give to their agent naming the
app id, the `set_feed` action, the RSS XML
newest-first format, and the 14-entry cap;
and no secret, OTP, code, session token,
cookie, or credential-carrying link. The
bundle SHALL NOT use the Clipboard API and
SHALL NOT render a copy button for the
prompt. WHEN the feed is non-empty but
unparseable, the bundle SHALL render the
same prompt plus a short "stored feed could
not be read" note, and SHALL NOT render raw
XML as if it were entries.

#### Scenario: Empty app shows the prompt

- **WHEN** the app is opened with an empty
  feed
- **THEN** it shows the prompt, naming the
  app id and the `set_feed` action, as
  selectable text with no copy button.

#### Scenario: Unparseable feed shows prompt plus note

- **WHEN** the app is opened with a
  non-empty feed that does not parse
- **THEN** it shows the prompt plus a
  "stored feed could not be read" note,
  and no raw XML is shown as entries.

### Requirement: Push procedure safety

The push procedure SHALL read the current
feed, prepend the new entry (replacing any
entry with the same guid), keep at most 14
entries (or the cap settled in tasks,
section 0, question 2), rebuild the feed
XML, set it with `act` action `set_feed`,
and verify with a final `get_app_state`.
It SHALL refuse an entry over the size
limit settled in tasks, section 0, question
2. If the state read fails, or the existing
feed is non-empty but unparseable, it SHALL
write nothing and exit non-zero, and SHALL
NEVER overwrite the feed with a single entry.

#### Scenario: Prepend, replace, cap

- **WHEN** a new entry is pushed to a
  14-entry feed, and then an entry with an
  existing guid is pushed
- **THEN** the first push drops the oldest
  entry and keeps newest first, and the
  second push replaces in place without
  duplicating the entry.

#### Scenario: Unparseable feed blocks the write

- **WHEN** a push is attempted while the
  stored feed is non-empty but unparseable
- **THEN** the procedure writes nothing, exits
  non-zero, and the stored feed is unchanged.

### Requirement: Hosting constraints

The bundle SHALL meet the same hosting
constraints as every catalog bundle: ES2019
script, one inline `<style>`, inlined assets
only, no external stylesheets or scripts,
system fonts, high-contrast black-on-white,
and an icon that is a plain glyph or
sanitized SVG, never emoji. Its total size
SHALL be under the 256 KiB bundle cap.

#### Scenario: Ceiling scan

- **WHEN** the bundle script is scanned
- **THEN** there are zero hits for `?.`,
  `??`, `replaceAll`, or `.at(`.
