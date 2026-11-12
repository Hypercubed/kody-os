# Tasks

Phases land in order: 1, then 2, then 3. This
change is docs-only. Cleanup (2026-11-11): the `public-pinned-catalog` blocker is removed — that change is archived, and the final URLs exist under compatible-catalog Phase 1's pinned tag. The remaining blocker is the Task 1.2 open decision below (which base installs the Store for a fresh fork). Drafting may start earlier. No task in
this file commits, pushes, or publishes anything
except the spec commit itself, which is outside
this change's implementation scope.

## 1. Rewrite the setup sequence

- [ ] 1.1 Rewrite `pkg/docs/setup.md` around
  the new sequence: fork, publish, confirm
  empty registry, then
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

  Cleanup (2026-11-11): the OTP unlock step is removed from this sequence — OTP was removed from Kody Nov 7, 2026, and the canonical setup-guide spec forbids OTP. (Rewriting `pkg/docs/setup.md` itself is Task 1.1's implementation, not done here.)
- [ ] 1.2 Write the bootstrap procedure per
  design.md: a copy-paste agent prompt that fetches the
  Store bundle from the pinned tag - the
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

  Open decision (2026-11-11): which base installs the Store for a fresh fork is undecided — a fresh fork has no Store yet to declare a pin, so there is no pinned tag to read the Store from. Evidence: `pkg/docs/setup.md` steps 2/4 hardcode the `main` catalog base (`https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/`), which under Phase 1 would pull the v20 Store, not v28. Do not decide here.
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
  pinned tag, not the old `pkg/catalog/` path) and
  update `catalog/README.md` bootstrap notes
  to match, with the canonical public repo URL
  and pinned-tag name filled in from the
  actual public repo.
- [x] 2.3 Repo-wide grep sweep for stale setup
  copy: `pkg/catalog/` as a catalog source,
  "App Store specified but not yet
  implemented," and bundled-examples first-app
  instructions must not remain in current
  docs (archived spec text excepted). Cleanup (2026-11-11): verified by grep — no `pkg/catalog/` in `pkg/docs/setup.md`, `pkg/README.md`, `pkg/.agents/skills/adding-an-app/SKILL.md`, or `catalog/README.md`; no "specified but not yet implemented" in current docs; no "bundled" in `pkg/docs/setup.md` or `pkg/README.md`. (Other open changes still cite `pkg/catalog/` in their own drafts — email-client, generic-rss-feed, handoff-board, f-flat-minor-calculator — out of this change's scope.)

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

  Cleanup (2026-11-11): partly done — the canonical setup-guide spec already carries empty-install / no-OTP / no-seeding (it forbids OTP and describes the shell as starting empty and seeding nothing). The ADDED requirements — the bootstrap choice, the pinned-tag procedure, and bootstrap apps as ordinary installs — are NOT yet in the canonical spec. They are not added here: that is implementation of the unimplemented bootstrap procedure, not cleanup.
