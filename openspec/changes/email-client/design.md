# Design: email-client

## Context

See proposal.md (Why). The shape to copy is `feeds.ts`:
a generic, server-side capability the package implements
once, declared data-only by an app, served same-origin
from the shell's fetch handler. The differences from
feeds are the ones that matter for mail:

- A feed route serves one allowlisted upstream URL per
  declared name. An email route serves the owner's own
  stored mail, so the allowlist is per-app
  (`capabilities.email`), not per-URL, and the data
  source is a Kody capability call, not an upstream
  fetch.
- Feeds are public data cached in storage. Mail is
  private, so there is no cache, no shared copy, and
  the route must sit behind exactly the same device
  gate as the app pages — which it does, by being
  dispatched from `app.ts` after `authenticate()`,
  like `/feed/`.
- Feeds are read-only. Mail actions (classify, delete,
  reply) are mutations, so they must follow the shell's
  existing mutation rule from
  `pkg/src/apps/INTEGRATION.md`: GET, never POST.
  Kody's edge rejects a mutating request to a
  `*.kody.run` package-app subdomain when the browser
  reports a foreign or `null` Origin, and the Scribe
  must not depend on POST working.

The fetch handler already reaches `kody:runtime` by
dynamic import for `packageContext` (`src/app.ts`,
`getPackageContext()`). The email module uses the
same import style for the capability surface. Which
surface actually works inside the fetch handler —
`runtime.kody.emailMessageList` and friends, or the
`runtime.email` object the package-apps guide lists
in the request context — is Open Question 1 and is
pinned by the packageAppFetch smoke test in tasks,
not assumed here. The implementation uses one surface
only, whichever the smoke test proves; it does not
ship a fallback that silently switches authority.

## Goals / Non-Goals

- Goals: live list, search, open, archive, mark spam /
  not spam / quarantine, delete, and text reply for
  Kody platform mail, from a shell app, on the Scribe;
  per-app allowlisting; sanitized rendering; no mail
  in app state; no new auth mechanism.
- Non-goals: compose, destination management, sender
  rules, subscriptions/push, caching, MCP exports,
  Gmail, attachments as editable files, and any
  change to an existing app, route, or action.

## Decisions

1. **Routes are per-app, like feeds.** `GET
   /email/:app/messages`, `GET /email/:app/search`,
   `GET /email/:app/messages/:id`, `GET
   /email/:app/attachments/:id`, plus GET-action
   routes on a message (below). The `:app` segment
   must be a valid app slug and must name an installed
   app whose stored definition declares
   `capabilities.email` with the flag the route needs
   (Decision 2). Anything else is a plain 404 with
   no mail, the same shape as an unknown feed.
   The bundle resolves its app id from the
   shell-stamped `data-action-base="/apps/<id>"`
   container (the xkcd proxy pattern), falling back
   to the `/apps/<id>` path of the page URL. It
   never hardcodes its own id.
2. **Two flags, not one blanket grant.**
   `capabilities.email` is `{ view: boolean, act:
   boolean }`. `view` allows list, search, get, and
   attachment download. `act` allows classify,
   delete, and reply, and implies nothing about
   `view` — a route checks exactly the flag it
   needs. The catalog email app declares both.
   Validation (in `registry.ts`, next to `feeds`)
   rejects any other shape, and a definition with
   neither flag true is treated as not declaring
   email at all.
3. **Read shape follows the capabilities, not a
   new model.** List returns the
   `emailMessageList` metadata only: id, direction,
   from, to, subject, dates, classification,
   delivery status — no bodies. Detail returns
   `emailMessageGet`: the same metadata plus
   `text_body`, attachment metadata, and the
   sanitized rendering of the body (Decision 4).
   Search returns `emailMessageSearch` results in
   list shape. Inboxes (`emailInboxList`) are
   exposed as `GET /email/:app/inboxes` for the
   app header only; the list routes take an
   optional `inbox_id` and otherwise use the
   capability default. There is no cursor paging
   in v1: the list capability takes only `limit`,
   so the server caps `limit` at 50 (default 25)
   and the app shows the newest N, with search
   as the way to reach older mail.
4. **Prefer text, sanitize HTML, drop images.**
   When `text_body` is present it is rendered
   escaped, linkified like the feed renderer.
   When only `html_body` is present it goes
   through the feed renderer's allowlist
   (paragraphs, headings, lists, links, tables;
   no script, style, iframe, form, svg, video,
   audio, and no `on*` attributes) with one
   mail-specific tightening: `<img>` is dropped
   entirely, not capped, because a remote image
   in mail is a tracking pixel until proven
   otherwise. Alt text, where present, is shown
   as a caption. A "show images" control is a
   future change, not a quiet addition here.
   Bodies are truncated server-side at 100,000
   characters with a visible "truncated" note;
   the full body is never silently cut.
5. **Attachments are metadata first, bytes on
   demand.** The detail response lists filename,
   content type, and size only. `GET
   /email/:app/attachments/:id` streams the bytes
   from `emailAttachmentGet` with
   `Content-Disposition: attachment` and the
   stored filename, so the browser downloads
   rather than rendering an untrusted file inline.
   The route takes an attachment id only; no
   storage key or path ever appears in a URL.
   If the Scribe cannot save or open a given
   type, metadata-only is the accepted v1
   outcome (Open Question 3) — the route still
   exists for browsers that can.
