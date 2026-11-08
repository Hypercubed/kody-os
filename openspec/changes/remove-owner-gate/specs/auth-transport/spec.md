# auth-transport Specification Delta

## Purpose

Remove the shell's owner gate entirely: the shell performs no access check in `fetch()`, and access to the hosted app is decided by Kody's own permission system. The app stays internet-private (`internet_visible` off) for a private shell.

## ADDED Requirements

### Requirement: No shell gate — platform permissions decide access

The shell SHALL perform no access check in `fetch()`: no visitor check, no role check, and no `metaGetCurrentUser` call. Every request that reaches `fetch()` SHALL be served. Who reaches `fetch()` is decided before shell code runs by Kody's platform gate: with `internet_visible` off, only the owner and holders of an `app:execute` / Use grant on the app; with `internet_visible` on, anyone on the internet. The shell SHALL NOT re-implement, narrow, or widen that decision in code. There SHALL be no shell-side denial, no locked page, and no footer auth path.

#### Scenario: Owner opens the app signed in
- **WHEN** the owner opens the hosted app signed in to Kody
- **THEN** the platform admits them and every page renders, with no shell check and no credential in any URL.

#### Scenario: A grantee opens the app
- **WHEN** a person holding an `app:execute` / Use grant on the app opens it signed in to Kody
- **THEN** the platform admits them and the shell serves them — the shell's former owner-only restriction no longer blocks them.

#### Scenario: A revoked grantee is denied by the platform, not the shell
- **WHEN** a person's grant is revoked and they open the hosted app
- **THEN** the platform denies them before shell code runs; the shell renders no denial page, because it never sees the request.

#### Scenario: Limited-browser Kody login still admits the visitor
- **WHEN** a visitor on a limited browser signs in via Kody's package-app sign-in route (`/-/auth/login`, plain HTML / sign-in-on-another-device, kody-hq/kody#4666) and arrives with platform-verified visitor identity
- **THEN** the platform admits them and the shell serves them, with no derived code, no stored hash, and no shell-side check involved.

#### Scenario: Internet-visible on means anyone can open the app
- **WHEN** `internet_visible` is turned on for the package
- **THEN** anyone on the internet can open the hosted app, with no shell gate left to stop them — so it SHALL NOT be turned on for a private shell.

### Requirement: Access is granted and revoked in Kody, and the docs say so

Access SHALL be granted by granting Use / `app:execute` on the app in Kody, and revoked by revoking that grant (or by the visitor signing out of Kody). The root `README.md`, `pkg/README.md`, `pkg/AGENTS.md`, `pkg/docs/setup.md`, and the repo-root `AGENTS.md` SHALL state this plainly, SHALL state that the shell performs no access check, SHALL state that package visibility and `internet_visible` are independent toggles, and SHALL carry the warning that turning `internet_visible` on exposes the app to anyone on the internet with no shell gate left. No doc SHALL claim the shell enforces owner-only access.

#### Scenario: Docs name Kody as the authority
- **WHEN** the readmes and setup guide are read
- **THEN** they name Kody's permission system — not a shell gate — as what decides who can open the app, and they name the grant and revoke steps.

#### Scenario: Docs warn about internet-visible
- **WHEN** the readmes and setup guide are read
- **THEN** they warn that `internet_visible` on exposes the app to anyone on the internet, with no shell gate left.

### Requirement: MCP exports are governed by Kody, unchanged

MCP exports SHALL NOT be routed through `fetch()`, as before, and who may call them SHALL be decided by Kody's `package:execute` / org access, not by the shell. Removing the fetch gate SHALL change nothing about MCP access: it neither opens nor closes that surface.

#### Scenario: An agent calls an export while the browser shell has no gate
- **WHEN** a Kody-connected agent calls `list_apps` or `act` via `execute`
- **THEN** the call is governed by Kody's package access, with no shell gate involved — exactly as before this change.

## REMOVED Requirements

### Requirement: Exactly one login path

The shell no longer authenticates a fetch request at all, so there is no "one login path" in the shell to require. Access is decided by the platform before shell code runs (see ADDED "No shell gate"). The retired-credential denial scenarios under this requirement go with it: there is no shell comparison of any credential to deny.

### Requirement: Mock target is login-free

There is no gate to skip, so the mock target needs no special case. Mock and hosted behave identically at the shell level — both serve whatever reaches them; the difference is platform-side. The mock is login-free because there is no gate at all.

### Requirement: Footer reports the active auth path

There is no auth path to report. The footer keeps status text, date, and time, and drops the auth-path element (see the shell spec delta).

### Requirement: Kody-authenticated visitors skip the device gate

There is no device gate to skip. A platform-verified visitor is admitted by the platform, not by a shell bypass, and a visitor the platform does not admit never reaches shell code. The limited-browser sign-in case is carried into ADDED "No shell gate" above.
