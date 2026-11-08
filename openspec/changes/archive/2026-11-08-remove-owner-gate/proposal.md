# Change: Remove the shell's owner gate — Kody permissions decide access

## Why

The shell currently runs its own owner check in `fetch()`: `isKodyOwnerVisitor()` in `pkg/src/auth.ts` serves a request only when the platform-verified visitor has role `owner` in the owning org, and every other visitor gets the locked page. That check was added on Oct 30, 2026, when the shell treated any platform-verified visitor as allowed — it was the only thing stopping a random signed-in Kody user from opening a private shell.

It is redundant now. The model is: the app stays internet-private (`internet_visible` off), so Kody's own platform gate decides who reaches the fetch handler at all — the owner, plus anyone granted `app:execute` / Use on the app. The shell re-checking owner-ness on top of that adds a second, stricter rule (owner-only, where the platform would also admit grantees) and a whole auth subsystem (`auth.ts`, the locked page, the footer auth path, the owner-check harness) for no additional protection on the browser surface. It never protected the MCP surface at all: MCP exports are not routed through `fetch()` and were never gated by it.

Removing it leaves one authority for access — Kody's permission system — and makes the readmes say so plainly, instead of the shell implying it enforces access itself.

## What changes

- **No shell gate in `fetch()`.** `pkg/src/app.ts` serves `dispatch()` to every request that reaches it. There is no owner check, no verified-visitor check, and no locked page in the shell.
- **`pkg/src/auth.ts` is deleted in full.** `isKodyOwnerVisitor`, `isKodyVerifiedVisitor`, `parseVisitorHeader`, `visitorHeader`, `isMockTarget`, `AccessCheck`, `AuthPath`, and `authPathFor` all go with it. The mock target needs no gate skip because there is no gate to skip.
- **The footer stops reporting an auth path.** There is no `via kody` / `locked` to report; the footer keeps status text, date, and time, and drops the auth-path element.
- **Docs say Kody permissions decide.** The root `README.md`, `pkg/README.md`, `pkg/AGENTS.md`, `pkg/docs/setup.md`, and the repo `AGENTS.md` (where it describes the gate) state, in plain terms: access is granted and revoked in Kody itself (Use / `app:execute` on the app, `internet_visible` off for a private shell); the shell performs no access check; turning `internet_visible` on exposes the app to anyone on the internet, with no shell gate left to stop them.
- **Tests follow.** `tests/owner-check-harness.ts` is deleted. No gate references remain in tests except as explicit denial cases for retired behaviour, if any are kept.

## What does not change

- **Package visibility and `internet_visible` are untouched by this change.** The package may be public (source forkable) while the hosted app stays internet-private. This change flips no toggle and approves no capability.
- **MCP exports are unchanged in behaviour.** They were never gated by `fetch()` and still are not; who may call them is decided by Kody's `package:execute` / org access, not by the shell. Removing the fetch gate neither opens nor closes the MCP surface.
- **No secret, session, or credential is introduced.** Kody login is still verified per request by the platform before shell code runs; signing out of Kody still ends a visitor's access. There is still no shell session to revoke.
- **The mock target stays login-free.** It was login-free by gate skip; after this change it is login-free because there is no gate at all.

## Impact

- This is a breaking change: it removes the shell's owner-only restriction and the locked page. A person previously blocked by the shell but admitted by the platform — anyone holding an `app:execute` / Use grant on the app — will now be served. By the repo's version policy it reads as MAJOR. The version decision is deferred to publish, as usual.
- The locked page disappears. A request that the platform does not admit never reaches shell code, so there is no shell-rendered denial to show; a request that does reach shell code is served.
- **Warning, carried into the docs:** with no shell gate left, `internet_visible` on means anyone on the internet can open the app. Do not turn it on for a private shell. A publicly visible demo needs its own demo mode, as a separate change — this change does not create one.
