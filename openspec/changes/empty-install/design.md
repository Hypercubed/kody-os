# Design: empty-install

## Context

See proposal.md (Why). Today `ensure_app_store_seeded()`
(`pkg/src/apps/registry.ts:1756`) installs only the App Store via
`store_install_from_catalog('app-store')` when the registry is empty, and
`dispatch()` (`pkg/src/app.ts:600-640`) calls it before routing on every
authenticated shell request — never from MCP reads. The Apps page empty
branch (`pkg/src/app.ts`, around line 1033) renders a `tile-empty` "no
apps yet" tile plus `<p class="empty-hint">Open the App Store to install
a shipped app, or ask an agent to add an app via MCP add_app — it appears
here with no republish.</p>`. The Home dashboard empty state
(`renderDashboard` in `pkg/src/apps/client.ts`) points at the App Store's
"Add to home" control.

The gate-hint prompt pattern is established: the Help app
(`pkg/catalog/help.bundle.json`, catalogVersion 4) renders prose plus
`<h3>Adding apps</h3>` plus
`<p class="gate-hint"><code>…prompt…</code></p>` with no bundle CSS of its
own, and the Daily Feed empty state follows the same shape. Prompts are
plain selectable text — no copy button, no Clipboard API.

The App Store install paths the prompts must name already exist and were
verified in code:

- Browser: `GET /apps/app-store` with no Store installed renders a
  not-installed fallback ("The App Store app is not installed.") with a
  GET form (`install-store=1`) that calls
  `store_install_from_catalog('app-store')` and 303s back to the Store
  page; the fallback also says "Or ask an agent to install it with
  install_from_catalog."
- Agent: `install_from_catalog('app-store')` (MCP export,
  `pkg/src/apps/registry.ts:1636`), verified with `list_apps`.

## Goals / Non-Goals

- Goals: a fresh install is completely empty; removing the last app
  stays empty; the Apps page with no apps explains, in Help style, how
  to get the App Store and how to add your own apps, both as copy-paste
  prompts; the App Store remains removable by the user.
- Non-goals: a copy button or any Clipboard API use; a browser bootstrap
  UI; moving the catalog out of `pkg/` (owned by `catalog-out-of-pkg`);
  changing the Home page empty state (default: unchanged, see Open
  Questions); changing `remove_app` / `manage_remove` or adding a
  self-removal guard; fixing the pre-existing "browser SHALL NOT render
  a removal control" spec drift.

## Decisions

1. **Seeding is removed entirely, not made conditional.** A seed-once
   flag or an explicit-removal flag would add stored state and a new
   failure mode (a flag lost on restore re-seeds the Store). The user
   wants empty as the default, not empty as an exception, so the
   smallest change that makes "remove the last app stays empty" true is
   to delete the call and the function. This also brings forward what
   `bootstrap-after-fork` Decision 1 already assumes: the shell does not
   seed.
2. **The empty Apps page is shell-rendered Help-style text, not a new
   app and not bundle JS.** It must render with zero apps installed, so
   it cannot live in an app bundle. It replaces the empty branch in
   `app.ts`: the section head ("Apps") stays, the "no apps yet" tile
   and the stale hint go, and the help text takes their place. The
   existing scenario (no Edit button with no apps installed) is kept.
3. **Both prompts are selectable `<code>` in `<p class="gate-hint">`,
   no copy button, no Clipboard API.** Same pattern as Help and Daily
   Feed; the shell theme styles prose, headings, and code, with no
   bundle CSS of its own.
4. **Prompt 1 names the browser fallback first, the agent path
   second.** A user with no agent connected can still get the Store by
   opening `/apps/app-store` and pressing "Install App Store"; the
   agent path (`install_from_catalog`) is the alternative in the same
   prompt. Neither mechanism is invented: both exist in code today.
5. **Prompt 2 reuses the Help app's add-app prompt verbatim.** One
   canonical wording, copied from `pkg/catalog/help.bundle.json`; the
   empty page must carry its own copy because Help itself may not be
   installed. Drift risk between the two copies is accepted and covered
   by a test (tasks §3) asserting the empty-page prompt contains the
   same skill path and `add_app` instruction as Help's.
6. **Removal is untouched.** The Store Remove button, `manage_remove`,
   and `remove_app` keep their current behaviour and no guard is added.
   A user who removes the Store while other apps remain was already
   able to do so; after this change, removing it as the last app also
   sticks.
7. **Home empty state unchanged by default.** `renderDashboard` keeps
   linking to `/apps/app-store`. That link still lands usefully: with
   no Store installed it shows the not-installed fallback with its
   Install button. Whether to reword it is an open question.

## Draft prompts (DRAFT — for user review, not approved wording)

Prompt 1 — install the App Store (draft):

> Add the App Store to my empty kody-os shell. Install the `app-store`
> catalog app with `install_from_catalog`, verify with `list_apps`
> that `app-store` is installed, and open the App Store page to confirm
> it lists catalog apps. If you cannot use the agent path, tell me to
> open the App Store page in the browser and press Install App Store.
> Do not install any other app, and do not publish or change the
> package source.

Prompt 2 — add your own apps (draft, copied verbatim from Help,
`pkg/catalog/help.bundle.json`):

> Add a new app to my hosted kody-os app on Kody. First open the
> published guide with Kody search entity
> `package:kody-os#.agents/skills/adding-an-app/SKILL.md`, then follow
> that definition contract. Use the package's `add_app` through the
> Kody MCP execute wrapper. Validate before writing, verify with
> `list_apps` and `get_app_state`, and do not publish or change the
> package source. Do not add it to the homepage unless I ask. Ask me
> before writing if any detail is missing or ambiguous.
>
> – App id: [slug]
> – Name: [display name]
> – What it does: [one sentence]

## Open Questions

- Exact prompt wording: are the drafts above (especially Prompt 1,
  which is new) acceptable, or should Prompt 1 be split into a
  browser-only instruction and an agent-only instruction?
- Version bump: MINOR is recommended (no installed app or agent script
  against a non-empty registry breaks; the change adds the empty-install
  state as a supported feature), but MAJOR is defensible (the canonical
  specs currently REQUIRE a fresh install to open with the App Store
  installed, and that contract is being removed). The implementation
  commit records the decision; the change itself does not decide it.
- Home empty state: leave `renderDashboard`'s "Install apps from the
  App Store" hint as-is (it now lands on the Install fallback), or
  reword it for the no-Store world in this change?
- Pre-existing drift, out of scope: canonical `app-registry` says the
  browser SHALL NOT call `remove_app` or render a removal control, but
  the Store (bundle v10, commit `08b81cd`) renders Remove. Does this
  change leave that line untouched (recommended — separate change), or
  fix it while the registry spec is open?
- Mock-dev and test fallout: do any existing tests or the catalog/store
  harnesses assume the Store is present on first shell use? The
  implementation greps for that (tasks §1/§3) rather than assuming.
