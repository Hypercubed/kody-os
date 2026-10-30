# Design: auth-rethink

## Context

See proposal.md (Why). Today `pkg/src/auth.ts` implements both
systems. The derived path recomputes an HMAC-SHA256 signature via
`credential("access-key").sign()` over the fixed domain string
`kody-os/access-key/v1`, encodes it into the device code, and
authenticates a cookie carrying that code's hash (or a stored hash
from `kody-os.auth.code_hash` when nothing is derived). The OTP path
stores only OTP hashes, burns a presented OTP into a random
25-character token, and authenticates later requests by hash lookup
in `kody-os.auth.sessions` — with no secret check anywhere in
`mintOtp`, `consumeOtp`, or `verifySession`, and no gate on
`get_access_status` in the fetch path. The `auth.ts` header comment
still claims rotation "invalidates every old cookie and bookmark at
once"; that is true only for the legacy path. The auth-transport spec
originally intended the secret to gate the anonymous device path
("no secret = login-only"), then added the OTP requirement ("OTP
sessions replace the secret on the device path") without reconciling
the two. This change reconciles them in favor of the secret-bound
model the owner directed on 2026-10-29.

## Goals / Non-Goals

- Goals: two login paths, no legacy; a cookie that cannot outlive
  its secret; rotation/deletion as a complete kill switch; OTP kept
  as the only issuance ceremony; logout and expiry preserved; the
  whole model provable by the probe in Gate 0 and by the verification
  tasks.
- Non-goals: per-user data separation (single shared OS state,
  unchanged); a new login UI (the unlock form stays, OTP-only);
  brute-force changes beyond the existing failure cap; any change to
  app definitions, registry behavior, or MCP exports other than the
  auth exports named in the proposal.

## Decisions

0. **Gate 0 — probe before implementation (BLOCKING).** Before any
   implementation task starts, a live anonymous-fetch probe SHALL
   establish whether `credential().sign()` resolves inside an
   anonymous fetch request. Method: with the secret bound (confirmed
   via MCP `get_access_status`), present the currently derived code
   through the anonymous path form (`/unlock/<code>`) from a
   signed-out browser/session and observe whether the fetch handler
   accepts it. The derived code is credential-adjacent: handle it
   transiently for the probe only, never record it in chat, logs, or
   files. A negative result MUST be distinguished before any
   conclusion is drawn: secret unbound vs. hosted hostname not on
   the secret's host allowlist vs. `sign()` unreachable in the
   anonymous fetch context. If `sign()` does not resolve
   anonymously, implementation SHALL NOT proceed on this design;
   the spec returns for revisiting (platform question or a
   different invalidation mechanism). The probe result SHALL be
   recorded in this design file before implementation tasks start.

   **Probe record (2026-10-29, run twice with identical results; no code
   values were recorded).** Secret bound: confirmed — the `access-key`
   secret exists (metadata updated 2026-10-26), and derivation
   succeeded in the authenticated MCP context when given the explicit
   hosted URL. Anonymous baseline: `GET /` from a signed-out session
   returned the locked page (404), so anonymous requests reach the
   fetch handler as published. Unlock attempt: the MCP-derived code,
   presented through the anonymous `/unlock/<code>` path form,
   returned 404 with no `Set-Cookie`, and the follow-up request with
   the (empty) cookie jar was still locked. Hosted version observed:
   v0.1.7 (current). Distinctions: an unbound secret is ruled out;
   a host-allowlist failure is unlikely as the sole cause (signing
   for `hypercubed.kody.run` succeeded in the MCP context), but a
   fetch-context host-resolution difference cannot be fully excluded
   from outside the handler — the most consistent explanation is
   that `sign()` does not resolve in the anonymous fetch context.
   Either way, fetch-context derivation does not produce a code an
   anonymous visitor can use. **Conclusion: Gate 0 FAILED.
   Implementation SHALL NOT proceed on the HMAC-verification design;
   the spec returns for revisiting.** Task 0.3: anonymous
   reachability is established by the baseline above; a distinct
   `internet_visible` setting could not be verified from the
   available read-only sources (no such field in the package search
   metadata), and no additional approval was needed for anonymous
   requests to reach the handler.
   Rationale: every cookie shape in Decision 1 needs the same call
   at request time; building first and discovering it fails would
   lock every anonymous device out.
1. **Cookie shape is decided after the probe, in a design addendum —
   the requirement is the outcome, not the shape.** Both candidate
   shapes MUST satisfy: verification against the current secret;
   deletion/change invalidates all cookies; per-device logout works
   without rotating the secret; 30-day expiry; HttpOnly cookie,
   same name and prefix behavior as today. (A) Stateless
   HMAC-signed cookie: payload plus signature, verified by
   recomputation, no session registry — logout then needs an
   explicit revocation record, which the addendum must define.
   (B) Registry + secret binding: keep the session registry, and a
   session authenticates only while it both matches the registry
   and verifies against the current secret. The addendum SHALL pick
   one, define logout and expiry under it, and define the new
   cookie/session storage format (versioned, so old-format cookies
   cannot authenticate). Rationale: picking the shape before the
   probe risks specifying a mechanism the platform cannot run.
2. **Minting gates on a bound secret.** `mint_otp` SHALL fail closed
   with a named machine-readable error when no secret is bound,
   instead of minting an OTP whose cookie could never verify.
   Rationale: the failure must surface at mint time (owner/agent
   context, where the secret state is checkable) rather than as a
   mysterious locked device.
3. **Local preview gets an explicit dev-mode decision, in the
   addendum — never silent drift.** `kody dev` has no bound secret,
   so the new model would make local OTP testing impossible as
   written. The addendum SHALL define exactly one dev behavior
   (e.g. a clearly-marked mock-only bypass, or a mock secret
   binding), state where it is allowed (mock target only), and
   prove it cannot activate in the hosted package. The
   stored-hash seed script is retired regardless; dev setup SHALL
   NOT rely on a stored code hash.
4. **Fail closed everywhere the secret is absent or unreachable.**
   If derivation/signing fails for any reason in the fetch handler,
   the request is denied (locked), never served on a fallback.
   Rationale: the legacy fallback is precisely what is being
   removed; a silent fallback would reintroduce it.
5. **Removal is total, verified by grep and by fetch.** No
   `?k=` handling, no stamping, no hidden `k` fields, no
   `get_access_code`, no stored hash, no `via key`, no enhancement
   key handling may remain in code, docs, Help copy, or the client.
   Verification tasks include repo-wide greps and anonymous fetch
   checks for each removed surface.

## Risks / Trade-offs

- [Risk] `sign()` does not resolve for anonymous fetch (Gate 0
  fails). Mitigation: the gate exists so this is found before
  implementation; no code is written against the assumption.
- [Risk] Secret host allowlist: signing is host-bound, so a secret
  whose hosts do not list the fork's hosted hostname fails closed
  for every cookie. Mitigation: the setup guide documents the host
  requirement as part of secret setup, and the probe distinguishes
  this failure from sign-unreachable.
- [Risk] Every device is logged out at cutover, including the
  owner's own Scribe session, and a fresh OTP is needed on every
  device. Mitigation: intended (rotation semantics); the cutover
  is announced in the setup guide and verified as part of the
  tasks, not discovered by users.
- [Risk] Stateless shape (A) makes per-device logout hard.
  Mitigation: Decision 1 requires the addendum to define logout
  before implementation; if no satisfactory logout exists under
  (A), the addendum picks (B).
- [Risk] Rollback republishes old code that would accept old
  registry tokens if the registry keys are reused. Mitigation:
  the new format is versioned/distinguishable (Decision 1), and
  old-format tokens SHALL NOT authenticate under the new code
  regardless of rollback.

## Migration Plan

Cutover is a republish: old cookies, bookmarks, and stored codes
stop working immediately; the owner mints fresh OTPs per device
after confirming the secret is bound. No data migration: apps and
their state are untouched (session storage is separate from app
storage). `pkg/docs/device-key.md`,
`pkg/AGENTS.md`, `pkg/README.md`, and the setup guide's auth section
are rewritten/corrected in the same change; stale claims (rotation
invalidates "everything", secret-derived code as fallback, `via key`)
SHALL NOT survive in any of them. Rollback is a republish of the
prior commit, which restores the old two-path behavior; the new
cookie format SHALL NOT authenticate under old code, and old-format
tokens SHALL NOT authenticate under new code.

## Version

MAJOR at implementation, in the same commit as the code, per
`pkg/AGENTS.md` (MCP export removed; auth/session behavior changes
so existing codes and sessions stop working; `0.x` does not soften
the rule). Exact target depends on landing order: if the app-store
change (MINOR) has landed, `0.2.0` → `1.0.0`; if this change lands
first, `0.1.7` → `1.0.0`. PATCH resets to 0, BUILD +1 on publish,
`pkg/AGENTS.md` + `pkg/README.md` headers updated in the same commit.
This spec draft does not bump anything.

## Open Questions

1. Cookie shape (Decision 1): stateless HMAC-signed vs. registry +
   secret binding — decided in the post-probe addendum, not here.
2. Dev-mode shape (Decision 3): mock-only bypass vs. mock secret
   binding — decided in the addendum.
3. Whether anonymous device access needs an `internet_visible`
   approval beyond publish. Unverified from public docs; the probe
   and verification tasks must establish it, and the setup guide
   documents the owner step if one exists.
4. Exact `mint_otp` error value for the unbound-secret case
   (machine-readable, named — string to be fixed in implementation).
5. Cookie lifetime: confirm 30 days is retained under the chosen
   shape, or record a different lifetime with rationale.
