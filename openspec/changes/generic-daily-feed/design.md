# Design: generic-daily-feed

## Context

See proposal.md (Why). The shape to copy is
Daily Brief as it stands after its 2026-10-27
feed-only trim: the stored payload is one RSS
XML string in a `feed` field, one `<item>` per
entry, newest first, and the bundle is a feed
reader with a sanitized renderer shared in
spirit with the xkcd app. The new part is
generalization: remove the one-feed
assumptions, and add the empty-state prompt
that tells a user, in plain words, how to get
an agent to start pushing.

This change is spec only. No definition, bundle,
or push script is written by this change itself;
tasks 1-5 write them, and task 7 checks that
this change document changed nothing outside
its own folder.

## Research

Research below is prior work, summarized so
this change stands on its own. It is not
re-verified by this change; tasks re-check
every number they depend on before shipping.

### 1. Daily Brief, the pattern being generalized

Note (2026-11-04): `daily-brief` was deleted
live after its feed moved verbatim to
`daily-feed` and the 8am digest cron was
retargeted to Daily Feed. The description below
is the pre-move pattern it generalized; Daily
Brief no longer exists as a live app.

- Live app id `daily-brief`, created 2026-10-25
  via `add_app` only, no republish, no package
  change. Definition: `feed` only (string,
  `maxLength` 250000), action `set_feed` only.
  Legacy `latest` / `history` fields and
  `set_latest` / `set_history` actions were
  removed in the 2026-10-27 trim; the bundle
  reads the feed only.
- Push: the 8am digest cron's step, via Kody
  execute `act` / `get_app_state` wrappers
  (`input.id` to the package function). The
  push script reads the current feed, parses
  the items, prepends the new entry (replacing
  any item with the same date guid), keeps
  only the newest 14 items, then sets the feed
  and verifies it. It refuses entries over
  19000 characters, and if the state read
  fails, or the existing feed is non-empty but
  unparseable, it writes nothing and exits
  non-zero, never overwriting the feed with a
  single entry. A Daily Brief failure never
  blocks or delays the digest delivery itself.
- Viewer: bundle JavaScript (ES2019, no `?.` /
  `??`), the bundle reads the shell-rendered
  `feed` field, parses the RSS XML, opens on
  the latest entry, and Previous / Next step
  through entries in-page. If JavaScript does
  not run, the shell still shows the `feed`
  field as readable plain text.
- Two viewer bugs from Daily Brief, carried
  into this spec as requirements, not lore:
  (a) the shell renders the bundle BEFORE the
  state fields, so a bundle script that runs
  immediately finds no fields, shows "No
  brief yet", and never hides the fields,
  leaving duplicate content visible. The fix
  is to wait for DOMContentLoaded (with a
  readyState fallback), then render the viewer
  and hide the state fields. (b) linkify must
  escape first, then linkify, in one pass:
  "Source: <url>" becomes a "Source" link,
  any other bare URL becomes a link with the
  URL as its text, trailing punctuation kept
  outside the link. A two-pass version
  double-wrapped the href URL in a second
  anchor and was caught in Node testing.
- One Daily Brief assumption that does NOT
  carry over: the title fallback that matched
  "AI Agents Digest — Weekday, Month Day,
  Year" in a description. The generic viewer
  uses item title, then pubDate, then entry
  position, and never a feed-specific regex.

### 2. Scribe constraints that shape the prompt

- Clipboard: a tap-gated Probe test run on the
  Scribe (2026-11-03) found `navigator.clipboard`
  present, but `writeText` and `readText` both
  denied with NotAllowedError, even from a tap
  gesture. Conclusion, already recorded for
  kody-os: no copy control is to be built on
  the Clipboard API, and selectable text stays
  the pattern. The empty-state prompt follows
  it: plain text the user can read and pass to
  an agent in their own words or by retyping,
  not a button that promises a copy it cannot
  do. On a phone or desktop browser, normal
  copy works; the app must not depend on it.
- Ceiling: ES2019 and earlier for bundle
  scripts, Chromium 80 on-device probe
  (2026-10-25), system fonts only, zero
  emojis, 48px minimum tap targets, no
  flexbox gap (grid gap is fine). Canonical
  statement: `pkg/docs/scribe-limitations.md`.
