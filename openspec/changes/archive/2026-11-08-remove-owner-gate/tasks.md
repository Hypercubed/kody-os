# Tasks

Phases land in order: 1, then 2, then 3. No task in this file commits, pushes, or publishes anything. No release/publish steps are in this plan — the owner decides when to release once there are enough changes.

## 1. Remove the gate

- [x] 1.1 Remove the gate from `pkg/src/app.ts`: `fetch()` SHALL call `dispatch()` unconditionally, with no visitor check, no role check, and no `metaGetCurrentUser` call. Delete `lockedPage()`, the `authPath` field from the chrome (`Chrome` / `shellChrome` options, `authLabel` default), and the `auth.ts` import. The footer SHALL NOT report an auth path. Unknown routes SHALL still return 404 inside the full chrome with plain "Not found." text.
- [x] 1.2 Delete `pkg/src/auth.ts` in full (`isKodyOwnerVisitor`, `isKodyVerifiedVisitor`, `parseVisitorHeader`, `visitorHeader`, `isMockTarget`, `AccessCheck`, `AuthPath`, `authPathFor`). No replacement auth helper SHALL be added. Grep SHALL find no remaining import of `./auth.ts` and no remaining reference to any of those names in `pkg/src/`.
- [x] 1.3 Delete `tests/owner-check-harness.ts`. Grep SHALL find no gate references (`isKodyOwnerVisitor`, `isKodyVerifiedVisitor`, `via kody`, `locked`, `device gate`, `owner gate`) in `tests/` except explicit denial cases for retired behaviour, if any are kept — record any that are kept and why.
- [x] 1.4 Update docs to state the Kody permission model (Decision 4): the root `README.md`, `pkg/README.md`, `pkg/AGENTS.md`, `pkg/docs/setup.md`, and the repo-root `AGENTS.md` (where it describes the gate) SHALL all say access is granted/revoked in Kody itself (Use / `app:execute` on the app), the shell performs no access check, package visibility and `internet_visible` are independent toggles, and turning `internet_visible` on exposes the app to anyone on the internet with no shell gate left. `pkg/docs/setup.md` SHALL carry the grant/revoke steps with a verification step, and SHALL NOT describe a shell-side denial, locked page, or owner check as deciding access. MCP exports SHALL be described as governed by Kody's `package:execute` / org access, unchanged by this change.
- [x] 1.5 Update any other doc that describes the gate as the way in (grep `device gate`, `via kody`, `locked`, `owner-only` across `pkg/docs/`, `pkg/.agents/skills/adding-an-app/SKILL.md`, and `pkg/docs/style-guide.md`): each SHALL be corrected to the permission model or have the gate wording removed, and the change SHALL record what was touched. No doc SHALL claim the shell enforces owner-only access after this change.

## 2. Verify

- [x] 2.1 Harness and tests: the catalog, store, and remaining harnesses SHALL pass. No gate references SHALL remain in tests except as recorded in 1.3. The shell SHALL satisfy the existing bundle constraints (`bun build pkg/src/app.ts --target=browser --external 'kody:*'` SHALL succeed).
- [ ] 2.2 Mock verification: `kody dev --target mock` SHALL serve the shell with no credential, no locked page, and no `via kody` / `locked` footer text on any served page. Hosted verification (owner served; grantee served; revoked grantee denied by the platform, before shell code runs) is the owner's call — mock cannot prove the hosted platform path — and SHALL be recorded as such, not marked done if not run.
- [x] 2.3 No-gate grep: grep across `pkg/` and `tests/` for `isKodyOwnerVisitor`, `isKodyVerifiedVisitor`, `parseVisitorHeader`, `visitorHeader`, `isMockTarget`, `authPath`, `lockedPage`, `via kody`, and `locked` SHALL return no hits except in this change's own files, the archived `remove-otp` change, and any denial cases recorded in 1.3.

## 3. Close out

- [x] 3.1 Validation: `openspec validate` for this change and whole-repo `openspec validate --changes`; the change SHALL be valid and the whole-repo result SHALL show no new failures against the pre-existing set (email-client, f-flat-minor-calculator, generic-rss-feed). If no `openspec` binary is available in this environment, record the manual shape check used instead and do not claim a validate run.
- [x] 3.2 Sync canonical specs (`openspec/specs/auth-transport/spec.md`, `openspec/specs/shell/spec.md`, `openspec/specs/setup-guide/spec.md`, and any other spec whose gate references the implementation touches) from the deltas in this change and confirm they validate.
- [x] 3.3 Archive: when implemented and verified, move this folder to `openspec/changes/archive/<YYYY-MM-DD>-remove-owner-gate/` and append a close-out note to this file recording what was actually verified, what was substituted, and what was left open. Do not mark a verification step done if it was not run.

## Close-out note (2026-11-08)

Implemented and verified as planned. `fetch()` calls `dispatch()` unconditionally; `auth.ts` deleted; `lockedPage()`, the `authPath` chrome field, and the footer auth path removed; `tests/owner-check-harness.ts` deleted; docs (root + `pkg/` READMEs, both AGENT.md files, `setup.md`, `shell-settings.md`, `style-guide.md`, adding-an-app SKILL.md, `INTEGRATION.md`, `index.ts` comment, About page donation line) state the Kody permission model.

Verified: catalog harness ALL PASSED (18 apps); store harness ALL PASSED; `bun build pkg/src/app.ts` succeeds; no gate references in `tests/`; `openspec validate remove-owner-gate` valid; whole-repo `--changes` shows no new failures (email-client, f-flat-minor-calculator fail identically on the base commit).

Recorded per 1.3 (no denial cases kept — none required) and 2.3: the only remaining `locked`-substring hits in `pkg/src/` are non-gate usages evaluated and left alone — the `blocked` local in `registry.ts`, `catalog fetch blocked (HTTPS only)` error strings in `remote-catalog.ts`, and generated `shell-css.ts`; `setup.md` keeps one accurate `owner-only` mention of Kody's own `communityForkAdopt` step. Spec delta gained the archived scenarios the validator requires (theme-routes x3, theme-override x2) plus a RETIRED-marked `Footer names the auth path` (remove-legacy-code convention) so archive drops nothing silently.

Substituted with reason: 2.2 mock/hosted verification not run here (no `kody` CLI in this environment) — the platform-path halves (grantee served, revoked grantee denied before shell code runs) are the owner's call on hosted; hosted verification left open. agent-tools and open-mode harness failures verified byte-identical on the base commit (pre-existing, unrelated). No commit, push, or publish performed.
