# Proposal

## Why

Kody already stores the owner's platform mail: inbound and
outbound messages for the current org, reachable through the
built-in email capabilities (`emailInboxList`,
`emailMessageList`, `emailMessageSearch`, `emailMessageGet`,
`emailAttachmentGet`, `emailMessageClassify`,
`emailMessageDelete`, `emailReply`). The kody-os shell cannot
show that mail today, because a data app's bundle is browser
JavaScript only: it cannot call `kody.*`, and no shell route
exists that will call those capabilities on its behalf. The
only kody-os mail shape available today is a synced viewer,
where an agent copies list and body text into app state with
`act()` — stale between syncs, capped by state-field sizes,
and unable to act on a message from the shell.

This change adds that missing server side to the package
itself, so a shell app can be a live email client for
Kody platform mail: list, search, open, archive, mark
spam / not spam, delete, and reply, all from the shell,
with no agent sync step and no mail stored in app state.

## What Changes

- `pkg/package.json`: declare the email capabilities the
  shell's fetch handler may call as the publisher, under
  `kody.app.capabilities`. The handler runs as the last
  publisher (the owner, in a personal org), and Kody caps
  its authority to exactly the declared list.
- `pkg/src/email.ts` (new, modelled on `pkg/src/feeds.ts`):
  the server-side email module. It calls the email
  capabilities through `kody:runtime`, sanitizes what it
  returns, and serves it to one declared app at a time.
  It never takes a message, URL, or address from an
  untrusted source except as a validated route parameter
  passed to the capability itself.
- `pkg/src/app.ts`: same-origin email routes, placed
  after the `/apps/` branches like the `/feed/` route and
  therefore inside the device gate that `fetch()` already
  runs: `GET /email/:app/messages`,
  `GET /email/:app/search`, `GET /email/:app/messages/:id`,
  `GET /email/:app/attachments/:id`, and GET-action
  routes for classify, delete, and reply (see design.md).
- `pkg/src/apps/types.ts` + `pkg/src/apps/registry.ts`:
  a data-only declaration, `capabilities.email`, that an
  app must carry before the email routes will serve it —
  the same allowlist pattern as `capabilities.feeds`.
  An app that does not declare it gets the feed-style
  plain 404, never mail.
- One catalog app, id `email`: a stateless bundle
  (empty `stateSchema`, `actions` `{}`) that renders list,
  search, and one open message from the live routes.
  It keeps no mail in app state and calls no `act()`.
- Docs: a `pkg/docs/email.md` capability doc and a
  `capabilities.email` row in `pkg/.agents/skills/adding-an-app/SKILL.md`.

## Capabilities

### New Capabilities

- `shell-email-routes`: same-origin, device-gated email
  routes served by the shell for apps that declare
  `capabilities.email`.
- `email-app`: a live Kody platform mail client in the
  shipped catalog (id `email`).

### Modified Capabilities

- `shell`: the fetch handler gains email routes and a
  `kody.app.capabilities` declaration; no existing route,
  app, or action changes behavior.
- `authoring`: `capabilities` gains the `email`
  declaration; existing `feeds` declarations are unchanged.

## Impact

- `pkg/package.json` (capability list only),
  `pkg/src/email.ts` (new), `pkg/src/app.ts` (route
  dispatch only), `pkg/src/apps/types.ts`,
  `pkg/src/apps/registry.ts` (declaration + validation),
  `pkg/catalog/email.bundle.json` (new),
  `pkg/src/apps/catalog.ts` (one import line,
  alphabetical), `pkg/catalog/README.md` (one entry),
  `pkg/docs/email.md` (new),
  `pkg/.agents/skills/adding-an-app/SKILL.md` (one row).
- No registry effect-op change, no `act()` change, no
  MCP export change, no storage-key or export-format
  change, no auth-mechanism change. Agents already reach
  the same email capabilities directly through `execute`;
  this change is the browser-shell path only.
- Publish as MINOR (a new capability, per
  `pkg/AGENTS.md`), in the same commit as the code, with
  BUILD +1 on publish. It is its own MINOR relative to
  whatever version is current when it lands; it is not
  folded into the calendar-app MINOR unless the two
  land in the same publish, in which case there is
  still only one MINOR bump.

## Out of Scope

- Gmail or any other mailbox: this is Kody platform
  mail only, for the current org.
- New-mail compose (`emailSend`) and destination or
  sender-rule management (`emailDestination*`,
  `emailSenderRule*`): not declared, not routed, not
  in the app. Reply is in scope because its recipient
  comes from the stored message; arbitrary compose is
  a follow-on change with its own confirmation design.
- Package subscriptions (`email.message.received`):
  not needed for an on-demand viewer, and not a
  substitute for the routes. A push/sync change, if
  ever wanted, is separate.
- Mail caching in `packageStorage()`: v1 fetches live
  on every open. No stale copy, no storage-budget
  cost, no second copy of mail to protect.
