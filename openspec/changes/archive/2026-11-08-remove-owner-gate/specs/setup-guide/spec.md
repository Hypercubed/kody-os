# setup-guide Specification Delta

## Purpose

The setup guide documents the Kody permission model as the way access works: grants in Kody decide who can open the app, the shell performs no access check, and `internet_visible` on would expose the app to anyone.

## MODIFIED Requirements

### Requirement: Setup guide exists and is the entry point

The package SHALL ship a setup guide at `pkg/docs/setup.md`, written for the fork owner and their agent, in reading order. The guide SHALL cover, at operator level with a verification step for each: the visibility precondition for sharing; the fork/install/publish model in Kody's terms (one-click Install vs. `communityFork` + review + publish, source-only fork with empty storage, no automatic updates from the original, "adopt" as a separate owner-only step, git clone as source copy only); the setup sequence ending in a first app installed via agent `add_app` and verified by an add/open/act round trip; access via Kody's permission system, with no credential setup of any kind and no shell-side access check — the guide SHALL state plainly that access is granted by granting Use / `app:execute` on the app in Kody and revoked by revoking that grant, that package visibility and `internet_visible` are independent toggles, and that turning `internet_visible` on exposes the app to anyone on the internet with no shell gate left (the Scribe signs in to Kody like anywhere else; there is no OTP and no per-visit code); the catalog/store and trust rule by pointer; adding further apps; local dev (login-free under `kody dev --target mock`, because there is no gate at all, not because of a mock bypass); and troubleshooting. The App Store (browser install of catalog apps) is implemented; the guide SHALL describe it as installed explicitly (a fresh shell starts empty and seeds nothing) and SHALL NOT describe store seeding as current behavior. The guide SHALL link to `pkg/.agents/skills/adding-an-app/SKILL.md` for app detail instead of duplicating it, SHALL NOT link to `pkg/docs/device-key.md` (that document is deleted), SHALL contain no secret value, derived code, or OTP, and SHALL NOT describe any retired legacy login path — or any shell-side denial, locked page, or owner check — as a way access is decided, and SHALL NOT name the `access-key` secret, rotation, or `get_access_status` at all. `pkg/README.md` SHALL point to the guide as the setup entry point, and the guide SHALL be readable via the Kody search entity `package:<scope>/kody-os#docs/setup.md` (scope rewritten per fork), like the adding-an-app skill.

#### Scenario: Guide covers fork to first app in order
- **WHEN** the guide is read start to finish
- **THEN** it names, in order, visibility, fork lanes, publish check, empty-registry check, and a first app added via `add_app` and verified by acting on it, with a verification step for each, and states plainly that the App Store is installed explicitly, not seeded.

#### Scenario: Guide uses Kody's terms for adopt and clone
- **WHEN** the guide's sharing section is read
- **THEN** "adopt" means only the separate owner-only Settings-page step, "clone" means only a source copy to a machine, and neither is presented as the install itself.

#### Scenario: Guide states the permission model
- **WHEN** the guide's access section is read
- **THEN** it states that access is granted by granting Use / `app:execute` on the app in Kody and revoked by revoking that grant, that the shell performs no access check, and that a grantee is served while a revoked grantee is denied by the platform before shell code runs — with a verification step for each.

#### Scenario: Guide warns about internet-visible
- **WHEN** the guide's access section is read
- **THEN** it warns that turning `internet_visible` on exposes the app to anyone on the internet, with no shell gate left, and that it SHALL NOT be turned on for a private shell.

#### Scenario: Guide carries no live secrets and names no secret setup
- **WHEN** the guide file is grepped for secret values, derived codes, OTP digits, `access-key`, rotation, and `get_access_status`
- **THEN** none are present; the export name `mint_otp` does not appear (it is removed by an earlier change).

#### Scenario: Guide is discoverable from README
- **WHEN** `pkg/README.md` is read
- **THEN** it points to the setup guide as the setup entry point, and the pointer resolves to `pkg/docs/setup.md`.
