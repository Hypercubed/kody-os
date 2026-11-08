# auth-transport Specification

## Purpose
Remove the one-time code (OTP) entirely: Kody login is the only auth path, and the mock target is login-free.

## Requirements

### Requirement: No derived key exists; no secret is consulted

There SHALL be no derived key, no UI-managed secret, and no secret-derived value anywhere in the package: no `access-key` need in `package.json`, no `credential()` call in the fetch path, no secret value in code, `packageStorage`, logs, or chat, and no `configured` state. The base spec's derived-key and key-management requirements are RETIRED in full. Key creation in the Kody UI is no longer part of this package's setup at all.

#### Scenario: No secret is required for any path
- **WHEN** the package is published with no secret bound (the only possible state)
- **THEN** Kody login works, and no setup step mentions a secret.

### Requirement: No secret means no rotation and no kill switch

Because no secret exists, there is no rotation semantic and no rotation kill switch. There are no shell sessions to revoke or expire (Kody login is verified per-request; there is no session cookie and no Logout link). A global session revoke does not exist as a runtime feature. Docs and code SHALL NOT claim that any runtime action invalidates all sessions at once. EXCEPTION — one-time cutover only (v2.0.0): the session and OTP registries moved to versioned keys (`kody-os.auth.sessions.v2`, `kody-os.auth.otp.v2`) and the v1 keys are never read, so every pre-cutover session and outstanding OTP stopped working at cutover. That is a migration effect of the version cutover, not a revoke feature, and it does not recur. (Those registries are removed by this change; the cutover note is retained here as history.)

#### Scenario: Logout revokes one device only
- **WHEN** a Kody visitor signs out of Kody
- **THEN** that visitor's identity is gone and the next request is denied (locked); there is no shell Logout link and no per-device session to revoke.

#### Scenario: Sessions expire on their own
- **WHEN** a request arrives with no verified visitor identity
- **THEN** it is denied (locked); there is no shell session to expire, and only Kody login restores access.

#### Scenario: Pre-cutover sessions stop at the v2.0.0 cutover
- **WHEN** a session or OTP minted before v2.0.0 is presented after the cutover
- **THEN** it no longer authenticates (the v1 registry keys are never read), and only Kody login restores access.

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
