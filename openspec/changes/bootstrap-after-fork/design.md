# Design: bootstrap-after-fork

## Cleanup (2026-11-11)

OTP references removed (OTP was removed from Kody Nov 7, 2026; the canonical setup-guide spec forbids OTP). "Pinned release" updated to pinned TAG per compatible-catalog Phase 1 (no `releases.json` until Phase 2); `pkg/catalog/` references now read repo-root `catalog/`. The catalog move out of `pkg/` is done; the "until then it installs from `pkg/catalog/`" line below is historical.

## Context

See proposal.md (Why). Today `pkg/docs/setup.md`
takes a fork owner from a copy of the package to
a working OS: confirm the fork is published,
confirm the registry is empty, and install a first app via `add_app` from
an example definition in the repo-root `catalog/` (for
example `counter`).  A fresh fork
starts with empty storage (fork copies source
only; no installed apps, state, or settings
travel with it), and nothing is seeded — the shell never seeds
the Store tile, and setup.md says so
("nothing is seeded, including no App
Store"). The App Store is implemented (the
old "specified but not yet implemented"
passage is gone from setup.md). About and
Help are built-in shell pages, not catalog
apps, so there is nothing to install for
them. Once the catalog is out of `pkg/`, the
Store bundle comes from the pinned public
tag instead of the shipped catalog;
until then it installs from the repo-root `catalog/`
via `install_from_catalog('app-store')`.

## Goals / Non-Goals

- Goals: one unambiguous bootstrap procedure
  for a fork owner; explicit support for
  staying empty; the Store install as the bootstrap
  procedure;
  no stale setup copy.
- Non-goals: any code change, including a new
  bootstrap script in `pkg/` (see Decision 3);
  changing the access model (there is no OTP unlock ceremony — OTP was removed from Kody Nov 7, 2026); changing
  what forking, publishing, adopting, or Use
  access mean (those definitions in setup.md
  stay as they are); a browser bootstrap UI.

## Decisions

1. **Bootstrap is an agent/script path, not a
   shell seed.** The shell never seeds anything, so the docs
   SHALL NOT promise shell seeding. Bootstrap is: an
   agent (or a script run by the fork owner)
   fetches the Store bundle from the pinned
   tag and installs it via `add_app`. About
   and Help are built-in shell pages and are
   never installed. The docs give the exact
   prompt and the exact checks; the shell's
   job after bootstrap is only to render what
   was installed.
2. **Empty is a supported choice, stated first.**
   The setup sequence SHALL present "install
   nothing" before "bootstrap," and SHALL state
   what empty means: Home and Apps show the shared help text with
   the two prompts ("Add your own apps" first,
   "Install the App Store" second), and apps can
   still be added later by an agent. Bootstrap is encouraged
   (the docs say why the Store is a useful first
   app and that About and Help are already
   present as built-in pages), never required, and
   never presented as a prerequisite for the
   shell to work.
3. **Prompt first, script only if clearer.**
   The primary bootstrap artifact in the docs
   SHALL be a copy-paste agent prompt (in the
   style of the existing setup prompt and the
   adding-an-app skill's recommended prompt): fetch the Store bundle from the pinned tag,
   validate each before writing, install via
   `add_app`, verify with `list_apps` and by
   opening each app page, and stop and ask if
   any check fails. A script SHALL be added
   only if the implementation finds the prompt
   ambiguous in practice (for example, if
   fetching and installing the bundle by hand
   proves error-prone); a script is not
   required by this spec, and adding one does
   not change the procedure.
4. **The bootstrapped Store is an ordinary install.**
   The docs SHALL state that the Store installed
   by bootstrap is a normal registry install: it
   appears in Apps, it can be pinned, hidden, or
   added to home from Apps Edit, and it can be
   removed by an agent via `remove_app`. It is
   not protected, hidden from management, or
   reinstalled automatically. If the Store is
   removed, reinstalling it uses the same
   fetch-and-`add_app` path as bootstrap. About
   and Help are not installs at all — they are
   built-in shell pages, always present unless
   disabled in Settings, and cannot be removed.
5. **Bootstrap installs the Store only.**
   Installing the Store IS the bootstrap
   procedure: fetch the Store bundle from the
   pinned tag and install it via `add_app`,
   then open the Store. There is no About or
   Help step — they are built-in pages, so a
   user who started empty, or who removed the
   Store, installs only the Store.
6. **Checks are part of the procedure, not an
   appendix.** After bootstrap, the docs SHALL require:
   `list_apps` shows `app-store`; the Help and
   About pages open and render as built-in
   pages; the Store page opens and lists catalog
   apps from the pinned tag. A
   failed check SHALL stop the procedure and
   ask, not proceed to the next app.

## Open Questions

- The canonical public repo URL, the pinned
  tag name, and the exact raw fetch URLs
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
