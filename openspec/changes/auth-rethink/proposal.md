# Proposal

## Why

The shell currently has two parallel device-login systems, and the
second one quietly undid the security property the first was built
for. The derived-code path (HMAC of a fixed string under the Kody
`access-key` secret) made rotation a global kill switch: change or
delete the secret and every bookmark and cookie died. The OTP path
added later (auth-transport task 7) replaced the secret on the device
path with a stored registry of random session bearers: OTPs work with
no secret at all, and rotating the secret revokes nothing except the
legacy code path. The two systems share one cookie name, one footer
vocabulary (`via key` covers both), and one unlock form, so the
rotation guarantee reads as true while being false for every
OTP-minted session. The intended model was always the simpler one:
login is Kody login, or a cookie — and that cookie is bound to the
secret, issued only through OTP verification, so deleting or changing
the secret invalidates all cookies at once.

## What Changes

- Exactly two ways in: a platform-verified Kody visitor, or a cookie.
  No third path. The legacy path is removed in full: no typed derived
  code, no `?k=` bookmarks or link/form stamping, no code-hash cookie,
  no stored-hash fallback, no `get_access_code` readout, no
  `via key` footer state, no hidden `k` fields, no client enhancement
  reading or attaching key material.
- The cookie is bound to the `access-key` secret (the HMAC path):
  issued only when a presented OTP burns, and verifiable only against
  the *current* secret. Deleting the secret or changing its value
  SHALL invalidate every cookie, with no per-session cleanup and no
  migration of old sessions. Old-format (unbound registry) cookies
  SHALL NOT authenticate after the cutover.
- Minting an OTP requires a bound secret. With no secret bound, the
  package serves Kody-logged-in visitors only (login-only mode) and
  `mint_otp` fails closed instead of minting a cookie that could
  never verify. The secret is therefore required for the cookie/device
  path and remains owner-created in the Kody UI only; there is still
  no MCP or in-app set path.
- OTP mechanics are unchanged: 4 digits, 10 minutes, single use, at
  most 5 outstanding, device-wide failure cap, plaintext returned
  exactly once. The unlock form still takes the OTP (path form
  `/unlock/<otp>`, since the edge drops query strings), then 303s to
  a clean URL with the cookie set. Per-device logout and the 30-day
  cookie lifetime are retained under whichever cookie shape the
  implementation chooses (see design.md, Decision 1).
- This change is gated: implementation SHALL NOT start until a live
  anonymous-fetch probe proves `credential().sign()` resolves inside
  an anonymous fetch request (design.md, Gate 0). If it does not
  resolve, the HMAC-verification design cannot check cookies at
  request time, and the spec is revisited instead of built.
- Platform update 2026-10-30 (kody-hq/kody#4577, merged): anonymous
  package-app requests now get their own credential client binding
  via a host-signed visitor-less ticket (`kva1.`, purpose
  `kody-package-app-anonymous-visit@v1`, carrying only audience +
  nonce + expiry + that request's binding). Before this fix anonymous
  requests passed an empty binding to `credential()`, so `sign()` /
  `fetch()` threw `invalid_request` at first use — the exact Gate 0
  failure observed 2026-10-29 on v0.1.7. The bridge/gateway now take
  the binding from the ticket while still treating the request as
  anonymous (`visitor: null`, `metaGetCurrentUser` still anonymous).
  Gate 0 is therefore re-testable on any hosted build containing
  the fix; see design.md Decision 0.
- BREAKING, by design: every existing device cookie, bookmark, and
  stored code stops working. MCP exports change (`get_access_code`
  removed). Version: MAJOR at implementation — see design.md.

## Capabilities

### New Capabilities

(none — both behaviors extend existing capabilities)

### Modified Capabilities

- `auth-transport`: the whole device-login model is replaced by the
  two-path, secret-bound-cookie model above; every requirement in
  the base spec is restated or retired in the delta.
- `shell`: footer auth-path vocabulary loses `via key`; shell chrome,
  enhancement, and form conventions lose all `?k=`/key handling;
  Help/empty-state copy loses the legacy path.

## Impact

- `pkg/src/auth.ts` (gate rewrite: cookie verification, OTP issuance
  gating, removal of derived-code entry, stored hash, and legacy
  cookie), `pkg/src/app.ts` (unlock, stamping, footer, Help copy),
  `pkg/src/apps/client.ts` (enhancement key handling removed),
  `pkg/src/index.ts` (export list: `get_access_code` removed),
  `pkg/scripts/seed-dev-hash.ts` (retired with the stored hash),
  `pkg/docs/device-key.md` (rewritten to the new model),
  `pkg/AGENTS.md` + `pkg/README.md` (gate, version, and local-dev
  copy), `pkg/docs/setup.md` (auth section updated if the
  setup-guide change has landed — reciprocal task).
- No storage-key changes for apps; session storage is versioned so
  old-format cookies cannot authenticate after the cutover. MCP
  exports other than `get_access_code` keep their signatures;
  `mint_otp` gains the secret-bound failure case, and
  `get_access_status` gains the new meaning (secret bound = cookie
  path enabled).
- This change depends on the probe (Gate 0) and interacts with the
  app-store change (install forms and "authenticated shell request"
  follow the new transport; if the store lands first, its `k`-field
  forms are removed here) and the setup-guide change (its auth
  section is written against this model).
