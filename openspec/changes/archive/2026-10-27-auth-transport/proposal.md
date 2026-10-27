# Proposal

## Why

The access key travels in the URL (`?k=`) on every link, form, and redirect, leaking into browser history, bookmarks, server logs, and the URL bar. The cookie layer that should prevent this has never been proven through Kody's edge, and JS-on (not JS-off) is the Scribe baseline — so a `localStorage` enhancement path is viable. Move the key out of the URL where the browser allows it, keeping `?k=` as the fallback.

Separately, the platform already answers "who is visiting" for every request, so Kody-authenticated visitors should not need the device key at all — and the key hash itself should live in Kody secret storage, not in app KV next to content.

## What Changes

- Unlock form writes the key to `localStorage` (in addition to the existing cookie); client enhancement attaches it to requests (header/query on `fetch`, same `?k=` param name) instead of reading it from stamped links.
- Server stops stamping `?k=` into links, forms, and redirects once a request authenticates via the cookie or enhancement path; `?k=` stamping remains for query-authenticated requests (the no-storage fallback).
- Footer/status bar renders the active auth path (`via kody` / `via cookie` / `via key`) so cookie survival through Kody's edge is observable without devtools.
- Kody-login bypass: a request carrying platform-verified visitor identity (`X-Kody-Visitor` header or `kody.metaGetCurrentUser({})` from `kody:runtime`) for a user the platform grants app access to skips the device gate entirely. Anonymous requests fall through to the key gate; the gate never fails open. The Scribe keeps the `?k=` path — its browser cannot do the Kody handoff/OAuth.
- Secret move: the device key becomes a value derived inside the package from a package-scope Kody secret via `credential().sign()` (HMAC-SHA256 over a fixed domain string, unambiguous-alphabet encoded). The secret value and the raw code never appear in code, storage, logs, or chat; rotation is a secret-value overwrite in the Kody UI, which changes the derived code and invalidates every bookmark and cookie at once. Package declares the need in `package.json` (`kody.credentials`, publisher-supplied).
- Optional key: with no secret defined, kody-os serves Kody-logged-in users only and the package stays private (no `internet_visible` needed). Defining the secret enables the anonymous `?k=`/cookie device path (the Scribe path), which is the configuration that needs `internet_visible`.
- Task 1 is an owner-run browser check (desktop + Scribe) deciding whether the cookie layer works; localStorage work proceeds regardless, cookie reliance is gated on the result.
- No change to the code model itself (still a single shared secret, hash-only storage, rotation invalidates all); docs state JS-on is required and the device key is a device latch, not multi-user auth.

## Capabilities

### New Capabilities

- `auth-transport`: key delivery across Kody-login bypass, cookie, `localStorage`/JS enhancement, and `?k=` fallback paths, plus visible auth-path reporting; key hash in package-scope secret storage with UI-only management.

### Modified Capabilities

- `shell`: link/form/redirect `?k=` stamping becomes conditional on the request's auth path (unstamped when Kody- or cookie- or enhancement-authenticated); unlock form gains the `localStorage` write; footer gains the `via kody` state.

## Impact

- `pkg/src/auth.ts` (visitor-identity check via `X-Kody-Visitor` / `metaGetCurrentUser`, secret-derived code verification, removal of the MCP key-set path), `package.json` (the `kody.credentials` need declaration), `pkg/src/app.ts` (`withAccessCodeInHtml` conditional stamping, footer auth-path indicator incl. `via kody`, unlock-form script), `pkg/src/client/index.ts` (enhancement attaches key from `localStorage`), `pkg/public/styles.css` + `src/shell-css.ts` regen if the footer needs styling.
- No MCP surface change except removing `set_access_code`; no export format change. `packageAppFetch` synthetic checks cannot verify cookies or the visitor header — verification is owner browser checks on the hosted URL plus a secret-kind readability probe (task 5).
