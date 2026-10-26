# Design: self-contained app bundles

## Context

See proposal.md (Why). Today every app is operator-form JSON validated by
`validateDefinition()` in `pkg/src/apps/registry.ts`, rendered by
`renderAppSection()` in `pkg/src/apps/client.ts`, and mutated only through
`act()`. The shell (`pkg/src/app.ts`) serves `GET /apps/:id` in full chrome
with inlined CSS and an optional client module. Scribe posture (see
`docs/scribe-limitations.md`): Scribe supports JS — vanilla ES2019, guarded
fetch enhancement allowed, no frameworks, no timers/WebSockets/routing
required. The JSON fast path (`?format=json`) already proves same-origin GET
round-trips from shell JS.

## Goals / Non-Goals

- Goals: agent-authored bundles install with no shell changes; shell hosts
  them in existing chrome; stateless bundles (8-ball) work end to end;
  trust boundary explicit; operator apps untouched.
- Non-goals: iframe sandboxing claims (Scribe support unproven — same-document
  hosting first); per-app storage bridge (Phase 2 of this change); bundle
  updates/diffing (re-add overwrites, same as operator apps); a gallery.

## Decisions

1. **Bundle = manifest + files, stored as data.** New optional definition
   shape: `{ kind: 'bundle', id, name, label?, icon?, description?,
   bundle: { entry: 'index.html', files: { path: content } } }`.
   Rationale: installs through the existing `add_app` registry write, so no
   republish and no new install path; validation stays in one place.
2. **Tight file rules.** Path allowlist (`index.html` + relative `.js`/`.css`
   only, no `..`, no absolute paths, no nesting beyond one level); per-app
   cap 256 KiB total (storage budget is 16 MiB shared); entry must be
   `index.html`. Rationale: keeps bundles auditable JSON and bounds the
   storage blast radius of one bad add.
3. **Same-document hosting, shell scripts win ties.** The shell inlines the
   entry HTML into the app panel/overlay section; bundle `<script>`/`<style>`
   are inlined alongside (no external bundle assets — Scribe loads no
   external stylesheets). Bundle JS runs after shell JS; on any error the
   server-rendered content stays. Rationale: ReKindle proves first-party
   scripts run in the Kindle browser; external-asset hosting would reintroduce
   the Scribe failure mode we already eliminated for the shell.
4. **No storage bridge in Phase 1.** Stateless bundles only: no bridge API,
   no namespaced keys wired yet. Rationale: the 8-ball needs none, and every
   bridge design (fetch endpoints, cookie rules, POST edge guards) deserves
   its own proven decision instead of riding along.
5. **Trust = private package + owner agents, stated plainly.** Only callers
   with MCP access can `add_app`; the package stays private. Bundle JS is
   treated like any agent-authored content running in the owner's browser —
   documented, not sandboxed. Rationale: a sandbox claim we cannot verify on
   Scribe would be security theater; the real control is who can install.
6. **Operator form frozen, not forked.** `validateDefinition` branches on
   `kind` (default preserves today's operator validation byte-for-byte);
   `act()` rejects for bundle ids with a clear error. The branch MUST also
   normalize absent `ui`/`stateSchema`/`actions` on bundle definitions so
   the shared `add_app` write path never dereferences missing fields.
   Rationale: zero
   regression surface for existing apps and exports.
7. **Authoring docs ship inside the package.** The Scribe capability
   findings move from root `docs/` (dev-only, gitignored, invisible to
   Kody) to `pkg/docs/scribe-limitations.md`, linked from the authoring
   guide, README, and AGENTS so a Kody-connected agent can open them by
   file path. Rationale: bundle authors are agents; the constraints they
   must obey have to be reachable through the same channel as the guide.
   Docs only — no behavior change.
8. **Templates frozen and deprecated, never extended.** `ui.template` stays
   exactly `hello` | `generic` | `clock`; unknown values keep failing
   validation with a naming error; no new per-app render branches will be
   added to the shell. The `clock` template keeps rendering (frozen, not
   removed) so anything already installed keeps working. Docs and guide
   say deprecated and point at bundles for anything visual. Rationale: every
   new template is a shell code change + republish — precisely the coupling
   bundles exist to end. (This supersedes the clock-calendar change's
   `counter`-template direction; that change is flagged for archive.)
9. **Example apps live in-repo as installable files.** `example-apps/` holds
   `hello-counter.json` (operator contract fixture — smoke tests, guide,
   and fast-path verification depend on an operator app, so it stays),
   plus bundles `eight-ball.bundle.json` and `clock.bundle.json` (modal),
   plus a README with `add_app` install
   steps. Every bundle MUST match the §1 manifest shape. Preview seeds
   from `example-apps/` (replacing the `pkg/app.json` + `pkg/apps/` +
   inline-modal seeding) so each file proves verbatim install. Orphaned
   seed files `pkg/app.json` and `pkg/apps/clock.json` are deleted;
   docs scratch-path references move to a non-seeded temp file. Rationale:
   one canonical copy of each app, installable verbatim in both stores.
10. **Probe converts to a bundle in Phase 2.** The Scribe probe needs
    persisted beacon results, so it waits on the storage bridge — then it
    ships as a bundle example and the custom `/probe*` routes plus
    `kody-os.probe.*` keys retire. Rationale: dogfoods bundles + bridge on
    a real app; until then the custom routes stay (they're proven on-device).

## Risks / Trade-offs

- [Risk] Bundle JS breaks the page on Scribe (old WebKit quirks) →
  Mitigation: ES2019 ceiling enforced by validation guidance + guide examples;
  server-rendered shell chrome and description always render regardless.
- [Risk] Agent ships an oversized or hostile bundle → Mitigation: 256 KiB
  cap, path allowlist, private package, owner-only install; removal is one
  MCP call.
- [Risk] Two app kinds confuse authors → Mitigation: guide leads with "toy
  with JS? bundle. Shared validated state? operators." plus the 8-ball as
  the canonical bundle example.

## Migration Plan

House apps convert in place, same id, via `add_app` overwrite:

| App | Current | Target | Notes |
|---|---|---|---|
| hello-counter | operator (`test-app.ts`, preview + smoke tests) | stays operator | operator-path contract fixture; fast-path/PRG verification needs it |
| eight-ball | operator (`pkg/app.json`, 20-button hack) | bundle, same id | true random shake; kills the hack |
| clock | operator (`pkg/apps/clock.json`, orphaned, template form) | bundle, same id | live ticking per 3.4; orphans deleted |
| clock (modal) | operator (inline in preview server) | bundle, same id | exercises bundle-in-overlay; replaces inline def |
| probe | custom routes + `kody-os.probe.*` keys | bundle, Phase 2 (5.5) | needs storage bridge |

Same-id overwrite preserves routes, pins, hidden flags, homepage
placement, and registry order (reference lists are id-keyed; only
`remove_app` scrubs them); state resets to initial, which is acceptable —
every convert is stateless. Run inventory (`list_apps`) on the preview
mock store and the Kody prod store first, convert each, and verify every
converted app opens and (where interactive) acts. Rollback per app is
re-adding its prior definition (operator JSONs stay in `example-apps/`
and git history); code rollback is a republish of the prior commit.

## Open Questions

- Per-app storage bridge shape (Phase 2): fetch endpoints vs. form-mediated
  writes given the POST edge rule — to be specified after stateless hosting
  proves out, not here.
