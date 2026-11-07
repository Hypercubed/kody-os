# Design: Remove the one-time code (OTP)

## Decisions

### Decision 1 — Kody login is the only auth path

A fetch request is authenticated only by platform-verified visitor identity (`X-Kody-Visitor` header set by the platform, confirmed via `kody.metaGetCurrentUser({})`) for a user the platform grants app access to. There is no session cookie, no OTP, no unlock form, no `/unlock/<code>` route, and no `?k=` submission. A request without verified visitor identity is denied (locked), exactly as an unauthenticated request is today. The gate still fails closed; only the mock target (Decision 2) skips it.

### Decision 2 — The mock target is login-free

Under `kody dev --target mock` the device gate is skipped entirely: every request is served without any credential. The mechanism is left to the implementer (the runtime indicates the local mock/dev target; the gate checks that indicator before the visitor/cookie checks). The hosted package is unaffected — its gate still requires verified visitor identity. This is what makes local dev need no unlock step.

### Decision 3 — Remove the OTP surface in full

Remove `mintOtp` / `mint_otp` from `pkg/src/auth.ts` and from the package root exports (`pkg/src/index.ts`) and `main()`'s exports. Remove the OTP registry (`kody-os.auth.otp.v2`, legacy `kody-os.auth.otp`), the OTP entry/mint/check code, the session-cookie issuance and verification that existed only to carry OTP sessions, the unlock form and `/unlock/<code>` route and gate-form script in `pkg/src/app.ts`, and the `?k=` submission transport. The `kody-os.auth.sessions.v2` key is removed too if nothing else reads it (it existed only for OTP-issued sessions); if session storage is still needed for another purpose, say so in the implementation and keep only what that purpose needs. Pre-existing OTP sessions stop working at the publish carrying this change (there is no registry to read them from); Kody login is unaffected.

### Decision 4 — Footer and Logout follow the single path

The footer reports only `via kody` (platform-verified visitor) or `locked`. `via cookie` and `via key` do not appear. The Logout link, which existed only for cookie-authenticated pages, is removed; a Kody visitor ends a session by signing out of Kody itself, not through the shell.

### Decision 5 — Docs drop the OTP path

Update `pkg/docs/setup.md`, the root `README.md`, `pkg/README.md`, and `pkg/AGENTS.md` to say Kody login only (mock login-free), removing the OTP mint/unlock steps and the Scribe-OTP framing. `pkg/docs/device-key.md` is deleted if it is OTP-only (it documents the device-key/OTP mechanism); if it carries non-OTP content worth keeping, move that content and say so in the implementation. The `mint-dev-otp` and `clear-auth` dev scripts in `pkg/scripts/` are deleted if OTP-only, or updated if they serve another purpose.

### Decision 6 — Tests follow the single path

Remove or rewrite the OTP-related tests (auth/OTP flows, mock mint-and-unlock, unlock-form and `?k=` checks). The mock no longer mints or unlocks, so the mock setup in tests drops the OTP step. The harness and remaining tests SHALL pass with no OTP references.

### Decision 7 — Version

This removes the `mint_otp` MCP export and an entire login path, so by the repo's version policy it reads as MAJOR. The version decision is deferred to publish, as usual.

### Decision 8 — Relationship to auth-rethink (removed)

The parked `auth-rethink` change was removed (Nov 7, 2026) as superseded by this change: its premise was reintroducing secret-binding on top of OTP verification, and both the secret and the OTP are gone. This change is the narrower, user-directed removal, not a full auth rethink. If auth is ever rethought again, it starts from this new end state (Kody login only, mock login-free), not from the OTP end state.

## Open questions

None. The owner directed the removal; the only question is implementation detail (Decision 2's mock-detection mechanism), which is left to the implementer.
