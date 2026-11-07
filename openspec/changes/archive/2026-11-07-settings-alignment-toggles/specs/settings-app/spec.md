# settings-app Specification Delta

## Purpose

Fix the Settings Pages section so its rows align with the other sections and its toggles visibly take effect.

## MODIFIED Requirements

### Requirement: Settings app offers page-visibility controls

The Settings app SHALL offer a Pages section alongside its existing theme sections: for each of Help and About, one Apps Edit toggle button (`.edit-toggle-btn`, 48px square, the eye-off SVG icon, `role="switch"`), where "on" (flat, inverted, `.edit-toggle-btn-on`) means hidden — the same control and semantics as the Apps Edit page's Hide toggle. The toggle SHALL submit as a plain GET form to `../theme/settings` (hidden `action=set`, hidden field-named param `showHelp` / `showAbout` carrying the opposite value: `1` to show, `0` to hide), with no JavaScript required (bundle JavaScript MAY enhance in place, never required), 303 back to the panel on submit. The current state SHALL be shown as a "Now: shown/hidden" readout plus a default/changed badge (from the read route's `defaults` / `override` / `effective` split). Each Pages row SHALL lay out like the other sections: the toggle button on its own line, with the quiet reset link below it (not side by side in a flex row). After a successful toggle, and on the initial render, the bundle JavaScript SHALL hide or show the matching top menu-bar Help / About link in the current page, so the effect is visible without navigating; it SHALL find the link by its href (ending in `/help` or `/about`, excluding `/apps/` links) and SHALL do nothing if no matching link is found. The section SHALL follow the same bundle constraints as the existing sections (ES2019 script, one inline `<style>`, inlined assets only, zero external links, system fonts, high-contrast black-on-white, 48px minimum tap targets, icon per the existing icon rules, and the 256 KiB cap). Disabling a page from this panel SHALL take effect on the next render; the panel itself SHALL remain reachable from the Apps page while installed.

#### Scenario: Panel shows the current page state
- **WHEN** the Settings page is fetched with only `showHelp` overridden to hidden
- **THEN** the Help row shows hidden with a `changed` badge and its toggle inverted, and the About row shows shown with a `default` badge and its toggle plain.

#### Scenario: Show / Hide round-trips without JavaScript
- **WHEN** a plain GET form in the panel submits hiding About with JavaScript unavailable
- **THEN** the server responds 303 back to the panel, the panel now shows About hidden with its toggle inverted, and the next render of any page shows no About menu link.

#### Scenario: Reset restores the file default
- **WHEN** the per-field reset for Help is submitted
- **THEN** the Help row shows the file value with a `default` badge, and the override no longer carries `showHelp`.

#### Scenario: Pages rows align with the other sections
- **WHEN** the Settings page is fetched
- **THEN** each Pages row shows its toggle button on its own line with the quiet reset link below it, matching the layout of the Background, Name, and Icon sections.

#### Scenario: Toggle updates the menu bar immediately
- **WHEN** the Help toggle is clicked and the change is saved
- **THEN** the top menu-bar Help link disappears from the current page without navigating, and the Help row shows hidden with its toggle inverted.
- **WHEN** the Help toggle is clicked again
- **THEN** the top menu-bar Help link reappears on the current page without navigating, and the Help row shows shown with its toggle plain.
