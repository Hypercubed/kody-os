# Proposal

## Why

Daily Brief works, but it is not generic. It is a live
`add_app` app (id `daily-brief`) whose bundle, push
procedure, and title fallback were built around one
specific feed: a daily AI-agents news digest, pushed
every morning by the 8am digest cron. Reusing it for
any other daily content means carrying that one
feed's assumptions with it, or forking a private
copy with no spec behind it.

This change specs a second, generic app that keeps
only the mechanism that made Daily Brief work: one
feed string in app state, pushed into the app by an
agent, rendered as one entry at a time on the
Scribe. Anything an agent can express as RSS can
be a daily feed in this app: a digest, a journal,
a daily note, a changelog, a single-topic brief.
The content is the agent's job; the app is only
the viewer, the storage field, and the prompt that
gets the push started.

## What Changes

- One new app, id `daily-feed`, label "Daily Feed",
  category `reading`, delivered in v1 as a registry
  write via `add_app`, exactly like Daily Brief and
  the other data apps. Per `pkg/AGENTS.md`
  ("Adding an app"), that is no package change, no
  commit, and no republish: the definition is data
  in `packageStorage()`, and it appears in
  `list_apps()` and on the Apps page as soon as
  `add_app` returns `{ ok: true }`.
- The definition follows the existing contract:
  `schemaVersion` 5, one state field, one action,
  no shell route, no MCP export, no capability
  declaration (see design.md, Decision 1).
  - State: `feed`, a string, initial `""`,
    `maxLength` 250000.
  - Action: `set_feed`, arg `value` (string,
    required, `maxLength` 250000), effect `set`
    field `feed` from arg `value`.
- A bundle that parses the stored RSS XML, opens
  on the latest entry, and steps through entries
  with Previous / Next, in the Daily Brief viewer
  pattern: nav grid `auto 1fr auto`, date plus
  "N of M", 48px tap targets, device-local dates.
- An empty-state prompt, rendered by the bundle
  when no feed data is available. The prompt is
  plain, selectable text the user can give to
  their agent to enable the daily feed push. It
  names the app id, the `set_feed` action, and
  the feed format, and it contains no secret,
  OTP, code, or session token (design.md,
  Decision 3).
- A push procedure, adapted from the Daily Brief
  procedure, with the digest-specific parts
  removed: read the current feed, prepend the new
  entry (replacing any entry with the same guid),
  keep at most 14 entries, rebuild the feed XML,
  and set it with `act`. If the state read fails,
  or the existing feed is non-empty but
  unparseable, the procedure writes nothing and
  never overwrites the feed with a single entry.

## Capabilities

### New Capabilities

- `daily-feed-app`: a generic, agent-pushed daily
  feed viewer, with an empty-state agent prompt.

### Modified Capabilities

- None in v1. No existing app, route, action, MCP
  export, or shell behavior changes. Daily Brief
  (`daily-brief`) is untouched by v1, and the two
  apps coexist; this change does not rename,
  replace, migrate, or import Daily Brief state
  (design.md, Decision 5). Note (2026-11-04):
  Daily Brief was later deleted live, its feed
  moved verbatim to Daily Feed, and the 8am
  digest cron now pushes to Daily Feed, so the
  two apps no longer coexist; see design.md,
  Decision 5.
- Catalog shipping (Phase 2, optional, tasks
  section 6) modifies `app-registry` only by
  adding one catalog definition (definition.json
  plus RECIPE.md), one `catalog.ts` import line,
  a regenerated index, and one README entry, in
  the same pattern as the existing catalog apps.

## Impact

- v1: one `add_app` definition, written to the
  live store and to the local mock store
  separately (the two stores are separate, per
  `pkg/.agents/skills/adding-an-app/SKILL.md`).
  No file in `pkg/` changes, so no version
  decision is triggered by v1 at all.
- Phase 2 (only on user direction):
  `pkg/catalog/daily-feed/definition.json` (new,
  `catalogVersion` 1) plus
  `pkg/catalog/daily-feed/RECIPE.md`, one import
  line in `pkg/src/apps/catalog.ts` (alphabetical
  by id), the generated index regenerated, and
  one entry in `pkg/catalog/README.md`.
  That is a new feature with nothing existing
  breaking, so it is a MINOR bump per
  `pkg/AGENTS.md`, with BUILD +1 on publish,
  in the same commit as the catalog files. Note:
  Phase 2 is done — Daily Feed is in the catalog
  at `catalogVersion` 5, `installMode`
  `recipe-or-json`.
- Storage budget: the feed field is at most
  250,000 characters, the bundle is under the
  256 KiB bundle cap, and both sit inside the
  16 MiB package storage budget. The cap is
  checked by the catalog harness before
  shipping, and by definition validation for
  an `add_app` v1.

## Out of Scope

- Replacing, renaming, or migrating Daily Brief
  in v1. Daily Brief keeps its id, its state, and
  its 8am digest push; a user who wants the same
  content in both apps asks an agent to push it
  to both; no automatic import is in v1. Note
  (2026-11-04): the replacement happened after
  v1 — Daily Brief's feed moved verbatim to
  Daily Feed, the digest cron was retargeted,
  and Daily Brief was deleted live after a full
  export; see design.md, Decision 5.
- A user-typed RSS URL at runtime. This app has
  no feed-URL input, and no declared
  `capabilities.feeds` entry. The shell's feed
  route takes only a feed name declared for an
  app, never a URL from a request, so a
  runtime-typed URL cannot be fetched through
  it. A self-fetching feed app is a different
  app, in the News / xkcd pattern, not this one.
  That separate app is now spec'd as
  `generic-rss-feed` (per-install feedUrl plus a
  `GET /user-feed/<app>` route); this app stays
  push-only.
- Self-fetching, live refresh, multi-section
  feeds, subscriptions, comments, or per-entry
  delete / edit from the app in v1. The only
  write path in v1 is the agent's `set_feed`
  with the full feed.
- A copy button for the empty-state prompt.
  Clipboard write is denied on the Scribe (see
  design.md, Research), so the prompt is
  selectable text, not a copy control.
- Any shell change, route, capability, or MCP
  export. The app needs none of them.
