# Tasks

Phases land in order: 1, then 2, then 3. This
change is docs-only and is blocked on final
URLs until `public-pinned-catalog` is done,
though drafting may start earlier. No task in
this file commits, pushes, or publishes anything
except the spec commit itself, which is outside
this change's implementation scope.

## 1. Rewrite the setup sequence

- [ ] 1.1 Rewrite `pkg/docs/setup.md` around
  the new sequence: fork, publish, confirm
  empty registry, unlock with an OTP, then
  choose install-nothing (supported, with the
  shared help text and its two prompts stated)
  or bootstrap.
  Remove the bundled-examples first-app path.
  (The stale "App Store specified but not yet
  implemented" passage is already gone from
  setup.md — verify it stays gone; do not
  re-add it.) Keep the fork /
  publish / adopt / Use-access definitions
  unchanged.
- [ ] 1.2 Write the bootstrap procedure per
  design.md: a copy-paste agent prompt that fetches the
  Store bundle from the pinned release - the
  definition plus its manifest-listed bundle
  files (`index.html`, `store.js`, `store.css`),
  assembled before install - validates it before
  writing, installs via `add_app`, and verifies
  with `list_apps` and by opening the Store page,
  stopping and asking on any failed check. State
  that the bootstrapped Store is an ordinary
  install, removable via agent `remove_app`, and
  that About and Help are built-in pages needing
  no install.
- [ ] 1.3 Confirm there is no separate Store-alone
  procedure to write: installing the Store IS
  the bootstrap procedure (1.2); About and Help
  need no install step.

## 2. Update the surrounding docs

- [ ] 2.1 Update the setup sections of
  `pkg/README.md` to link to the rewritten
  setup sequence (one canonical procedure, no
  diverging copy) and to correct any
  `pkg/catalog/` or bundled-examples references.
- [ ] 2.2 Update `pkg/.agents/skills/adding-an-app/SKILL.md`
  for the new catalog source (public repo
  pinned release, not `pkg/catalog/`) and
  update `catalog/README.md` bootstrap notes
  to match, with the canonical public repo URL
  and pinned-release name filled in from the
  actual public repo.
- [ ] 2.3 Repo-wide grep sweep for stale setup
  copy: `pkg/catalog/` as a catalog source,
  "App Store specified but not yet
  implemented," and bundled-examples first-app
  instructions must not remain in current
  docs (archived spec text excepted).

## 3. Verify the docs procedure

- [ ] 3.1 Walk the documented procedure
  against a fresh fork (or a fresh mock store
  standing in for one, where a hosted fork is
  unavailable): empty choice renders the shared help text
  with its two prompts; bootstrap installs the
  Store and all checks pass; removing the Store
  and following the bootstrap procedure restores
  it.
- [ ] 3.2 Sync the canonical specs: update
  `openspec/specs/setup-guide` for the new
  sequence. Record the version decision in
  the implementation commit (docs-only: rides
  with the next version-bumping publish or
  PATCH on its own).