6. **Mutations are GET actions, with a
   confirmation step in the bundle.** Following
   the shell's GET-action rule, classify, delete,
   and reply are `GET
   /email/:app/messages/:id?action=<name>&...`
   with `format=json` for the bundle's in-place
   path (same pattern as `actFromForm`'s JSON
   path: `{ ok: true }` / `{ ok: false, error }`,
   `no-store`). Mutation URLs are never rendered
   as plain `<a href>` links, so nothing prefetches
   them; the bundle calls them only on an explicit
   tap. Delete additionally requires
   `confirm=1`, which the bundle sets only after
   an in-page confirm step — the server refuses
   a delete without it. Reply takes `text` only
   (no HTML, no attachments in v1), requires a
   non-empty body capped at 50,000 characters,
   and is sent through `emailReply`, so the
   recipient always comes from the stored message
   and thread headers are preserved by the
   capability, not rebuilt by the shell.
   Classify maps to the capability's
   `classification` / `archived` fields:
   `archive`, `unarchive`, `spam`, `not-spam`
   (accepted), `quarantine`.
7. **Runs-as is the publisher, and the gate is
   the shell's gate.** The routes run as the
   person who last published the package — the
   owner in a personal org — because that is who
   the platform mail belongs to, and only the
   capabilities listed in
   `kody.app.capabilities` may run as that
   person. No `visitorNeeds` entry is added in
   v1: a signed-in visitor does not get the
   owner's mail through a visitor grant, and no
   new credential is introduced. Anyone who
   passes the shell's device gate (access code,
   session cookie, or Kody-login bypass, exactly
   as app pages do) can use the routes; anyone
   who does not gets the locked page, never mail.
   This is the same trust level as installing a
   bundle at all — bundle scripts already run
   same-origin with full session authority — and
   the per-app declaration (Decision 1) is what
   stops an unrelated installed bundle from
   reading mail.
8. **No mail in app state, no cache, no logs of
   content.** The catalog email app has an empty
   `stateSchema` and `actions: {}`, like the
   Calendar app: every view is a live route call,
   and closing the app leaves nothing behind.
   The server logs counts and errors only —
   never subjects, addresses, or bodies. A failed
   capability call returns a plain error to the
   bundle with no capability internals leaked.
9. **MINOR, additive only.** Adding routes, a
   module, a declaration, and a catalog app
   breaks nothing existing, so this is a MINOR
   bump per `pkg/AGENTS.md`, in the same commit
   as the code, with BUILD +1 on publish and
   `pkg/AGENTS.md` / `pkg/README.md` headers
   updated in that commit. If Kody's publish
   check warns that a capability used by the
   import closure is not declared, the fix is to
   add that name to `kody.app.capabilities` and
   republish — never to widen the surface by
   declaring capabilities the routes do not call.
   Publish may also require the owner to
   re-approve the new capabilities in the Kody
   UI; that approval is the owner's, and no agent
   approves it on their behalf.

## Risks

- **A wrong runtime surface ships.** Mitigation:
  Open Question 1 is answered by a smoke test
  before the routes are treated as done, and the
  spec forbids shipping both surfaces.
- **GET mutations get prefetched or replayed.**
  Mitigation: no plain links to mutation URLs,
  bundle-only fetch on tap, `no-store` responses,
  and the delete `confirm=1` step. A replayed
  classify is idempotent; a replayed delete is
  the residual risk, which the confirm step
  narrows but does not eliminate — it is the
  same trade the shell already makes for
  `act()` GET forms.
- **A routing bug breaks the whole shell.**
  Mitigation: email routes are placed after the
  `/apps/` branches (like `/feed/`), match only
  the `/email/` prefix, and fall through to the
  existing 404 on any mismatch, so an unknown
  email path cannot shadow an app page.
- **Mail volume overwhelms the Scribe.**
  Mitigation: list cap 50, body cap 100,000
  characters, attachment metadata first, no
  images, no cache to grow.

## Alternatives considered

- **Synced viewer via `act()` (the status quo
  shape).** Rejected for this change, not as a
  bad idea: it works, and it is what a data app
  can do today, but it duplicates mail into app
  state, goes stale, hits field caps, and cannot
  act on a message from the shell. The routes
  remove all four problems at once.
- **Standalone Kody package mail client.**
  Rejected: its server code could call the email
  capabilities directly, but it would live
  outside the shell launcher, cost a package
  slot, and need its own session/auth story on
  the Scribe. The shell route keeps mail inside
  the OS the user already opens.
- **MCP exports for email on the shell.**
  Rejected for v1: agents already reach the same
  capabilities through `execute` directly, so
  shell MCP exports would add surface without
  adding a browser path. The browser path is
  the gap; the routes are the fix.
- **A generic `capabilities.email` with one
  boolean.** Rejected in favor of view/act:
  a viewer-only app should not be able to
  delete or reply just by declaring email, and
  the two-flag shape costs one validation
  branch.

## Open Questions

1. Which `kody:runtime` surface works in the
   shell's fetch handler: `runtime.kody.*` or
   `runtime.email.*`? Answered by the
   packageAppFetch smoke test (task 1.2).
2. Does publish require the owner to re-approve
   the new `kody.app.capabilities` in the Kody
   UI, and does that approval gate the publish
   or the first call? Answered at publish time;
   the agent does not approve on the owner's
   behalf either way.
3. Can the Scribe browser save or open a
   downloaded attachment? If not, v1 ships
   metadata-only for attachments on the Scribe
   and the download route remains for other
   browsers.
4. Does `emailMessageList` order newest-first
   in practice, and does `limit` behave as a
   cap rather than a page? Answered by the
   smoke test against real (or seeded) platform
   mail; the app's "newest N" wording is
   adjusted to match what the test proves.
