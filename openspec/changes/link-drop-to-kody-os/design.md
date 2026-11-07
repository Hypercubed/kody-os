# Design: link-drop-to-kody-os

## Context

See proposal.md (Why). The shape to copy is
Probe as it stands: a live `add_app` app whose
bundle sends data home over the shell's
GET-action path, one appended string entry at a
time, into an array field with a cap. The new
part is what the entry means — a link the user
chose, from any browser they use — and the
bookmarklet that makes sending it a one-tap
act from a page that is not kody-os.

This change is spec only. No definition,
bundle, or bookmarklet is written by this
change itself; tasks 1-5 write them, and task 7
checks that this change document changed
nothing outside its own folder.

## Research

Research below is prior work, summarized so
this change stands on its own. It is not
re-verified by this change; tasks re-check
every number they depend on before shipping.

### 1. Probe, the pattern being copied

- Live app id `probe`, definition
  `schemaVersion` 5. State: `reports`, an
  array of strings, `maxItems` 500, initial
  `[]`.
- Action `append_report`, args `tag` and `d`
  (both strings), one effect: `append` field
  `reports` from arg `d`, `cap` 500,
  `maxEntryBytes` 2048. Oldest entries drop
  first past the cap; a string entry over the
  byte cap is rejected, the action returns
  `{ ok: false, error }`, and stored state is
  left untouched.
- Action `clear_reports`, no args, one effect:
  `set` field `reports` to `[]`.
- The bundle builds its action URL from the
  page's own path (the Probe `actBase`
  pattern: take the path up to `/apps/`,
  append `/apps/probe`), then navigates or
  beacons to
  `?action=append_report&tag=...&d=...`.
  The link-drop bookmarklet does the same
  derivation from the kody-os page's location,
  not from the sending page's location.

### 2. The GET-action contract

- Per `pkg/.agents/skills/adding-an-app/
  SKILL.md`: every persistence goes through
  `act()` — shell GET forms, or bundle
  `fetch` of the same-origin GET action URL,
  resolved against the container's
  `data-action-base`, with `?format=json`
  and `credentials: 'same-origin'`, with a
  full-navigation fallback where fetch or JSON
  parsing are absent.
- UI buttons (`ui.actions`) carry no
  arguments and render as GET forms. An
  argument-taking action like `send` is
  therefore driven by a URL (the bookmarklet)
  or by MCP `act`, never by a shell button.
- The edge rejects mutating requests from
  package-app subdomains with a foreign or
  `null` Origin, so UI mutations are GET
  forms. The bookmarklet is a top-level
  navigation, not a cross-origin fetch, which
  is why it can write at all — and why it
  cannot save silently in the background.
- The only effect operators are `set` and
  `append`, applied in order from a
  definition's `effects[]`. There is no
  remove-one-element, update-one-element, or
  dedupe operator. Anything v1 wants beyond
  append and clear-all has to be a procedure
  (an agent rewriting state), not a bundle
  action.

### 3. Session, the hard requirement

- The sending browser must already hold a
  kody-os session (the session cookie, 30
  days, SameSite=Lax, per the 2026-11-04
  feasibility research) in that browser. The
  bookmarklet carries no credential, no code,
  and no token: it carries only the link being
  sent, and the session cookie is what
  authorizes the append.
- If the sending browser is not signed in, the
  GET lands on the Locked page and nothing is
  saved. That failure is visible — the user
  sees the Locked page instead of their link
  list — not silent. The app page must say
  this plainly, because "I tapped it and
  nothing happened" is otherwise
  indistinguishable from a lost entry.
- SameSite=Lax is also the reason a
  background save does not work: the cookie
  is sent on top-level navigations, not on
  cross-site subresource requests. The
  bookmarklet's new-tab navigation is not a
  workaround for that rule; it is the shape
  the rule permits.

### 4. Scribe constraints that shape the viewer

