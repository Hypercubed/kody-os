# Design: remove-legacy-code

## Context

See proposal.md (Why). Today `pkg/src/auth.ts` implements both
systems and checks the legacy one first. `authenticate()` tries, in
order: the session-cookie bearer (`verifySession` hash lookup), the
legacy cookie/query value (hash of the derived code when
`deriveAccessCode()` succeeds, else the stored hash in
`kody-os.auth.code_hash`), and finally an OTP burn from a `?k=`
query value. `checkCode()` (used by the POST unlock form) tries the
derived code, then the stored hash, then the OTP burn. The unlock
handler (`pkg/src/app.ts`) sets either a session cookie (OTP) or a
code-hash cookie (legacy), stamps the legacy code into the continue
URL and into `localStorage` under `kody_os_auth`, and reports
`via key`. Query-authenticated responses keep `?k=` stamped into
every link and form via `finishResponse`/`withAccessCode`, and
every app action form carries a hidden `k` field
(`pkg/src/apps/client.ts`). The shell enhancement
(`pkg/src/client/index.ts`) reads the stored value from
`localStorage` (or the hidden field / `?k=` URL) and appends it as
`&k=` to fetch URLs. The `access-key` need is declared in
`pkg/package.json` with `ownerCredentialForVisitors: true`, and
`get_access_code` / `get_access_status` are exported from
`pkg/src/index.ts`. Local dev seeds a stored hash with
`pkg/scripts/seed-dev-hash.ts` and unlocks the preview with
`?k=<seeded code>`.

The OTP mechanics themselves are sound and need no change (see the
2026-10-29 sanity check in conversation: random OTP, hash-only
storage, single use, short TTL, failure cap, random session
bearer, HttpOnly cookie). What is removed is everything that lets
a value other than a fresh OTP or a live session token
authenticate a request.

## Goals / Non-Goals

- Goals: one device path (OTP issuance + session cookie), no
  legacy surface anywhere in code, docs, Help copy, or rendered
  output; the unlock ceremony still works with no JavaScript and
  on the Scribe; local dev keeps a working unlock without a
  stored code hash; the cutover is a single MAJOR republish.
- Non-goals: secret-binding of cookies (auth-rethink, parked —
  see below); a global session revoke / kill switch (a future
  change may add a storage-based epoch or revoke-all export;
  this change deliberately adds neither); per-user data
  separation; a new login UI; brute-force changes beyond the
  existing failure cap; any change to app definitions, registry
  behavior, or MCP exports other than the two auth exports
  named in the proposal.

## Relationship to auth-rethink

The `auth-rethink` change (pushed 2026-10-29, Gate 0 FAILED,
parked by owner choice) couples this removal with HMAC
secret-binding of OTP cookies. This change implements ONLY the
removal half, on the OTP registry sessions as they exist today,
with no secret involved. It does not unblock, implement, or
supersede auth-rethink: auth-rethink stays parked and untouched
by this change, as a future plan only. If auth-rethink is ever
revived, it starts from this change's end state (no secret, no
derived code) and its proposal/design MUST be rewritten — its
Gate 0 record and its "secret required" premises do not carry
over, and its "current `access-key` secret" premise is gone
entirely: a revived secret-binding design would have to
re-establish a secret need from scratch, not reuse the removed
legacy access key. Where this change and auth-rethink differ on
the `?k=` submission transport (Decision 2), this change's
decision governs the implemented behavior.

Update 2026-10-31: Kody limited-browser sign-in
(kody-hq/kody#4666, merged 2026-10-31; owner-verified via the
host-root `/-/auth/login` route for kody-os from the Scribe,
`hypercubed.kody.run/-/auth/login?app=kody-os`) is what
removes the last practical reason to keep the legacy path: a
Scribe visitor can now arrive as a platform-verified Kody
visitor without the derived code. That does not change the
two-path model above — Kody visitor or OTP-issued session —
and it does not make OTP redundant: OTP remains the device
path for a visitor who is not Kody-signed-in.

## Decisions

1. **Removal is total for authentication, verified by grep and
   by fetch.** After this change, no code path, in any file,
   SHALL compare a presented value against a derived code or a
   stored code hash, or accept a code-hash cookie. The removed
   symbols are `deriveAccessCode`, `accessKeyHost`,
   `encodeDerivedCode`, `getAccessCode`, `getAccessStatus`,
   `readAccessHash` (and `ACCESS_HASH_KEY` /
   `ACCESS_KEY_DOMAIN`), `accessCookie` (and the `ACCESS_COOKIE`
   constant as a separate name — the session cookie keeps the
   same prefixed name via `sessionCookieName()`), and the
   legacy branches of `checkCode` and `authenticate`. The
   `access-key` need is removed from `pkg/package.json`, and
   `get_access_code` / `get_access_status` leave
   `pkg/src/index.ts`. Verification tasks include repo-wide
   greps (scoped to `pkg/`, excluding `openspec/`
   history) and anonymous fetch checks for each removed
   surface.
