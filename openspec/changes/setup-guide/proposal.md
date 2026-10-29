# Proposal

## Why

Everything a new owner needs to set up kody-os is currently scattered:
the fork/install model lives in Kody's docs, the device-key and OTP
mechanics live in `pkg/docs/device-key.md` and `docs/scribe-auth.md`,
the catalog and store behavior lives in the app-store change, and the
login model is being rethought in the auth-rethink change. A person
who forks the package has no single path from "I have a copy" to "my
OS is set up, the App Store is installed, and I have installed my
first app from it." The setup conversation has to be re-derived every
time, and the terms collide: in Kody, "adopt" is a secret-access step,
not the install, and "clone" does not install anything into an account.

## What Changes

- A single setup guide, `pkg/docs/setup.md`, written for the fork
  owner and their agent, in reading order: what kody-os is, how
  sharing/forking works, the setup sequence after fork + publish, how
  login works (Kody login or the secret-bound cookie, issued through
  OTP), how the App Store is seeded and how the first app is installed
  from it, what rotation/deletion of the secret does, and how to verify
  each step. The guide is the entry point; it links to
  `pkg/docs/device-key.md` and `pkg/docs/adding-an-app.md` for detail
  instead of duplicating them.
- The guide explains the fork model in the terms Kody uses: one-click
  Install vs. the `communityFork` + review + publish agent lane, fork
  as a source-only copy with empty storage under the adopter's scope,
  updates not flowing from the original, and "adopt" as a separate
  owner-only secret-access step. It states the empty-storage premise
  as expected behavior with a verification step in the sequence
  (check the registry is empty after publish, before the first shell
  request), not as a quoted Kody-docs fact.
- The guide's walkthrough ends with a first app installed from the App
  Store in the browser — the moment the setup is proven working — not
  with the fork itself. Installing further apps (store or agent
  `add_app`) is covered by pointer, not repeated.
- `pkg/README.md` points to the guide as the setup entry point, the
  Help page points to it for first-run/fork setup, and the guide
  carries a copy-paste "setup kody-os" prompt for the adopter's agent,
  in the same pattern as the README's recommended prompt.
- Docs-only change: no code, no storage, no MCP, and no behavior
  change. The guide SHALL describe only behavior the package actually
  has at the time it ships; its auth section is written against the
  auth-rethink model and is verified against the auth-rethink
  implementation (see design.md Dependencies).

## Capabilities

### New Capabilities

- `setup-guide`: the setup guide as a published doc surface — its
  location, contents, discoverability, and accuracy rules.

### Modified Capabilities

- `help-page`: the Help page gains a pointer to the setup guide for
  first-run/fork setup, alongside the existing agent add flow.

## Impact

- New: `pkg/docs/setup.md`. Modified: `pkg/README.md` (setup pointer),
  `pkg/src/app.ts` Help-page copy only if the Help text lives there
  (pointer text, no behavior), `pkg/docs/adding-an-app.md` (cross-link
  only, if it names setup). No other file moves. The guide does not
  replace `pkg/docs/device-key.md` or `pkg/docs/adding-an-app.md`;
  those remain the detail references.
- This change depends on the app-store change (the store is the first
  app the walkthrough installs) and on the auth-rethink change (the
  guide's login section describes the rethought model). It may be
  drafted before either lands, but it SHALL NOT ship describing
  behavior the package does not have.
- Version: PATCH at publication if published alone (docs-only, per
  `pkg/AGENTS.md`); rides with the next version-bumping change if one
  is pending. This spec draft itself, outside `pkg/`, bumps nothing.
