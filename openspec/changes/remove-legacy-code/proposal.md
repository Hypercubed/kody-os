# Proposal

## Why

The shell still has two device-login systems, and the older one is
now purely a liability. The derived-code path (an HMAC-derived code
under the Kody `access-key` secret, plus a stored-hash fallback) is
checked *before* the OTP path, is deterministic until the secret
rotates, is bookmarkable and shareable in a URL, and is readable
through the `get_access_code` MCP export. Anyone who learns the code
has access until rotation, with no per-device revocation — so the
security of the whole gate is bounded by its weakest path. The OTP
path, by contrast, needs no secret at all: a random 4-digit code,
hash-only storage, single use, 10-minute expiry, burned into a
random 25-character session bearer with a 30-day HttpOnly cookie.
The owner directed on 2026-10-29 that there be no legacy path at
all. This change implements exactly that removal, and nothing else:
no secret-binding of cookies, no new invalidation mechanism. The
secret-bound redesign in the parked `auth-rethink` change is NOT
implemented here (see design.md, Relationship to auth-rethink).

## What Changes

- Exactly two ways in: a platform-verified Kody visitor, or a
  session cookie issued only by burning an OTP. No third path.
  The legacy path is removed in full: no derived code, no
  stored-hash fallback, no code-hash cookie, no `get_access_code`
  readout, no `get_access_status`, no `access-key` need in
  `package.json`, no `via key` footer state, no hidden `k` fields
  on action forms, no link/form/redirect stamping of any
  credential, and no code written to browser storage by any
  unlock path.
- The OTP ceremony is unchanged and is now the only device path:
  4 digits, 10 minutes, single use, at most 5 outstanding,
  device-wide failure cap of 10 per 10 minutes, plaintext
  returned exactly once at mint time, no secret gate on
  `mint_otp`. The unlock form still takes the OTP; the three
  current submission transports (unlock-form POST, the
  `/unlock/<otp>` path form, and the no-JavaScript `?k=` GET
  submission) are retained as *submission* transports only —
  a presented OTP burns on first use, and success 303s to a
  clean URL with the session cookie set. A `?k=` value is never
  stamped onward, never rendered in a link or form, and a
  bookmarked OTP is inert because it is already burned.
- The session cookie keeps its current registry form (random
  bearer, SHA-256 hash lookup, 30-day expiry, HttpOnly,
  SameSite=Lax, Secure on HTTPS, path-scoped). There is no
  secret to rotate and no rotation kill switch: sessions end by
  per-device logout or 30-day expiry. A global revoke does not
  exist; that is a stated non-goal, not an oversight (see
  design.md).
- BREAKING, by design: every derived code, `?k=` bookmark, and
  code-hash cookie stops working, and two MCP exports are
  removed. Existing OTP-minted sessions keep working. Version:
  MAJOR at implementation — see design.md.

## Capabilities

### New Capabilities

(none — this change only removes)

### Modified Capabilities

- `auth-transport`: the device-login model becomes Kody visitor
  or OTP-issued session cookie, with the secret and the derived
  code retired; every requirement in the base spec is restated
  or retired in the delta.
- `shell`: footer auth-path vocabulary loses `via key`; shell
  chrome, enhancement, and form conventions lose all code
  handling; Help/empty-state copy loses the legacy path.

## Impact

- `pkg/src/auth.ts` (derived/stored branches, legacy cookie,
  exports removed; OTP + session verification unchanged),
  `pkg/src/app.ts` (unlock, stamping, footer, Help copy),
  `pkg/src/apps/client.ts` (hidden `k` fields removed),
  `pkg/src/client/index.ts` (stored-code read/attach removed;
  stored session-token read retained — see design.md),
  `pkg/src/index.ts` (exports removed),
  `pkg/package.json` (`access-key` need removed),
  `pkg/scripts/seed-dev-hash.ts` (retired; replaced by a
  mock OTP-mint script for local dev),
  `pkg/docs/device-key.md` (rewritten to the OTP-only model),
  `pkg/AGENTS.md` + `pkg/README.md` (gate, exports, version,
  local-dev copy), `pkg/docs/adding-an-app.md` (device-key
  passages).
- No storage-key changes for apps. The stale
  `kody-os.auth.code_hash` key in live packageStorage is never
  read again and needs no migration. Publishing with the need
  removed changes the capability fingerprint, so the owner must
  re-approve the capability set in the Kody UI before the new
  publish serves (owner-only step; the agent SHALL NOT approve
  on the owner's behalf).
- This change interacts with the app-store change (any `k`-field
  forms it adds are removed here, or never added if it lands
  after) and the setup-guide change (its auth section is written
  against the auth-rethink model and SHALL be corrected to this
  model — reciprocal task, see tasks.md).
