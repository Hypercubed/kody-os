# Spec Delta

## ADDED Requirements

### Requirement: Setup guide documents the empty install

The setup guide SHALL state that a fresh install opens with an empty registry — no mini-apps are seeded, including no Mini-App Store — and SHALL describe the Mini-apps page help text a new user sees.

#### Scenario: New user reads the empty-install sequence
- **WHEN** a user follows the setup guide for a fresh install
- **THEN** the guide tells them the install starts empty, that the Mini-apps page shows two copy-paste prompts (one for installing the Mini-App Store, one for adding their own mini-apps), and that the Mini-App Store is installed via an agent with `install_from_catalog` (not seeded, and not via a browser install path).

### Requirement: Setup guide documents the Home empty states

The setup guide SHALL describe the two Home empty states.

#### Scenario: New user reads the Home empty states
- **WHEN** a user follows the setup guide for a fresh install
- **THEN** the guide tells them Home shows the same help as the Mini-apps page when no mini-apps are installed, and prompts the user to add mini-apps to Home via Mini-apps Edit's Add to home control once mini-apps exist but none are on Home.
