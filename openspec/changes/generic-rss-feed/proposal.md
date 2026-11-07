# Generic RSS feed (live)

## Summary

Add a second generic feed app, `generic-rss-feed`, that reads an RSS (or Atom) feed live from a URL the user supplies at setup — the live counterpart to the existing push-only `generic-feed`. The app fetches through a new shell route, `GET /user-feed/<app>`, which reads the URL from the app's own stored state and fetches it with the same server-side machinery as the declared-feed route. The route never takes a URL from the request.

## Problem

The user wants two generic feeds:

- A generic **push** feed — the existing `generic-feed` app. It has no capabilities, one `feed` field, and one `set_feed` action; an agent fetches the user's RSS URL and pushes the parsed feed in. It never reads RSS live.
- A generic **live** feed — this change. It reads the user's RSS URL live, like XKCD reads its feed live.

XKCD and News read live through the `feeds` capability: fixed URLs declared in the definition (XKCD: `https://xkcd.com/rss.xml`, 1 h TTL), fetched server-side by the shell and served at `GET /feed/<app>/<name>`. Both `feeds` and `proxy` are declared-URL-only: the route never takes a URL from the request; only a declared entry, matched by name against the stored definition, is fetched. A URL the user supplies at setup cannot be declared — it is not known at publish time, it belongs to the user rather than the publisher, and baking it into the definition would make every URL change look like a catalog update. So a generic live feed needs a shell mechanism to fetch a user-supplied URL at runtime. This change adds the app and that mechanism, spec only.

## Proposed change

- New catalog app `generic-rss-feed` (id proposed; flagged for review), modelled on XKCD/News for the reader UI and on `generic-feed` for the setup prompt. One state field, `feedUrl`, set by the user or their agent through a `set_feed_url` action; empty state carries a Help-style prompt to supply the RSS URL. Viewer: newest first, Previous/Next, device-local dates, escape-first linkify — the existing feed-viewer pattern.
- New shell route `GET /user-feed/<app>` (see design.md, Decision 1). It takes only the app id from the request and reads the feed URL from that app's stored state; it never takes a URL from the request. The URL is validated at write time and again at serve time (bare HTTPS, no credentials), fetched with the declared-feed machinery (8 s timeout, 64 KiB cap, 1 h TTL, server-side cache with stale fallback), and the app declares no `feeds`/`proxy` capability — so the Store discloses no publisher host. The trust decision is the user's own: they supplied the URL.
- Catalog placement follows the catalog-restructure model: `pkg/catalog/generic-rss-feed/` with `definition.json` + `RECIPE.md`, generated index entry, no `installMode` (absent = `json`: it needs setup — the URL; the recipe fully configures it; unattended install lands unconfigured with the built-in prompt; any app can be installed via its recipe).
- `generic-feed` (push) is unchanged. Its RSS-URL setup prompt stays as-is (recommendation; flagged as a decision for the user).

## Scope

In scope: the new app, the user-feed route, the recipe, bundle and route tests, spec deltas.

Out of scope: changing `generic-feed` or `daily-feed`; changing the `feeds`/`proxy` capabilities for declared URLs, except that the new route reuses their fetch/cache helpers; the out-of-pkg catalog move; anything public; any Kody publish.

## Open questions

- App id: `generic-rss-feed` (proposed) — alternatives `rss-feed`, `live-rss-feed`? Flagged for review.
- Route name: `GET /user-feed/<app>` (proposed) — alternative `GET /feed/<app>/rss`. Flagged for review at implementation.
- `generic-feed`'s RSS-URL setup prompt stays as-is (recommendation) or is simplified now that a live app exists — decision for the user.
- Sequencing with the catalog-restructure commit (`b548aca`, MINOR 2.8.0) and with `help-about-built-in` (committed in `c5d10d4`; reverted `app-store` to `json` and removed Help/About from the catalog): both touch the same canonical scenarios this change modifies. Both have landed, so the counts and install-mode list are settled: 19 apps with this change; no app reports `recipe-only`, all 19 report `json`. See design.md, Decision 7.

## Risks

- The new route is a second fetch path; if its validation or caching diverges from `serveFeed`, the two paths drift. Mitigation: the spec requires it to reuse the existing fetch/cache helpers and limits, and the route test covers the same cases (hit / miss / stale / 502).
- A user-supplied URL is fetched server-side, so a hostile or mistaken URL could point at an internal or oversized resource. Mitigation: bare-HTTPS-only validation at write and serve time, 8 s timeout, 64 KiB cap, no credentials — the same limits as declared entries.

## Success criteria

- `openspec validate generic-rss-feed --type change` reports valid.
- The change, once implemented, installs from the catalog unattended, lands unconfigured with the setup prompt, and after the recipe runs shows the latest entry of the user's feed with Previous/Next.
- The catalog harness covers the new app; the route is tested with a stubbed fetch and a fixture feed, with no live network dependency in tests.
