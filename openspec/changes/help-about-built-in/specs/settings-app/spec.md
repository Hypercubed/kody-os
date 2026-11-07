# Spec Delta

## ADDED Requirements

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
