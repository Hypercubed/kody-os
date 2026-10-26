# Proposal

## Why

The access key travels in the URL (`?k=`) on every link, form, and redirect, leaking into browser history, bookmarks, server logs, and the URL bar. The cookie layer that should prevent this has never been proven through Kody's edge, and JS-on (not JS-off) is the Scribe baseline — so a `localStorage` enhancement path is viable. Move the key out of the URL where the browser allows it, keeping `?k=` as the fallback.

## What Changes

- Unlock form writes the key to `localStorage` (in addition to the existing cookie); client enhancement attaches it to requests (header/query on `fetch`, same `?k=` param name) instead of reading it from stamped links.
- Server stops stamping `?k=` into links, forms, and redirects once a request authenticates via the cookie or enhancement path; `?k=` stamping remains for query-authenticated requests (the no-storage fallback).
- Footer/status bar renders the active auth path (`via cookie` / `via key`) so cookie survival through Kody's edge is observable without devtools.
- Task 1 is an owner-run browser check (desktop + Scribe) deciding whether the cookie layer works; localStorage work proceeds regardless, cookie reliance is gated on the result.
- No change to the code itself (still a single shared secret, hash-only storage, rotation invalidates all); docs state JS-on is required and the gate is a device latch, not multi-user auth.

## Capabilities

### New Capabilities

- `auth-transport`: key delivery across cookie, `localStorage`/JS enhancement, and `?k=` fallback paths, plus visible auth-path reporting.

### Modified Capabilities

- `shell`: link/form/redirect `?k=` stamping becomes conditional on the request's auth path (unstamped when cookie- or enhancement-authenticated); unlock form gains the `localStorage` write.

## Impact

- `pkg/src/auth.ts` (no logic change expected; cookie constants reused), `pkg/src/app.ts` (`withAccessCodeInHtml` conditional stamping, footer auth-path indicator, unlock-form script), `pkg/src/client/index.ts` (enhancement attaches key from `localStorage`), `pkg/public/styles.css` + `src/shell-css.ts` regen if the footer needs styling.
- No storage migration, no MCP surface change, no export format change. `packageAppFetch` synthetic checks cannot verify cookies — verification is owner browser checks on the hosted URL.
