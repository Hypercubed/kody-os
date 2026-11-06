# Setup Guide Specification

## Purpose
One reading-order guide a fork owner (or their agent) can follow from "I have a copy" to "my OS is set up and a first mini-app is installed", in Kody's own terms for fork, install, publish, adopt, and clone, with a verification step for each procedure and no detail from the legacy login system slated for removal.

## Requirements

### Requirement: Setup guide exists and is the entry point

The package SHALL ship a setup guide at `pkg/docs/setup.md`, written
for the fork owner and their agent, in reading order. The guide SHALL
cover, at operator level with a verification step for each: the
visibility precondition for sharing; the fork/install/publish model
in Kody's terms (one-click Install vs. `communityFork` + review +
publish, source-only fork with empty storage, no automatic updates
from the original, "adopt" as a separate owner-only step, git clone
as source copy only); the setup sequence ending in a first mini-app
installed via agent `add_app` and verified by an add/open/act round
trip; login via Kody login or the OTP-issued session cookie, with
no credential setup of any kind; Scribe per-visit OTPs; the
catalog/store and trust rule by pointer; adding further mini-apps; local
dev; and troubleshooting. The Mini-App Store (browser install of catalog
mini-apps) is implemented; the guide SHALL describe it as installed
explicitly (a fresh shell starts empty and seeds nothing) and SHALL NOT
describe store seeding as current behavior. The guide SHALL link to
`pkg/.agents/skills/adding-an-app/SKILL.md` for app detail instead of duplicating
it, SHALL NOT link to `pkg/docs/device-key.md` (that document
describes the legacy fallback slated for removal under
remove-legacy-code; the link is deferred until its rewrite),
SHALL contain no secret value, derived code, or OTP, and SHALL NOT
describe any retired legacy login path as a way in — and SHALL NOT
name the `access-key` secret, rotation, or `get_access_status` at
all. `pkg/README.md` SHALL point to the guide as the setup entry
point, and the guide SHALL be readable via the Kody search entity
`package:<scope>/kody-os#docs/setup.md` (scope rewritten per fork),
like the adding-an-app skill.

#### Scenario: Guide covers fork to first app in order
- **WHEN** the guide is read start to finish
- **THEN** it names, in order, visibility, fork lanes, publish check, empty-registry check, and a first mini-app added via `add_app` and verified by acting on it, with a verification step for each, and states plainly that the Mini-App Store is installed explicitly, not seeded.

#### Scenario: Guide uses Kody's terms for adopt and clone
- **WHEN** the guide's sharing section is read
- **THEN** "adopt" means only the separate owner-only Settings-page step, "clone" means only a source copy to a machine, and neither is presented as the install itself.

#### Scenario: Guide carries no live secrets and names no secret setup
- **WHEN** the guide file is grepped for secret values, derived codes, OTP digits, `access-key`, rotation, and `get_access_status`
- **THEN** none are present; only the export name `mint_otp` appears, as the way to mint an unlock code.

#### Scenario: Guide is discoverable from README
- **WHEN** `pkg/README.md` is read
- **THEN** it points to the setup guide as the setup entry point, and the pointer resolves to `pkg/docs/setup.md`.

### Requirement: Guide includes a setup agent prompt

The guide SHALL include a copy-paste "setup kody-os" prompt for the
adopter's agent, naming the guide itself as the first document the
agent reads, mirroring the README's recommended-prompt pattern.

#### Scenario: Prompt bootstraps the setup
- **WHEN** the prompt in the guide is copied to a Kody-connected agent
- **THEN** it directs the agent to read the guide first and follow its sequence, without naming any package behavior the guide does not cover.

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

### Requirement: Setup guide uses mini-apps in user-facing prose

User-facing prose in the setup guide (`pkg/docs/setup.md`) and
in `pkg/README.md` SHALL call an installed unit a mini-app
("mini-apps" plural) and the Store the "Mini-App Store". Code,
MCP names, routes, and storage keys in those documents SHALL stay
`app`: `add_app`, `list_apps`, `get_app_state`, `/apps`,
`/apps/:id`, and `kody-os.apps.*` SHALL NOT be respelled. The
adding-an-app skill SHALL stay unchanged.

#### Scenario: Guide prose says mini-apps, code stays app
- **WHEN** the setup guide and README are read
- **THEN** their prose reads "Mini-apps are JSON definitions…", "the mini-app appears on the Mini-apps page", and "Add further mini-apps the same way", while their code samples and tool names still read `add_app`, `list_apps`, `/apps`, and `kody-os.apps.*`.

#### Scenario: Guide's first-app check still uses app tool names
- **WHEN** a user follows the guide's first-app verification step
- **THEN** the check still names `list_apps`, `get_app_state`, and `GET /apps/<id>`, and the Mini-apps page lists the new mini-app.
