# Spec Delta

## ADDED Requirements

### Requirement: Setup guide documents the empty install

The setup guide SHALL state that a fresh install opens with an empty registry — no apps are seeded, including no App Store — and SHALL describe the Apps page help text a new user sees: two copy-paste prompts, one for installing the App Store and one for adding their own apps.

#### Scenario: New user reads the empty-install sequence
- **WHEN** a user follows the setup guide for a fresh install
- **THEN** the guide tells them the install starts empty, that the Apps page shows the two prompts, and that the App Store is installed from its own page or via `install_from_catalog`, not seeded.
