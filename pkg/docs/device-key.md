# Device access: OTP sessions only

kody-os is private. There are exactly two ways into the browser shell,
and no setup step for either beyond what the platform already provides:

1. **Kody login (owner).** A platform-verified Kody visitor with role
   `owner` in the owning org skips the device gate. Any other verified
   visitor, and any anonymous visitor, falls through to the device gate.
   On a limited browser (e.g. the Kindle Scribe stock browser) use the
   host-root platform sign-in route, not a path under the app:
   `https://hypercubed.kody.run/-/auth/login?app=kody-os`
   (with `return_to=/kody-os/` to land back in the app). The platform
   sign-in also offers a "sign in on another device" code flow for
   limited browsers. This is a platform path, not a kody-os path: there
   is no sign-in button inside kody-os itself.
2. **One-time code (OTP) device login.** The owner mints a 4-digit code
   with the `mint_otp` MCP export. The code is single use, valid for 10
   minutes, and at most 5 may be outstanding at once. Entering it in the
   shell's unlock form (or opening `/unlock/<code>`, or submitting it
   as `?k=` on a GET) burns it and mints a 30-day session: a random
   25-character bearer whose SHA-256 hash is stored, carried in an
   HttpOnly session cookie. The raw code and the raw bearer are never
   stored in package storage, logged, or rendered anywhere. (The
   unlock interstitial also writes the session token to `localStorage`
   under `kody_os_auth` as a carrier; fetches authenticate with the
   cookie, not with that stored value.)

There is no other way in. There is no secret to create, no value to
configure, no derived code, no stored-hash fallback, and no code-hash
cookie. A bookmarked or replayed code is inert: it was already burned,
or it expired. A device that loses its cookie needs a fresh OTP or a
Kody login.

## How the gate reads

- The shell footer names the active path: `via kody`, `via cookie`, or
  `locked`, followed by the package version and build number.
- A valid session cookie authenticates every request by hash lookup.
  The cookie name carries the platform cookie prefix when one is
  supplied; the legacy bare name is still accepted on read so existing
  cookies keep working, and logout clears both names.
- The `?k=` parameter is only a single-use OTP submission transport.
  It never authenticates a session token, never appears in a link, form,
  redirect, or bookmark the shell renders, and is stripped from action
  arguments (along with `from` and `format`) before an action runs.
  Authentication after unlock rides the cookie alone; same-origin
  fetches (the shell client enhancement and bundle bridge actions) send
  the cookie and attach no credential to the URL.
- Unlock attempts are capped device-wide: 10 failures per 10-minute
  window, after which further attempts read exactly like a wrong code
  until the window passes. A successful unlock clears the counter.
- Logout is per-device: it revokes only the session presenting that
  request's cookie (a silent no-op for missing or unknown tokens) and
  clears the cookie. Other devices' sessions are untouched.

## Cutover invalidation (v2.0.0)

Version 2.0.0 moved the session and OTP registries to versioned keys:
`kody-os.auth.sessions.v2` and `kody-os.auth.otp.v2`. The v1 keys are
never read, never migrated, and never a fallback, so every session and
outstanding OTP minted before the cutover stopped working when 2.0.0
went live. Affected devices need a fresh OTP or Kody login. There is
no secret to rotate and therefore no rotation kill switch: sessions
end by per-device logout or 30-day expiry.

To clear sessions and OTPs from a local/mock store, run from `pkg/`:

```bash
kody execute --target mock --file scripts/clear-auth.ts
```

It returns only counts cleared, never hashes, tokens, or codes, and
touches no app definition or app state. It is a local/mock maintenance
tool, not a live cutover mechanism: ad-hoc hosted execute cannot write
package storage (it has no package provenance), so the live cutover
invalidation is the versioned-key move itself, not a script run.

## Local preview

The local preview (`kody dev --target mock`) uses the same gate against
its own mock store, which is separate from the hosted store. A fresh
mock store is locked until you mint a local OTP:

```bash
cd pkg
kody execute --target mock --file scripts/mint-dev-otp.ts
```

Mint while `kody dev` is stopped, then start it (or restart it
afterward): writes made while the preview is running never reach its
in-memory snapshot. Enter the minted code in the unlock form; the
footer then reads `via cookie` with a clean URL. A later restart with
the mock store intact does not need a fresh code — only a store reset
or a lost cookie does.

## Exports

- `mint_otp` — mint a 4-digit OTP (returns the code exactly once).
- There is no access-code readout export and no session-listing export.
  Session and OTP registries hold SHA-256 hashes only, so no export
  can present a device's raw bearer or code.

## See also

- [Setup](setup.md) — the two ways in, from the operator's side.
- [Agent guide](../AGENTS.md) — the gate, the local-dev flow, and the
  mock-write ordering rule.
