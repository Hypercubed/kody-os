# Proposal

## Why

Today an app definition carries exactly one capability:
`capabilities.feeds`, a list of upstream feeds the shell will
fetch through its same-origin proxy. Everything else an app
might do — manage other apps, ask the shell to fetch a
non-feed upstream — has no declared form at all. That leaves
the installer (a human in the Store, or an agent calling
`add_app`) with nothing to review: an app's abilities are
visible only by reading its bundle code.

This change adds a declared capabilities surface to bundle
definitions, so abilities are stated in the definition, checked
at install time, shown at install time, and checked again by
the shell wherever the shell acts on an app's behalf. It is
deliberately paired with the accepted trust model: installing
an app already trusts its same-origin code, so capabilities
are installer disclosure plus a server-side allowlist for
honest apps, not a sandbox. A malicious bundle is not stopped
by a declaration it can ignore; a bundle that does not declare
an ability is stopped from using the shell's implementation
of that ability.

## What Changes

- `AppCapabilities` gains new declared abilities alongside
  `feeds`: `manageApps` (the app may use the shell's app
  management API, as defined by `data-only-app-store`) and a
  generalized `proxy` declaration (the shell may fetch named
  upstreams on the app's behalf, following the feeds pattern:
  name, HTTPS URL, TTL, and size cap; the route never takes a
  URL from the request).
- The shape question is settled in design.md: capabilities
  stay a structured object, not a bare string array, because
  proxy entries need parameters. A future capability that
  needs no parameters may still be a boolean flag in the
  same object.
- `validateCapabilities` and `sanitizeCapabilities` in
  `pkg/src/apps/registry.ts` validate and normalize the new
  fields at install time, so the stored definition — not a
  runtime claim — is what the shell checks. Unknown capability
  keys are rejected at validation, not silently stored.
- Installer disclosure: the Store (and, for agents, the
  `add_app` verification path) shows an app's capabilities in
  plain words before install. An update that adds a capability
  — above all `manageApps` or a new proxy host — is a
  confirmation gate, like the modified-app update confirm
  today: the installer sees what is new and confirms, or the
  update does not happen.
- Server allowlist: the management API refuses calls from an
  app whose stored definition does not declare `manageApps`,
  and the proxy route refuses undeclared names/hosts, with
  the feed-style plain 404 and no capability detail.

## Capabilities

### New Capabilities

- `authoring`: bundle definitions may declare `manageApps`
  and `proxy` capabilities, with the validation, storage, and
  disclosure rules in design.md.
- `app-registry`: install-time capability validation and
  sanitization, and capability-change confirmation on update.

### Modified Capabilities

- `app-registry`: `capabilities.feeds` is unchanged in
  behavior. Whether feeds are generalized into `proxy` or
  kept as a separate, feed-shaped entry is settled in
  design.md; either way, no existing feed declaration breaks.

## Impact

- `pkg/src/apps/types.ts` (`AppCapabilities`),
  `pkg/src/apps/registry.ts` (validation, sanitization,
  install/update paths, capability-change detection),
  `pkg/src/apps/client.ts` (capability disclosure rendering
  for the Store), `pkg/src/feeds.ts` (proxy route, if
  generalized), `pkg/catalog/README.md` and
  `pkg/docs/adding-an-app.md` (authoring rules).
- No storage-key change: capabilities live in the stored
  definition, as feeds do today. No MCP export change:
  `add_app` validation already covers capabilities, and
  agents surface them through the same verification path.
- BREAKING: none for existing definitions — a definition
  without the new fields declares no new abilities, and
  feeds behave as before. A definition declaring an
  unknown capability key is now rejected at install, which
  is a validation tightening, not a behavior change for
  valid definitions. Version: MINOR at implementation
  (new optional fields, nothing existing breaks) — this
  spec draft itself, outside `pkg/`, bumps nothing.
