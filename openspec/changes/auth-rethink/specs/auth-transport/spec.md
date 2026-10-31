# Spec Delta

## ADDED Requirements

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

### Requirement: Cookie is bound to the current secret

A presented cookie SHALL authenticate only if it verifies against
the CURRENT `access-key` secret (package-scope Kody secret,
publisher-supplied need declared in `package.json`, HMAC via the
scoped `credential().sign()` client). Cookie name SHALL be
`__Host-${packageContext.cookiePrefix}session` with HttpOnly, Secure,
SameSite=Lax, Path=/, no Domain. Value SHALL be payload (session id,
issued-at, expiry, version) + `sign()` HMAC. Verification SHALL
recompute the HMAC and constant-time compare every request with no
caching, AND match the session registry (exists, not revoked/expired);
exactly one `sign()` per verification. Error handling SHALL log
`err.code` + `err.message` and never swallow (`invalid_request` vs
`credential_denied` stays distinguishable). Since kody-hq/kody#4577 the
credential client binding is available inside anonymous fetch via the
per-request `kva1.` ticket (live, no republish needed), so `sign()`
verification at request time is a supported platform path. The secret value SHALL never appear in code,
`packageStorage`, logs, or chat. A cookie issued under a previous
secret value SHALL NOT authenticate. With no secret bound, NO cookie
SHALL authenticate, however it was issued.

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

### Requirement: Cookie is issued only through OTP verification

Minting SHALL create a 4-digit OTP valid for 10 minutes and single
use, storing only its SHA-256 hash, and SHALL fail closed with a
named machine-readable error when no secret is bound. Failed unlock
attempts SHALL be capped per code AND per IP/device-window with
constant-time compare, denying further attempts until the window passes. A correct OTP
SHALL burn itself and mint the secret-bound cookie (`__Host-` prefix,
HttpOnly, Secure, SameSite=Lax, Path=/, 30-day expiry, no credential in any URL). Requests SHALL
authenticate by cookie verification against the current secret (recompute + compare every request, one sign() per verify),
failing closed on unknown, expired, revoked-version, or previous-secret cookies.
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
- **THEN** that device's session version is bumped / revoke-listed so its cookie stops working, other devices'
  cookies keep working, and the secret is unchanged.

## MODIFIED Requirements

### Requirement: Footer reports the active auth path
Every shell page footer SHALL include the active auth path (`via kody`,
`via cookie`, or `locked`) so the login path is observable without
devtools. The `via key` path SHALL NOT appear.

#### Scenario: Owner reads the auth path off the page
- **WHEN** any authenticated page is fetched
- **THEN** the footer names `via kody` or `via cookie` as the path
  that authenticated the request, or `locked` when denied.

