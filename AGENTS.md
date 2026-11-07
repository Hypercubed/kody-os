# AGENTS.md — maintainers of this repository

This file is for agents working **on this repository**. It is not shipped to Kody and it is not the package's agent guide.

- **`pkg/AGENTS.md` is for agents using the published package on Kody**: MCP exports, `add_app`, the device gate, and the app-definition contract. Read it when the task is about using or extending the package from the outside.
- **This file is for agents changing the repository itself**: shell code, catalog definitions, specs, tests, and publishing. When the two files disagree about a maintainer task, this file wins for repo work; when they disagree about package behavior, `pkg/AGENTS.md` wins, and the disagreement itself is worth flagging.

## Repository layout

- `pkg/` — the Kody package. The only directory that ships. Shell source in `pkg/src/`, catalog in `pkg/catalog/`, package-user docs in `pkg/docs/`, dev scripts in `pkg/scripts/`, theme and assets in `pkg/public/`.
- `openspec/` — canonical specs in `openspec/specs/`, active changes in `openspec/changes/`, closed changes in `openspec/changes/archive/<YYYY-MM-DD>-<slug>/`.
- `tests/` — repository-level harnesses (bun). Catalog-bundle tests live in `pkg/catalog/tests/`.
- `docs/` — repository-level docs, currently the 2026-10-27 security review.
- `.agents/skills/` — repository tooling skills. `.claude/settings.json` — Claude Code settings for this repo.

## Before you commit, push, or publish

Name the exact scope first and wait for direction. This is a standing rule for this repo, not a suggestion:

- A commit, push, or publish is never implied by "the code is ready", by a previous commit, or by a general instruction to keep going.
- A force-push (including a history rewrite) needs its own explicit direction, naming the branch and the remote.
- Git and Kody publishing are separate. Pushing to GitHub does not publish to Kody; publishing to Kody does not push to Git.
- Never push with `--mirror` or `--all`. Push one branch to one remote, by name. That rule exists because unrelated refs on other remotes (including old checkpoint refs) must never be copied into a public repo by accident.
- Do not re-add Entire integration. Entire tracking was removed in November 2026 (checkpoints deleted, tracking disabled, Entire files removed from the tree). Re-adding it needs an explicit decision.

## Version policy

The full policy lives in `pkg/AGENTS.md` and is not restated in full here, because the package file is canonical and duplication drifts. The maintainer-facing summary:

- Single source of truth: `pkg/package.json` (`version` + integer `build`). `pkg/AGENTS.md` and `pkg/README.md` headers must state the same version, updated in the same commit as any bump.
- Take the highest bump any part of the change triggers; when in doubt between two levels, take the higher one. Bump in the same commit as the change — never a separate "bump version" commit, and never bump for a change you have not verified.
- MAJOR: existing apps or agent scripts break (definition no longer validates/acts the same, a `schemaVersion` is dropped, a state field or effect operator changes meaning without migration, an MCP export is removed/renamed/reshaped, auth/session behavior breaks existing sessions).
- MINOR: new feature, nothing existing breaks (new `schemaVersion`, MCP export, effect operator, optional field, capability). Reset PATCH to 0.
- PATCH: bug fix restoring documented behavior, internal refactor with no observable change, docs-only correction. A publish containing only docs corrections still bumps PATCH.
- BUILD: increment by exactly 1 on every Kody publish, including version-unchanged publishes. Never reset, skip, or reuse a `version` + `build` pair.
- What does NOT bump the version: changes outside `pkg/` (specs, repo tooling, this file, the repository README), and app definitions or state written via `add_app`/`act` (data, not package code).

## Shell constraints (binding)

These come from the package and the Scribe ceiling, and they bind maintainer work the same way they bind app authors:

- **ES2019 only** for shell and bundle code. No syntax or API newer than ES2019. System fonts only, zero emojis, 48px minimum tap targets, no flexbox gap (grid gap is fine). The canonical ceiling statement is in `pkg/docs/scribe-limitations.md` — do not restate it in a conflicting form elsewhere.
- **GET forms only in browser UI.** Kody's edge rejects mutating requests from package-app subdomains with a foreign or `null` Origin. Never render `<form method="POST">` or `fetch(..., { method: 'POST' })` in shell or bundle UI. UI actions are GET forms; `POST /apps/:id` stays for API clients. Bundle action URLs resolve against the shell-stamped `data-action-base` with `credentials: 'same-origin'`.
- **Styles are inlined.** `pkg/src/shell-css.ts` is generated from `pkg/public/styles.css`. Regenerate after any theme edit; do not add an external stylesheet.
- **No root-export side effects** in the package entry: no jobs, file writes, or installs on import.
- **Works without JavaScript** (form submit + redirect), except the App Store data app, which requires JavaScript by design and shows a no-JS note pointing at agent `add_app`.

## Catalog rules

