# Tasks

> ARCHIVED 2026-10-30: implemented Oct 30, 2026 — `pkg/catalog/news.bundle.json` authored and registered (catalog harness green with 9 apps), all six declared feeds verified through the real `GET /feed/news/<name>` proxy route on `kody dev` (200 + parseable RSS, cache miss→hit, negatives 404; BBC HTTPS variants confirmed, so the spec's recorded open question is answered), `tests/news-list.cjs` 53/53 under bun, ceiling scan clean, catalog + Counter + calendar harnesses green, `openspec validate --changes` green for this change, version bumped to v1.1.0 build 16, and specs synced to `openspec/specs/news-app/spec.md`. Task 3.1 is out of scope by design (the cleaned in-app reader needs its own package-level design and security review) and is left unchecked — it carries over as a future change, not as unfinished work here. This archive commit changes no `pkg/` code.

## 1. Bundle

- [x] 1.1 Author `pkg/catalog/news.bundle.json` (id `news`,
  schemaVersion 5, `ui.title` News, `ui.actions` [], no `openAs`
  and no `placements`, `stateSchema` `{ type: "object", initial: {},
  fields: {} }`, `actions` {}, sanitized icon per the existing
  icon rules, user-facing description stating the app opens on
  World, shows at most 10 headlines per section, and opens
  articles at the source): bundle JavaScript renders a masthead,
  a device-local long-form date line, six section buttons
  (World, Technology, Business, Science, Arts, Finance), a
  section title, and a headline list; section switching
  re-fetches that section through `GET /feed/news/<name>` and
  parses the RSS XML in-page; each list item shows the headline
  (HTML-escaped), a plain-text summary truncated to 350
  characters, and a thumbnail only when the feed supplies one;
  tapping a headline opens the source article externally and
  the bundle never fetches article content; one inline
  `<style>`, inlined assets only, no external stylesheets or
  scripts, ES2019 script per `pkg/docs/scribe-limitations.md`
  DONE Oct 30, 2026: bundle authored (18,906-byte JSON, 15,917-byte
  entry: one inline `<style>`, one inline `<script>`, no `<link`, no
  `script src`), icon is a sanitized monochrome SVG (rect/line),
  description states opens-on-World / 10 headlines / articles open at
  the source. Ceiling scan clean; `tests/news-list.cjs` green.
- [x] 1.2 Declare the six feeds in `capabilities.feeds`
  (at most 8 allowed; 6 used), each `{ name, url, ttlSeconds:
  900, maxBytes: 65536 }` or the proxy defaults where a value
  is already the default: `world` →
  `https://feeds.bbci.co.uk/news/world/rss.xml`,
  `technology` →
  `https://feeds.bbci.co.uk/news/technology/rss.xml`,
  `business` →
  `https://feeds.bbci.co.uk/news/business/rss.xml`,
  `science` →
  `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml`,
  `arts` →
  `https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml`,
  `finance` →
  `https://www.cnbc.com/id/10000664/device/rss/rss.html`
  DONE Oct 30, 2026: six feeds declared in section order, all HTTPS,
  `ttlSeconds: 900`, `maxBytes: 65536` (largest live body is the
  business feed at 36,790 bytes, under the proxy cap).

## 2. Verification

- [x] 2.1 Verify every declared feed URL through the proxy
  before treating the bundle as done: each of the six HTTPS
  URLs must return parseable RSS via `GET /feed/news/<name>`
  (BBC HTTPS variants are assumed, not verified, at spec
  time — see Design decision 3). A section whose feed fails
  blocks that section; do not ship it empty and do not fall
  back to an `http://` URL.
  DONE Oct 30, 2026: verified through the real route on `kody dev
  --target mock` — `GET /feed/news/<name>` returned 200 with
  `application/rss+xml` and parseable RSS for all six (items:
  world 33, technology 21, business 50, science 42, arts 19, finance
  30), `x-feed-cache` went miss → hit on re-read, and an undeclared
  name plus an unknown app both 404. The BBC HTTPS variants serve RSS,
  so the spec's recorded open question is answered: no replacement
  source is needed and nothing falls back to `http://`.
- [x] 2.2 Register the bundle in the catalog: one import line
  in `pkg/src/apps/catalog.ts` (alphabetical by id) plus one
  entry in `pkg/catalog/README.md`; verify the catalog harness
  passes (validate + install in a blank store + empty initial
  state +  directory/import match) with no other catalog file changed
  DONE Oct 30, 2026: `news` import + `CATALOG` entry (alphabetical,
  before `probe`) plus one `pkg/catalog/README.md` line; catalog
  harness green with 9 apps; no other catalog file touched.
- [x] 2.3 Prove the list in jsdom (harness outside `pkg/`,
  run with bun): World loads by default with the long-form
  date; each section loads its own feed and title and the
  active button is distinct; at most 10 items render; summaries
  are plain text truncated to 350 characters; feed-supplied
  HTML never reaches the DOM; a failed feed shows the error
  state with a working Retry; switching sections re-fetches
  and does not show the previous section as current
  DONE Oct 30, 2026: `tests/news-list.cjs`, 53/53 PASS under `bun`.
  Also proved: headline links open with `target="_blank"` and no
  article fetch, session `k` rides on the feed request, an enclosure
  image renders while an image-less feed renders none, and the
  definition shape (six HTTPS feeds, 900s TTL, stateless, `ui.title`
  News). Environment note: jsdom had to be pinned to 24.x in
  `/tmp/jsdom-test` — jsdom 30 crashes inside bun while reporting a
  script error, which also breaks the pre-existing calendar harness.
- [x] 2.4 Run the ES2019 ceiling scan on the bundle script
  (zero hits for `?.`/`??`/`replaceAll`/`.at(`/template
  literals) plus the catalog harness green, and verify
  `openspec validate --changes` passes if the binary is
  available (otherwise check the change shape manually, as
  with other changes in this environment)
  DONE Oct 30, 2026: ceiling scan zero hits for `?.`/`??`/
  `replaceAll`/`.at(`/template literals; catalog, Counter, and
  calendar harnesses all green; `openspec validate --changes` reports
  `change/news-app` valid after correcting the spec header from
  `## NEW Requirements` to `## ADDED Requirements` (the installed CLI
  only accepts ADDED/MODIFIED/REMOVED/RENAMED). Four unrelated changes
  (auth-rethink, email-client, fixed-shell-scroll, remove-legacy-code)
  still fail validation for their own pre-existing reasons.
- [x] 2.5 Apply the MINOR version bump in the same commit as
  the code per `pkg/AGENTS.md` (shared with the pending
  open-mode / agent-tools / calendar MINOR if they land
  together, not a second bump;  `pkg/AGENTS.md` + `pkg/README.md` headers updated, BUILD +1 on
  publish)
  DONE Oct 30, 2026: `pkg/package.json` 1.0.1 → 1.1.0 (PATCH reset)
  with build 15 → 16, and the `pkg/AGENTS.md` / `pkg/README.md`
  headers now read v1.1.0. No separate bump is owed for calendar,
  open-mode, or agent-tools: open-mode and agent-tools shipped in
  v0.4.0 and calendar still carries no bump, so this MINOR covers
  the pending catalog-app bump as one release. Code and bump are in
  the working tree together so they land in one commit; BUILD moves
  with a version bump in this repo's release commits, and increments
  again at the next publish.

## 3. Explicitly out of scope (future change, not this one)

- [ ] 3.1 (NOT in this change) A shell reader route plus the
  cleaned, column-paginated article reader from the standalone
  spec (`~/workspace/your_files/news-app-clone-spec.md` §7–§8:
  title/byline/siteName, sanitised content, Previous/Next +
  tap/keyboard paging, "Page X of Y", 10–32 px persistent text
  size, timeout and unavailable states with a source fallback).
  That needs its own package-level design and security review
  for fetching arbitrary article URLs; it must not be added
  quietly to this bundle.
