# Design: empty-install

## Context

See proposal.md (Why). Today `ensure_app_store_seeded()`
(`pkg/src/apps/registry.ts:1756`) installs only the App Store via
`store_install_from_catalog('app-store')` when the registry is empty, and
`dispatch()` (`pkg/src/app.ts:600-640`) calls it before routing on every
authenticated shell request — never from MCP reads. The Mini-apps page empty
branch (`pkg/src/app.ts`, around line 1033) renders a `tile-empty` "no
apps yet" tile plus `<p class="empty-hint">Open the App Store to install
a shipped app, or ask an agent to add an app via MCP add_app — it appears
here with no republish.</p>` (old strings, quoted verbatim; the
mini-apps wording for their replacement is in
`mini-apps-user-facing`). The Home dashboard empty state
(`renderDashboard` in `pkg/src/apps/client.ts:573`) is one message for
both empty cases: "No widgets yet" plus "Install apps from the App
Store, then use a row's "Add to home" control." It only receives the
widget list, so it cannot tell "no mini-apps at all" from "mini-apps installed,
none on Home" — and its wording is wrong in both cases: with no mini-apps
there is no Store to install from, and with mini-apps installed there is
nothing to install.

The gate-hint prompt pattern is established: the Help app
(`pkg/catalog/help.bundle.json`, catalogVersion 4) renders prose plus
`<h3>Adding mini-apps</h3>` (renamed from "Adding apps" by
`mini-apps-user-facing`) plus
`<p class="gate-hint"><code>…prompt…</code></p>` with no bundle CSS of its
own, and the Daily Feed empty state follows the same shape. Prompts are
plain selectable text — no copy button, no Clipboard API.

The Mini-App Store install path Prompt 1 names is the agent path:
`install_from_catalog('app-store')` (MCP export,
`pkg/src/apps/registry.ts:1636`), verified with `list_apps`. A browser
path also exists in code today — `GET /apps/app-store` with no Store
installed renders a not-installed fallback ("The App Store app is not
installed.") with a GET form (`install-store=1`) that calls
`store_install_from_catalog('app-store')` and 303s back — but it is
deliberately not named in the copy: it depends on the catalog living in
`pkg/`, and the catalog is moving out of `pkg/`
(`catalog-out-of-pkg`), so it will not be true later.

## Goals / Non-Goals

- Goals: a fresh install is completely empty; removing the last mini-app
  stays empty; the Mini-apps page with no mini-apps explains, in Help style, how
  to get the Mini-App Store and how to add your own mini-apps, both as copy-paste
  prompts; the Home page distinguishes its two empty cases (no mini-apps:
  same help as Mini-apps; mini-apps but none on Home: short Add-to-home message);
  the Mini-App Store remains removable by the user.
- Non-goals: a copy button or any Clipboard API use; a browser bootstrap
  UI; moving the catalog out of `pkg/` (owned by `catalog-out-of-pkg`);
  changing `remove_app` / `manage_remove` or adding a
  self-removal guard; fixing the pre-existing "browser SHALL NOT render
  a removal control" spec drift; revisiting Help's "Install a shipped
  app from the App Store — no agent needed" line (follow-up for the
  catalog move, not this change).

## Decisions

1. **Seeding is removed entirely, not made conditional.** A seed-once
   flag or an explicit-removal flag would add stored state and a new
   failure mode (a flag lost on restore re-seeds the Store). The user
   wants empty as the default, not empty as an exception, so the
   smallest change that makes "remove the last app stays empty" true is
   to delete the call and the function. This also brings forward what
   `bootstrap-after-fork` Decision 1 already assumes: the shell does not
   seed.
2. **The empty Mini-apps page is shell-rendered Help-style text, not a new
   app and not bundle JS.** It must render with zero mini-apps installed, so
   it cannot live in an app bundle. It replaces the empty branch in
   `app.ts`: the section head ("Mini-apps") stays, the "no apps yet" tile
   and the stale hint go, and the help text takes their place. The
   existing scenario (no Edit button with no mini-apps installed) is kept.
3. **Both prompts are selectable `<code>` in `<p class="gate-hint">`,
   no copy button, no Clipboard API.** Same pattern as Help and Daily
   Feed; the shell theme styles prose, headings, and code, with no
   bundle CSS of its own.
4. **Prompt 1 is agent-only.** The browser fallback exists in code
   today, but it depends on the catalog living in `pkg/`, and the
   catalog is moving out of `pkg/` (`catalog-out-of-pkg`), so naming it
   in the copy would ship text that will go stale. The agent path
   (`install_from_catalog`) is the durable one. The preview intro
   likewise drops the "or install the Mini-App Store in the browser" clause:
   "No mini-apps installed yet. This shell starts empty — nothing is
   installed until you add it. Pick a path below. Copy a prompt into a
   Kody-connected agent."
5. **Prompt 2 reuses the Help app's add prompt verbatim, as rewritten by
   `mini-apps-user-facing`.** One canonical wording, copied from
   `pkg/catalog/help.bundle.json`; the empty page must carry its own copy
   because Help itself may not be installed. Prompt prose says mini-app;
   prompt code keeps `add_app`, `list_apps`, and `get_app_state`. Drift risk
   between the two copies is accepted and covered by a test (tasks §3)
   asserting the empty-page prompt contains the same skill path and
   `add_app` instruction as Help's.
6. **Removal is untouched.** The Store Remove button, `manage_remove`,
   and `remove_app` keep their current behaviour and no guard is added.
   A user who removes the Store while other mini-apps remain was already
   able to do so; after this change, removing it as the last app also
   sticks.
7. **Home has two empty states, not one.** With no mini-apps installed,
   Home shows the same help as the Mini-apps page — same intro, same two
   prompts — rendered from the same shared shell block, not a second
   copy, so the two cannot silently diverge. Home is where a fresh user
   lands first, so they should not have to discover the Mini-apps page to
   learn how to start. With mini-apps installed but none on Home, Home shows
   a short message instead: "No widgets yet. You have mini-apps installed —
   add some to Home from the Mini-apps page. Open Mini-apps, tap Edit, and use
   Add to home on a row. They appear here live with no republish."
   Wording is "Add to home", not "pin": Pin is a separate Mini-apps-page
   section and does not place a mini-app on Home. Implementation note:
   `renderDashboard` currently only receives the widget list, so it
   cannot tell the two cases apart; the shell must pass whether any
   mini-apps exist (from `list_apps` / homepage in `dashboardBody`,
   `pkg/src/app.ts`) into the dashboard rendering.
8. **User-facing wording follows `mini-apps-user-facing`.** Every
   user-facing string in this change says mini-app / Mini-apps /
   Mini-App Store, per that change's boundary rule (Decision 1 there):
   prompt prose says mini-app, prompt code keeps `app`
   (`install_from_catalog('app-store')`, `add_app`, `list_apps`,
   `get_app_state`), routes stay `/apps`, and the Store id stays
   `app-store`. The empty help text also carries Help's glossary line
   (Decision 3 there), since Help itself may not be installed on an
   empty shell: "A mini-app is an installed app: in the browser it is
   called a mini-app, and agents call it an app (`add_app`,
   `list_apps`)." The two changes must not ship one saying "apps" and
   the other "mini-apps": whichever lands second re-checks the first's
   prompts against this decision.

## Draft prompts (DRAFT — for user review, not approved wording)

Prompt 1 — install the Mini-App Store (draft, agent-only):

> Add the Mini-App Store to my empty kody-os shell. Install the `app-store`
> catalog mini-app with `install_from_catalog`, verify with `list_apps`
> that `app-store` is installed, and confirm the Mini-App Store page lists
> catalog mini-apps. Do not install any other mini-app, and do not publish or
> change the package source.

Prompt 2 — add your own mini-apps (draft, copied verbatim from Help,
as rewritten by `mini-apps-user-facing`,
`pkg/catalog/help.bundle.json`):

> Add a new mini-app to my hosted kody-os app on Kody. First open the
> published guide with Kody search entity
> `package:kody-os#.agents/skills/adding-an-app/SKILL.md`, then follow
> that definition contract. Use the package's `add_app` through the
> Kody MCP execute wrapper. Validate before writing, verify with
> `list_apps` and `get_app_state`, and do not publish or change the
> package source. Do not add it to the homepage unless I ask. Ask me
> before writing if any detail is missing or ambiguous.
>
> – Mini-app id: [slug]
> – Name: [display name]
> – What it does: [one sentence]

## Open Questions

- Exact prompt wording: is the agent-only Prompt 1 draft above
  acceptable as final copy?
- Version bump: MINOR is recommended (no installed app or agent script
  against a non-empty registry breaks; the change adds the empty-install
  state as a supported feature), but MAJOR is defensible (the canonical
  specs currently REQUIRE a fresh install to open with the App Store
  installed, and that contract is being removed). The implementation
  commit records the decision; the change itself does not decide it.
- Pre-existing drift, out of scope: canonical `app-registry` says the
  browser SHALL NOT call `remove_app` or render a removal control, but
  the Store (bundle v10, commit `08b81cd`) renders Remove. Does this
  change leave that line untouched (recommended — separate change), or
  fix it while the registry spec is open?
- Mock-dev and test fallout: do any existing tests or the catalog/store
  harnesses assume the Store is present on first shell use? The
  implementation greps for that (tasks §1/§3) rather than assuming.