- Clipboard: a tap-gated Probe test run on
  the Scribe (2026-11-03) found
  `navigator.clipboard` present, but
  `writeText` and `readText` both denied
  with NotAllowedError, even from a tap
  gesture. Conclusion, already recorded for
  kody-os: no copy control is to be built on
  the Clipboard API, and selectable text
  stays the pattern. The bookmarklet code on
  the app page is therefore selectable text
  plus a draggable link, not a copy button.
  On a phone or desktop browser, normal copy
  works; the app must not depend on it.
- Ceiling: ES2019 and earlier for bundle
  scripts, Chromium 80 on-device probe
  (2026-10-25), system fonts only, zero
  emojis, 48px minimum tap targets, no
  flexbox gap (grid gap is fine). Canonical
  statement: `pkg/docs/scribe-limitations.md`.
- Bundle-before-state ordering, carried over
  from Daily Brief: the shell renders the
  bundle BEFORE the state fields, so a bundle
  script that runs immediately finds no
  fields. The fix is to wait for
  DOMContentLoaded (with a readyState
  fallback), then render the viewer and hide
  the state fields (the bundle sets
  `ui.hideState: true`, and the current
  adding-an-app skill requires the bridge-
  first, seed-second, span-fallback read
  path for state).
- Viewer links are plain anchors. What a tap
  does on the Scribe — open in the same
  browser, leaving kody-os, with Back to
  return — is a task-5 check on the device,
  not a promise in this spec.

### 5. Why append, not a rewrite

- Daily Feed's push rewrites the whole feed
  string on every push: read, modify, set.
  Two pushes racing each other can lose one
  entry (last writer wins). A link send is
  exactly the case where races are likely —
  two tabs, two devices, one tap each — so
  the send must be atomic per entry. The
  `append` effect is that atomicity: one
  action, one entry, no read-modify-write
  in the sender. The cost is that the app
  cannot dedupe or edit in place, which v1
  accepts openly (Decision 8).

## Decisions

### Decision 1: One array field, two actions, no capabilities

State is `links` only, actions are `send`
(append) and `clear` (set to `[]`) only, no
`capabilities.feeds`, no
`capabilities.proxy`, no
`capabilities.manageApps`. Rationale: the
smallest definition that can hold the
pattern, copied from Probe with the field and
action renamed. A second field would need a
reason in the spec, not symmetry with
another app. The 500-entry and 2048-byte
caps are the definition's hard backstops,
matching Probe's validator-known defaults;
the bookmarklet's title truncation (Decision
4) works inside them, not around them.

### Decision 2: One entry, one JSON string

The `send` action takes a single string arg,
`entry`, and appends it as-is. The entry's
shape is JSON text:

```json
{"t": "2026-11-04T18:10:30-07:00", "title": "Example page", "url": "https://example.com/page"}
```

- `t`: ISO 8601 timestamp of the send, from
  the sending browser's clock. It is a
  display value, not a sort key: display
  order is storage order reversed, and a
  wrong device clock only mislabels one
  entry's time.
- `title`: the sending page's
  `document.title` at send time, truncated
  by the bookmarklet (Decision 4).
- `url`: the sending page's location, never
  truncated, never rewritten.

Rationale: `append` takes one `fromArg`
value, so one entry must be one string; a
three-arg action would need three appends
to three arrays that could drift out of
sync, and a three-field object entry would
need an object-typed array item, which the
Probe precedent does not use. JSON keeps
timestamp, title, and URL atomic in one
string, and unknown keys are ignored by the
bundle, so a later extension (for example a
selected-text key) does not break v1
entries. Entries that are not valid JSON,
or that parse to something without a usable
URL, are not errors: the bundle renders
them as plain text with no link (Decision 7),
so a hand-written `act` send or a future
format never breaks the list.

### Decision 3: Most-recent-first display, append-order storage

Storage order is append order, oldest first,
because that is what `append` does. Display
order is the reverse: newest on top, oldest
at the bottom. The bundle reverses at render
time; nothing in storage records display
order, and no stored order field is added.
Rationale: the newest link is the one the
user most recently wanted, and it must be
the first thing the list shows after a send
lands — that is also how the user confirms
a send worked.

