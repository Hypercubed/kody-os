# Spec Delta

## MODIFIED Requirements

### Requirement: Exactly two login paths, no legacy path

The system SHALL authenticate a fetch request by exactly one of two
paths: a platform-verified Kody visitor, or a cookie bound to the
current `access-key` secret. There SHALL be no third path. In
particular, the system SHALL NOT accept: a typed derived code, a
`?k=` query code or bookmark, a code-hash cookie, a stored-hash
fallback comparison, a `get_access_code` readout, or any credential
carried in a URL, link, form, or redirect. A request presenting only
a retired credential SHALL be denied exactly like an unauthenticated
request, with no fallback comparison of any kind.

#### Scenario: Derived code is denied
- **WHEN** a request presents the currently derived code (typed code,
  `?k=` form, or bookmark) with no valid cookie and no verified
  Kody visitor
- **THEN** it is denied (locked), storage is unchanged, and no
  cookie is set.

#### Scenario: Old cookie is denied after cutover
- **WHEN** a request presents a pre-rethink cookie (registry token
  unbound to any secret, or code-hash cookie)
- **THEN** it is denied (locked) and no cookie is set.

#### Scenario: Unauthenticated request is denied
- **WHEN** a request carries no verified visitor identity and no
  valid cookie
- **THEN** it is denied (locked) and the response carries no app
  content.

### Requirement: Footer reports the active auth path

Every shell page footer SHALL include the active auth path (`via kody`,
`via cookie`, or `locked`) so the login path is observable without
devtools. The `via key` path SHALL NOT appear.

#### Scenario: Owner reads the auth path off the page
- **WHEN** any authenticated page is fetched
- **THEN** the footer names `via kody` or `via cookie` as the path
  that authenticated the request, or `locked` when denied.

### Requirement: Kody-authenticated visitors skip the device gate

A request carrying platform-verified visitor identity (`X-Kody-Visitor`
header set by the platform, confirmed via `kody.metaGetCurrentUser({})`)
for a user the platform grants app access to SHALL be served without
any cookie. Requests without verified identity SHALL fall through to
the cookie gate; the gate SHALL never fail open.

#### Scenario: Owner opens the app signed in
- **WHEN** a Kody-signed-in user with app access opens the hosted app
- **THEN** every page renders with no device gate and no credential in
  any URL, and the footer reads `via kody`.

#### Scenario: Anonymous visitor still gated
- **WHEN** a request carries no verified visitor identity
- **THEN** the cookie gate applies exactly as without this change.

### Requirement: Cookie is bound to the current secret

A presented cookie SHALL authenticate only if it verifies against
the CURRENT `access-key` secret (package-scope Kody secret,
publisher-supplied need declared in `package.json`, HMAC via the
scoped `credential().sign()` client). The secret value SHALL never
appear in code, `packageStorage`, logs, or chat. A cookie issued
under a previous secret value SHALL NOT authenticate. With no
secret bound, NO cookie SHALL authenticate, however it was issued.

#### Scenario: Cookie verifies against the current secret
- **WHEN** a request presents a cookie issued under the current
  secret value
- **THEN** it is served, with no credential in any URL.

#### Scenario: Previous-secret cookie is denied
- **WHEN** the secret value has changed since a cookie was issued
  and the cookie is presented again
- **THEN** it is denied (locked) and no cookie is set.

#### Scenario: No secret means no cookie auth
- **WHEN** no `access-key` secret is bound and a request presents
  any cookie without a verified Kody visitor
- **THEN** it is denied (locked).

### Requirement: Secret rotation or deletion invalidates all cookies

Replacing the `access-key` secret value in the Kody UI, or deleting
the secret, SHALL invalidate every existing cookie at once, with no
per-session cleanup, no migration, and no grace period. Fresh OTPs
after the change SHALL be the only way back in for device sessions
(Kody login is unaffected).

#### Scenario: Rotation invalidates everything
- **WHEN** the owner replaces the secret value in the Kody UI
- **THEN** every existing cookie stops working on every device, and
  only a fresh OTP (or Kody login) restores access.

#### Scenario: Deletion invalidates everything
- **WHEN** the owner deletes the `access-key` secret
- **THEN** every existing cookie stops working, `mint_otp` fails
  closed, and only Kody login (or re-creating the secret plus a
  fresh OTP) restores device access.

### Requirement: Key management is Kody-UI-only, and the secret is required for the cookie path

Key creation and replacement SHALL be possible ONLY through the Kody
UI secret create/update flow; the in-app and MCP key-set paths SHALL
NOT exist. With no key secret defined, the app SHALL serve
Kody-logged-in users only. Defining the secret SHALL enable the
cookie/device path. (This retires the base spec's "key is optional"
wording as applied to the device path: the secret is optional only
in the sense that login-only mode needs none.)

#### Scenario: No secret means login-only
- **WHEN** no key secret is defined
- **THEN** signed-in users with app access are served, anonymous
  requests are denied, and `mint_otp` fails closed.

### Requirement: Cookie is issued only through OTP verification

Minting SHALL create a 4-digit OTP valid for 10 minutes and single
use, storing only its SHA-256 hash, and SHALL fail closed with a
named machine-readable error when no secret is bound. Failed unlock
attempts SHALL be capped at 10 per 10-minute window device-wide,
denying further attempts until the window passes. A correct OTP
SHALL burn itself and mint the secret-bound cookie (HttpOnly,
30-day expiry, no credential in any URL). Requests SHALL
authenticate by cookie verification against the current secret,
failing closed on unknown, expired, or previous-secret cookies.
The OTP plaintext SHALL be returned exactly once at mint time and
never logged, rendered, or stored. The unlock form SHALL accept
only the OTP (path form `/unlock/<otp>`, since the edge drops query
strings); a correct OTP SHALL 303 to a clean URL with the cookie
set. Per-device logout SHALL revoke that device's cookie without
rotating the secret.

#### Scenario: OTP unlocks a fresh device
- **WHEN** the owner mints an OTP via MCP and enters it on a device
  with no cookie, with the secret bound
- **THEN** the device receives the secret-bound cookie and
  subsequent requests authenticate with no key material in any URL.

#### Scenario: OTP cannot be replayed
- **WHEN** an already-used or expired OTP is submitted
- **THEN** it is rejected exactly like a wrong code, with nothing
  written.

#### Scenario: OTP minting requires a bound secret
- **WHEN** `mint_otp` is called with no `access-key` secret bound
- **THEN** it returns `{ ok: false }` with a named error, writes
  nothing, and no OTP is issued.

#### Scenario: Logout revokes one device only
- **WHEN** a device logs out
- **THEN** that device's cookie stops working, other devices'
  cookies keep working, and the secret is unchanged.
