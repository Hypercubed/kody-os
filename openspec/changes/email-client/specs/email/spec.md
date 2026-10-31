# Spec Delta

## NEW Requirements

### Requirement: Live Kody platform mail, no synced copy

The shell SHALL fetch Kody platform mail live
from the built-in email capabilities on every
view, for the current org only. It SHALL NOT
copy mail into app state, cache mail in
`packageStorage()`, or require an agent sync
step. The catalog email app SHALL have an empty
`stateSchema` and `actions: {}`, and SHALL make
no `act()` call.

#### Scenario: List is live metadata only
- **WHEN** the list route is called
- **THEN** it returns `emailMessageList`
  metadata only — id, direction, from, to,
  subject, dates, classification, delivery
  status — with no bodies, capped at 50 items
  (default 25), newest first as the capability
  returns them.

#### Scenario: Search reaches older mail
- **WHEN** the search route is called with a
  query
- **THEN** it returns `emailMessageSearch`
  results in list shape, so mail beyond the
  newest-N list is reachable without paging.

#### Scenario: Closing leaves nothing behind
- **WHEN** the email app is closed
- **THEN** no mail, search query, or opened
  message remains in app state or storage.

### Requirement: Sanitized body rendering

The server SHALL prefer `text_body`, rendered
escaped and linkified, and SHALL sanitize
`html_body` through the feed renderer's
allowlist with `<img>` dropped entirely and
alt text kept as a caption. No script, style,
iframe, form, svg, video, audio, or `on*`
attribute SHALL survive in either body path.
Bodies SHALL be truncated server-side at
100,000 characters with a visible truncation
note.

#### Scenario: Text body preferred
- **WHEN** a message has both `text_body` and
  `html_body`
- **THEN** the detail response renders the
  text body, not the HTML.

#### Scenario: HTML body without images
- **WHEN** a message has only `html_body`
  containing an image, a script, and a link
- **THEN** the rendered body keeps the link,
  drops the image and the script, and shows
  the image's alt text as a caption if present.

#### Scenario: Truncation is visible
- **WHEN** a body exceeds 100,000 characters
- **THEN** the response is truncated at that
  limit and carries a truncation flag the app
  renders as a visible note.

### Requirement: Attachments are metadata first

The detail response SHALL list attachments by
filename, content type, and size only. Bytes
SHALL be served only on demand, from
`emailAttachmentGet`, with
`Content-Disposition: attachment` and the
stored filename, never rendered inline and
never addressed by a storage key in a URL.

#### Scenario: Attachment download
- **WHEN** the attachment route is called with
  a valid attachment id for a declared app
- **THEN** it streams the bytes as a download
  with the stored filename.

### Requirement: Mail actions from the shell

The shell SHALL support, through GET-action
routes, archiving, unarchiving, marking spam,
marking not spam, quarantining, deleting, and
text-only reply. Reply SHALL go through
`emailReply` with `text` only (non-empty,
capped at 50,000 characters, no HTML, no
attachments in v1), so the recipient comes
from the stored message and thread headers are
preserved by the capability.

#### Scenario: Archive and spam actions
- **WHEN** an `act`-declared app calls the
  archive or spam action for a message
- **THEN** the message's classification /
  archived state changes through
  `emailMessageClassify`, and a later list
  call reflects it.

#### Scenario: Reply preserves the thread
- **WHEN** an `act`-declared app replies with
  text to a stored inbound message
- **THEN** the reply is sent through
  `emailReply` to that message's sender, with
  its thread headers, and no other recipient
  is added by the shell.

#### Scenario: Compose is out of scope
- **WHEN** a caller asks the shell to send a
  new message to an arbitrary address
- **THEN** there is no route for it in this
  change, because `emailSend` is not declared
  and not routed.
