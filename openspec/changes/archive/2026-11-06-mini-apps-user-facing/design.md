# Design: mini-apps-user-facing

## Context

See proposal.md (Why). The three words in play already have distinct
meanings in the code, and this change keeps all three:

- An **app** is the installed unit: a JSON definition plus state plus
  actions, its own full page at `/apps/:id`, a catalog entry,
  installed by `add_app` / `install_from_catalog` / the Store.
  It exists whether or not it is ever on Home. (`pkg/src/apps/
  registry.ts`, `openspec/specs/app-registry/spec.md`.)
- A **widget** is one rendering of an app: the compact live view on
  Home, one per homepage-pinned app, in homepage order, with
  page-only content hidden. (`openspec/specs/widget-home/spec.md`,
  `openspec/specs/widget-visibility/spec.md`,
  `renderWidgetSection` / `renderDashboard` in
  `pkg/src/apps/client.ts`.)
- A **Kody app** is the outer thing: the published kody-os package
  itself, as installed on Kody.

The confusion is only that the first and third share the word "app"
where a human meets them. The audit for this change (Nov 6, 2026,
VM clone at `c1da8cb` plus the uncommitted `empty-install` update)
found the user-facing "app" strings in exactly four places:

1. Shell chrome and pages (`pkg/src/app.ts`,
   `pkg/src/apps/client.ts`): menu link "Apps" (`app.ts:383-385`),
   page title / section head "Apps" (`app.ts:1029-1031`),
   "All apps" (`client.ts:359`), "Edit apps" (`client.ts:472`),
   "Back to Apps" (`app.ts:733`), "no apps yet" (`app.ts:1033-1035`
   — replaced by the `empty-install` help text when that change
   lands, but the wording rule still applies to its replacement),
   the Apps empty hint (`app.ts:1040`), the Home dashboard empty
   hint "Install apps from the App Store" (`client.ts:578-580`),
   the Store fallback "The App Store app is not installed."
   (`app.ts:824`), "Install App Store" (`app.ts:827`), and
   "Launcher management moved to Apps Edit" (`app.ts:799`).
   Pinned and Recent headings do not say "app" and do not change.
2. The Store bundle (`pkg/catalog/app-store.bundle.json`): name /
   label / `ui.title` "App Store", description "Install and update
   apps from the catalog, right here in the browser — no agent
   needed.", intro with the same sentence, the no-JS note ("This App
   Store needs JavaScript… ask an agent to install apps with
   `add_app`."), "Loading apps…" / "Could not load apps.",
   `storeCapsText` "Can manage other apps.", and the confirm-dialog
   wording "This will remove this app…" / "replace this app's
   definition…".
3. The Help bundle (`pkg/catalog/help.bundle.json`): description
   "An overview of kody-os and how apps are added.", intro "the Apps
   page lists installed apps…", heading "Adding apps", the add prompt
   "Add a new app to my hosted kody-os app on Kody.…", and "The new
   app appears on the Apps page immediately."
