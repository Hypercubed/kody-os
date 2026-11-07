# auth-transport Specification

## Purpose
Authenticate the shell by exactly two login paths: a platform-verified Kody visitor, or a session cookie issued only by burning a single-use OTP. There is no legacy access key, no secret, and no credential in any URL.

## Requirements

### Requirement: Footer reports the active auth path

Every shell page footer SHALL include the active auth path (`via kody`,
`via cookie`, or `locked`) so the login path is observable without
devtools. The `via key` path SHALL NOT appear. The Logout link
SHALL appear only for cookie-authenticated pages.

#### Scenario: Owner reads the auth path off the page
- **WHEN** any authenticated page is fetched
- **THEN** the footer names `via kody` or `via cookie` as the path
  that authenticated the request, or `locked` when denied.

### Requirement: Exactly two login paths, no legacy path

The system SHALL authenticate a fetch request by exactly one of
two paths: a platform-verified Kody visitor, or a session cookie
issued only by burning an OTP. There SHALL be no third path. In
particular, the system SHALL NOT accept: a derived code, a stored
code hash, a code-hash cookie, a `get_access_code` readout, a
`get_access_status` report, or any credential carried in a URL,
link, form, redirect, or header other than the single-use OTP
submission described below. A request presenting only a retired
credential SHALL be denied exactly like an unauthenticated
request, with no fallback comparison of any kind. No secret is
consulted at request time, and no secret need is declared.

#### Scenario: Derived code is denied
- **WHEN** a request presents a derived code (typed code, `?k=`
  form, or bookmark) with no valid session cookie and no
  verified Kody visitor
- **THEN** it is denied (locked), storage is unchanged, and no
  cookie is set.

#### Scenario: Stored-hash code is denied
- **WHEN** a request presents a code matching the stale
  `kody-os.auth.code_hash` value (or a cookie carrying its hash)
  with no valid session cookie and no verified Kody visitor
- **THEN** it is denied (locked), storage is unchanged, and no
  cookie is set.

#### Scenario: Old code-hash cookie is denied
- **WHEN** a request presents a pre-cutover code-hash cookie
  with no valid session cookie and no verified Kody visitor
- **THEN** it is denied (locked) and no cookie is set.

#### Scenario: Unauthenticated request is denied
- **WHEN** a request carries no verified visitor identity and no
  valid session cookie
- **THEN** it is denied (locked) and the response carries no app
  content.

### Requirement: Unlock writes only the session token to localStorage

A successful OTP unlock SHALL write only the minted session token
to browser `localStorage` (key `kody_os_auth`), where available,
as a fallback carrier for the session. No unlock path SHALL write
a device code to storage, and no code SHALL ever be stored. The
session cookie remains the primary carrier; absent or disabled
storage SHALL never block the unlock landing or the plain
Continue link.

#### Scenario: OTP unlock stores the session token only
- **WHEN** an OTP unlock succeeds
- **THEN** the stored value is the session token, the continue
  URL is clean, and no code appears in storage or in any URL.

### Requirement: Kody-authenticated visitors skip the device gate

A request carrying platform-verified visitor identity (`X-Kody-Visitor`
header set by the platform, confirmed via `kody.metaGetCurrentUser({})`)
for a user the platform grants app access to SHALL be served without
any cookie. Requests without verified identity SHALL fall through to
the session-cookie gate; the gate SHALL never fail open. (Unchanged
in substance; "device key" wording retired.)

#### Scenario: Owner opens the app signed in
- **WHEN** a Kody-signed-in user with app access opens the hosted app
- **THEN** every page renders with no device gate and no credential in
  any URL, and the footer reads `via kody`.

#### Scenario: Anonymous visitor still gated
- **WHEN** a request carries no verified visitor identity
- **THEN** the session-cookie gate applies exactly as without this change.

