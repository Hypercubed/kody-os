# Design

## Context
See proposal.md Why. Today `finishResponse` (`pkg/src/app.ts:332`) stamps `?k=` into all HTML links/forms plus `Location` whenever the request authenticated via query; cookie-authenticated responses already render clean URLs. `authenticate` (`pkg/src/auth.ts`) returns `viaQuery`/`viaCookie`, so the server knows the path — it just doesn't report it.

## Goals / Non-Goals
- Goals: conditional stamping (reuse the existing `viaQuery` flag), footer indicator, unlock-form `localStorage` write, enhancement key attachment.
- Non-Goals: no change to code issuance/rotation/hash storage; no per-user identity; no brute-force throttling (out of scope, recorded as a risk).

## Decisions
1. **Reuse `viaQuery`, don't add state** — stamping branches on the existing `AccessCheck` flag. Why: zero new server state, fallback behavior byte-identical.
2. **Enhancement sends the same `?k=` param over `fetch`** — key travels as `k` in the `format=json` URL the fast path already builds, read from `localStorage` with the DOM as fallback source. Why: server parses one auth mechanism, not two; no header/CORS surface.
3. **Footer indicator is plain text in the status bar** — no styling system change. Why: observable without devtools, no theme regen.
4. **Unlock script is inline and guarded** — `try { localStorage.setItem(...) } catch {}` before following the redirect. Why: storage absence never blocks; ES2019-safe.

## Risks / Trade-offs
- [Risk] Cookie stripped by Kody edge → Mitigation: task 1 owner check decides; enhancement path works regardless.
- [Risk] Bundle JS reads `localStorage` key → Mitigation: same exposure as `?k=` in DOM today; documented as device gate, not auth.
- [Risk] Single shared secret, no throttle → Mitigation: out of scope; recorded, not solved here.

## Migration Plan
1. Land footer indicator first (observable, zero behavior change).
2. Land conditional stamping + unlock write + enhancement attachment.
3. Owner verifies on desktop + Scribe; rollback is a republish of the prior commit.

## Open Questions
- None (cookie-survival is task 1's finding, not a design unknown).
