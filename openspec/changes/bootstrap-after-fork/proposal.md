# Proposal

## Why

After the catalog moves out of `pkg/` and the
Store reads a pinned public release (see
`catalog-out-of-pkg` and `public-pinned-catalog`),
a fresh fork starts with an empty registry
and no Store. About and Help are already
present as built-in shell pages. That
is a valid state — the shell's empty states are
honest — but a fork owner who wants a working
Store needs a documented, unambiguous path from
empty to bootstrapped, and a fork owner who wants
nothing needs to know that staying empty is
supported, not a broken setup.

Today's setup docs do not give that path: they
point at `pkg/catalog/` (which will no longer
exist) and describe a first app installed from
bundled examples. The App Store is implemented
and setup.md already gives copy-paste prompts
for installing it, but there is no documented
path from empty to bootstrapped once the
catalog leaves `pkg/`. This change rewrites the setup path
around bootstrapping from the pinned public
release, with opt-in at every step.

## What Changes

- `pkg/docs/setup.md` and the setup sections of
  `pkg/README.md` are rewritten around the new
  sequence: fork, publish, confirm the registry
  is empty, then choose: install nothing, or
  bootstrap. Bootstrap means installing the Store —
  encouraged, not required — by pulling its
  bundle from the pinned release and installing
  it via `add_app`, through an agent prompt or a
  script, with checks after each step.
- The docs state plainly that the bootstrapped
  Store is an ordinary install: it can be removed
  later via agent `remove_app` (browser removal
  is out of scope here and stays MCP-only), and
  it is not special. There is no separate
  Store-alone path to give, because installing
  the Store IS the bootstrap procedure — About
  and Help are built-in and need no install.
- `pkg/.agents/skills/adding-an-app/SKILL.md` and the catalog
  README are updated for the new catalog source:
  catalog apps come from the public repo's
  pinned release, not from `pkg/catalog/`, and
  a custom app still arrives via an agent and
  `add_app`, unchanged.
- Stale setup copy is corrected in the same
  change: the App Store is implemented, the
  catalog is not in `pkg/`, and the first-app
  path is the bootstrap path, not bundled
  examples.

## Capabilities

### New Capabilities

(none — docs only)

### Modified Capabilities

- `setup-guide`: the fork setup sequence gains
  the bootstrap choice and the pinned-release
  bootstrap procedure, and loses the bundled-
  examples first-app path.
- `authoring`: catalog-app documentation points
  at the public repo catalog, not `pkg/catalog/`.

## Impact

- `pkg/docs/setup.md`, `pkg/README.md` (setup
  sections), `pkg/.agents/skills/adding-an-app/SKILL.md`,
  `catalog/README.md` (bootstrap and
  release-cutting notes, shared with
  `public-pinned-catalog`).
- No code change, no storage change, no MCP
  change. Any bootstrap script or agent prompt
  in the docs is documentation, not a new
  package script, unless the implementation
  decides a script is clearer than a prompt
  (see design.md).
- BREAKING: none. Docs-only changes do not
  break installed apps or agent scripts, except
  that paths and procedures agents were told to
  follow (`pkg/catalog/`, bundled examples) are
  superseded — which is the point of the change.
  Version: docs-only, so it rides with the next
  version-bumping publish or takes a PATCH on
  its own per `pkg/AGENTS.md` — this spec draft
  itself, outside `pkg/`, bumps nothing.
  Final URLs and the pinned-release name are
  filled in from the actual public repo at
  implementation time, not invented here.
