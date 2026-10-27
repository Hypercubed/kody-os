# Device access: OTP sessions first, derived code as fallback

The browser shell lock exists so the Kindle Scribe can open the OS without
Kody login. The primary path is **OTP sessions**: the owner mints a short
one-time code over MCP, the device holder types it once, and the browser
keeps a session cookie after that. No code, token, or `?k=` ever appears in
a URL.

## Unlock a device (owner + device holder)

1. The owner calls the package MCP export `mint_otp`. It returns
   `{ ok: true, code: "<4 digits>", error: "" }` — the plaintext exactly
   once. It is never logged, rendered, or stored; only its SHA-256 hash
   rests in `packageStorage`, valid 10 minutes, at most 5 outstanding
   (minting a 6th while 5 are live returns `{ ok: false, error: "too many
   outstanding codes" }`).
2. On the device, open the app and type the 4 digits into the unlock form.
   A correct OTP is burned on first use and mints a session: a random
   25-char token whose SHA-256 hash is stored with 30-day expiry, carried
   in an HttpOnly session cookie, and mirrored to `localStorage` under the
   familiar `kody_os_auth` key so the enhancement fast path keeps working.
   Later requests authenticate by session-cookie hash lookup — the address
   bar stays clean from the first submit onward.
3. A used or expired OTP reads exactly like a wrong code, with a named
   inline error. At most 10 failed unlock attempts are allowed per 10-minute
   window device-wide; further attempts are denied ("Too many attempts")
   until the window passes, and any success clears the counter.

The session bearer is revocable without touching anything else: it expires
30 days after minting, and the in-app Logout link (shown only on device
sessions, never on Kody-login sessions) deletes the server-side token and
clears the cookie at once.

No code, token, or `?k=` value is ever rendered into links, forms, or
redirects: the unlock form submits to `/unlock/<code>` (rewritten in place
by a small inline script; without JavaScript the plain GET still works
where the platform passes query strings), and a successful unlock
303-redirects to the clean app home while setting the cookie.

### Scribe cookie caveat

The Scribe browser keeps storage for the session at best. Within one Scribe
session the cookie works: enter one OTP, browse with clean URLs. Once the
Scribe session ends, the cookie is gone — mint and enter a fresh OTP for
the next session. Verified working on-device (2026-10-26/27).

## Fallback: the derived device code (secret path)

Anonymous `credential()` calls never resolve for signed-out visitors, so
the secret-derived path cannot serve the device gate on its own — but it
remains in place as fallback (for example where the platform passes query
strings, and for local preview). The legacy mechanics are unchanged:

- The code is **derived inside the package** as HMAC-SHA256 of the fixed
  domain string `kody-os/access-key/v1` under a package-scope Kody secret,
  encoded in the unambiguous alphabet and grouped exactly like the old
  generated codes. The secret value never appears in code, storage, logs,
  or chat; the handler recomputes the code per request.
- There is no MCP or in-app set path: key management is Kody-UI-only.
  Need name: `access-key` (declared in `pkg/package.json` under
  `kody.credentials`: kind `secret` plus description; publisher supply is
  the default package behavior).
- **Create the secret (owner, one time):** sign in to Kody as the package
  owner and open the credential creation form
  (`https://kody.codes/@<org>/-/credentials/new?kind=secret&name=access-key`,
  replacing `<org>` with the organization slug). Save any random value —
  it is never shown again and never typed anywhere.
- **Hosts matter:** Kody's edge drops any cookie or signature whose host
  is not whitelisted on the credential. Open the secret's detail page and
  add the app's hosted hostname (for example `hypercubed.kody.run`) to its
  hosts, or every request falls through to locked. Nothing is ever fetched
  from that hostname.
- **Rotate the code (owner, any time):** reopen the same `access-key`
  secret in the Kody UI and overwrite its value, then save. The derived
  code changes at once: every existing bookmark and cookie stops working
  immediately. No republish, no code or storage write.
- **Read the current code (owner, via MCP):** call the package MCP export
  `get_access_code`. When a secret is bound it returns `{ ok: true, code:
  "<derived-code>" }`; otherwise `{ ok: false, code: "" }` — a locked /
  not-applicable signal, never a guessable value, and never the secret
  itself.

## Login-only mode (no secret, stays private)

With no `access-key` secret defined, the app serves Kody-logged-in visitors
only (`via kody`) and denies anonymous requests at the device gate. This
mode needs no `internet_visible` approval: keep the package private.

## Footer: version and build

Every page footer names the active auth path (`via kody`, `via cookie`,
`via key`, or `locked`) followed by the package version and build number
from `pkg/package.json`, e.g. `via cookie · v0.1.4 · b2`. The build number
increments on every publish; the version bumps on user-visible changes.

## Local preview note

Local `kody dev` has no bound secret, so the derived path is empty there
and the pre-secret stored-hash fallback applies: seed a throwaway dev hash
in the mock store (a local test fixture, not key management) as described
in [Adding an app](adding-an-app.md). OTP minting works the same locally
(the mock store stands in for `packageStorage`), so the full
unlock → cookie → act loop is testable without the hosted secret.
