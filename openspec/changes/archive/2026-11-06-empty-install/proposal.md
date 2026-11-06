# Proposal

## Why

Today a fresh install is never actually empty: on the first authenticated
shell request against an empty registry, the shell installs the Mini-App Store
(`ensure_app_store_seeded()` in `pkg/src/apps/registry.ts`, called at the
top of `dispatch()` in `pkg/src/app.ts` before routing). The same rule
re-seeds it whenever the registry later becomes empty, so removing the App
Store as the last app looks like it works and is then undone by the next
shell request — the row comes straight back. That was verified on the PC
on Nov 5–6, 2026 (read-only): the server allows self-removal
(`manage_remove` / `remove_app` have no App Store guard) and the bundle
shows Remove on the up-to-date Mini-App Store row, but the empty-registry seed
runs before routing on every authenticated shell request, so the removal
never sticks when the Store is the only app installed.

The user wants the opposite default: a fresh install gets a completely
empty "os" — no mini-apps seeded, including no Mini-App Store — and a user who
removes the Mini-App Store (or every mini-app) stays empty. Removing the Store must
remain possible; the fix is in the seeding, not in hiding the Remove
button.

The Mini-apps page is also not ready for that world. With no mini-apps installed it
renders one tile saying "no apps yet" plus the hint "Open the App Store to
install a shipped app, or ask an agent to add an app via MCP add_app".
That hint points at a Mini-App Store that is not installed. An empty install
needs the Mini-apps page itself to tell the user what to do next.

## What Changes

- The empty-registry seed is removed: no call to
  `ensure_app_store_seeded()` in `dispatch()`, and the function itself is
  removed (after a caller grep — see tasks). A fresh install stays empty
  until the user or an agent installs something, and removing the last app
  leaves the registry empty on the next shell request.
- With no mini-apps installed, the Mini-apps page renders Help-style help text
  instead of the "no apps yet" tile and the stale hint: prose plus two
  "copy this prompt" texts, each a selectable `<code>` block inside
  `<p class="gate-hint">`, styled by the shell theme exactly like the Help
  app and the Daily Feed empty state. No copy button and no Clipboard API
  (on-device Scribe test: `navigator.clipboard` is present but
  `writeText`/`readText` are denied with `NotAllowedError`, so selectable
  text stays the pattern).
- Prompt 1 installs the Mini-App Store. It is agent-only: `install_from_catalog('app-store')`, verified
  with `list_apps`. The browser fallback at `/apps/app-store`
  (GET `?install-store=1` → `store_install_from_catalog`) exists in
  code today, but it is deliberately NOT named in the copy: it depends
  on the catalog living in `pkg/`, and the catalog is moving out of
  `pkg/` (`catalog-out-of-pkg`), so that path will not be true later.
  The agent prompt is the durable path.
- Prompt 2 adds the user's own mini-apps. It reuses the Help app's add
  prompt (see design.md) rather than inventing new wording.
- The Home page gets two empty states, matching the Mini-apps page. With no
  mini-apps installed, Home shows the same help as the Mini-apps page — same
  intro, same two prompts, rendered from the same shared shell block,
  not a second copy. With mini-apps installed but none on Home, Home shows
  a short message instead: "No widgets yet. You have mini-apps installed —
  add some to Home from the Mini-apps page. Open Mini-apps, tap Edit, and use
  Add to home on a row." ("Add to home", not "pin" — Pin is a separate
  Mini-apps-page section and does not place a mini-app on Home.)
- Nothing about removal changes: the Mini-App Store Remove button stays, and
  `manage_remove` / `remove_app` are untouched. No new guard is added
  anywhere.
- The setup docs are updated to describe the empty install and the new
  Mini-apps-page help text, and the canonical `shell` and `app-registry` specs
  are synced (see specs/).

## Capabilities

### New Capabilities

- `empty-install`: a fresh install opens with an empty registry and no
  seeded mini-apps, and the Mini-apps page with no mini-apps installed shows Help-style
  text with two copy-paste agent prompts (install the Mini-App Store; add your
  own mini-apps).

### Modified Capabilities

- `shell`: the Mini-apps page empty state gains the help text and loses the
  "no apps yet" tile and the App Store hint; the Home page empty state
  splits into two cases (no mini-apps: same help as Mini-apps; mini-apps but none on
  Home: short Add-to-home message); the fresh-install sentence
  ("opens with the App Store installed") is removed.
- `app-registry`: the "First use seeds only the App Store" requirement is
  removed; an empty registry stays empty across shell requests.
- `setup-guide`: the setup sequence describes the empty install and the
  Mini-apps-page help text.

## Impact

- `pkg/src/app.ts` (dispatch seed call, Mini-apps empty branch, Home
  dashboard empty states), `pkg/src/apps/client.ts`
  (`renderDashboard` — it must be told whether any mini-apps exist, so it
  can pick the right empty state),
  `pkg/src/apps/registry.ts` (`ensure_app_store_seeded` and its export),
  `pkg/docs/setup.md` and the setup sections of `pkg/README.md`.
- No storage-schema change, no MCP export change, no change to
  `remove_app` / `manage_remove`. The Home hint no longer links to
  `/apps/app-store` as the way to get started: with no mini-apps installed
  Home shows the same help as Mini-apps, and with mini-apps installed it points
  at Mini-apps Edit's Add to home.
- BREAKING: see design.md Open Questions (version). No installed app and
  no agent script that works against a non-empty registry breaks; what
  changes is the fresh-install contract the canonical specs currently
  REQUIRE ("a fresh install SHALL open with the App Store installed").
  The version decision (MINOR recommended, MAJOR defensible) is recorded
  in the implementation commit, not decided here. Build increments by 1
  on publish either way, per `pkg/AGENTS.md`.
- This change does NOT cover `bootstrap-after-fork` (docs-only, pending):
  that change assumes this world (its Decision 1 says the shell cannot
  seed once the catalog leaves `pkg/`), and its docs will need to match
  the new empty states — see tasks §5. It also does NOT fix the
  pre-existing drift that the canonical `app-registry` spec says the
  browser SHALL NOT render a removal control while the Store (v10,
  commit `08b81cd`) does render Remove; that is a separate change.