### Requirement: Kody-authenticated visitors skip the device key
A request carrying platform-verified visitor identity (`X-Kody-Visitor` header set by the platform, confirmed via `kody.metaGetCurrentUser({})`) for a user the platform grants app access to SHALL be served without any device key. Requests without verified identity SHALL fall through to the device-key gate; the gate SHALL never fail open. A host-signed anonymous visit ticket (`kva1.`, kody-hq/kody#4577) carries ONLY a per-request credential-client binding plus audience/nonce/expiry — it names no visitor (`visitor: null`) and SHALL NOT confer identity, storage scope, or capability authority; `visitorFor`, `createCallerContext`, and `metaGetCurrentUser` treat it exactly like no ticket. The ticket is transport for `credential().sign()` in anonymous fetch, not a third login path.

#### Scenario: Owner opens the app signed in
- **WHEN** a Kody-signed-in user with app access opens the hosted app
- **THEN** every page renders with no device gate and no `?k=` in links, and the footer reads `via kody`.

#### Scenario: Anonymous visitor still gated
- **WHEN** a request carries no verified visitor identity (including a request carrying only a `kva1.` anonymous ticket)
- **THEN** the device-key gate applies exactly as without this change.

### Requirement: Key management is Kody-UI-only
Key creation and replacement SHALL be possible ONLY through the Kody UI secret create/update flow (creation-link form); the in-app and MCP key-set paths SHALL be removed, and docs SHALL give the exact UI steps. Replacing the secret value SHALL change the derived code and invalidate every existing bookmark and cookie at once. With no key secret defined, the app SHALL serve Kody-logged-in users only. Defining the secret SHALL enable the cookie/device path. (This retires the base spec's "key is optional" wording as applied to the device path: the secret is optional only in the sense that login-only mode needs none.)

#### Scenario: Key rotation invalidates everything
- **WHEN** the owner replaces the secret value in the Kody UI
- **THEN** every existing bookmark and cookie stops working, exactly as rotation works today.

#### Scenario: No secret means login-only
- **WHEN** no key secret is defined
- **THEN** signed-in users with app access are served, anonymous requests are denied, and `mint_otp` fails closed.

### Requirement: Key is optional; login-only mode stays private
With no key secret defined, the app SHALL serve Kody-logged-in users only and stay private (no `internet_visible` required). Defining the secret SHALL enable the anonymous device-key path.

#### Scenario: No secret means login-only and private
- **WHEN** no key secret is defined
- **THEN** signed-in users with app access are served, anonymous requests are denied, and the package requires no `internet_visible` approval.

## REMOVED Requirements

### Requirement: Three key-delivery paths with visible fallback
The system SHALL authenticate requests via cookie first, then the JS enhancement path (key read from `localStorage`, attached to enhancement requests), then `?k=` query. Server-rendered links, forms, and redirects SHALL carry `?k=` only when the request authenticated via query; cookie- or enhancement-authenticated responses SHALL render clean URLs. Retired by Exactly two login paths: no `?k=` stamping, no enhancement key path; cookie or Kody visitor only.

#### Scenario: Cookied browser gets clean URLs
- **WHEN** a request presents a valid auth cookie
- **THEN** the response HTML contains no `?k=` in links, forms, or redirects.

#### Scenario: Query-authenticated session keeps working
- **WHEN** a request authenticates via `?k=` with no valid cookie
- **THEN** the response keeps `?k=` stamped in links, forms, and redirects exactly as today.

#### Scenario: Enhancement attaches the key without links
- **WHEN** the client enhancement runs with a stored key and `fetch` available
- **THEN** enhancement requests authenticate without `?k=` in the page's rendered links, falling back to native submit on any failure.

### Requirement: Unlock writes localStorage where available
The unlock form's success path SHALL write the key to `localStorage` via an inline script when storage exists, in addition to the existing cookie; storage absence SHALL never block the redirect. Retired: no key material in storage; cookie only.

#### Scenario: Storage-less unlock still lands
- **WHEN** the unlock form succeeds in a browser without `localStorage`
- **THEN** the redirect carries `?k=` and the session works exactly as today.

### Requirement: Key is derived from a UI-managed secret, never stored
The device key SHALL be derived inside the package as HMAC-SHA256 (via the scoped `credential().sign()` client) of a fixed domain string under a package-scope Kody secret (publisher-supplied need declared in `package.json`), unambiguous-alphabet encoded and formatted exactly like today's codes. Retired as a user-visible code path: HMAC via `credential().sign()` remains as the cookie-verification mechanism (see Cookie is bound to the current secret), but no derived code is typed, bookmarked, or read out.

#### Scenario: Derived code round-trips
- **WHEN** a request presents the currently derived code via `?k=` or the unlock form
- **THEN** the handler recomputes the derivation and serves the request, with no stored hash comparison.

### Requirement: OTP sessions replace the secret on the device path
Minting SHALL create a 4-digit OTP valid for 10 minutes and single use, storing only its SHA-256 hash. Replaced by Cookie is issued only through OTP verification (secret-bound cookie, `mint_otp` fails closed with no secret bound).

#### Scenario: OTP unlocks a fresh device
- **WHEN** the owner mints an OTP via MCP and enters it on a device with no cookie
- **THEN** the device receives a session cookie and subsequent requests authenticate with no key material in any URL.

#### Scenario: OTP cannot be replayed
- **WHEN** an already-used or expired OTP is submitted
- **THEN** it is rejected exactly like a wrong code, with nothing written.
