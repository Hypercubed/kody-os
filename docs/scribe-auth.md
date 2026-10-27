# Scribe auth: code-gated access (no Kody login on-device)

Source: user directive 2026-10-25 (external agent's writeup). Overrides HANDOFF.md §2 and §4 (Kody session gating / private-only) for the Scribe path.

## Problem
The kody-os page markup is Scribe-compatible, but Kody's login/handoff flow is not usable in the Scribe browser. So the OS needs its own gate that works with plain HTML + URLs.

## Design (superseded by OTP sessions, 2026-10-27 — kept for history)

The original design below used a long-lived `?k=` code. It is retained
for the record; the live flow is OTP sessions (see "OTP sessions" below),
which never put secrets in URLs.
1. Package keeps its `kody.app` entry, server-rendered HTML, no client JS.
2. Access code gate in the fetch handler (original design; OTP sessions in
   "OTP sessions" below are the live path and never use `?k=` URLs):
   - Derive the code inside the package as HMAC-SHA256 (via the scoped `credential().sign()` client) of the fixed domain string `kody-os/access-key/v1` under the package-scope secret `access-key` (kind `secret`, publisher-supplied need declared in `pkg/package.json`). Never store or log the raw code or the secret value. `packageStorage()` holds no auth secrets on the derived path.
   - Accept the code via `?k=<code>` (bookmarkable — the Scribe-safe path) or a plain HTML GET form that navigates to `?k=<code>` and sets a long-lived HttpOnly cookie (progressive enhancement; Scribe reportedly keeps session-only storage, so cookies may not persist there).
   - Recompute the derived code per request and compare; return 404 for anything invalid (same pattern as our existing notFoundPage).
   - Rotation = overwrite the secret value in the Kody UI. No republish, no code or storage write.
   - Fallback: while no secret is bound, the pre-secret SHA-256 hash in `packageStorage()` still verifies (today's behavior exactly), so the package works before the owner creates the secret.
3. Page/app content stays in `packageStorage()` so agents update it over MCP without republishing.
4. Publish, then `packageUpdate` with `changes: { internet_visible: true }` — only for configurations that serve anonymous devices. Because the app uses `packageStorage`, this returns an approval link the OWNER must click (agents cannot approve). Devices unlock with per-session OTPs (see below); no code ever appears in a URL, so there is nothing to bookmark.
5. The key is optional: with no secret defined, the app serves Kody-logged-in visitors only (`via kody`) and stays private (no `internet_visible` needed). Key management is Kody-UI-only — no MCP or in-app set path. Exact steps: `pkg/docs/device-key.md`.

## Implementation notes (2026-10-25, after first publish)

- Kody's edge rejects a mutating POST to a `*.kody.run` package-app subdomain when the browser reports a foreign or `null` `Origin`: `Cross-origin mutating requests to a package-app subdomain are not allowed.` A same-origin POST works from some browsers, but embedded/sandboxed/old contexts report `Origin: null`, so the UI must not depend on POST.
- The unlock form is therefore a GET form whose inline script rewrites the
  submit to the path form `/unlock/<code>` (Kody's edge drops query strings
  before the handler runs, so `?k=` never arrives; the code lives in the
  path for one request and the success redirect lands on the clean app home).
  It sets the session cookie through the normal authenticated GET path. App
actions are GET forms too (`GET /apps/:id?action=...` with a hidden `k`
  field on legacy paths where the platform preserves the query string; a
  GET form discards the action's query string). `POST /apps/:id` remains for
  API clients only.
- Live verification: `?k=` bookmark → 200 and sets the cookie; bare `/` → 404 locked; wrong code → 404. The one-shot `POST /__access-code` bootstrap and the MCP `set_access_code` are removed (2026-10-26): code creation and rotation happen only in the Kody UI secret screen.
- Secret move (2026-10-26, auth-transport task 5): the derived-code path is live with a stored-hash fallback. With no secret bound, verification behaves exactly as before (stored hash). Once the owner creates the `access-key` secret, the derived code becomes authoritative and the stored hash is ignored — creating the secret rotates the code; overwriting the secret value rotates it again.
- Rule for every future app: no mutating `<form method="POST">` or UI `fetch(..., { method: 'POST' })`. See `pkg/src/apps/INTEGRATION.md`.

## Conflicts with standing plan (explicitly overridden by user)
- HANDOFF.md said "Kody session gating is the auth — do not build a separate login system." Scribe can't use Kody login, so the code gate replaces it on the device path.
- Package was private + `internet_visible: false`. Internet-visible serving is required only for the anonymous device-key configuration (secret defined); the login-only default (no secret) stays private with no approval click. Either way the approval, when needed, is the owner's website click.
- Privacy posture changes: guessable-URL + code becomes the lock (not owner session). Code must be random, long, and rotatable; treat the `?k=` URL as a password.

## OTP sessions (live since 2026-10-27, auth-transport task 7)

Anonymous `credential()` never resolves for signed-out visitors, so the
secret-derived path cannot serve the device gate on its own. The gate now
mints single-use 4-digit OTPs (`packageStorage` holds OTP hashes: 10-minute
TTL, max 5 outstanding, pruned on write) that burn into session bearers
(random 25-char token, hash stored with 30-day expiry, raw token in an
HttpOnly cookie, hash lookup on read, pruned on read). Owner flow:
`mint_otp` over MCP, read the 4 digits to the device holder, who enters
them in the unlock form (POST) or the plain GET form (rewritten in place
to `/unlock/<code>`); the cookie then authenticates with clean URLs.
Failed unlocks are capped at 10 per 10-minute window device-wide (counter
in `packageStorage`). Full steps: `pkg/docs/device-key.md`. Verified
working on-device 2026-10-26/27 (desktop and Scribe); Scribe sessions need
a fresh OTP per visit as its browser drops cookies between sessions.


## Open questions for the build (all resolved)

- Cookie value on Scribe: resolved — Scribe drops cookies between
  sessions, so each Scribe visit needs a fresh OTP (verified 2026-10-27).
- Per-app codes vs one OS code: one OS-wide gate (simplest, matches the
  writeup); per-app codes were never built.
- `internet_visible` approval is a manual owner step — plan the publish
  sequence around it.
