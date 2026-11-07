# kody-os

A personal AI OS that runs on [Kody](https://kody.codes/?ref=hypercubed) — a homepage for your devices, built with the Kindle Scribe in mind but working in most browsers. One generic shell renders every app; apps are JSON definitions stored in the package, not code you have to write. Ask a Kody-connected agent to add an app — a clock, a feed, a game — and it shows up on all your devices, with no republish needed.

Current package version: **v3.0.0** (build 33). See `pkg/package.json` for the authoritative version.

![Home dashboard](pkg/public/screenshots/home.png)
![All apps](pkg/public/screenshots/apps.png)

## Run it

You need a free [Kody](https://kody.codes/?ref=hypercubed) account, a fork of kody-os, and a publish. The full steps, with checks, are in the [Setup guide](pkg/docs/setup.md). The short version:

1. **Sign up for Kody (free).** Create your account with [this referral link](https://kody.codes/signup?ref=hypercubed).
2. **Fork kody-os.** Install it from [the kody-os listing on Kody](https://kody.codes/@hypercubed/kody-os) in one click — that forks it into your account and publishes it. Otherwise, fork this repository on GitHub and publish the package from `pkg/` through a repo session; your Kody-connected agent can do the publish.
3. **Sign in with Kody.** Open the app while signed in to your Kody account and you skip the device gate entirely — that is the only way in, including on the Kindle Scribe.
4. **Install your first app.** A fresh install starts empty — no apps seeded, including no App Store. Install the App Store from the prompt on the empty Apps page (`install_from_catalog('app-store')`), or ask your agent to add an app (for example `counter`) with `add_app`. Adding an app never needs a republish.


## What it does

- **Home** — pinned widgets with live content, reorderable with corner arrows; honest empty state when nothing is pinned yet.
- **Apps** — every installed app as a tile; Edit mode pins, hides, and adds apps to the home dashboard.
- **App pages** — description, live state, and one plain-form button per declared action. Actions work with JavaScript disabled (GET form + redirect) and enhance in place where scripting runs. The App Store itself is the exception: it is a data app and requires JavaScript.
- **Feeds and proxy** — apps declare allowlisted HTTPS upstreams (`capabilities.feeds`, `capabilities.proxy`) read through the shell's same-origin feed/proxy routes with storage caching. No auth is forwarded upstream.
- **Access** — sign in with your Kody account to skip the device gate entirely (the only way in, including on the Kindle Scribe). The local mock target used for development skips the gate entirely. Agents use MCP exports, which are never gated. There is no secret to configure.
- **Help and About** — built-in shell pages, not apps. They can be hidden from the Settings app.

The shipped catalog has 18 apps: app-store, arrow-game, calculator, calendar, cellular-playground, clock, counter, daily-feed, eight-ball, generic-feed, hoodie-weather, link-drop, mac-puzzle, news, probe, settings, three-bit-art, and xkcd. See [`pkg/catalog/README.md`](pkg/catalog/README.md) for what each one does and the catalog membership checklist.

## For maintainers — two roots

This repository has two different "roots", and they serve different audiences. Do not confuse them:

- **This file, and `AGENTS.md` at the repository root, are for maintainers of this repository.** They describe the repo layout, how to change the shell, how to run the tests, how to write a spec, and how to publish.
- **`pkg/` is the Kody package itself.** Its `pkg/README.md` and `pkg/AGENTS.md` are for users and agents *of the package* on Kody: how to set up a fork, sign in, install apps, and write an app definition. Those files ship inside the package. The files at the repository root do not.

If you just want to use kody-os, start with the [Setup guide](pkg/docs/setup.md). The rest of this file is for people working on the code.

## Repository layout

```
pkg/                 The Kody package — the only directory that ships to Kody.
  src/               Shell source: app.ts (fetch handler), auth.ts, feeds.ts,
                     client/, bridge/, and apps/ (registry, catalog, forms, client).
  catalog/           Shipped app dirs (definition.json + RECIPE.md + index.html),
                     generated index, plus tests.
  docs/              Package-user docs: setup,
                     scribe-limitations, style-guide.
  scripts/           kody dev helpers: registry, catalog, add-app.
  public/            Theme, favicon, screenshots, and styles.css (inlined into src/shell-css.ts).
  package.json       Single source of truth for version and build.
  README.md          Package-user README (ships with the package).
  AGENTS.md          Package-user agent guide (ships with the package).
  .agents/skills/    Agent skills shipped with the package (adding-an-app).
openspec/            Specs and change proposals (see "Working with specs" below).
  specs/             Canonical, current specs (shell, app-registry, authoring, …).
  changes/           Active change proposals: proposal.md, design.md, tasks.md, spec deltas.
  changes/archive/   Closed changes, dated by close-out (e.g. 2026-11-07-…).
tests/               Repository-level harnesses (bun): catalog, store, agent-tools,
                     open-mode, owner-check, home-widget-counter, isolation-demo, …
docs/                Repository-level docs: the 2026-10-27 security review.
.agents/skills/      Repository tooling skills (e.g. kody-lan-access).
.claude/             Claude Code settings for this repo.
```

## Developing

All shell work happens in `pkg/`. The repository root has no build step of its own.

### Run the shell locally

```sh
cd pkg
export NO_PROXY='*' no_proxy='*'
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY
kody dev --target mock
# → App ready at http://127.0.0.1:4302/
```

Full local-dev instructions, including installing the App Store, are in `pkg/README.md` and `pkg/AGENTS.md`. Two rules that bite every new maintainer, so they are stated here too:

- **Run `kody dev` from `pkg/` only.** The repository root fails (missing `kody.app.entry`).
- **Stop the preview before any mock-store write.** A running preview serves its startup snapshot from memory; a `kody execute` write made while it runs lands on disk and is then silently overwritten by the preview's next action. Stop, write, restart.

### Run the tests

```sh
bun tests/catalog-harness.ts
bun tests/store-harness.ts
bun pkg/catalog/tests/app-store-tests.cjs
```

Run the harness for the area you changed, plus the catalog harness whenever a catalog definition changes. A harness failure is a real signal unless you have verified it is pre-existing on a clean checkout — say so explicitly in that case instead of waving it through.

## Working with specs

Changes to the shell go through OpenSpec, not straight to code:

1. Create a change under `openspec/changes/<slug>/` with `proposal.md`, `design.md`, and `tasks.md`, plus a spec delta under `specs/<spec>/spec.md` for each canonical spec it changes.
2. Implement against the tasks, keeping the canonical specs in `openspec/specs/` in sync in the same change.
3. When the change is done, archive it under `openspec/changes/archive/<YYYY-MM-DD>-<slug>/` with a close-out note in its `tasks.md`. Do not mark a verification step done if it was not run — record what was substituted for it instead (for example, a harness run in place of a `kody dev` check, with the reason).

Active changes and their status live in `openspec/changes/`; the archived history is the record of what actually shipped and when.

## Rules that shape every change

The full maintainer rules are in [`AGENTS.md`](AGENTS.md). The ones that most often decide a review:

- **ES2019 only** for shell and bundle code (Kindle Scribe / Chromium 80 ceiling), system fonts only, zero emojis, 48px minimum tap targets, no flexbox gap (grid gap is fine).
- **GET forms only in browser UI.** Kody's edge rejects mutating requests from package-app subdomains with a foreign or `null` Origin, so never render a POST form or `fetch` a POST. `POST /apps/:id` stays for API clients only.
- **Version + build are a single source of truth in `pkg/package.json`.** `pkg/AGENTS.md` and `pkg/README.md` headers must match it, updated in the same commit as any bump. Changes outside `pkg/` (specs, repo tooling) do not bump the version; app definitions written via `add_app` are data, not package code, and do not either.
- **Styles are inlined.** `pkg/src/shell-css.ts` is generated from `pkg/public/styles.css` — regenerate after any theme edit.
- **Capabilities are disclosure, not a sandbox.** Bundle scripts run same-origin with the visitor's full authority, so installing an app is trusting its code. Review third-party bundles before shipping one in the catalog.

## Publishing

Git and Kody publishing are separate steps, and neither implies the other:

- **Git:** this repository lives on GitHub. Pushing to GitHub does not publish anything to Kody, and publishing to Kody does not push anything to Git.
- **Kody:** publishing the package from `pkg/` increments `build` by exactly 1, even when `version` is unchanged. Never reset or skip a build number, and never reuse a `version` + `build` pair.
- **Before any commit, push, or publish, name the exact scope and wait for direction.** A publish in particular is never implied by "the code is ready".

Entire tracking was removed from this repository in November 2026 (checkpoints deleted, tracking disabled, Entire files removed from the tree). Do not re-add Entire integration without an explicit decision to do so, and never push with `--mirror` or `--all` — that is how unrelated refs (including old checkpoint refs on other remotes) get copied into a public repo.

## Roadmap: the public catalog

The next change, spec'd and in progress, moves the catalog out of the package so the App Store can read it from this public repository instead of from the shipped bundle. It lands before the Kody listing goes public:

- `catalog-out-of-pkg`: move the `pkg/catalog/<id>/` directories to `catalog/` at the repo root, with a generated `catalog/catalog.json`.
- `public-pinned-catalog`: the Store reads the public catalog pinned to a release tag (never `main` HEAD by default).
- `bootstrap-after-fork`: docs for bootstrapping the App Store from the pinned release after forking (About and Help are built-in pages and need no install).

## License

kody-os is licensed under the MIT License. See [`LICENSE`](LICENSE) at the repository root. An identical copy ships inside the package at `pkg/LICENSE`.
