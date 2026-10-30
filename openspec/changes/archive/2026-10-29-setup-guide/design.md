# Design: setup-guide

## Context

See proposal.md (Why). The facts the guide must get right were
established in the October 2026 fork/auth discussions: a private
package must be made public before it can be listed or forked; a
one-click Install forks and publishes when checks pass, while the
agent lane (`communityFork`) leaves an inert source that needs a
repo-session review and a publish before anything runs; a fork copies
source only, under the adopter's scope, and upstream updates do not
flow into it; "adopt" (`communityForkAdopt`) is an owner-only,
Settings-page step granting self-authored-like secret access and is
not the install; a read-only git clone copies source to a machine and
installs nothing into a Kody account. On the auth side, the
auth-rethink change makes the cookie the only device credential,
bound to the `access-key` secret and issued through OTP verification,
with secret rotation/deletion invalidating all cookies; the secret is
per-fork, owner-created in the Kody UI, and required for the
cookie/device path (Kody login still works without it).

## Goals / Non-Goals

- Goals: one reading-order guide a fork owner (or their agent) can
  follow start to finish; every procedure in it verified against the
  real package; terminology that matches Kody's (fork, install,
  publish, adopt) instead of redefining it; the first-app install as
  the proof the setup worked.
- Non-goals: a new in-OS setup wizard or onboarding UI; a replacement
  for `device-key.md` or `adding-an-app.md`; a tutorial for building
  apps (that stays in `adding-an-app.md`); any behavior change.

## Decisions

1. **Guide lives in the package docs, not in the shell.**
   `pkg/docs/setup.md`, readable the same way agents already read
   `adding-an-app.md` (Kody search entity
   `package:kody-os#docs/setup.md`, scope rewritten per fork). Rationale:
   the audience is the owner setting up, often through their agent,
   before the shell is usable; an in-OS page cannot be the first thing
   they read. The Help page points to it; it does not contain it.
2. **The guide owns the sequence; detail docs own their topics.**
   The guide explains each step at operator level (what to do, what
   to expect, how to verify) and links to `device-key.md` for auth
   detail and `adding-an-app.md` for the app contract. Rationale: one
   source of truth per topic; the guide cannot drift from detail docs
   it duplicates. If a detail doc and the guide disagree, the detail
   doc is corrected and the guide re-verified — never the reverse.
3. **Fork-model claims are stated with their verification.**
   The empty-storage premise (a fork starts with no installed apps and
   no state) is stated as expected behavior, and the setup sequence
   includes checking it (registry empty after publish, before the
   first shell request; exactly the App Store after it). Rationale:
   the Kody docs establish the fork as a source copy but do not state
   the storage premise in one sentence; the guide must not present an
   inference as a quoted platform fact.
4. **The auth section follows auth-rethink, verified against it.**
   The guide describes Kody login and the secret-bound cookie issued
   through OTP, secret creation as owner-only Kody UI work, rotation/
   deletion invalidating all cookies, per-visit OTPs on the Scribe
   (cookies drop between sessions), and per-device logout. It SHALL
   NOT describe the retired legacy path (typed derived code, `?k=`
   bookmarks, code-hash cookie, stored-hash fallback) as a way in.
   If this guide lands before auth-rethink, its auth section is
   drafted against the auth-rethink spec and marked for re-verification
   at auth-rethink implementation; the auth-rethink change carries a
   task to update the guide if it has already landed.
5. **A copy-paste agent prompt is part of the guide.** The guide ends
   its setup sequence with a recommended prompt ("setup kody-os")
   naming the guide itself as the first thing the adopter's agent
   reads, mirroring the README's recommended-prompt pattern.
   Rationale: the common case is an agent doing the setup; the prompt
   makes the guide self-bootstrapping.
6. **No secrets, codes, or live values in the guide.** The guide
   names the secret (`access-key`) and the exports (`mint_otp`,
   `get_access_status`) but never shows a secret value, a derived
   code, or an OTP. Verification greps for those patterns are part of
   the tasks.