2. **`?k=` survives ONLY as a single-use OTP submission
   transport.** The shell must work with no JavaScript, and the
   package-app edge rejects cross-origin POST forms, so the
   locked page's GET form is the only no-JavaScript unlock
   transport. `authenticate()`'s OTP-burn branch (burn a
   `?k=` value, mint a session, deny on failure) is RETAINED,
   and only for OTPs: a burned value is inert, so a bookmarked
   or replayed `?k=` OTP authenticates nothing. What is removed
   is all *persistence* of the parameter: no stamping into
   links, forms, or redirects (`finishResponse` stamping,
   `withAccessCode`, `withAccessCodeInHtml`), no hidden `k`
   fields, and no `?k=` in any rendered URL after a successful
   unlock. Success SHALL 303 (or meta-refresh, as today) to a
   clean URL with the session cookie set. Rationale: the
   credential-in-URL persistence is the vulnerability; the
   single-use submission is not, because the value dies on
   first use.
3. **The unlock ceremony keeps all three submission transports,
   OTP-only.** Unlock-form POST (`code` field), the
   `/unlock/<otp>` path form (the edge drops query strings),
   and the `?k=` GET submission SHALL all feed the same
   OTP-burn check. The unlock handler SHALL set only the
   session cookie, report only `via cookie`, and store only
   the session token in `localStorage` (see Decision 4). The
   interstitial's `Continue` URL SHALL be clean (no stamped
   code) for OTP unlocks, as it already is today.
4. **Browser storage holds a session token, never a code.**
   `localStorage` key `kody_os_auth` is retained as the
   carrier for the OTP-minted session token, exactly as the
   unlock interstitial writes it. No unlock path SHALL write a
   device code to storage, and the enhancement
   (`src/client/index.ts`) SHALL NOT read a code from the DOM
   or the URL: the hidden-field and `?k=`-URL fallbacks in
   `readDomKey` are removed. RESOLVED 2026-10-31 (Open
   Question 2): the stored-value attach is NOT retained either.
   The server accepts `?k=` only as a single-use OTP
   submission (it burns the value and mints a session, or
   counts a failure); it never accepts a session token as
   `?k=`, so attaching the stored session token could not
   authenticate an enhancement fetch and would instead count
   toward the failure cap. The enhancement therefore attaches
   no credential at all: same-origin fetches authenticate with
   the HttpOnly session cookie, and a cookie-less browser falls
   back to native submit. The bridge (`src/bridge/bridge.js`)
   follows the same rule: its `readKeyFromPage` attach is
   removed, and its fetches already send
   `credentials: 'same-origin'`. The enhancement SHALL NOT
   write anything to storage.
5. **Local dev uses the same OTP ceremony against the mock
   target — no stored hash, no dev bypass in fetch code.**
   `pkg/scripts/seed-dev-hash.ts` is retired and
   `pkg/scripts/mint-dev-otp.ts` takes its place (implementation
   note 2026-10-31: the mint script already existed when this
   change was implemented, so it was kept with an updated header
   comment rather than added; `pkg/scripts/clear-auth.ts` was
   added in the same change): it imports
   `mintOtp` and `resolveStore` (the same
   `kody execute --target mock --file <script>` pattern the
   seed script uses) and returns a fresh OTP for the mock
   store. Dev setup docs are updated to the mint-and-enter
   flow. No fetch-handler code SHALL branch on a dev/mock
   flag, and no stored code hash SHALL be seeded. Task 0.1
   confirms the mint script resolves in the mock context
   before implementation; if it does not, the change stops
   for a design addendum instead of falling back to a stored
   hash.
6. **No secret, no rotation, no kill switch — stated plainly.**
   After this change there is no `access-key` secret, no
   `configured` state, and no rotation semantic of any kind.
   Session invalidation is per-device logout
   (`revokeSession`, unchanged) or 30-day expiry. The stale
   `kody-os.auth.code_hash` key in live packageStorage is
   never read again; no migration and no cleanup export are
   provided, and the key is left inert. Docs SHALL NOT claim
   rotation invalidates anything (the stale claim in the
   `auth.ts` header comment and in `pkg/AGENTS.md` is
   corrected as part of this change, since both files lose
   the secret entirely).
7. **Publish requires an owner re-approval, done by the owner
   only.** Removing the credential need changes the capability
   fingerprint of an internet-visible package, so the new
   publish pauses for capability approval in the Kody UI.
   The agent SHALL NOT approve it; the verification tasks
   name the step and the implementation waits for the owner.
   Rollback is a republish of the prior commit, which
   restores the legacy path (and the secret need) exactly as
   before; old code-hash cookies and derived codes would work
   again under rolled-back code, which is inherent to a
   rollback and SHALL be stated in the cutover note, not
   hidden.