#### Scenario: Limited-browser Kody login counts as the Kody path, not a third path
- **WHEN** a visitor on a limited browser signs in via Kody's
  package-app sign-in route (`/-/auth/login`, plain HTML /
  sign-in-on-another-device, kody-hq/kody#4666) and arrives
  with platform-verified visitor identity
- **THEN** the request is served as a Kody visitor (`via kody`),
  with no derived code, no stored hash, and no device-key
  credential involved; this does not add a login path beyond
  the two named above.

### Requirement: No derived key exists; no secret is consulted

There SHALL be no derived key, no UI-managed secret, and no
secret-derived value anywhere in the package: no `access-key`
need in `package.json`, no `credential()` call in the fetch
path, no secret value in code, `packageStorage`, logs, or chat,
and no `configured` state. The base spec's derived-key and
key-management requirements are RETIRED in full. Key creation
in the Kody UI is no longer part of this package's setup at
all.

#### Scenario: No secret is required for any path
- **WHEN** the package is published with no secret bound
  (the only possible state)
- **THEN** Kody login and OTP unlock both work, and no setup
  step mentions a secret.

### Requirement: No secret means no rotation and no kill switch

Because no secret exists, there is no rotation semantic and no
rotation kill switch. Session invalidation is per-device logout
or 30-day expiry only. A global session revoke does not exist
as a runtime feature. Docs and code SHALL NOT claim that any
runtime action invalidates all sessions at once. EXCEPTION —
one-time cutover only (v2.0.0): the session and OTP registries
moved to versioned keys (`kody-os.auth.sessions.v2`,
`kody-os.auth.otp.v2`) and the v1 keys are never read, so
every pre-cutover session and outstanding OTP stopped working
at cutover. That is a migration effect of the version cutover,
not a revoke feature, and it does not recur.

#### Scenario: Logout revokes one device only
- **WHEN** a device logs out
- **THEN** that device's session stops working and other
  devices' sessions keep working.

#### Scenario: Sessions expire on their own
- **WHEN** a session is older than 30 days
- **THEN** it no longer authenticates, and only a fresh OTP
  (or Kody login) restores access.

#### Scenario: Pre-cutover sessions stop at the v2.0.0 cutover
- **WHEN** a session or OTP minted before v2.0.0 is presented
  after the cutover
- **THEN** it no longer authenticates (the v1 registry keys
  are never read), and only a fresh OTP (or Kody login)
  restores access.

### Requirement: OTP sessions are the only device path

Minting SHALL create a 4-digit OTP valid for 10 minutes and
single use, storing only its SHA-256 hash, with at most 5
outstanding codes and no secret gate of any kind. Failed unlock
attempts SHALL be capped at 10 per 10-minute window device-wide,
denying further attempts until the window passes. A correct OTP
SHALL burn itself and mint a session cookie (random 25-character
bearer, SHA-256 hash lookup in `kody-os.auth.sessions.v2`, HttpOnly,
30-day expiry, no credential in any URL). Requests SHALL
authenticate by session verification, failing closed on unknown
or expired tokens. The OTP plaintext SHALL be returned exactly
once at mint time and never logged, rendered, or stored. The
unlock form SHALL accept only the OTP, by any of the three
submission transports (unlock-form POST, `/unlock/<otp>` path
form since the edge drops query strings, or the no-JavaScript
`?k=` GET submission); a correct OTP SHALL land on a clean URL
with the cookie set, and a presented OTP SHALL never be stamped
onward into any link, form, or redirect. Per-device logout SHALL
revoke that device's session only. OTP is retained in full
by this change: removing the legacy access key does NOT
remove OTP, and no future secret-binding plan is implemented
here (see design.md, Relationship to auth-rethink).

#### Scenario: OTP unlocks a fresh device
- **WHEN** the owner mints an OTP via MCP and enters it on a device
  with no cookie
- **THEN** the device receives the session cookie and subsequent
  requests authenticate with no key material in any URL.

#### Scenario: OTP cannot be replayed
- **WHEN** an already-used or expired OTP is submitted, by any
  transport
- **THEN** it is rejected exactly like a wrong code, with nothing
  written, and any bookmark of it stays inert.

#### Scenario: Bookmarked OTP is inert
- **WHEN** a URL carrying a previously submitted `?k=` OTP value
  is opened again
- **THEN** it is denied (locked), because the OTP is already burned.
