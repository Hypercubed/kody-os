# Tasks

## 1. Cookie investigation (owner-run)

- [x] 1.1 Investigated cookie delivery live: Kody's edge strips any cookie whose name lacks the app's `cookiePrefix`, so the bare `kody_os_auth` cookie never reached the handler. Resolved by prefixing the cookie name (see `sessionCookieName`); verified working on desktop and Scribe
- [x] 1.2 Finding recorded in design.md (cookiePrefix requirement) and verified live: footer shows `via cookie` after OTP unlock on desktop and Scribe

## 2. Auth-path indicator

- [x] 2.1 Render the active auth path (`via kody` / `via cookie` / `via key` / `locked`) in the shell footer from the existing `AccessCheck` flags plus the visitor check, and verify each of the four states renders on preview by direct fetch
- [x] 2.2 Update the `shell` spec delta if the indicator wording changes during implementation and verify `openspec validate --strict` passes

## 3. Conditional stamping + localStorage

- [x] 3.1 Branch `withAccessCodeInHtml` and redirect stamping on `viaQuery` (unstamped when Kody- or cookie-authenticated) and verify Kody- and cookie-authenticated preview responses contain zero `?k=` while query-authenticated responses keep it
- [x] 3.2 Add the guarded `localStorage` write to the unlock success path and verify unlock works with storage present, absent, and disabled
- [x] 3.3 Attach the stored key in the client enhancement (`src/client/index.ts`, DOM fallback when storage is empty) and verify `format=json` actions authenticate with clean links, falling back to native submit on failure
- [x] 3.4 Update `pkg/docs/adding-an-app.md` (JS-on required, gate-is-a-latch wording) and verify ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` plus `openspec validate --changes` passes

## 4. Kody-login bypass

- [x] 4.1 Read the platform visitor signal in the fetch handler (`X-Kody-Visitor` header, confirmed via `kody.metaGetCurrentUser({})`; anonymous = throws → key path) and serve verified users with app access with zero device gate and zero `?k=`, never failing open
- [x] 4.2 Record the bypass-scope decision (anyone with app access vs owner-only) and verify on the hosted URL: signed-in owner sees `via kody` with clean URLs, incognito/anonymous hits the device gate
- [x] 4.3 Keep the Scribe path on `?k=` (no Kody handoff in its browser) and verify the Scribe bookmark flow is byte-identical to today

## 5. Secret move + UI-only key management

- [x] 5.1 Probe `credential().sign()` HMAC from the fetch handler with a package-scope secret (need declared in `package.json`, publisher-supplied) and record the working need shape; if unreachable, keep the hash in `packageStorage` and land only the management/docs parts
- [x] 5.2 Replace the stored-hash check with per-request derivation (`sign()` HMAC over the fixed domain string, same alphabet/grouping), remove the MCP `set_access_code` and any in-app set path, declare the need in `package.json`, and verify rotation (secret overwrite in the Kody UI) invalidates every bookmark and cookie
- [x] 5.3 Document the exact Kody UI steps for creating/replacing the key (creation-link form `https://kody.codes/@<org>/-/credentials/new?kind=secret&name=<need>`, verified against the `credentials` guide section `creating-credentials`) in `pkg/docs/` + `docs/scribe-auth.md`, state the key is optional, and verify: no secret → login-only serving while private (no `internet_visible`); secret set → anonymous device-key path enabled
- [x] 5.4 Run `node --experimental-strip-types --check` on touched files plus ES2019 grep zero hits for `?.`/`??`/`replaceAll`/`.at(` and verify `openspec validate --changes` passes

## 6. Derived-code readout (added 2026-10-26: no readout path exists for the owner to learn the derived bookmark code)

- [x] 6.1 Expose MCP `get_access_code` returning the currently derived device code (derived path) or a locked/not-applicable signal when no secret exists (never a guessable value), document it in `pkg/docs/device-key.md`, and verify via the MCP path plus `node --experimental-strip-types --check`, ES2019 grep zero hits, and `openspec validate auth-transport`

## 7. OTP sessions (added 2026-10-26: anonymous credential() never resolves for signed-out visitors, so the secret-derived path cannot serve the device gate; sessions live in packageStorage instead and the secret is no longer on the request path)

- [x] 7.1 Mint OTPs via MCP `mint_otp` (4 digits; SHA-256 hash stored under one registry key with 10-minute expiry, max 5 outstanding, pruned on write; returns the plaintext code exactly once, never logged)
- [x] 7.2 Accept the OTP in the unlock form (POST body, Scribe-safe GET-form equivalent where needed), burn it on first success, and mint a session: random 25-char token, SHA-256 hash stored with 30-day expiry, HttpOnly cookie carrying the raw token plus the guarded `localStorage` write of the session token (same key name as today). Rate-limit: at most 10 failed unlock attempts per 10-minute window device-wide (counter in packageStorage); further attempts are denied until the window passes
- [x] 7.3 Authenticate requests by session-cookie hash lookup (expired/pruned sessions denied, fail closed); keep the derived-code and stored-hash paths untouched as fallback; footer states unchanged; enhancement keeps attaching the session token on the `format=json` fast path (revocable session bearer, never the master code or an OTP) with native-submit fallback
- [x] 7.4 Document the OTP flow in `pkg/docs/device-key.md` (request-via-agent, enter-on-device, Scribe cookie caveat: fresh OTP per Scribe session if cookies don't persist) + `docs/scribe-auth.md`, and verify `node --experimental-strip-types --check`, ES2019 grep zero hits, `openspec validate auth-transport`, plus an isolated-store round-trip (mint → unlock → cookie → replay/expired/wrong/lockout). NOTE 2026-10-26: the temporary `auth-diag` and `BUILD_ID` removal is deferred until after live verification on preview/prod — both stay in place in this phase per owner instruction.
