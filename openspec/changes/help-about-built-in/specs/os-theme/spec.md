# Spec Delta

## MODIFIED Requirements

### Requirement: Single theme file with defaults

The package SHALL read `pkg/settings.json` at render time for display name, icon reference, page title, header brand, and body background. Every field SHALL be optional; a missing file or missing field SHALL fall back to today's values (name `kody-os`, current icon, current background), so existing installs render byte-identically. All fields SHALL be strings when present except `background`, which accepts a string or grid object: `name` is the header brand and default title suffix, `title` overrides the document-title prefix when non-empty, `icon` is short glyph text or sanitized inline SVG (empty means the current checkerboard mark), and `background` SHALL be one of the closed tokens `desk` (default) or `paper`, or a grid object `{ "grid": [r0..r7] }` of eight integers 0–255 (MSB left) rendered as a repeating black-on-paper tile; invalid grids fall back to `desk`.

The file is the DEFAULT layer only: the effective theme on any request is the file-resolved theme merged with the durable storage override defined below, and the file's values are what a reset restores. A change to the file that is shadowed by a stored override for the same field SHALL NOT change that field's rendered value until the override is cleared.

The file also carries the page-visibility flags `showHelp` and `showAbout` (see Settings file carries page-visibility flags); they ride the same default / override layers as the theme fields.

#### Scenario: Absent file changes nothing

- **WHEN** `settings.json` is absent and no override is stored
- **THEN** every page renders exactly as before, with name `kody-os` and the current icon and background.

#### Scenario: Fork rebrands via one file

- **WHEN** a fork sets name, icon, and background in `settings.json` and republishes, and no override is stored for those fields
- **THEN** the title tag, header brand, and page background show the fork's values on every page with no other file touched.

#### Scenario: Grid background renders tiled
- **WHEN** `background` is a valid 8-row grid object
- **THEN** the page background shows the repeating monochrome tile with no external assets.

#### Scenario: SVG icon renders as the brand mark
- **WHEN** `icon` is sanitized inline SVG
- **THEN** the upper-left header mark shows the SVG in monochrome, with no color or animation.

## ADDED Requirements

### Requirement: Settings file carries page-visibility flags

The settings file (`pkg/settings.json`) SHALL carry two optional boolean fields, `showHelp` and `showAbout`, alongside the theme fields, flat in the same object. Each SHALL default to shown (`true`) when absent. The flags SHALL ride the same two layers as the theme fields: the file value is the default, and the durable override under `kody-os.shell.theme` may set either flag per field; the effective value is the override when present and valid, else the file value, else shown. `get_shell_theme` SHALL return the flags in its `defaults`, `override`, and `effective` splits, and `set_shell_theme` / `reset_shell_theme` SHALL accept them as fields. On the write path, `validateThemeSet` SHALL accept JSON booleans (`true` / `false`) via `set_shell_theme` and the strings `1` (show) / `0` (hide) via the theme set route (field-named param, following the existing `field` + field-named-value pattern); any other value SHALL fail the whole payload with no write, exactly like an invalid theme field. On the read path, a non-boolean stored or file value SHALL fall back to shown for that flag only. Resetting a flag SHALL delete that flag's override, restoring the file value; resetting with no argument SHALL delete the whole override key. Disabling a page SHALL hide exactly that page and its menu link, and nothing else: disabling Help SHALL NOT hide the empty Home / empty Apps help text, which is first-run guidance shown only when no apps are installed, not the Help page.

#### Scenario: Absent flags show both pages
- **WHEN** neither the file nor the override sets `showHelp` or `showAbout`
- **THEN** the Help and About pages render and their menu links show.

#### Scenario: File flag hides its page
- **WHEN** the file sets `showAbout: false` and no override is stored for it
- **THEN** `GET /about` responds 404, no About menu link shows, and the Help page is unaffected.

#### Scenario: Override wins over the file
- **WHEN** the file sets `showHelp: false` and the override sets `showHelp: true`
- **THEN** the Help page renders and its menu link shows.

#### Scenario: Invalid flag value fails the whole payload
- **WHEN** `set_shell_theme` is called with a valid `showHelp` and an invalid `showAbout`
- **THEN** the result is `{ ok: false, error }` and the previously stored override is unchanged.

#### Scenario: Reset restores the file value
- **WHEN** an override for `showHelp` is reset
- **THEN** the next render shows the file value for Help, and a later file edit to `showHelp` shows up without any further reset.

#### Scenario: Disabling Help leaves the empty-state text alone
- **WHEN** Help is disabled and the Apps page is fetched with no apps installed
- **THEN** it still shows the shared help text (first-run guidance), with no Edit button.
