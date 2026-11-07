# settings-app Specification

## Purpose
Define the Settings catalog app: the shell's settings surface, which renders theme controls from the theme read route, submits them to the theme set and reset routes, and offers page-visibility controls for the built-in Help and About pages.

## Requirements

### Requirement: Settings catalog app

The shipped catalog SHALL include a Settings app (id `settings`, schemaVersion 5, empty `stateSchema`, `actions: {}`, `capabilities.theme: { view: true, set: true }`, `ui.openAs: "page"`): a stateless bundle that renders shell theme controls from the theme read route and submits them to the theme set / reset routes. It SHALL keep no theme in app state and SHALL call no `act()`. Its app id for routes SHALL be resolved from the shell-stamped `data-action-base` container with a `/apps/<id>` path fallback, never hardcoded. It SHALL NOT be installed by default on a fresh install. Removing it SHALL delete only its definition and (empty) state; the `kody-os.shell.theme` key SHALL be untouched, and a later reinstall SHALL show the same overrides.

The bundle SHALL offer: background desk / paper buttons; name and title text inputs (title blank clears the title override); icon as a glyph text input, a "stock mark" button (sets icon to `""`), and a per-field reset; per-field reset buttons for every field; and one "reset all to file defaults" button. For each field it SHALL show the effective value and its source (file default or override), derived from the read route's `defaults` / `override` / `effective` split. When the effective background is a grid, or the effective icon is SVG, it SHALL show a "custom grid / custom mark, set via file or agent" notice instead of an editor for that field, while still offering desk / paper or glyph / stock / reset to replace it. It SHALL NOT offer a grid editor or an SVG editor in v1.

Core controls SHALL be plain GET forms (no POST, no JavaScript required); bundle JavaScript MAY enhance in place with `format=json`, but SHALL never be required. The bundle SHALL satisfy the existing bundle constraints: ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap.

#### Scenario: Panel shows source, not just values

- **WHEN** the Settings page is fetched with only `background` overridden
- **THEN** the background row shows the effective value labelled as an override, and the name, title, and icon rows show their values labelled as file defaults.

#### Scenario: Panel controls round-trip without JavaScript

- **WHEN** a plain GET form in the panel submits a background change with JavaScript unavailable
- **THEN** the server responds 303 back to the panel, and the panel now shows the new background labelled as an override.

#### Scenario: Removing the panel keeps the settings

- **WHEN** the Settings app is removed and later reinstalled
- **THEN** the reinstalled panel shows the same overrides as before removal.

#### Scenario: Custom grid is shown, not edited

- **WHEN** the effective background is a grid set via the file or MCP
- **THEN** the panel shows the custom-grid notice with desk / paper buttons to replace it, and no grid editor.

### Requirement: Settings app offers page-visibility controls

The Settings app SHALL offer a Pages section (labelled "Pages" or "Help and About") alongside its existing theme sections, following the existing `st-field` pattern: for each of Help and About, a Show / Hide pair of plain GET forms to `../theme/settings` (hidden `action=set`, hidden `field=showHelp` / `field=showAbout`, value in the field-named param: `1` to show, `0` to hide), a per-field reset, and the current state shown (effective value and its source, file default or override, from the read route's `defaults` / `override` / `effective` split). The section SHALL follow the same rules as the existing sections: plain GET forms with no JavaScript required (bundle JavaScript MAY enhance in place, never required), 303 back to the panel on submit, and the same bundle constraints (ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap). Disabling a page from this panel SHALL take effect on the next render; the panel itself SHALL remain reachable from the Apps page while installed. The Settings app's `catalogVersion` SHALL increment by exactly 1 for this change (1 → 2).

Note: this requirement composes with the shell-settings change's ADDED "Settings catalog app" requirement (same spec file, different requirement name); archive order between the two changes does not matter for this requirement.

#### Scenario: Panel shows the current page state
- **WHEN** the Settings page is fetched with only `showHelp` overridden to hidden
- **THEN** the Help row shows hidden labelled as an override, and the About row shows shown labelled as a file default.

#### Scenario: Show / Hide round-trips without JavaScript
- **WHEN** a plain GET form in the panel submits hiding About with JavaScript unavailable
- **THEN** the server responds 303 back to the panel, the panel now shows About hidden, and the next render of any page shows no About menu link.

#### Scenario: Reset restores the file default
- **WHEN** the per-field reset for Help is submitted
- **THEN** the Help row shows the file value, and the override no longer carries `showHelp`.
