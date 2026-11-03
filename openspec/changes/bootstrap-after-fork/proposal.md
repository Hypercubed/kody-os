# Proposal

## Why

After the catalog moves out of `pkg/` and the
Store reads a pinned public release (see
`catalog-out-of-pkg` and `public-pinned-catalog`),
a fresh fork starts with nothing: an empty
registry, no Store tile, no About, no Help. That
is a valid state — the shell's empty states are
honest — but a fork owner who wants a working
Store needs a documented, unambiguous path from
empty to bootstrapped, and a fork owner who wants
nothing needs to know that staying empty is
supported, not a broken setup.

Today's setup docs do not give that path: they
point at `pkg/catalog/` (which will no longer
exist), describe the App Store as "specified but
not yet implemented" (stale since v2.1.0), and
describe a first app installed from bundled
examples. This change rewrites the setup path
around bootstrapping from the pinned public
release, with opt-in at every step.

## What Changes

- `pkg/docs/setup.md` and the setup sections of
  `pkg/README.md` are rewritten around the new
  sequence: fork, publish, confirm the registry
  is empty, then choose: install nothing, or
  bootstrap. Bootstrap means installing About,
  Help, and the Store — encouraged, not required
  — by pulling their bundles from the pinned
  release and installing them via `add_app`,
  through an agent prompt or a script, with
  checks after each step.
- The docs state plainly that bootstrap apps are
  ordinary installs: they can be removed later
  via agent `remove_app` (browser removal is out
  of scope here and stays MCP-only), they are
  not special, and installing the Store alone
  later uses the same path as bootstrapping all
  three. The Store-alone recovery path is given
  explicitly, because a user who starts empty
  and later wants a Store must not have to
  bootstrap everything to get it.
- `pkg/docs/adding-an-app.md` and the catalog
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
  sections), `pkg/docs/adding-an-app.md`,
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