4. Docs (`pkg/docs/setup.md`, `pkg/README.md`): user-facing prose
   ("Apps are JSON definitions…", "the app appears on the Apps
   page", "Add further apps the same way", "Apps are already
   installed in a 'fresh' fork") mixed with code, MCP names, routes,
   and storage keys that must stay `app`.

Per-app catalog descriptions do not use the generic word and do not
change. The adding-an-app skill
(`pkg/.agents/skills/adding-an-app/SKILL.md`) is agent-facing, not
browser-facing, and does not change (Decision 5).

## Goals / Non-Goals

- Goals: a human reading the browser never meets the nested "app
  inside a Kody app" wording; "mini-app" is the one display word for
  an installed unit and "Mini-App Store" for the Store; "widget"
  keeps its existing Home meaning; every internal identifier stays
  `app`, so no installed mini-app, agent script, export, or route
  breaks; the change is a string sweep, reversible by changing the
  strings back.
- Non-goals: renaming anything internal (MCP, routes, storage,
  types, skill name/path, export format); renaming apps to widgets;
  changing any behaviour, layout, tap target, or form semantics;
  fixing the pre-existing "browser SHALL NOT render a removal
  control" spec drift (Store v10 renders Remove); changing
  `empty-install`'s seeding or Home-state decisions — only its
  user-facing wording is in scope here (Decision 6).

## Decisions

1. **Boundary rule: browser-facing says mini-app, everything else
   stays app.** A string is user-facing if a human reads it rendered
   in the browser: shell chrome, page titles and headings, section
   heads, empty states, Help and Store bundle copy, catalog
   descriptions shown in Store rows, inline browser error text, and
   user-facing prose in `pkg/docs/setup.md` / `pkg/README.md`. A
   string is internal if code, an MCP export, a route, a storage key,
   a type name, an agent skill, or a JSON error payload reads it:
   `add_app`, `list_apps`, `get_app_state`, `remove_app`,
   `export_app`, `import_app`, `act`, `install_from_catalog`,
   `/apps`, `/apps/:id`, `kody-os.apps.*`, `AppDefinition`,
   `AppSummary`, `kody-os-app/2`, and MCP `{ ok: false, error }`
   text all stay `app`.
2. **Spelling is hyphenated, always.** "mini-app" (singular),
   "mini-apps" (plural), "Mini-App Store" (Store name/label/title),
   "Mini-apps" as a page/menu word. Never "mini app", "Mini App",
   or "MiniApp" in user-facing text. The hyphen is what makes the
   token greppable and distinct from the bare word "app".
3. **Help carries the mapping once, in one glossary line.** Help's
   intro gains, as its first sentence after the opening paragraph:
   "A mini-app is an installed app: in the browser it is called a
   mini-app, and agents call it an app (`add_app`, `list_apps`)."
   No other page repeats the explanation; prompts and headings just
   use "mini-app" and the glossary line is the place a confused
   reader lands. If Help is not installed, the `empty-install`
   help text carries the same one line (Decision 6).
4. **Agent prompts carry both words, in their proper places.**
   Prompt prose says mini-app; prompt code says app. Help's add
   prompt becomes: "Add a new mini-app to my hosted kody-os app on
   Kody. First open the published guide … then follow that
   definition contract. Use the package's `add_app` through the
   Kody MCP execute wrapper. Validate before writing, verify with
   `list_apps` and `get_app_state`, and do not publish or change
   the package source. … – Mini-app id: [slug] …" The bracketed
   field label changes ("App id" → "Mini-app id"); the tool names
   and the skill path do not. A user saying "mini-app" to an agent
   and an agent calling `add_app` are the same action, and the
   prompt shows both so neither side has to guess.
5. **The adding-an-app skill does not change.** It is read by
   agents, not rendered in the browser, so per Decision 1 it stays
   `app` throughout — including its name, path, description, and
   "Add a custom app" heading. Its contract is the definition of
   the internal name; renaming it would be an internal rename by
   another name, and would break the skill path every prompt
   quotes (`package:kody-os#.agents/skills/adding-an-app/
   SKILL.md`).
6. **`empty-install` wording follows this change, whichever lands
   first.** The `empty-install` Apps/Home empty-state prompts are
   user-facing text, so Prompt 1 becomes "Add the Mini-App Store
   to my empty kody-os shell. Install the `app-store` catalog
   mini-app with `install_from_catalog`…" (the Store is itself a
   mini-app, but the prompt names it once, as "the Mini-App
   Store", and does not repeat the noun), and Prompt 2 reuses
   Help's add prompt as rewritten here. The two changes must not
   ship one saying "apps" and the other "mini-apps": the
   implementation of whichever lands second re-checks the first's
   prompts against this decision, and the prompt-sync test in
   tasks §3 asserts Help and the empty page agree.
7. **The Store's id stays `app-store` while its label becomes
   "Mini-App Store".** Label is display; id is internal. This is
   the one place the split is visible in a single object, and it
   is intentional: renaming the id would rename the route, the
   catalog entry, and every `install_from_catalog('app-store')`
   call for no user-facing gain, since users read the label, not
   the id. The Store row, its page title, and its description all
   show "Mini-App Store"; nothing user-facing shows "app-store".
8. **Two leaks are accepted and documented, not fixed.** (a) URLs
   stay `/apps` and `/apps/:id` — a user reading the address bar
   still sees "apps". Renaming routes would break bookmarks, the
   `from` parameter, and every agent script that fetches them.
   (b) MCP tool names (`add_app`, `list_apps`) stay visible in
   agent traces a user may see. Both leaks are the price of a
   non-breaking change; Help's glossary line (Decision 3) is what
   explains them.

## Draft copy (DRAFT — for user review, not approved wording)

Shell chrome: menu "Mini-apps"; page title / section head
"Mini-apps"; "All mini-apps"; "Edit mini-apps"; "Back to
Mini-apps"; "no mini-apps yet"; Apps empty hint: "Open the
Mini-App Store to install a shipped mini-app, or ask an agent to
add a mini-app via MCP `add_app` — it appears here with no
republish." (The `empty-install` replacement text supersedes this
hint when that change lands; its prompts follow Decision 6.)
Home empty hint: "Install mini-apps from the Mini-App Store, then
use a row's "Add to home" control. They appear here live with no
republish." Store fallback: "The Mini-App Store mini-app is not
installed." Button: "Install Mini-App Store".

