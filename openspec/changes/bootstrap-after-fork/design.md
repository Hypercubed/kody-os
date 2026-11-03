# Design: bootstrap-after-fork

## Context

See proposal.md (Why). Today `pkg/docs/setup.md`
takes a fork owner from a copy of the package to
a working OS: confirm the fork is published,
confirm the registry is empty, unlock with an
OTP, and install a first app via `add_app` from
a bundled example in `pkg/catalog/` (for
example `counter`). It also says, in a now-stale
passage, that a built-in App Store "is specified
but not yet implemented" and that adding apps
goes through an agent "until it lands" — both
superseded by the v2.1.0 App Store release and
by the v2.2.0 Manage apps link. A fresh fork
starts with empty storage (fork copies source
only; no installed apps, state, or settings
travel with it), and today the shell auto-seeds
the Store tile on first shell use against an
empty registry — a seeding path that cannot
work once the catalog is no longer shipped,
because there is no shipped Store bundle to
seed from.

## Goals / Non-Goals

- Goals: one unambiguous bootstrap procedure
  for a fork owner; explicit support for
  staying empty; a Store-alone recovery path;
  no stale setup copy.
- Non-goals: any code change, including a new
  bootstrap script in `pkg/` (see Decision 3);
  changing the OTP unlock ceremony; changing
  what forking, publishing, adopting, or Use
  access mean (those definitions in setup.md
  stay as they are); a browser bootstrap UI.

## Decisions

1. **Bootstrap is an agent/script path, not a
   shell seed.** Once the catalog is out of
   `pkg/`, the shell cannot seed the Store from
   a shipped bundle, so the docs SHALL NOT
   promise shell seeding. Bootstrap is: an
   agent (or a script run by the fork owner)
   fetches the About, Help, and Store bundles
   from the pinned release and installs each
   via `add_app`. The docs give the exact
   prompt and the exact checks; the shell's
   job after bootstrap is only to render what
   was installed.
2. **Empty is a supported choice, stated first.**
   The setup sequence SHALL present "install
   nothing" before "bootstrap," and SHALL state
   what empty means: Home shows the honest
   no-widgets state, Apps shows the honest
   no-apps state, and apps can still be added
   later by an agent. Bootstrap is encouraged
   (the docs say why About, Help, and Store
   are useful first apps), never required, and
   never presented as a prerequisite for the
   shell to work.
3. **Prompt first, script only if clearer.**
   The primary bootstrap artifact in the docs
   SHALL be a copy-paste agent prompt (in the
   style of the existing setup prompt and the
   adding-an-app recommended prompt): fetch
   the three bundles from the pinned release,
   validate each before writing, install via
   `add_app`, verify with `list_apps` and by
   opening each app page, and stop and ask if
   any check fails. A script SHALL be added
   only if the implementation finds the prompt
   ambiguous in practice (for example, if
   fetching and installing three bundles by
   hand proves error-prone); a script is not
   required by this spec, and adding one does
   not change the procedure.
4. **Bootstrap apps are ordinary installs.**
   The docs SHALL state that About, Help, and
   Store installed by bootstrap are normal
   registry installs: they appear in Apps, they
   can be pinned, hidden, or added to home
   from Apps Edit, and they can be removed by
   an agent via `remove_app`. No bootstrap app
   is protected, hidden from management, or
   reinstalled automatically. If a bootstrap
   app is removed, reinstalling it uses the
   same fetch-and-`add_app` path as bootstrap.
5. **Store-alone recovery is its own procedure.**
   The docs SHALL give, separately from full
   bootstrap, the Store-alone path: fetch only
   the Store bundle from the pinned release
   and install it via `add_app`, then open the
   Store. A user who started empty, or who
   removed the Store, SHALL NOT have to
   bootstrap About and Help to get a Store.
6. **Checks are part of the procedure, not an
   appendix.** After bootstrap, the docs SHALL
   require: `list_apps` shows `about`, `help`,
   and `app-store`; each app page opens and
   renders; acting is not required for these
   stateless apps, but the Store page lists
   catalog apps from the pinned release. A
   failed check SHALL stop the procedure and
   ask, not proceed to the next app.

## Open Questions

- The canonical public repo URL, the pinned
  release name, and the exact raw fetch URLs
  for the three bootstrap bundles are filled
  in at implementation time from the actual
  public repo. The spec deliberately does not
  invent them; a draft with placeholder URLs
  would be worse than a draft that names the
  slots.
- Whether the bootstrap prompt lives in
  setup.md alone or is duplicated in README.md
  is a docs-maintenance detail; the requirement
  is one canonical procedure, with the other
  location linking to it, not two diverging
  copies.
