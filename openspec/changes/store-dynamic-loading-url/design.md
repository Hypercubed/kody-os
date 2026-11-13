# Design: store-dynamic-loading-url

## Context

The Store bundle (`catalog/app-store/`) renders its
loading line from a `catalogSourceUrl` variable. That
variable is seeded by scraping the static
`.store-status` text in `index.html`, which hardcodes
the catalog URL at the pin that was current when the
Store was written (`4.2.0`). After the rows response
arrives, the bundle corrects the URL from the rows'
folder URLs (`catalogUrlFromRows`), so the text is
right from the second load in a session onward — but
the first paint on every open names the old pin, and
the static text must be hand-updated on every pin
move. The self-update section's "Catalog source:"
link uses the same variable, so it is stale in the
same window.

The shell knows both bases on every rows call
(`resolveManagedBases` in `pkg/src/apps/registry.ts`
yields the discovery base, `main`, and the listing
base, the `4.2` tag), and each row already carries a
`folderUrl` in tree-URL form
(`folderUrlForBase`). The bundle has no way to ask
for the bases before rows, because `rows` is the only
read the management API offers.

## Decisions

### 1. New `info` management action

The shell SHALL expose `GET /manage/info?app=app-store`
under the same permission rule as `rows`: the acting
app must declare `manageApps` in its stored
definition, or the response is the feed-style plain
404 with no detail. The response is
`{ ok: true, listingUrl, discoveryUrl, discoveryRef, pinnedLabel }`:

- `listingUrl`: the display URL of the catalog
  directory the apps list is read from — the listing
  base, or the discovery base when no separate
  listing base is declared. GitHub raw bases render
  in tree form
  (`https://github.com/<owner>/<repo>/tree/<ref>/<tail>`,
  no trailing slash, via `folderUrlForBase` with an
  empty id); non-GitHub bases render as the base URL
  itself.
- `discoveryUrl`: the display URL of the discovery
  base, or null when the Store declares no catalog
  source.
- `discoveryRef` / `pinnedLabel`: the existing
  labels from `StoreSelfUpdate` (the discovery ref,
  e.g. `main`; the listing tag label, e.g. `4.2`).

`info` performs no upstream fetch: it resolves the
declared bases locally. It is cheap enough to call
before every rows load, and it cannot fail on GitHub
staleness — it never contacts GitHub.

### 2. The bundle asks first, then loads rows

`load()` SHALL call `info` first, then `rows`:

- On `info` success, the bundle sets
  `catalogSourceUrl` to `listingUrl` and the loading
  text reads "Loading apps from \<listingUrl\>…"
  while rows load. After rows, the URL is refreshed
  from the rows' folder URLs as today, so the two
  sources agree and either may correct the other.
- On `info` failure — an older shell has no `info`
  action and answers plain 404 — the bundle proceeds
  exactly as today: generic loading text, corrected
  from folder URLs after the first load. The new
  Store works against an old shell; the old Store
  ignores the new action. No version gate is needed,
  and the Store's `minPackageVersion` stays `4.2.0`.

The static text in `index.html` becomes
"Loading apps…" with no URL, so the first paint can
never name a stale base. The seed scrape (the regex
over `.store-status`) is removed with it: the URL
comes from `info` or from rows, never from static
text.

### 3. The loading line names the listing URL

The loading text names the listing (tag) URL because
the apps list comes from there. The discovery (main)
URL is named in the self-update section ("Latest App
Catalog vX from main"), not in the loading line.

Recorded order, corrected: inside the single rows
call the shell reads the listing manifest (tag)
first, then the Store definition from main
(self-update). A phased main-then-tag loading text
would need the rows call split so the bundle could
observe the phases; that is out of scope (Decision
5).

### 4. Versions

- Shell: new management action, nothing existing
  breaks — MINOR under the version policy:
  `4.2.1` → `4.3.0`, build `48` → `49`.
  `pkg/AGENTS.md` and `pkg/README.md` headers state
  the new version in the same commit.
- Store: the bundle changes, so its `catalogVersion`
  goes `30` → `31` (one +1 for the definition
  change). `minPackageVersion` stays `4.2.0`
  (Decision 2 fallback). The catalog index is
  regenerated, never hand-edited.

### 5. Considered and rejected

- **Split the rows call so the text can phase
  main-then-tag.** Rejected: it doubles the
  management calls and duplicates the self-update
  fetch (once in the split call, once in rows) for
  a loading string. The loading line names one
  source — the listing — and the self-update section
  already names main.
- **Have the shell substitute the URL into the
  bundle HTML at serve time.** Rejected: bundles
  are served as stored, and templating them would
  be a new shell behavior with its own cache and
  escaping questions, for the same one line.
- **Keep the hardcoded URL and update it on every
  pin move.** Rejected: that is the chore this
  change removes. The static text is the defect.
- **Cache the last-known URL in the bundle
  (localStorage) for the first paint.** Rejected:
  a cached URL is stale in exactly the window that
  matters — right after a pin move — and would
  reintroduce the lie in a harder-to-spot form.

## Failure modes

- `info` on an old shell answers plain 404; the
  bundle falls back to today's behavior. No error
  is shown for the `info` failure itself — the rows
  load is what the user is waiting on, and it
  proceeds.
- `info` succeeds but rows fail: the loading text
  already named the real listing URL, and the rows
  error renders as today with Retry.
- A Store declaring no catalog source gets
  `listingUrl: null, discoveryUrl: null`; the bundle
  shows the generic loading text, as today.
- The `info` URLs are display-only. The bundle
  never fetches the catalog directly; rows still
  come through the shell management API.
