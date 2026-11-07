# auth-transport Specification Delta

## Purpose

Remove the one-time code (OTP) entirely: Kody login is the only auth path, and the mock target is login-free.

## MODIFIED Requirements

### Requirement: Footer reports the active auth path

Every shell page footer SHALL include the active auth path (`via kody` or `locked`) so the login path is observable without devtools. The `via cookie` and `via key` paths SHALL NOT appear. There SHALL be no Logout link (it existed only for cookie-authenticated pages).

#### Scenario: Owner reads the auth path off the page
- **WHEN** any page is fetched
- **THEN** the footer names `via kody` as the path that authenticated the request, or `locked` when denied.

### Requirement: Kody-authenticated visitors skip the device gate

A request carrying platform-verified visitor identity (`X-Kody-Visitor` header set by the platform, confirmed via `kody.metaGetCurrentUser({})`) for a user the platform grants app access to SHALL be served without any cookie. Requests without verified identity SHALL be denied (locked); there is no session-cookie gate to fall through to, and the gate SHALL never fail open. (Unchanged in substance; "device key" wording retired.)

#### Scenario: Owner opens the app signed in
- **WHEN** a Kody-signed-in user with app access opens the hosted app
- **THEN** every page renders with no device gate and no credential in any URL, and the footer reads `via kody`.

#### Scenario: Anonymous visitor still gated
- **WHEN** a request carries no verified visitor identity
- **THEN** it is denied (locked) and the response carries no app content.

#### Scenario: Limited-browser Kody login counts as the Kody path, not a third path
- **WHEN** a visitor on a limited browser signs in via Kody's package-app sign-in route (`/-/auth/login`, plain HTML / sign-in-on-another-device, kody-hq/kody#4666) and arrives with platform-verified visitor identity
- **THEN** the request is served as a Kody visitor (`via kody`), with no derived code, no stored hash, and no device-key credential involved; this does not add a login path beyond the one named above.

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

## ADDED Requirements

### Requirement: Exactly one login path

The system SHALL authenticate a fetch request by exactly one path: a platform-verified Kody visitor. There SHALL be no second path and no legacy path, and the system SHALL NOT accept any credential carried in a URL, link, form, redirect, or header (including a derived code, a stored code hash, a code-hash cookie, a session cookie, or a one-time code). A request presenting only a retired credential SHALL be denied exactly like an unauthenticated request, with no fallback comparison of any kind. No secret is consulted at request time, and no secret need is declared.

#### Scenario: Derived code is denied
- **WHEN** a request presents a derived code (typed code, `?k=` form, or bookmark) with no verified Kody visitor
- **THEN** it is denied (locked), storage is unchanged, and no cookie is set.

#### Scenario: Stored-hash code is denied
- **WHEN** a request presents a code matching the stale `kody-os.auth.code_hash` value (or a cookie carrying its hash) with no verified Kody visitor
- **THEN** it is denied (locked), storage is unchanged, and no cookie is set.

#### Scenario: Old code-hash cookie is denied
- **WHEN** a request presents a pre-cutover code-hash cookie with no verified Kody visitor
- **THEN** it is denied (locked) and no cookie is set.

#### Scenario: Unauthenticated request is denied
- **WHEN** a request carries no verified visitor identity
- **THEN** it is denied (locked) and the response carries no app content.

### Requirement: Mock target is login-free

Under the local mock/dev target (`kody dev --target mock`) the device gate SHALL be skipped entirely: every request SHALL be served without any credential. The hosted gate SHALL still require verified visitor identity; the mock bypass SHALL NOT apply to the hosted package.

#### Scenario: Mock serves without any credential
- **WHEN** the shell runs under `kody dev --target mock` and a request arrives with no visitor identity and no cookie
- **THEN** the request is served (not locked), with no unlock step.

#### Scenario: Hosted still requires Kody login
- **WHEN** a request arrives at the hosted package with no verified visitor identity
- **THEN** it is denied (locked), even though the mock target would serve it.

## REMOVED Requirements

### Requirement: Exactly two login paths, no legacy path

Replaced by ADDED "Exactly one login path" (Kody visitor only). The two-path model, the session cookie issued by burning an OTP, and the OTP submission are gone.

### Requirement: Unlock writes only the session token to localStorage

The unlock flow is gone (no OTP, no unlock form, no session token to store).

### Requirement: OTP sessions are the only device path

The entire OTP session system is gone (no minting, no OTP registry, no session-cookie issuance, no unlock transports, no per-device logout of OTP sessions).