- A catalog app is one directory `pkg/catalog/<id>/` holding `definition.json` + `RECIPE.md`, plus one import line in `pkg/src/apps/catalog.ts` (alphabetical by id), plus one entry in `pkg/catalog/README.md`, plus a re-run of the catalog-index generator (`bun scripts/build-catalog-index.ts`), plus a harness pass (validate + install in a blank store + initial state + index/directory/import match).
- `catalogVersion` starts at 1 on a definition's first versioned release and increments by exactly 1 on any change to that definition file — never for an unrelated app or a shell change, never reused, never decreased. It is distinct from `schemaVersion` and from the package version.
- Install snapshots are written only by store install/update (including seeding), never by generic `add_app`/`import_app`, deleted by `remove_app`, and never included in exports. The Store never auto-updates.
- Catalog bundles run with the visitor's authority. Shipping a definition in the catalog is trusting its bundle code, exactly as `add_app` trusts any definition. Review third-party bundles before adding one.
- Capabilities are installer disclosure plus a server-side allowlist for honest apps, not a sandbox: `capabilities.feeds` and `capabilities.proxy` (up to 8 each, HTTPS bare URLs, TTL/maxBytes limits, served by name, never by request URL) and `capabilities.manageApps` (boolean; only declared bundles may use `GET /manage/rows|install|update|restore`, undeclared callers get a plain 404). Unknown capability keys fail validation with no write.

## Local development

Run from `pkg/` only — the repository root fails (missing `kody.app.entry`). Proxy bypass is required on this host for every `kody dev` / `curl` call: `export NO_PROXY='*' no_proxy='*'; unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY`.

```sh
cd pkg
kody dev --target mock # → App ready at http://127.0.0.1:4302/, status at /__kody/dev/status
kody execute --target mock --file scripts/catalog.ts --params '{"op":"install","id":"app-store"}'
kody execute --target mock --file scripts/add-app.ts --params "$(cat myapp.json)"
kody execute --target mock --file scripts/registry.ts --params '{"op":"list"}'
```

**Mock writes need a stopped server.** `kody dev` reads its mock store once at startup and serves that snapshot from memory. A `kody execute` write made while the preview runs returns `{ ok: true }` and lands on disk, but the preview never shows it, and the preview's next write rewrites the file from its snapshot and silently deletes the CLI change. Stop the server, run the writes, start it again. "Write now, restart later" loses the write as soon as the running preview acts.

The shell's automatic App Store seed only fires on an empty registry, so install `app-store` explicitly if any other app was seeded first. Full local-dev detail, including the login-free mock target and the device gate, is in `pkg/AGENTS.md` — read it before debugging auth, and do not duplicate its auth description here.

## Tests

- Run with bun from the repository root for repo harnesses (`bun tests/catalog-harness.ts`, `bun tests/store-harness.ts`) and for catalog-bundle tests (`bun pkg/catalog/tests/app-store-tests.cjs`). Other harnesses in `tests/` cover agent tools, open mode, owner checks, home-widget counters, and isolation; run the ones for the area you changed.
- A failing harness is a real signal. If you believe a failure is pre-existing, verify it on a clean checkout of the base commit before saying so, and name the failing check — do not wave failures through as "probably pre-existing".
- Do not mark a verification step done if it was not run. In particular, a `kody dev` check that could not run in this environment (no `kody` CLI here) must be recorded as substituted — by which harness, and why — not as done.

## Working with specs

- A change lives in `openspec/changes/<slug>/` with `proposal.md`, `design.md`, and `tasks.md`, plus a spec delta under `specs/<spec>/spec.md` for every canonical spec it changes. Keep the canonical specs in `openspec/specs/` in sync in the same change; a change whose spec deltas do not match the code is unfinished.
- When a change is done, archive it to `openspec/changes/archive/<YYYY-MM-DD>-<slug>/` and add a close-out note to its `tasks.md` recording what was actually verified, what was substituted, and what was left open. Archived changes are the record of what shipped; do not rewrite them to make the past look cleaner.
- Specs 4–6 of the store/catalog rethink (`catalog-out-of-pkg`, `public-pinned-catalog`, `bootstrap-after-fork`) are written but not implemented, gated on this repository being public. The catalog move must land in the same release window as the pinned-catalog change, never alone.

## Security and secrets

- The trust boundary is who can install or publish an app. Bundle scripts run same-origin with the visitor's full authority by design; capabilities do not isolate them. See `docs/security-review-2026-10-27.md`.
- Never commit secrets, tokens, API keys, or credentials to this repo, and never paste one into chat or a file to make something work. Use the secure entry flow for any credential that must be stored. If a credential is pasted into chat by mistake, the correct response is to rotate it, not to copy it anywhere else.
- No auth registries exist. Auth is Kody-login-only; there is no legacy access key, no derived code, no session, and no stored-hash fallback.
- When a user asks a question, answer the question. Do not attach a build, spec, or publish pitch to a question turn unless the user asks for that work.
