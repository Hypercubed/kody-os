# auth-transport Specification

## Purpose
Move the device access key out of the URL on browsers that support it, let Kody-authenticated visitors skip the device key, and hold the key hash in secret storage — while keeping `?k=` as the working fallback for storage-less sessions.

## Requirements

### Requirement: Three key-delivery paths with visible fallback
The system SHALL authenticate requests via cookie first, then the JS enhancement path (key read from `localStorage`, attached to enhancement requests), then `?k=` query. Server-rendered links, forms, and redirects SHALL carry `?k=` only when the request authenticated via query; cookie- or enhancement-authenticated responses SHALL render clean URLs.

#### Scenario: Cookied browser gets clean URLs
- **WHEN** a request presents a valid auth cookie
- **THEN** the response HTML contains no `?k=` in links, forms, or redirects.

#### Scenario: Query-authenticated session keeps working
- **WHEN** a request authenticates via `?k=` with no valid cookie
- **THEN** the response keeps `?k=` stamped in links, forms, and redirects exactly as today.

#### Scenario: Enhancement attaches the key without links
- **WHEN** the client enhancement runs with a stored key and `fetch` available
- **THEN** enhancement requests authenticate without `?k=` in the page's rendered links, falling back to native submit on any failure.

### Requirement: Footer reports the active auth path
Every shell page footer SHALL include the active auth path (`via kody`, `via cookie`, `via key`, or `locked`) so cookie survival through Kody's edge is observable without devtools.

#### Scenario: Owner reads the auth path off the page
- **WHEN** any authenticated page is fetched
- **THEN** the footer names the path that authenticated the request.

### Requirement: Unlock writes localStorage where available
The unlock form's success path SHALL write the key to `localStorage` via an inline script when storage exists, in addition to the existing cookie; storage absence SHALL never block the redirect.

#### Scenario: Storage-less unlock still lands
- **WHEN** the unlock form succeeds in a browser without `localStorage`
- **THEN** the redirect carries `?k=` and the session works exactly as today.

### Requirement: Kody-authenticated visitors skip the device key
A request carrying platform-verified visitor identity (`X-Kody-Visitor` header set by the platform, confirmed via `kody.metaGetCurrentUser({})`) for a user the platform grants app access to SHALL be served without any device key. Requests without verified identity SHALL fall through to the device-key gate; the gate SHALL never fail open.

#### Scenario: Owner opens the app signed in
- **WHEN** a Kody-signed-in user with app access opens the hosted app
- **THEN** every page renders with no device gate and no `?k=` in links, and the footer reads `via kody`.

#### Scenario: Anonymous visitor still gated
- **WHEN** a request carries no verified visitor identity
- **THEN** the device-key gate applies exactly as without this change.

### Requirement: Key is derived from a UI-managed secret, never stored
The device key SHALL be derived inside the package as HMAC-SHA256 (via the scoped `credential().sign()` client) of a fixed domain string under a package-scope Kody secret (publisher-supplied need declared in `package.json`), unambiguous-alphabet encoded and formatted exactly like today's codes. The secret value SHALL never appear in code, `packageStorage`, logs, or chat; `packageStorage` SHALL hold no auth secrets.

#### Scenario: Derived code round-trips
- **WHEN** a request presents the currently derived code via `?k=` or the unlock form
- **THEN** the handler recomputes the derivation and serves the request, with no stored hash comparison.

### Requirement: Key management is Kody-UI-only
Key creation and replacement SHALL be possible ONLY through the Kody UI secret create/update flow (creation-link form); the in-app and MCP key-set paths SHALL be removed, and docs SHALL give the exact UI steps. Replacing the secret value SHALL change the derived code and invalidate every existing bookmark and cookie at once.

#### Scenario: Key rotation invalidates everything
- **WHEN** the owner replaces the secret value in the Kody UI
- **THEN** every existing bookmark and cookie stops working, exactly as rotation works today.

### Requirement: Key is optional; login-only mode stays private
With no key secret defined, the app SHALL serve Kody-logged-in users only and stay private (no `internet_visible` required). Defining the secret SHALL enable the anonymous device-key path.

#### Scenario: No secret means login-only and private
- **WHEN** no key secret is defined
- **THEN** signed-in users with app access are served, anonymous requests are denied, and the package requires no `internet_visible` approval.

### Requirement: OTP sessions replace the secret on the device path
Minting SHALL create a 4-digit OTP valid for 10 minutes and single use, storing only its SHA-256 hash. Failed unlock attempts SHALL be capped at 10 per 10-minute window device-wide, denying further attempts until the window passes. A correct OTP SHALL burn itself and mint a session (random token, hash stored with 30-day expiry, raw token in an HttpOnly cookie). Requests SHALL authenticate by session-cookie hash lookup, failing closed on unknown or expired sessions. The OTP plaintext SHALL be returned exactly once at mint time and never logged, rendered, or stored.

#### Scenario: OTP unlocks a fresh device
- **WHEN** the owner mints an OTP via MCP and enters it on a device with no cookie
- **THEN** the device receives a session cookie and subsequent requests authenticate with no key material in any URL.

#### Scenario: OTP cannot be replayed
- **WHEN** an already-used or expired OTP is submitted
- **THEN** it is rejected exactly like a wrong code, with nothing written.
