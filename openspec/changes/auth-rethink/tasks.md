## 0. Probe gate (blocking — before any implementation)

- [x] 0.1 Run the Gate 0 probe from design.md Decision 0: confirm the secret is bound via MCP `get_access_status`, then present the derived code through the anonymous `/unlock/<code>` path form from a signed-out session and record whether the fetch handler accepts it. Handle the derived code transiently only; never record it in chat, logs, or files. Distinguish unbound secret vs. host not allowlisted vs. `sign()` unreachable before concluding
- [x] 0.2 Record the probe result in `design.md` (Decision 0). If `sign()` does not resolve anonymously, STOP: do not start implementation tasks; return the spec for revisiting — **probe FAILED 2026-10-29; stopped here**
- [x] 0.3 Establish whether anonymous device access needs an `internet_visible` approval beyond publish, and record the answer (plus the owner step, if any) for the setup guide — anonymous reachability established (locked page served anonymously); no distinct `internet_visible` setting verifiable from read-only sources, no additional approval needed for anonymous requests to reach the handler

## 1. Design addendum (after the probe passes)

- [ ] 1.1 Write the Decision 1 addendum: pick the cookie shape (stateless HMAC-signed vs. registry + secret binding), define per-device logout and 30-day expiry under it, and define the versioned cookie/session format so old-format cookies cannot authenticate
- [ ] 1.2 Write the Decision 3 addendum: define the single local-dev (`kody dev` mock-only) auth behavior and prove it cannot activate hosted; retire the stored-hash seed path from dev setup

## 2. Implementation

- [ ] 2.1 Rewrite the gate in `pkg/src/auth.ts`: cookie verifies against the current secret only; OTP burn issues the new-format cookie; `mint_otp` fails closed with a named error when no secret is bound; remove derived-code entry, stored-hash fallback, legacy code-hash cookie, and `get_access_code`; `get_access_status` reports the new meaning (secret bound = cookie path enabled)
- [ ] 2.2 Rewrite `pkg/src/app.ts` + `pkg/src/apps/client.ts`: unlock form takes OTP only and 303s clean with the cookie; remove `?k=` handling, link/form/redirect stamping, hidden `k` fields, and enhancement key read/attach; footer reports only `via kody`, `via cookie`, or `locked`; remove `get_access_code` from `pkg/src/index.ts` exports; retire `pkg/scripts/seed-dev-hash.ts`
- [ ] 2.3 Remove the legacy path from every place the app-store change (if landed first) added a `k`-field form, and confirm the store's "authenticated shell request" follows the new transport
- [ ] 2.4 Rewrite docs in the same change: `pkg/docs/device-key.md` (new model, no legacy instructions), `pkg/AGENTS.md` + `pkg/README.md` (gate, exports, version, local-dev copy), and the setup guide's auth section if it has landed; grep-verify no stale claim survives

## 3. Verification

- [ ] 3.1 On `kody dev` (mock, with the addendum's dev behavior): Kody-login path, OTP mint/burn/cookie round-trip, wrong/expired OTP rejected, failure cap, per-device logout, and old-format cookie rejected
- [ ] 3.2 Hosted + Scribe: fresh OTP unlocks a device; cookie survives navigation with clean URLs; rotating the secret invalidates every cookie (all devices locked, fresh OTPs required); deleting the secret invalidates every cookie and `mint_otp` fails closed; re-creating the secret restores the path with fresh OTPs only
- [ ] 3.3 Prove the removal: repo-wide grep finds no `?k=` handling, stamping, hidden `k` field, `get_access_code`, stored-hash key, or `via key` in code, docs, or Help copy; anonymous fetches with a derived code, a stored-hash code, an old registry token, and no credential are all denied; `kody check --offline` passes
- [ ] 3.4 Apply the MAJOR version bump in the same commit as the code per design.md (target depends on landing order; PATCH reset to 0, BUILD +1 on publish, headers updated) and confirm no other active change depends on a removed surface
