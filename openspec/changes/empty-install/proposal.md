# Proposal

## Why

Today a fresh install is never actually empty: on the first authenticated
shell request against an empty registry, the shell installs the App Store
(`ensure_app_store_seeded()` in `pkg/src/apps/registry.ts`, called at the
top of `dispatch()` in `pkg/src/app.ts` before routing). The same rule
re-seeds it whenever the registry later becomes empty, so removing the App
Store as the last app looks like it works and is then undone by the next
shell request — the row comes straight back. That was verified on the PC
on Nov 5–6, 2026 (read-only): the server allows self-removal
(`manage_remove` / `remove_app` have no App Store guard) and the bundle
shows Remove on the up-to-date App Store row, but the empty-registry seed
runs before routing on every authenticated shell request, so the removal
never sticks when the Store is the only app installed.

The user wants the opposite default: a fresh install gets a completely
empty "os" — no apps seeded, including no App Store — and a user who
removes the App Store (or every app) stays empty. Removing the Store must
remain possible; the fix is in the seeding, not in hiding the Remove
button.

The Apps page is also not ready for that world. With no apps installed it
renders one tile saying "no apps yet" plus the hint "Open the App Store to
install a shipped app, or ask an agent to add an app via MCP add_app".
That hint points at an App Store that is not installed. An empty install
needs the Apps page itself to tell the user what to do next.

## What Changes

- The empty-registry seed is removed: no call to
  `ensure_app_store_seeded()` in `dispatch()`, and the function itself is
  removed (after a caller grep — see tasks). A fresh install stays empty
  until the user or an agent installs something, and removing the last app
  leaves the registry empty on the next shell request.
- With no apps installed, the Apps page renders Help-style help text
  instead of the "no apps yet" tile and the stale hint: prose plus two
  "copy this prompt" texts, each a selectable `<code>` block inside
  `<p class="gate-hint">`, styled by the shell theme exactly like the Help
  app and the Daily Feed empty state. No copy button and no Clipboard API
  (on-device Scribe test: `navigator.clipboard` is present but
  `writeText`/`readText` are denied with `NotAllowedError`, so selectable
  text stays the pattern).
- Prompt 1 installs the App Store. It names real mechanisms only: in the
  browser, open `/apps/app-store` and press "Install App Store" (that
  page already renders a not-installed fallback with a GET
  `?install-store=1` form that calls `store_install_from_catalog`, then
  303s back); as an agent, `install_from_catalog('app-store')`, verified
  with `list_apps`.
- Prompt 2 adds the user's own apps. It reuses the Help app's add-app
  prompt (see design.md) rather than inventing new wording.
- Nothing about removal changes: the App Store Remove button stays, and
  `manage_remove` / `remove_app` are untouched. No new guard is added
  anywhere.
- The setup docs are updated to describe the empty install and the new
  Apps-page help text, and the canonical `shell` and `app-registry` specs
  are synced (see specs/).

## Capabilities

### New Capabilities

- `empty-install`: a fresh install opens with an empty registry and no
  seeded apps, and the Apps page with no apps installed shows Help-style
  text with two copy-paste agent prompts (install the App Store; add your
  own apps).

### Modified Capabilities

- `shell`: the Apps page empty state gains the help text and loses the
  "no apps yet" tile and the App Store hint; the fresh-install sentence
  ("opens with the App Store installed") is removed.
- `app-registry`: the "First use seeds only the App Store" requirement is
  removed; an empty registry stays empty across shell requests.
- `setup-guide`: the setup sequence describes the empty install and the
  Apps-page help text.

## Impact

- `pkg/src/app.ts` (dispatch seed call, Apps empty branch),
  `pkg/src/apps/registry.ts` (`ensure_app_store_seeded` and its export),
  `pkg/docs/setup.md` and the setup sections of `pkg/README.md`.
- No storage-schema change, no MCP export change, no change to
  `remove_app` / `manage_remove`, no change to the Home page empty state
  by default (see design.md Open Questions — the Home hint still links to
  `/apps/app-store`, whose not-installed fallback now becomes the useful
  landing page for that link).
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
