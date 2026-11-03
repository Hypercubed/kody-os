# Design: bundle-capabilities

## Context

See proposal.md (Why). Today `AppCapabilities` in
`pkg/src/apps/types.ts` declares only `feeds: FeedDecl[]`,
validated in `registry.ts` (`validateCapabilities`, at most
8 entries, HTTPS bare URLs, TTL 60–86400, maxBytes
1024–262144) and sanitized to defaults (TTL 3600, maxBytes
65536) at install time. The feed route
`GET /feed/:app/:name` in `pkg/src/feeds.ts` looks up the
feed by name in the stored definition and fetches only that
declared URL, with an 8-second timeout and storage caching.
That is the pattern this change generalizes: the shell
implements a capability generically, and a definition only
names what it needs, never code.

The trust context, agreed 2026-11-03, is that installing an
app trusts its same-origin code, and any installed app can
technically trigger shell routes (including the current
Store's GET mutations) from JavaScript. Capabilities therefore
do not create a runtime sandbox; they create a reviewable
declaration and a shell-side allowlist.

## Goals / Non-Goals

- Goals: a declared, validated, stored, and disclosed
  capability surface; a confirmation gate when an update
  adds a capability; shell-side refusal for undeclared
  management and proxy use.
- Non-goals: sandboxing, per-app origins, iframe isolation,
  or per-app bridge tokens (a separate, much larger change
  if ever wanted); restricting what a bundle script can
  fetch directly from the browser (CORS permitting, it can
  fetch any upstream itself — the proxy capability governs
  what the *server* fetches on its behalf, not what the
  browser can reach); any change to `act()` semantics.

## Decisions

1. **Capabilities stay a structured object.** The definition
   carries `capabilities: { feeds?, manageApps?, proxy? }`,
   not a bare string array. `manageApps` is a boolean.
   `proxy` is a list of entries shaped like feeds
   (`{ name, url, ttlSeconds?, maxBytes? }`), with the same
   limits as feeds unless the implementation spec says
   otherwise. A bare string list cannot carry the host,
   TTL, and size cap a proxy entry needs, and inventing a
   second, stringly-typed surface next to feeds would
   duplicate the one working pattern.
2. **Feeds are kept, not silently renamed.** Either feeds
   stay as they are and `proxy` is a second, general-purpose
   list, or feeds are generalized into `proxy` with feeds
   kept as a validated alias. The implementation must pick
   one and must not break any existing feed declaration
   either way. Duplicating the proxy route for feeds and
   for proxy entries is rejected; there is one server
   proxy implementation, parameterized by the declared
   entry.
3. **Validation rejects unknown keys; sanitization stores
   the canonical form.** At `add_app` time, an unknown
   capability key, a malformed proxy entry, a non-HTTPS
   URL, a URL with credentials, or an out-of-range TTL /
   size cap fails validation with no write — the same
   validate-all-first rule as the rest of the definition.
   Sanitization applies defaults and stores only the
   validated fields, so later shell checks read the stored
   definition, never a bundle-supplied claim at request
   time.
4. **Disclosure is in plain words, at install and at
   update.** The Store shows, for each app, what it
   declares: "can install and update other apps" for
   `manageApps`, and the declared proxy hosts for `proxy`
   (feed hosts shown as today, or under the generalized
   wording if feeds merge into proxy). The agent
   `add_app` path surfaces the same list in its
   verification step. Wording is a docs detail; the
   requirement is that no capability is installable
   without being shown.
5. **Capability expansion on update requires confirmation.**
   When a Store update (or an `add_app` overwrite) would
   change an installed app's stored capabilities by adding
   `manageApps`, a new proxy host, or any new capability
   key, the update SHALL NOT apply until the installer
   confirms a page/prompt naming exactly what is new.
   Removing a capability, or changing only TTL/size
   parameters, does not require this gate. This mirrors
   the modified-app update confirm: the loss being
   guarded against is silent privilege growth, not
   definition drift in general.
6. **Server refusal is feed-style.** A management call
   from an app without declared `manageApps`, or a proxy
   request for an undeclared name, returns the plain
   404 used by the feed route, with no capability detail
   and no write. An authenticated request still passes
   the device gate first; an unauthenticated request
   gets the locked page, never a capability answer.

## Open Questions

- Feeds-vs-proxy merge (Decision 2) is left to
  implementation, with the no-breakage constraint above.
  The spec does not require an answer in advance because
  either shape satisfies the disclosure and allowlist
  requirements.
- Whether the Store shows capabilities on the row itself
  or on a per-app detail view is a UI detail; the
  requirement is disclosure before install, not placement.
