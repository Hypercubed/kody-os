# Spec Delta

## ADDED Requirements

### Requirement: Setup guide exists and is the entry point

The package SHALL ship a setup guide at `pkg/docs/setup.md`, written
for the fork owner and their agent, in reading order. The guide SHALL
cover, at operator level with a verification step for each: the
visibility precondition for sharing; the fork/install/publish model
in Kody's terms (one-click Install vs. `communityFork` + review +
publish, source-only fork with empty storage, no automatic updates
from the original, "adopt" as a separate owner-only step, git clone
as source copy only); the setup sequence ending in a first app
installed via agent `add_app` and verified by an add/open/act round
trip; login via Kody login or the OTP-issued session cookie, with
no credential setup of any kind; Scribe per-visit OTPs; the
catalog/store and trust rule by pointer; adding further apps; local
dev; and troubleshooting. The App Store (browser install of catalog
apps) is specified but not implemented at the time of writing; the
guide SHALL state that plainly and SHALL NOT describe store seeding
as current behavior. The guide SHALL link to
`pkg/docs/adding-an-app.md` for app detail instead of duplicating
it, SHALL NOT link to `pkg/docs/device-key.md` (that document
describes the legacy fallback slated for removal under
remove-legacy-code; the link is deferred until its rewrite),
SHALL contain no secret value, derived code, or OTP, and SHALL NOT
describe any retired legacy login path as a way in — and SHALL NOT
name the `access-key` secret, rotation, or `get_access_status` at
all. `pkg/README.md` SHALL point to the guide as the setup entry
point, and the guide SHALL be readable via the Kody search entity
`package:<scope>/kody-os#docs/setup.md` (scope rewritten per fork),
like `adding-an-app.md`.

#### Scenario: Guide covers fork to first app in order
- **WHEN** the guide is read start to finish
- **THEN** it names, in order, visibility, fork lanes, publish check, empty-registry check, and a first app added via `add_app` and verified by acting on it, with a verification step for each, and states plainly that the App Store is not yet implemented.

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
