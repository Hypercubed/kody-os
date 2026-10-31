# Tasks

## 1. Bundle

- [ ] 1.1 Author `pkg/catalog/news.bundle.json` (id `news`,
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
- [ ] 1.2 Declare the six feeds in `capabilities.feeds`
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

## 2. Verification

- [ ] 2.1 Verify every declared feed URL through the proxy
  before treating the bundle as done: each of the six HTTPS
  URLs must return parseable RSS via `GET /feed/news/<name>`
  (BBC HTTPS variants are assumed, not verified, at spec
  time — see Design decision 3). A section whose feed fails
  blocks that section; do not ship it empty and do not fall
  back to an `http://` URL.
- [ ] 2.2 Register the bundle in the catalog: one import line
  in `pkg/src/apps/catalog.ts` (alphabetical by id) plus one
  entry in `pkg/catalog/README.md`; verify the catalog harness
  passes (validate + install in a blank store + empty initial
  state + directory/import match) with no other catalog file
  changed
- [ ] 2.3 Prove the list in jsdom (harness outside `pkg/`,
  run with bun): World loads by default with the long-form
  date; each section loads its own feed and title and the
  active button is distinct; at most 10 items render; summaries
  are plain text truncated to 350 characters; feed-supplied
  HTML never reaches the DOM; a failed feed shows the error
  state with a working Retry; switching sections re-fetches
  and does not show the previous section as current
- [ ] 2.4 Run the ES2019 ceiling scan on the bundle script
  (zero hits for `?.`/`??`/`replaceAll`/`.at(`/template
  literals) plus the catalog harness green, and verify
  `openspec validate --changes` passes if the binary is
  available (otherwise check the change shape manually, as
  with other changes in this environment)
- [ ] 2.5 Apply the MINOR version bump in the same commit as
  the code per `pkg/AGENTS.md` (shared with the pending
  open-mode / agent-tools / calendar MINOR if they land
  together, not a second bump; `pkg/AGENTS.md` +
  `pkg/README.md` headers updated, BUILD +1 on publish)

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
