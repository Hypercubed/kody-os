# Proposal

## Why

The App Store's loading text names a catalog URL that is
hardcoded in the Store bundle's `index.html`
(`https://github.com/Hypercubed/kody-os/tree/4.2.0/catalog`).
The bundle seeds its `catalogSourceUrl` by scraping that
static text, so the loading line — and the self-update
section's "Catalog source:" link — both show the stale
pin until the rows response corrects them from the rows'
folder URLs. The pin moved to `4.2`, so the first thing
the Store says on every open is a URL that is no longer
the listing base. It corrects itself after the first
load, but the first paint is wrong, and the static text
has to be hand-updated on every pin move — the exact
chore the moving-tag model was meant to remove.

The bundle cannot learn the real URL before the rows
response today: the only management call is `rows`, and
the rows response is what carries the folder URLs. The
shell already knows both catalog bases (it resolves
them for every rows call); the bundle just cannot ask
for them.

## What Changes

- A new shell management action, `info`
  (`GET /manage/info?app=app-store`), under the same
  permission rule as `rows`: a bundle declaring
  `manageApps` gets the resolved catalog bases as
  display URLs; anything else gets the feed-style
  plain 404. The response carries the listing URL
  (where the apps list comes from) and the discovery
  URL (where the Store self-update reads from),
  plus the existing labels (`pinnedLabel`,
  `discoveryRef`). It performs no upstream fetch —
  it resolves the declared bases locally.
- The Store bundle fetches `info` first, then `rows`.
  While rows load, the loading text reads
  "Loading apps from \<listing URL\>…", using the
  real listing URL from `info`. The static text in
  `index.html` becomes "Loading apps…" — no URL, so
  it can never be stale. The self-update section's
  "Catalog source:" link uses the same URL.
- If `info` fails — an older shell has no `info`
  action and answers plain 404 — the bundle falls
  back to today's behavior: generic loading text,
  corrected from the rows' folder URLs after the
  first load. A new Store works against an old shell,
  and an old Store ignores the new action.

## What Does Not Change

- The rows call, the row statuses, the self-update
  section, and the manifest cache (30 s, in-memory)
  are unchanged. The shell still reads the listing
  (tag) first, then main (self-update), inside the
  single rows call; the bundle does not observe those
  phases, so the loading text names the listing URL
  — the source of the list — and the discovery URL
  stays named in the self-update section ("Latest
  App Catalog vX from main"), not in the loading line.
- A phased main-then-tag loading text would need the
  rows call split so the bundle could observe the
  phases. That is out of scope: it doubles the
  management calls for a loading string.
- No publish or release step is part of this change.
  The shell publish and the Store self-update are
  the user's call afterwards. The Store's
  `minPackageVersion` stays `4.2.0`: the bundle
  degrades gracefully on an older shell, so no gate
  is needed.