Store bundle: description "Install and update mini-apps from the
catalog, right here in the browser — no agent needed."; intro with
the same sentence, then "For a custom mini-app that is not in the
catalog, ask an agent to add it with MCP `add_app`. Up-to-date
mini-apps have a Remove button below. … Pin, hide, and home are
managed from Mini-apps Edit."; no-JS note: "This Mini-App Store
needs JavaScript to load the catalog. Without JavaScript, ask an
agent to install mini-apps with `add_app`."; status "Loading
mini-apps…" / "Could not load mini-apps."; capability line "Can
manage other mini-apps."; confirm dialog: "This will remove this
mini-app: its definition and its saved state will be deleted…"
and "This will replace this mini-app's definition — bundle files,
stateSchema, actions, capabilities, and metadata — with the
catalog copy."

Help bundle: description "An overview of kody-os and how
mini-apps are added."; intro "kody-os is a minimal shared OS
shell. The home page shows your live widgets; the Mini-apps page
lists installed mini-apps and opening one shows its live state,
and every action runs through the same handler the agents use. A
mini-app is an installed app: in the browser it is called a
mini-app, and agents call it an app (`add_app`, `list_apps`).";
heading "Adding mini-apps"; prompt as in Decision 4; closing "The
new mini-app appears on the Mini-apps page immediately. Add it to
the home dashboard from the Mini-App Store row's Add to home
control."

Docs: `pkg/README.md` — "Mini-apps are JSON definitions in package
storage…"; "An agent calls MCP `add_app` and the mini-app appears
on the Mini-apps page with no republish." `pkg/docs/setup.md` —
"the mini-app appears on the Mini-apps page", "Add further
mini-apps the same way", "the Mini-apps page lists `counter`".

## Open Questions

- **Version: PATCH recommended, MINOR if the reviewer disagrees.**
  This is a wording correction with no behaviour, API, route, or
  storage change, which fits PATCH ("bug fix or correction,
  behaviour otherwise unchanged", `pkg/AGENTS.md`). It is not a
  new feature (so not MINOR on that ground) and nothing breaks
  (so not MAJOR). If the reviewer treats observable copy as more
  than a correction, MINOR is the next step up — never MAJOR.
  Recorded in the implementation commit; build +1 on publish
  either way.
- **"Mini-App Store" vs "Store".** The Store's full display name
  is "Mini-App Store" for consistency, but the short word "Store"
  already appears in copy ("the Store lists catalog apps"). This
  change keeps short "Store" where the full name has just been
  used on the same page, and uses the full name for titles,
  labels, and first mentions. If the user prefers the full name
  everywhere, that is a copy edit inside this change, not a new
  decision.
- **Should the `/apps` URL leak be fixed later?** A route rename
  (`/apps` → `/mini-apps`, with a redirect) is a separate,
  breaking-adjacent change: bookmarks, `from` params, and agent
  scripts all name `/apps`. It is explicitly out of scope here;
  revisit only if the URL wording itself confuses users in
  practice.