- GET forms only in browser UI: Kody's edge
  rejects mutating requests from package-app
  subdomains with a foreign or `null` Origin,
  so UI actions are GET forms and bundle
  action URLs resolve against the
  shell-stamped `data-action-base`. This app
  has no UI write action in v1, so the rule
  binds it only through the bundle's
  navigation controls, which are in-page
  JavaScript, not form actions.

### 3. Why the push model, and why not a typed URL

- The shell's feed capability is declared,
  not requested: `capabilities.feeds` holds up
  to 8 fixed HTTPS URLs, served via
  `GET /feed/:app/:name` with storage caching.
  The route takes the feed name, never a URL.
  News (6 declared feeds) and xkcd (1 declared
  feed) use it. A bundle therefore cannot, by
  itself, fetch a URL a user types at runtime:
  direct fetch is often blocked by missing CORS
  headers (the xkcd case), and the same-origin
  proxy only serves declared names.
- The agent-push model avoids all of that:
  the agent already has Kody execute access,
  already reads and writes app state through
  `act`, and can push any content it can
  express as RSS, from any source it can reach.
  The cost is staleness: the app only updates
  when an agent pushes. The spec owns that
  cost openly (Decision 4) instead of
  pretending the viewer is live.

## Decisions

### Decision 1: One field, one action, no capabilities

State is `feed` only, action is `set_feed`
only, no `capabilities.feeds`, no
`capabilities.proxy`, no `capabilities.manageApps`.
Rationale: the smallest definition that can
hold the pattern, and the easiest to audit.
A second field or a second action would need
a reason in the spec, not just symmetry with
another app. The push script, not the
definition, owns entry caps, guid dedup, and
entry-size limits, because those are procedure
rules an agent can change without redefining
the app. The definition's 250,000-character
field cap is the hard backstop, not the
procedure cap.

### Decision 2: RSS XML, newest first, plain-text descriptions

The pushed payload is RSS 2.0 XML: one
`<item>` per entry, newest first, each with
`title`, `link`, `pubDate`, and `description`
as escaped plain text, no CDATA. Rationale:
it reuses the Daily Brief payload shape, the
existing renderer, and the existing push
script almost verbatim, and it keeps the
bundle's parser to one format in v1. Atom
entries are out of v1; if a source only
offers Atom, the pushing agent converts it
to RSS before pushing. Descriptions stay
plain text in storage; links are added at
render time by the linkify step, so storage
never carries feed-supplied HTML, script, or
inline style into the list.

### Decision 3: Empty-state prompt, exact shape

WHEN the feed is empty, or parses to zero
items, the bundle SHALL render, in place of
the viewer, a prompt with all of the following,
in plain selectable text:

- What is missing: no daily feed data has
  been pushed to this app yet.
- What to ask: a sentence the user can give
  to their agent, in this shape (wording may
  be tightened by the implementation, but no
  element below may be dropped):

  > Please set up a daily feed push for my
  > kody-os app "daily-feed". Using Kody
  > execute against kody:@hypercubed/kody-os,
  > read its current state, prepend one new
  > RSS item (newest first, at most 14 items
  > total), and set the full feed with the
  > act action "set_feed". Do not overwrite
  > the feed if the current feed cannot be
  > read or parsed. The feed is RSS XML with
  > one item per entry, each with title, link,
  > pubDate, and a plain-text description.

- What the agent needs to know, stated
  plainly: the app id (`daily-feed`), the
  action (`set_feed`), the format (RSS XML,
  newest first), and the cap (14 entries).
- What the prompt SHALL NOT contain: any
  secret, OTP, code, session token, cookie,
  or link carrying a credential. The prompt
  is about the push, not about access; access
  is the user's existing agent relationship,
  not something the app hands out.

The prompt is bundle-rendered JavaScript
content. Limitation, stated openly: with
JavaScript off, the shell shows the empty
`feed` field and no prompt. That is the
honest no-JS state, not a second prompt to
maintain, and it is not a reason to add a
shell route for the prompt.

