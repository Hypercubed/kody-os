# Design

## Context
See proposal.md Why. Today `finishResponse` (`pkg/src/app.ts:332`) stamps `?k=` into all HTML links/forms plus `Location` whenever the request authenticated via query; cookie-authenticated responses already render clean URLs. `authenticate` (`pkg/src/auth.ts`) returns `viaQuery`/`viaCookie`, so the server knows the path — it just doesn't report it. The device-key hash lives in `packageStorage` (`kody-os.auth.code_hash`); the raw code is shown once at set/rotate and never stored.

The platform (verified 2026-10-26 against the `package_apps` guide) answers "who is visiting" per request: the `X-Kody-Visitor` header (`userId`, `username`, `role` — the platform strips any inbound `X-Kody-*`, so it cannot be forged, and it is absent for anonymous visitors) plus `kody.metaGetCurrentUser({})` from `kody:runtime` (throws `Authenticated MCP user is required` when signed out). Secrets come in `session`/`package`/`user` scopes with write-only values; the `credential(key)` client is an opaque handle (code gets signatures via `sign()`, never values) — so the handler verifies a presented code by recomputation without the secret value ever entering code or storage.

## Goals / Non-Goals
- Goals: conditional stamping (reuse the existing `viaQuery` flag), footer indicator, unlock-form `localStorage` write, enhancement key attachment, Kody-login bypass on the verified visitor signal, key hash in a package-scope secret with UI-only management, login-only private mode when no secret exists.
- Non-Goals: no per-user data separation (single shared OS state); no brute-force throttling (out of scope, recorded as a risk); no change to app:execute grants (Kody owns that).

## Decisions
1. **Reuse `viaQuery`, don't add state** — stamping branches on the existing `AccessCheck` flag. Why: zero new server state, fallback behavior byte-identical.
2. **Enhancement sends the same `?k=` param over `fetch`** — key travels as `k` in the `format=json` URL the fast path already builds, read from `localStorage` with the DOM as fallback source. Why: server parses one auth mechanism, not two; no header/CORS surface.
3. **Footer indicator is plain text in the status bar** — no styling system change. Why: observable without devtools, no theme regen.
4. **Unlock script is inline and guarded** — `try { localStorage.setItem(...) } catch {}` before following the redirect. Why: storage absence never blocks; ES2019-safe.
5. **Bypass reads the visitor header, confirms via `metaGetCurrentUser`, never trusts the client** — order: valid device key OR verified Kody visitor with app access → serve; anything else → deny/fall through. Why: the header is platform-set and unforgeable; the confirm call makes bypass depend on a live platform answer, not a stored value. Anonymous (`metaGetCurrentUser` throws) always takes the key path.
6. **Key = HMAC(secret, domain), recomputed per request, never stored** — `credential('access-key').sign({ type: 'hmac', algorithm: 'hmac-sha256', message: DOMAIN, encoding: 'hex' })`, truncated into the unambiguous alphabet and grouped exactly like today's codes. Why: `credential()` clients are opaque handles — code gets signatures, never values — so recomputation is the ONLY read path; nothing auth-related persists in `packageStorage`, backups, or exports. Rotation is a UI secret overwrite: the derived code changes, every bookmark/cookie dies, no code or storage write.
7. **Key management is Kody-UI-only; the key is optional** — `set_access_code` (MCP) and any in-app set path are removed; creation is the Kody UI creation-link form (`https://kody.codes/@<org>/-/credentials/new?kind=secret&name=<need>`, verified against the `credentials` guide); rotation is a secret-value overwrite in the same UI. No secret defined → serve signed-in users only, stay private, no `internet_visible`. Why: one creation surface the owner already trusts; the login-only default is the safest ship state.

## Risks / Trade-offs
- [Risk] Cookie stripped by Kody edge → Mitigation: task 1 owner check decides; enhancement path works regardless; Kody-login bypass covers desktop anyway.
- [Risk] Bundle JS reads `localStorage` key → Mitigation: same exposure as `?k=` in DOM today; documented as device gate, not auth.
- [Risk] Single shared secret, no throttle → Mitigation: out of scope; recorded, not solved here. Secret storage narrows where the hash lives but the cookie is still a bearer token.
- [Risk] `sign()` unreachable from the fetch handler or need/supplier mapping fails → Mitigation: task 5.1 probe runs before the move; if unreachable, the hash stays in `packageStorage` and only the UI-only-management + optional-key parts land.

## Migration Plan
1. Land footer indicator first (observable, zero behavior change), including the `via kody` state.
2. Land Kody-login bypass (desktop goes keyless; Scribe untouched on `?k=`).
3. Land secret move + UI-only management + docs UI steps (probe first).
4. Land conditional stamping + unlock write + enhancement attachment.
5. Owner verifies on desktop + Scribe; rollback is a republish of the prior commit.

## Open Questions
- Which `package-credential-suppliers` flag state / need shape the fetch handler needs (publisher-supplied vs plain need) — RESOLVED at task 5.1, see probe record below.
- Bypass scope: DECIDED at task 4 (Phase A) — anyone with platform-verified visitor identity the platform grants app access to (not owner-only). Matches the private-app permission; the header is platform-set and unforgeable, and the live `metaGetCurrentUser` confirm makes bypass depend on a platform answer, not a stored value. Anonymous always takes the `?k=` key path.

## 5.1 probe record (2026-10-26)

- Declared need shape (`pkg/package.json`, `kody.credentials`): need `access-key`, `{ "kind": "secret", "description": "..." }` — publish validation rejects `scope`/`suppliedBy` on needs; publisher supply is default package behavior. `sign()` additionally requires a credential host: code passes fixed `ACCESS_KEY_HOST = 'kody-os.local'`, and the secret must list that exact host (else `This credential has no hosts, so it is not sent anywhere`). Nothing is ever fetched from it.
- Attempted call shape (guarded, in `pkg/src/auth.ts` `deriveAccessCode()`):
  `runtime.credential('access-key')` then
  `client.sign({ type: 'hmac', algorithm: 'hmac-sha256', message: 'kody-os/access-key/v1', encoding: 'hex' })`,
  mapped through `encodeDerivedCode()` into the unambiguous alphabet and grouped
  exactly like today's codes. Any failure (unbound need, missing module, bad
  signature) returns `''` — never throws, secret value never read.
- Fallback semantics: derived non-empty → authoritative (stored hash ignored, so
  creating the secret rotates the code; overwriting the secret rotates it again).
  Derived empty (no secret yet, or local preview) → the pre-secret stored-hash
  check applies byte-identically to before, so the package works before AND
  after the owner creates the secret.
- Hosted confirm still pending (no live secret exists yet): after publish, the
  owner creates the `access-key` secret via the creation-link form
  (`https://kody.codes/@<org>/-/credentials/new?kind=secret&name=access-key`),
  opens the app with the derived code, and checks old bookmarks/cookies die;
  then overwrites the value and checks the code changes again.
