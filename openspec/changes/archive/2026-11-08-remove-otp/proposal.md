# Change: Remove the one-time code (OTP) — Kody login only, mock login-free

## Why

The shell authenticates by two paths: a platform-verified Kody visitor, or a session cookie issued only by burning a single-use OTP (`mint_otp`). The OTP was the fallback for devices that could not sign in to Kody, and the only way to unlock local dev (`kody dev --target mock`), which has no real Kody platform to verify a visitor.

Both reasons are gone. Users can now sign in to Kody on a Kindle Scribe, so the Scribe — the one device that needed the OTP fallback — uses Kody login like anywhere else. And local dev does not need an auth gate at all: the mock server runs on the developer's own machine, so making it login-free removes the mint-and-unlock step from every dev cycle without any security cost.

So the OTP is redundant. Removing it leaves one login path (Kody login), one less system to maintain (no OTP registry, no unlock form, no session-cookie issuance), and a login-free mock.

## What changes

- **Kody login is the only auth path.** A request is served only with platform-verified visitor identity (`X-Kody-Visitor`, confirmed via `kody.metaGetCurrentUser`). There is no session cookie, no OTP, no unlock form or route, and no `?k=` submission.
- **The mock target is login-free.** Under `kody dev --target mock` the device gate is skipped entirely, so local dev needs no unlock step.
- **`mint_otp` is removed** from the package root exports and from `main()`'s exports. The OTP registry keys (`kody-os.auth.otp.v2`, legacy `kody-os.auth.otp`), the session registry's OTP-issued entries, and the OTP mint/check/unlock code are removed.
- **Footer and Logout follow.** The footer reports only `via kody` or `locked` (no `via cookie`). The Logout link, which existed only for cookie-authenticated pages, is removed; signing out of Kody itself is how a Kody visitor ends a session.
- **Docs and tests follow.** Setup, README, device-key, and package docs drop the OTP path and say Kody login only (mock login-free). OTP-related tests are removed or rewritten; the mock no longer mints or unlocks.

## What does not change

- The Kody login path itself (`isKodyOwnerVisitor`, platform-verified visitor, limited-browser Kody sign-in via `/-/auth/login`) is unchanged.
- The device gate still fails closed: without verified visitor identity, a hosted request is denied (locked). Only the mock target skips the gate.
- No secret is introduced. The package still has no secret, no rotation, and no kill switch.
- The parked `auth-rethink` change stays parked. This is a narrower, user-directed removal, not the full auth rethink; if auth-rethink is ever revived, it rewrites from this new end state.

## Impact

- This is a breaking change: it removes the `mint_otp` MCP export and an entire login path. By the repo's version policy it reads as MAJOR. The version decision is deferred to publish, as usual.
- Existing OTP sessions stop working at the publish that carries this change (there is no OTP registry to read them from). Kody login is unaffected. Users on a device with only an OTP session will need to sign in to Kody once.
- The `mint-dev-otp` and `clear-auth` dev scripts go away if they are OTP-only (see tasks).
