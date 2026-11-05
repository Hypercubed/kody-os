# Spec Delta

## Purpose

Give sanitized inline SVG tile icons a shared
source folder, so a catalog icon is copied
from a file under one spec instead of drawn
fresh in each bundle's JSON.

## MODIFIED Requirements

### Requirement: Sanitized inline SVG icons

The sanitization rule from the archived
`2026-10-27-svg-icons` change is unchanged:
validation SHALL allowlist elements `svg,
path, circle, rect, line, polyline, polygon,
g, title` and geometry plus monochrome
fill / stroke attributes only, and SHALL
reject `script, foreignObject, use, image,
style`, `on*` handlers, external refs, and
animations. In addition, for the 10 migrated
catalog icons (about, calculator, calendar,
clock, counter, eight-ball, hoodie-weather,
mac-puzzle, news, probe), the icon string
SHALL match the corresponding file in
`pkg/icons/` after whitespace normalization.
Glyph icons are unchanged by this requirement.

#### Scenario: Migrated icon matches its file

- **WHEN** the catalog harness checks a
  migrated app's bundle
- **THEN** its `icon` string matches
  `pkg/icons/<app-id>.svg` (whitespace
  normalized), and a mismatch fails the
  harness.

#### Scenario: Hostile SVG is still rejected

- **WHEN** `add_app` receives an icon with
  script, external ref, or event handler
- **THEN** it returns `{ ok: false, error }`
  naming the problem and writes nothing,
  exactly as before this change.

## ADDED Requirements

### Requirement: Shared icon folder spec

`pkg/icons/` SHALL contain one file per
shared icon, named in kebab-case (app-id
names for single-app tile icons, function
names for genuinely shared icons), each
conforming to: `viewBox="0 0 24 24"`, no
`width` or `height` attributes, `fill="none"`
line art (default-black solids only where
meant), `stroke="currentColor"`, stroke
width 1.6, round caps and joins, a `<title>`,
and no color, gradients, animation, `style`,
script, external refs, or `<use>`. The folder
SHALL carry a `README.md` stating this spec
in full, and every file in it SHALL pass the
folder validation in the harness. The folder
SHALL NOT be served or fetched at render
time: tile icons are still rendered from the
definition string, inlined by the shell.

#### Scenario: A new icon follows the folder spec

- **WHEN** an author adds a tile icon from
  `pkg/icons/` following its README
- **THEN** the icon validates, renders in
  `.tile-icon` at 1.5rem in `currentColor`,
  and the catalog harness passes.

#### Scenario: An out-of-spec file fails

- **WHEN** a file in `pkg/icons/` carries a
  fixed width, a color, a gradient, or a
  rejected element
- **THEN** the folder validation fails the
  harness, naming the file and the rule.

### Requirement: Glyph icons unchanged

The 6 glyph tile icons (app-store, arrow-game,
cellular-playground, help, three-bit-art,
xkcd) SHALL remain plain-text glyphs in this
change. Converting a glyph to SVG is a
separate per-icon change with its own
`catalogVersion` increment, not part of this
folder's migration.

#### Scenario: Glyph icon still renders as a glyph

- **WHEN** the Apps page renders an app with
  a glyph icon after this change
- **THEN** the glyph renders escaped exactly
  as before, and no folder file is required
  for it.