### Decision 4: Staleness is visible, not hidden

The viewer SHALL show, for the entry being
viewed, its pubDate in device-local long form
(weekday, month, day, year) when a pubDate
is present, and the "N of M" position. It
SHALL NOT present the newest stored entry as
"today's" feed when its pubDate is older:
the date shown is the entry's date, and an
old date reads as an old date. There is no
"last pushed" timestamp field in v1, because
there is no second field to hold it; the
newest entry's pubDate is the freshness
signal, and the implementation must not
invent a fresher one. A push cadence (daily,
weekly, on demand) is the user's arrangement
with their agent, not a schedule the app
enforces; a Kody scheduled job or a Muse
cron are both viable push triggers, and the
choice is recorded in the task notes, not
fixed by this spec.

### Decision 5: Daily Brief coexistence, no migration (superseded 2026-11-04)

Daily Brief stays exactly as it is for v1. This
app gets its own id, its own state key, and its
own push procedure. Rationale: Daily Brief's
state and push are live and working; touching
them to "generalize in place" would risk the
one feed that already works, and would make
the generic app's first user the existing
digest's test subject. If a user wants the
same content in both apps, an agent pushes
to both ids. A migration or import tool is
an open question (tasks, section 0), not a
v1 promise.

Superseded (2026-11-04): after v1, Daily
Brief's feed moved verbatim to Daily Feed, the
8am digest cron was retargeted to Daily Feed,
and Daily Brief was deleted live after a full
export (`~/workspace/kody-ai-os/daily-brief-export-2026-11-04.json`).
The first Daily Feed push then lost the 12 prior
items (Oct 24–Nov 4); the user chose on Nov 5 to
leave Daily Feed as-is, today only, with history
in the export file. Daily Feed is now the digest
target; Daily Brief no longer exists live.

### Decision 6: Page first, widget later

v1 placements are `page` only, mirroring
Daily Brief. A homepage widget placement
renders the same state in compact form, and
would be a natural later step for a "latest
entry on home" view, but it changes what
"done" means (compact rendering, widget
controls, homepage order) without changing
the push model, so it is an open question,
not v1 scope. The spec delta therefore
requires page rendering only.

## Open Questions

1. Answered — app id is `daily-feed`: the
   implementation used the spec default, and
   the app is installed live under that id.
   (The `generic-daily-feed` alternative was
   not taken.)
2. Answered — procedure defaults stay 14
   entries and 19000 characters per entry:
   the implementation used the spec defaults.
   The definition cap (250000) is unchanged.
3. Answered — catalog from the start, on the
   user's direction: Daily Feed is in the
   catalog at `catalogVersion` 5,
   `installMode` `recipe-or-json`.
4. Answered — migration happened after v1,
   not as a v1 step: Daily Brief's feed moved
   verbatim to `daily-feed` on 2026-11-04
   and Daily Brief was deleted live (see
   Decision 5).
5. Answered for v1 — page only: the
   definition's placements are `page` only.
   A widget is a future step (see
   Decision 6), not v1 scope.

## Alternatives Considered

- Generalize Daily Brief in place (same id,
  new bundle, new prompt). Rejected: it
  risks a working live app and conflates
  "the digest app" with "any daily feed".
  A second app keeps both meanings clear.
- Self-fetching via declared feeds, with the
  user picking from a fixed list at install
  time. Rejected for v1: it is the News /
  xkcd pattern, it needs a feed URL baked
  into the definition at install, and it
  answers a different question ("show me
  this public feed") than the push model
  ("show me what my agent prepared for me").
  It remains a viable second app, not a
  variant of this one.
- A multi-feed app with sections, in the
  News pattern, where each section is a
  pushed feed. Rejected for v1: sections
  need either multiple state fields or a
  compound payload, and the empty-state
  prompt gets complicated ("which section
  is missing?"). One feed, one prompt, in v1.
- A "last pushed" timestamp field, updated
  by the push script alongside the feed.
  Rejected for v1: it adds a second field
  and a second effect to every push, and
  the newest entry's pubDate already carries
  the freshness signal. Revisit if a push
  cadence ever needs to be audited from the
  app itself.
