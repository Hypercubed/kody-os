# Spec Delta

## NEW Requirements

### Requirement: Shell email routes

The shell SHALL serve same-origin email routes for
apps that declare `capabilities.email`, dispatched
from `app.ts` after the `/apps/` branches and inside
the device gate that `fetch()` already runs, with
no new auth mechanism and no POST route for mail.

#### Scenario: Gated route
- **WHEN** an unauthenticated request reaches any
  `/email/` route
- **THEN** it gets the locked page, never mail,
  exactly as an unauthenticated app page does.

#### Scenario: Authenticated route
- **WHEN** a request with a valid session, code,
  or Kody-login bypass reaches a declared app's
  email route
- **THEN** the route runs and returns JSON
  (`no-store`) or, for an attachment, bytes with
  `Content-Disposition: attachment`.

#### Scenario: Undeclared app gets nothing
- **WHEN** an email route names an unknown app,
  a malformed app slug, or an installed app whose
  stored definition does not declare
  `capabilities.email` with the flag the route
  needs
- **THEN** the shell returns a plain 404 with no
  mail and no capability error detail.

#### Scenario: Unknown email path cannot shadow an app
- **WHEN** a request matches `/email/` but no
  email route
- **THEN** it falls through to the existing 404
  and no app page is shadowed.

### Requirement: Email routes are GET only

Mail reads and mail mutations SHALL both be GET
routes. No POST route SHALL be added for mail, and
no mutation URL SHALL be rendered as a plain
`<a href>` link.

#### Scenario: Mutation via GET with JSON
- **WHEN** the bundle calls a mutation route
  with `format=json`
- **THEN** it receives `{ ok: true }` on success
  or `{ ok: false, error }` on failure, with
  `no-store`, and no redirect or HTML page.

#### Scenario: Delete requires confirmation
- **WHEN** a delete route is called without
  `confirm=1`
- **THEN** the server refuses it and nothing is
  deleted, regardless of any client-side state.

### Requirement: Shell capability declaration

The package SHALL declare, in
`pkg/package.json` under `kody.app.capabilities`,
exactly the email capabilities its fetch handler
calls: `emailInboxList`, `emailMessageList`,
`emailMessageGet`, `emailAttachmentGet`,
`emailMessageClassify`, `emailMessageDelete`,
`emailReply` — plus `emailMessageSearch` only if
design.md Open Question 5 verifies it exists as
a callable capability; if it does not, search is
cut or re-scoped and the name is not declared.
It SHALL NOT declare `emailSend`,
`emailDestination*`, or `emailSenderRule*` in
this change.

#### Scenario: Undeclared capability is not called
- **WHEN** the publish check warns that a
  capability used by the import closure is not
  declared
- **THEN** the fix is to add that name to
  `kody.app.capabilities` and republish, never
  to declare capabilities the routes do not call.

## MODIFIED Requirements

### Requirement: App capabilities declaration

The `capabilities` object on an app definition
SHALL gain an `email` declaration, alongside the
existing `feeds` declaration, with the shape
`{ view: boolean, act: boolean }`. `view` allows
list, search, get, and attachment download; `act`
allows classify, delete, and reply. Any other
shape SHALL fail definition validation, and a
definition with neither flag true SHALL be treated
as not declaring email.

#### Scenario: Viewer-only app cannot act
- **WHEN** an app declaring only `view: true`
  calls a classify, delete, or reply route
- **THEN** it receives a plain 404 and nothing
  changes.

#### Scenario: Feeds declarations unchanged
- **WHEN** an existing app with only
  `capabilities.feeds` is validated
- **THEN** validation passes exactly as before
  this change.
