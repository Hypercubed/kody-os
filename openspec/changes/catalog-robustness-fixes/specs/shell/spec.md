# shell

## ADDED Requirements

### Requirement: Not-installed Store fallback is a copy-prompt

When the App Store app is not installed, the Store page fallback SHALL present the same selectable copy-prompt the empty-Help block gives (a `<code>` block the user can select and copy), naming the install call with its catalog base — not a bare repo-relative path. The fallback SHALL offer no one-tap install (there is no catalog source to fetch from without one).

#### Scenario: Fallback names the install call and its catalog base

- **WHEN** the Store page is opened with no App Store installed
- **THEN** the fallback shows a selectable copy-prompt naming the install call (`install_from_catalog` with id `app-store` and the catalog base), and no one-tap install control.