### Decision 4: Title truncated, URL never truncated, 2048-byte cap kept

The bookmarklet builds the entry JSON, then
checks its byte length. If it exceeds 2048
bytes, it shortens the title (and only the
title) until the entry fits, keeping a
readable prefix. It never shortens the URL:
a truncated URL is a broken link, which is
worse than a shortened title. If the URL
alone, plus the JSON wrapper and timestamp,
already exceeds 2048 bytes, the send is out
of v1 scope: the bookmarklet still attempts
it, the action rejects it, state is left
untouched, and the user lands on the app
page without their link — a visible failure
for an edge case (tracking-heavy URLs over
about 1900 characters) that task 2 must
demonstrate, not hide. Raising
`maxEntryBytes` is open question 2, not a
v1 default, because the validator's upper
bound for it is not yet verified.

### Decision 5: Bookmarklet derived from the app page's location

The app page renders the bookmarklet; the
bookmarklet's target URL is derived at
render time from the app page's own location
(the Probe `actBase` derivation: path up to
`/apps/`, plus `/apps/link-drop`), never
hardcoded to a host. Rationale: the same
definition installed on hosted Kody, on the
mock preview, and on a dev install must each
produce a bookmarklet that sends to itself.
A hardcoded host would send mock-page
installs to the live app and live-page
installs to nothing when the host changes.
The bookmarklet code is:

```text
javascript:(function(){var u=location.href,t=document.title;var e=JSON.stringify({t:new Date().toISOString(),title:t,url:u});window.open('<APP-BASE>?action=send&entry='+encodeURIComponent(e),'_blank');})();
```

with `<APP-BASE>` replaced by the derived
base at render time, and title truncation
applied before encoding (Decision 4). The
exact snippet is the implementation's to
finalize in ES2019-compatible form; the
spec fixes its shape, not its whitespace.

### Decision 6: Landing on the app page is the confirmation

The bookmarklet URL carries no
`format=json` parameter, following Probe's
navigate-send precedent: the browser lands
on the app page, which renders the list with
the new entry on top. That landing IS the
confirmation; there is no separate success
page, toast, or return to the original page.
If task 2 finds that a bare navigation
returns JSON or an error page instead of
the app page, the implementation must change
the URL form to whatever lands on the app
page, and this decision's note must be
updated — the requirement (land on the list
showing the new entry) does not move, the
URL form may.

### Decision 7: Sanitized rendering, scheme allowlist

The bundle SHALL escape all entry text
before inserting it into the page (escape
first, then linkify or link — never
innerHTML with entry content), and SHALL
only create an anchor when the parsed URL's
scheme is exactly `http` or `https`.
`javascript:`, `data:`, `file:`, and any
other scheme render as plain text with no
anchor. Rationale: entries arrive from any
page the user visits, and an entry is
therefore untrusted content in the same
sense as a feed description. A stored
`javascript:` link that became a clickable
anchor would turn a saved link into code
execution on tap. The allowlist is the whole
defense, and it must be tested with
adversarial entries in task 3, not just
with well-formed ones.

### Decision 8: No per-item delete, no dedupe, in v1

The operators provide no remove-one-element
effect, so a bundle "delete this link"
button cannot be built from the fixed
operators: a `set` from a string arg would
store a string, not an array, and there is
no array-valued arg type for the bundle to
pass a rewritten array through. v1 therefore
offers `clear` (all entries) only, and the
bundle does not hide duplicates: two sends
of the same link are two entries, shown as
two entries. Rationale: hiding state the
bundle does not own would lie about what
`clear` will destroy, and a fake delete
that only hides an entry until the next
render would be worse than an honest
limitation. An agent-side procedure (clear
plus re-push of the kept entries) is the v1
escape hatch for "remove one link", and it
is recorded as a procedure note in task 1,
not as a bundle feature.

### Decision 9: Page first, widget later

