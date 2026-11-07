# settings-app Specification

## Purpose

Define the Settings catalog app: the shell's settings surface, which renders theme controls from the theme read route, submits them to the theme set and reset routes, and offers page-visibility controls for the built-in Help and About pages.

## Requirements

### Requirement: Settings catalog app

The shipped catalog SHALL include a Settings app (id `settings`, schemaVersion 5, empty `stateSchema`, `actions: {}`, `capabilities.theme: { view: true, set: true }`, `ui.openAs: "page"`, `ui.menuBar: true`): a stateless bundle that renders shell theme controls from the theme read route and submits them to the theme set / reset routes. It SHALL keep no theme in app state and SHALL call no `act()`. Its app id for routes SHALL be resolved from the shell-stamped `data-action-base` container with a `/apps/<id>` path fallback, never hardcoded. It SHALL NOT be installed by default on a fresh install. Removing it SHALL delete only its definition and (empty) state; the `kody-os.shell.theme` key SHALL be untouched, and a later reinstall SHALL show the same overrides.

The bundle SHALL offer: a Background section with a segmented Desk / Paper control (active = inverted); a Name section with one labeled text field plus Save; an Icon section with a glyph text field plus Save and a "stock mark" action (sets icon to `""`); a Pages section (see the page-visibility requirement); and one "reset all to file defaults" button. It SHALL NOT offer a Title field. Each section SHALL open with the shared black-bar section title (`.os-section-title`). For each field it SHALL show the effective value as a "Now: …" readout plus a badge — `default` (plain) when the value comes from the file, `changed` (inverted) when an override exists — derived from the read route's `defaults` / `override` / `effective` split. Reset SHALL be a quiet text link under each setting, not a full button; "stock mark" SHALL be a quiet link too. When the effective background is a grid, or the effective icon is SVG, it SHALL show a "custom grid / custom mark, set via file or agent" notice instead of an editor for that field, while still offering desk / paper or glyph / stock / reset to replace it. It SHALL NOT offer a grid editor or an SVG editor in v1.

Core controls SHALL be plain GET forms (no POST, no JavaScript required); bundle JavaScript MAY enhance in place with `format=json`, but SHALL never be required. The bundle SHALL satisfy the existing bundle constraints: ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap. The Settings app's `catalogVersion` SHALL be 3 for this change (2 → 3).

#### Scenario: Panel shows source, not just values
- **WHEN** the Settings page is fetched with only `background` overridden
- **THEN** the background row shows the effective value with a `changed` badge, and the name and icon rows show their values with a `default` badge.

#### Scenario: Panel controls round-trip without JavaScript
- **WHEN** a plain GET form in the panel submits a background change with JavaScript unavailable
- **THEN** the server responds 303 back to the panel, and the panel now shows the new background with a `changed` badge.

#### Scenario: Removing the panel keeps the settings
- **WHEN** the Settings app is removed and later reinstalled
- **THEN** the reinstalled panel shows the same overrides as before removal.

#### Scenario: Custom grid is shown, not edited
- **WHEN** the effective background is a grid set via the file or MCP
- **THEN** the panel shows the custom-grid notice with desk / paper buttons to replace it, and no grid editor.

#### Scenario: No Title field
- **WHEN** the Settings page is fetched
- **THEN** the page shows Background, Name, Icon, Pages, and Reset all, and no Title input, reset, or readout.

### Requirement: Settings app offers page-visibility controls

The Settings app SHALL offer a Pages section alongside its existing theme sections: for each of Help and About, one Apps Edit toggle button (`.edit-toggle-btn`, 48px square, the eye-off SVG icon, `role="switch"`), where "on" (flat, inverted, `.edit-toggle-btn-on`) means hidden — the same control and semantics as the Apps Edit page's Hide toggle. The toggle SHALL submit as a plain GET form to `../theme/settings` (hidden `action=set`, hidden field-named param `showHelp` / `showAbout` carrying the opposite value: `1` to show, `0` to hide), with no JavaScript required (bundle JavaScript MAY enhance in place, never required), 303 back to the panel on submit. The current state SHALL be shown as a "Now: shown/hidden" readout plus a default/changed badge (from the read route's `defaults` / `override` / `effective` split). The section SHALL follow the same bundle constraints as the existing sections (ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap). Disabling a page from this panel SHALL take effect on the next render; the panel itself SHALL remain reachable from the Apps page while installed.

#### Scenario: Panel shows the current page state
- **WHEN** the Settings page is fetched with only `showHelp` overridden to hidden
- **THEN** the Help row shows hidden with a `changed` badge and its toggle inverted, and the About row shows shown with a `default` badge and its toggle plain.

#### Scenario: Show / Hide round-trips without JavaScript
- **WHEN** a plain GET form in the panel submits hiding About with JavaScript unavailable
- **THEN** the server responds 303 back to the panel, the panel now shows About hidden with its toggle inverted, and the next render of any page shows no About menu link.

#### Scenario: Reset restores the file default
- **WHEN** the per-field reset for Help is submitted
- **THEN** the Help row shows the file value with a `default` badge, and the override no longer carries `showHelp`.

### Requirement: Settings app appears in the top menu bar

The Settings app SHALL set `ui.menuBar: true` in its definition. When installed, the shell SHALL add a "Settings" link to the top menu bar (after Apps, alphabetical by label, alongside the other menu-app links). The link SHALL be excluded when the app is hidden and SHALL be removed when the app is uninstalled. No shell code change is required for this requirement: the menu-bar mechanism already exists (the `ui.menuBar` flag, validated and preserved by the registry, and the menu bar rendering menu-app links for non-hidden apps with the flag).

#### Scenario: Menu-bar link appears when installed
- **WHEN** the Settings app is installed and not hidden
- **THEN** the top menu bar shows a "Settings" link that opens the Settings page.

#### Scenario: Menu-bar link follows hide and uninstall
- **WHEN** the Settings app is hidden
- **THEN** the top menu bar shows no "Settings" link.
- **WHEN** the Settings app is uninstalled
- **THEN** the top menu bar shows no "Settings" link.
