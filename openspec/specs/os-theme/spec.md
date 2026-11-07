# OS Theme

## Purpose

A single file that rebrands the OS for forks: name, icon, background, and title, edited at fork time with no code spelunking, shipped with the package.

## Requirements

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

### Requirement: Durable per-field theme override

The shell SHALL support a durable storage override of the theme, stored under the key `kody-os.shell.theme` in `packageStorage()`, independent of the bundled file so that it survives republishes. The stored value SHALL be a partial theme object: only the fields present are overrides, and an absent field SHALL leave the file value in force. The effective theme for a request SHALL be resolved per field: stored override if present and valid, else the file-resolved value, else the stock fallback.

The write path SHALL validate the whole set payload first and write nothing on any invalid field, unknown key, or invalid value. The read path SHALL be defensive: corrupt stored JSON SHALL read as no override, and an invalid stored field SHALL fall back to the file value for that field only, leaving the other fields' overrides in force.

Set semantics per field SHALL be: an absent key leaves the field unchanged; a key present with value `null` clears that field's override; otherwise the value is validated as a new override. `name` SHALL be a non-empty string of at most 200 characters (empty string is an error on the write path). `title` SHALL be a non-empty string of at most 200 characters, or empty string, which clears the override (effective title then falls back to the name). `icon` SHALL be a string; empty string is a valid override meaning the stock mark, a glyph is stored as-is, and a value starting with `<svg` SHALL pass the existing app-icon sanitizer (a sanitizer failure is an error on the write path and a fallback to the file icon on the read path). `background` SHALL be `desk`, `paper`, or a grid object of eight integers 0–255 (empty string and any other value are errors on the write path and fall back to the file background on the read path). The 200-character cap applies to the write path only; a longer value already in the file SHALL NOT be re-validated against it on read.

Reset SHALL mean delete, not set-to-initial: resetting with no argument SHALL delete the whole key, and resetting one field SHALL delete just that field's override, dropping the key when the last field is cleared. After a reset, a later change to the file default SHALL show up again for that field.

#### Scenario: One field overridden, others follow the file

- **WHEN** an override stores only `background: "paper"`
- **THEN** pages render a paper background with the file's name, title, and icon unchanged.

#### Scenario: Override survives a republish

- **WHEN** an override is stored and the package is republished with a different `settings.json`
- **THEN** every overridden field still renders the stored value, and every non-overridden field renders the new file value.

#### Scenario: Invalid stored field falls back per field

- **WHEN** the stored override holds an invalid `background` and a valid `name`
- **THEN** pages render the file background with the stored name, and no page fails to render.

#### Scenario: Reset restores the file value

- **WHEN** an override for `name` is reset
- **THEN** the next render shows the file name, and a later file edit to `name` shows up without any further reset.

#### Scenario: No override is byte-identical

- **WHEN** no override is stored
- **THEN** every page renders exactly as the file-only shell rendered before this change.

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