## Risks / Trade-offs

- [Risk] Every device using the legacy path (derived-code
  bookmarks, code-hash cookies) is logged out at cutover and
  needs a fresh OTP or Kody login. Mitigation: intended; the
  cutover is announced in the setup guide and verified as
  part of the tasks, not discovered by users. OTP-minted
  sessions are unaffected.
- [Risk] Removing `?k=` stamping breaks a workflow that
  depends on bookmarked access. Mitigation: none offered —
  bookmarked access *is* the removed surface. The replacement
  is a fresh OTP per visit, which is already the Scribe's
  normal flow (the Scribe drops cookies between sessions).
- [Risk] The capability re-approval gate delays the publish
  serving the new code. Mitigation: the step is named in the
  tasks and the owner performs it; the old publish keeps
  serving until then, so there is no lockout window from the
  approval itself.
- [Risk] A consumer outside this repo (agent script, doc)
  calls `get_access_code` or `get_access_status`.
  Mitigation: task 0.2 greps the repo and its docs; anything
  outside the repo cannot be found from here and breaks loudly
  (removed export) rather than silently.
- [Risk] The stored session token in `localStorage` is
  readable by any same-origin bundle script (it is not
  HttpOnly). Trade-off accepted and unchanged: bundle scripts
  already run same-origin with full session authority
  (installing an app = trusting its code, per
  `pkg/AGENTS.md`), and the token carrier is what keeps the
  Scribe usable. This change does not widen it: no code is
  ever written to storage, and the cookie remains the
  primary carrier.

## Migration Plan

Cutover is a republish: derived codes, bookmarks, and
code-hash cookies stop working immediately; the owner mints
fresh OTPs per legacy-path device after the owner re-approves
the capability set, or signs in via Kody login (including the
limited-browser `/-/auth/login` route, kody-hq/kody#4666).
CUTOVER INVALIDATION, added 2026-10-31 per the owner's
direction to invalidate all existing OTP access first: the
session and OTP registries move to versioned keys
(`kody-os.auth.sessions.v2` and `kody-os.auth.otp.v2`) in the
same change. The v1 keys (`kody-os.auth.sessions` and
`kody-os.auth.otp`) are never read, never migrated, and never
a fallback, so every pre-cutover OTP session and outstanding
OTP stops working at cutover — this supersedes the earlier
line that existing OTP-minted sessions keep working — and
each device needs a fresh OTP or Kody login. This is a
one-time migration effect of the version cutover, not a
runtime revoke feature: after cutover, no action invalidates
all sessions at once (per-device logout and 30-day expiry
only). No data migration: apps and their state are untouched
(auth storage is separate from app storage), and the stale
code-hash key is left inert. `pkg/scripts/clear-auth.ts`
(added in the same change, following the mint-dev-otp
pattern) clears the v2 and v1 session/OTP registries in a
local/mock store and returns counts only; it is NOT the live
cutover mechanism — ad-hoc hosted execute cannot write
package storage (no package provenance) — and no live storage
write or live clear call is part of this change. `pkg/docs/device-key.md`,
`pkg/AGENTS.md`, `pkg/README.md`,
`pkg/.agents/skills/adding-an-app/SKILL.md`, and the setup guide's auth
section (if landed) are rewritten/corrected in the same
change; stale claims (rotation invalidates "everything",
secret-derived code as fallback, `via key`, secret required
for the device path) SHALL NOT survive in any of them.
Rollback is a republish of the prior commit (see Decision 7).

## Version

MAJOR at implementation, in the same commit as the code, per
`pkg/AGENTS.md` (MCP exports removed; auth behavior changes
so existing codes and bookmarks stop working). The draft's
earlier `0.1.7` / `0.2.0` → `1.0.0` targets are superseded:
live is now v1.5.1 build 19 (published 2026-10-31), so the
MAJOR target is `1.5.1` → `2.0.0`. PATCH resets to 0, BUILD
+1 on publish (so `2.0.0` build 20), `pkg/AGENTS.md` +
`pkg/README.md` headers updated in the same commit. This spec
draft does not bump anything.

## Open Questions

1. Whether the app-store change lands before or after this
   one (landing order fixes the version target and which
   change owns removing any `k`-field store forms).
2. RESOLVED 2026-10-31: the `localStorage` session token
   does NOT re-authenticate enhancement fetches — the server
   accepts `?k=` only as an OTP submission, so attaching the
   token would fail and count toward the failure cap. The
   attach is therefore removed from both the enhancement and
   the bridge; cookie-less browsers fall back to native
   submit. (Live `kody dev` verification of the cookie-less
   path was unavailable in the implementation VM; see task
   2.1.)
3. Whether a global session revoke (storage epoch or
   revoke-all export) should follow as a separate change.
   Out of scope here; recorded only so the absence is a
   decision, not an oversight.