v1 placements are `page` only, mirroring
Daily Feed and Probe. A homepage widget
showing the latest saved link is a natural
later step, but it changes what "done"
means (compact rendering, widget controls,
homepage order) without changing the send
model, so it is an open question, not v1
scope. The spec delta therefore requires
page rendering only. Note (2026-11-04):
the bundle already carries widget-hiding CSS
(`section.widget #ld-clear-form` and
`section.widget #ld-install` are hidden), so
when the app renders as a widget it shows
only the link list; a latest-link widget
placement is still the open question, not
v1 scope.

### Decision 10: Trust note — a GET append is session-gated, not secret-gated

Anyone who can get the user's browser to
perform a top-level navigation to a crafted
`?action=send&entry=...` URL while the
user is signed into kody-os could append an
entry. That is the same exposure Probe's
`append_report` already carries, and the
severity here is low by construction: an
appended entry is a link, rendered escaped
and scheme-checked (Decision 7), carrying
no code, no state change beyond the list,
and removable with `clear`. The bookmarklet
itself carries no secret, so publishing or
sharing it leaks nothing. This is stated so
the limitation is a known one, not a
surprise found later; it is not a reason to
add authentication to the bookmarklet,
which has nowhere to store a credential
safely.

## Open Questions

1. Answered — app id is `link-drop`: the
   app is installed under that id (renamed
   from Send Link before any live install;
   see tasks.md implementation notes).
   The `links` / `reading-list` alternatives
   were not taken.
2. Entry byte cap: keep `maxEntryBytes`
   2048 (the Probe default), or raise it
   (for example to 4096) if the validator
   accepts a larger value? The definition
   cap does not change the bookmarklet's
   title-truncation rule either way; it only
   moves the URL-length edge in Decision 4.
3. Per-item delete: is clear-all plus an
   agent clear-and-repush procedure enough
   for v1, or does v1 need a bundle delete
   built on some mechanism outside the fixed
   operators? If the latter, this spec needs
   a new decision, not just a new task.
4. Widget placement: page only in v1, or
   page plus a latest-link widget from the
   start (see Decision 9)?
5. Selected text: should the bookmarklet
   also capture the page's current text
   selection into an extra entry key (ignored
   by the v1 bundle)? It is a small addition
   to the bookmarklet with no definition
   change, but it changes the install-block
   wording and the entry examples.
6. Hosted versus mock bookmarklet: the mock
   page's bookmarklet sends to localhost and
   only works on the machine running dev.
   Is that acceptable as the mock story, or
   should mock verification use hand-built
   URLs instead of the page-rendered
   bookmarklet?

## Alternatives Considered

- Three parallel arrays (`titles`, `urls`,
  `times`) with three appends per send.
  Rejected: the three appends are not
  atomic as a group, and a failed or partial
  send would leave the arrays out of sync
  with no repair operator. One entry, one
  append, is the only atomic shape.
- An object-typed array item (array of
  objects, schemaVersion 5) instead of a
  JSON string. Rejected for v1: it departs
  from the Probe precedent the spec is
  copying, and the bundle would still need
  to validate and escape each object's
  fields; the JSON string keeps the
  definition to the proven string-array
  shape and puts parsing in one tested
  bundle function.
- A rewrite-the-whole-list push in the Daily
  Feed pattern (`set` with the full list).
  Rejected: it reintroduces the
  read-modify-write race (Decision: see
  Research 5) for exactly the concurrent
  sends this app invites.
- Browser-native bookmark sync, or a
  third-party read-it-later service.
  Rejected: neither lands the link in
  kody-os state, so neither reaches the
  Scribe's kody-os viewer, which is the
  point of the app.
- Server-side fetch and archive of the
  linked page (declared proxy capability,
  stored page content). Rejected for v1: it
  is a different app with its own storage,
  copyright, and staleness questions, and it
  answers "keep this page" rather than
  "remind me of this link".
- A share-sheet target or browser extension.
  Rejected for v1: no shell capability
  exists for either, and both raise the
  install cost above a bookmarklet while
  the bookmarklet is unproven. Revisit if
  the bookmarklet proves too awkward on
  mobile in practice.
