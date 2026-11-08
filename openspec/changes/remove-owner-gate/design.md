# Design: Remove the shell's owner gate

## Decisions

### Decision 1 — `fetch()` serves every request that reaches it; the platform is the gate

`pkg/src/app.ts` `fetch()` SHALL call `dispatch()` unconditionally. It SHALL perform no visitor check, no role check, and no `metaGetCurrentUser` call. Who reaches `fetch()` is decided before shell code runs by Kody's platform gate: with `internet_visible` off, only the owner and holders of an `app:execute` / Use grant on the app; with `internet_visible` on, anyone on the internet. The shell SHALL NOT re-implement, narrow, or widen that decision in code. This is the whole point of the change: one authority for access, in Kody itself.

### Decision 2 — Delete `pkg/src/auth.ts` in full

Remove the file, not just the owner function. `isKodyOwnerVisitor`, `isKodyVerifiedVisitor`, `parseVisitorHeader`, `visitorHeader`, `isMockTarget`, `AccessCheck`, `AuthPath`, and `authPathFor` are all gate machinery with no other caller: `app.ts` is the only importer, and after Decision 1 it imports none of them. `isMockTarget` goes too — the mock target needed a gate skip only because a gate existed; with no gate, mock and hosted behave identically at the shell level (both serve whatever reaches them; the difference is platform-side). No replacement auth helper is added.

### Decision 3 — Remove the locked page and the footer auth path

Delete `lockedPage()` from `pkg/src/app.ts` and the `authPath` field from the chrome (`Chrome` / `shellChrome` options, `authLabel` default). The footer SHALL keep status text, date, and time, and SHALL NOT report an auth path: there is no `via kody` / `locked` to report, and a served page implies the platform admitted the visitor. Unknown routes SHALL still return 404 inside the full chrome with plain "Not found." text, as today — that 404 is a routing response, not a denial, and it stays.

### Decision 4 — Docs state the Kody permission model, plainly and in both readmes

Update the root `README.md`, `pkg/README.md`, `pkg/AGENTS.md`, `pkg/docs/setup.md`, and the repo-root `AGENTS.md` wherever it describes the gate, so all five say the same thing in plain terms:

- Access to the hosted app is granted and revoked in Kody itself: grant Use / `app:execute` on the app to let someone in; revoke the grant (or sign out of Kody) to end their access. The shell performs no access check of its own.
- Package visibility (public source, forkable) and `internet_visible` (hosted app reachable without a session) are independent toggles. A public package with an internet-private app is the normal private-shell shape.
- **Warning, in the docs:** with no shell gate left, turning `internet_visible` on exposes the app to anyone on the internet. Do not turn it on for a private shell. A publicly visible demo needs its own demo mode, as a separate change.
- MCP exports are not routed through `fetch()` and are governed by Kody's `package:execute` / org access, not by the browser gate. Removing the fetch gate changes nothing about who may call them.
- Local dev (`kody dev --target mock`) is login-free because there is no gate at all, not because of a mock bypass.

The setup guide SHALL carry the grant/revoke steps with a verification step (open signed in as owner; confirm a grantee is served; confirm revoking the grant ends access), and SHALL NOT describe any shell-side denial, locked page, or owner check as a way access is decided.

### Decision 5 — Tests follow the removal

Delete `tests/owner-check-harness.ts` — it tests functions that no longer exist. The remaining harnesses SHALL pass with no gate references, except explicit denial cases for retired behaviour if any are kept (none are required). The mock verification in the tasks SHALL confirm the shell serves with no credential and no locked page, and that no `via kody` / `locked` footer text remains anywhere in served pages.

### Decision 6 — Version

Removing the shell's owner-only restriction and the locked page changes auth behaviour — an `app:execute` grantee previously blocked by the shell is now served — so by the repo's version policy this reads as MAJOR (5.0.0 if it is the next version). The version decision is deferred to publish, as usual; the build number increments by exactly 1 on publish, as always.

### Decision 7 — Non-goals

This change SHALL NOT add a replacement gate (owner check, allowlist, or any other shell-side access check), SHALL NOT change MCP export authorisation, SHALL NOT flip `internet_visible` or package visibility, SHALL NOT reintroduce an OTP, secret, session, or derived code, and SHALL NOT create a public-demo mode. Any of those is a separate change, reviewed on its own.

## Open questions

None. The owner directed the removal and named the model (Kody permissions decide); the only question is implementation detail, which the tasks cover.