## Risks / Trade-offs

- [Risk] Guide drifts from implemented behavior (especially auth,
  while auth-rethink is unimplemented). Mitigation: the auth-section
  verification task runs against the implementation, and
  auth-rethink carries the reciprocal update task; the guide never
  ships ahead of the behavior it describes.
- [Risk] A fork owner reads the guide before the package is public
  and cannot find a listing. Mitigation: the guide opens with the
  visibility precondition (private packages cannot be forked) and
  the publisher-side step that makes the listing exist.
- [Risk] "Adopt" confusion persists. Mitigation: the guide defines
  fork, install, publish, and adopt in Kody's terms in one place,
  early, and uses "first use" (never "adoption") for App Store
  seeding, matching the app-store spec.

## Migration Plan

None: docs-only addition. Existing docs are untouched except for
pointers/cross-links. Rollback is deleting the guide file and its
pointers.

## Version

PATCH at publication if published alone (docs-only correction/addition
per `pkg/AGENTS.md`); rides with the next version-bumping change if
one is pending. Headers in `pkg/AGENTS.md`/`pkg/README.md` are updated
in the same commit as any bump. This spec draft does not bump anything.

## Open Questions

1. Confirm the guide lives only in `pkg/docs/` (plus Help/README
   pointers) rather than also being rendered as an in-OS page.
2. Confirm the guide includes the copy-paste "setup kody-os" agent
   prompt (Decision 5).
3. Confirm landing order with auth-rethink: guide drafted now,
   auth section re-verified at auth-rethink implementation, vs.
   guide held until auth-rethink lands.

## Implementation notes (2026-10-29, as implemented and archived)

Implemented per owner direction (2026-10-29): the guide SHALL NOT
include details of the legacy system slated for removal. The
following deviations from the proposal/design above are the
implemented behavior and supersede Decision 4, Decision 6, and
the auth-rethink-dependent parts of the tasks for this change.
The original proposal/design text is preserved in git history
(commit `b8a8966`).

- **Auth model.** The guide describes Kody login and the
  OTP-issued session cookie only. There is no `access-key`
  secret setup, no rotation/deletion semantics, and no
  `get_access_status` in the guide. The auth-rethink model
  (secret-bound cookie) is parked and was not used; the guide
  follows the remove-legacy-code end state (OTP sessions, no
  secret). The guide describes the live OTP mechanics, which
  the package already has; the legacy path still exists in
  code until remove-legacy-code lands, but the guide documents
  no part of it.
- **Detail link.** The guide links to `adding-an-app.md` only.
  The `device-key.md` link is deferred: that document currently
  describes the legacy fallback (secret creation, rotation,
  `get_access_code`), and linking it would funnel setup readers
  into the legacy setup steps. The link may be added once
  remove-legacy-code rewrites `device-key.md`.
- **Store sequence.** The App Store is specified but not
  implemented (no seeding code exists; `pkg/examples/` is not
  renamed). The guide's setup sequence therefore ends with a
  first app added via agent `add_app` and verified by an
  add/open/act round trip, and states plainly that the store
  is not yet implemented. When the app-store change lands, the
  guide's sequence and catalog section need updating.
- **Open questions resolved.** (1) The guide lives only in
  `pkg/docs/` plus Help/README pointers; no in-OS page.
  (2) The copy-paste prompt is included. (3) Landing order:
  the guide shipped before auth-rethink, on the
  remove-legacy-code model instead.
- **Verification limits.** Task 2.2's live-fork walk could not
  be run end to end from this environment (no kody CLI here,
  no live fork to publish); the sequence was verified against
  the package source and the existing flows it describes
  (`list_apps`, `add_app`, OTP unlock, `kody dev` patterns in
  `pkg/README.md` / `pkg/AGENTS.md`). A live-fork walk remains
  a good first-use check for the owner.
- **Version.** No bump in the implementing commit (docs-only;
  the Help pointer is copy text, no behavior change). PATCH at
  publication if published alone, per the version policy, or
  ride with the next version-bumping change.
