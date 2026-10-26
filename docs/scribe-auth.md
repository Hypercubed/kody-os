# Scribe auth: code-gated access (no Kody login on-device)

Source: user directive 2026-10-25 (external agent's writeup). Overrides HANDOFF.md §2 and §4 (Kody session gating / private-only) for the Scribe path.

## Problem
The kody-os page markup is Scribe-compatible, but Kody's login/handoff flow is not usable in the Scribe browser. So the OS needs its own gate that works with plain HTML + URLs.

## Design
1. Package keeps its `kody.app` entry, server-rendered HTML, no client JS.
2. Access code gate in the fetch handler:
   - Store a SHA-256 hash of a random access code in `packageStorage()`. Never store or log the raw code.
   - Accept the code via `?k=<code>` (bookmarkable — the Scribe-safe path) or a plain HTML GET form that navigates to `?k=<code>` and sets a long-lived HttpOnly cookie (progressive enhancement; Scribe reportedly keeps session-only storage, so cookies may not persist there).
   - Hash incoming, compare to stored hash, return 404 for anything invalid (same pattern as our existing notFoundPage).
   - Rotation = write a new hash to storage. No republish.
3. Page/app content stays in `packageStorage()` so agents update it over MCP without republishing.
4. Publish, then `packageUpdate` with `changes: { internet_visible: true }`. Because the app uses `packageStorage`, this returns an approval link the OWNER must click (agents cannot approve). Final URL form: `https://<username>.kody.run/<package-name>/?k=<code>`.

## Implementation notes (2026-10-25, after first publish)

- Kody's edge rejects a mutating POST to a `*.kody.run` package-app subdomain when the browser reports a foreign or `null` `Origin`: `Cross-origin mutating requests to a package-app subdomain are not allowed.` A same-origin POST works from some browsers, but embedded/sandboxed/old contexts report `Origin: null`, so the UI must not depend on POST.
- The unlock form is therefore a GET form that navigates to the safe `next` path with `?k=<code>`; it sets the same cookie through the normal authenticated GET path. App actions are GET forms too (`GET /apps/:id?action=...` with a hidden `k` field, because a GET form discards the action's query string). `POST /apps/:id` remains for API clients only.
- Live verification: `?k=` bookmark → 200 and sets the cookie; bare `/` → 404 locked; wrong code → 404; `/__access-code` → 404 after the first code exists.
- Rule for every future app: no mutating `<form method="POST">` or UI `fetch(..., { method: 'POST' })`. See `pkg/src/apps/INTEGRATION.md`.

## Conflicts with standing plan (explicitly overridden by user)
- HANDOFF.md said "Kody session gating is the auth — do not build a separate login system." Scribe can't use Kody login, so the code gate replaces it on the device path.
- Package was private + `internet_visible: false`. Internet-visible serving is now required; needs the owner's website approval click.
- Privacy posture changes: guessable-URL + code becomes the lock (not owner session). Code must be random, long, and rotatable; treat the `?k=` URL as a password.

## Open questions for the build
- Cookie value on Scribe is doubtful — ship `?k=` first, cookie second.
- Per-app codes vs one OS code: start with one OS-wide code (simplest, matches the writeup).
- `internet_visible` approval is a manual owner step — plan the publish sequence around it.
