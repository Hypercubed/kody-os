# Tasks: client-side navigation for shell pages

## 1. BE: stable swap target

- [x] 1.1 Add `id="os-main"` to the `<main>` element in
      `shellChrome` (`pkg/src/app.ts`). This is the only BE change
      to the served HTML (one attribute). No route or content
      change.

## 2. FE: navigation enhancement

- [x] 2.1 In `pkg/src/client/index.ts`, add the navigation
      enhancement alongside the existing Store/Edit-toggle swaps:
      intercept clicks on same-origin links to Home (`/`) and Apps
      (`/apps`); fetch the target as HTML (`Accept: text/html`,
      `credentials: 'same-origin'`, `redirect: 'follow'`); parse
      with `DOMParser`; validate the fresh document (has `<main>`
      with content, has a `<title>`); swap the current
      `#os-main` innerHTML with the fresh one; then run the
      post-swap step (Decision 7): update `document.title` and
      the nav `aria-current` from the fresh document; `history.pushState` to the new URL;
      scroll to the top. Scripts in swapped HTML do not execute,
      so all behaviour stays in the persistent bundle. No seed
      adoption is implemented in this change (Home/Apps carry no
      seeds); the post-swap step is the hook where it would go if
      a future shell page carries seeds.
- [x] 2.2 Handle `popstate` (back/forward): fetch the URL and swap
      the same way. Ignore `popstate` events where only the
      fragment changed (let the browser handle fragment scrolling
      natively).
- [x] 2.3 Fall back to native navigation on any failure (fetch
      error, non-OK response, parse failure, missing `<main>`,
      cross-origin URL, missing `history.pushState`). The click
      handler does not `preventDefault()` until it has confirmed
      the URL is a same-origin shell-page link; on any error after
      that, set `window.location` to the target (a full load).
- [x] 2.4 Update the header comment in `index.ts` (it currently
      states "no client routing") to reflect that shell-page
      navigation is now client-side, with native fallback.

## 3. Docs

- [x] 3.1 Record the navigation behaviour in `pkg/AGENTS.md`
      (FE/BE boundary section) and in the adding-an-app SKILL.md's
      provided-surface section: the FE may navigate shell pages
      (Home, Apps) client-side; the BE still renders every page
      as a full HTML document; app pages stay full-load.
- [x] 3.2 Record the known limitation: if a future change adds a
      `form.app-action` to Home or Apps, the navigation code must
      re-run the app-action setup after a swap (Home/Apps
      currently carry no `app-action` forms, and their Edit/Store
      forms are document-delegated).

## 4. Spec delta

- [x] 4.1 Add the "Client-side navigation for shell pages"
      requirement to the shell spec delta
      (`specs/shell/spec.md` in this change), with scenarios for
      the swap, the title/`aria-current` update, `popstate`, and
      the native fallback.

## 5. Verification

- [x] 5.1 Typecheck clean (`cd pkg && bun run typecheck`,
      exit 0).
- [x] 5.2 New jsdom harness (`tests/client-nav.cjs`, run with
      node + `JSDOM_PATH`): Home → Apps swap (content, title,
      `aria-current`, `pushState`, no full navigation); `popstate`
      back to Home; fallback (fetch fails → native navigation).
      All checks pass.
- [x] 5.3 Existing harnesses green: counter-tests,
      link-drop-tests, link-drop-dom-tests, lit-isolation,
      catalog harness (19 apps), store harness. Record any
      failure and whether it is pre-existing (verify
      "pre-existing" on a clean checkout of the base before
      saying so).
- [ ] 5.4 `openspec validate` passes for this change.
- [x] 5.5 Version: MINOR by the package policy (new feature,
      nothing existing breaks). Target 4.4.0, assuming
      fe-be-separation (4.3.1) lands first; the exact number
      depends on merge order. The bump lands in the
      implementation commit, with `pkg/AGENTS.md` header updated
      in the same commit; build +1 on publish.
- [ ] 5.6 Scribe verification: navigate Home → Apps → Home on
      the Scribe and confirm the content swaps without a full
      reload (URL updates, title updates, no blank flash). This
      is a specific Scribe behaviour (the point of the change),
      so a verify-on-Scribe task is included.

## 6. Close-out

- [x] 6.1 Append a close-out note to this `tasks.md` recording
      what was verified, what was substituted, and what was left
      open, before archiving.

### Close-out note (2026-11-14, implemented in the VM on branch
### `client-side-navigation`, uncommitted)

- **Implemented.** BE: `id="os-main"` on `<main>` in `shellChrome`
  (`pkg/src/app.ts`) — the only BE change. FE: navigation
  enhancement in `pkg/src/client/index.ts` — intercepts
  same-origin clicks to Home/Apps (derived from
  `data-app-base`), fetches as HTML, parses with DOMParser,
  validates (has `<main>` with content, has a `<title>`), swaps
  `#os-main`, runs the post-swap step (title, nav `aria-current`
  synced by href, scroll to top), `history.pushState` (using the
  fetch's final URL), and handles `popstate` (back/forward fetches
  and swaps; a non-shell-page popstate reloads). Any failure falls
  back to a native navigation. App pages, Help, and About stay
  full-load. Header comment updated (no longer says "no client
  routing"). Docs: FE/BE boundary in `pkg/AGENTS.md` + a
  client-side navigation note in the adding-an-app SKILL.md.
  Version MINOR 4.3.1 → **4.4.0** (`pkg/package.json`,
  `pkg/AGENTS.md` header, `tests/store-harness.ts` expectation).
- **Research folded in (Nov 14).** Deep research recommended the
  custom router over a library (@lit-labs/router is ES2021 +
  URLPattern + Labs/prototyping; htmx/Turbo are the only credible
  alternatives and are wrong scope for two pages; Lit SSR is out
  of scope). Design Decision 7 (post-swap step) and the Risks
  were updated: scripts in swapped HTML do not execute, islands
  inside `<main>` are destroyed on swap (state must live in the
  bridge), `connectedCallback` must be idempotent (os-stepper
  already guards with `_cleared`). No seed adoption is
  implemented (Home/Apps carry no seeds); the post-swap step is
  the hook where it would go.
- **Verified (VM, 2026-11-14).** Typecheck clean (exit 0). New
  jsdom harness `tests/client-nav.cjs` (node + JSDOM_PATH, bundles
  `index.ts` with bun build, loads vendored Lit first): **19/19
  checks pass** — Home→Apps swap (content, title, aria-current,
  pushState URL), popstate back to Home, fetch-failure fallback
  (content unchanged, native navigation attempted), app-page
  links not intercepted, same-page click a no-op. Existing
  harnesses green: catalog (19 apps), store, counter-tests,
  link-drop-tests, link-drop-dom-tests, lit-isolation (6/6),
  isolation-demo. Two known pre-existing failures unchanged:
  hoodie-tests (external href) and home-widget-counter (ENOENT,
  stale catalog path) — both verified pre-existing on the base.
- **Left open.** 5.4 `openspec validate` NOT RUN (no openspec CLI
  on the VM; it lives on the PC, which is offline) — run on the
  PC before archiving. 5.6 Scribe verification NOT RUN (PC /
  be-quite-900 offline) — navigate Home → Apps → Home on the
  Scribe and confirm the swap without a full reload. The change
  is NOT committed, NOT pushed, and has NO PR yet — the user has
  not directed commit/push/PR. Note: the repo-root `AGENTS.md`
  modification in this working tree is the separate no-JS doc
  fix (uncommitted, pre-existing); it is NOT part of this change
  and must not be staged into its commit.
- **Branch/PR sequencing.** Builds on fe-be-separation (4.3.1,
  PR #3 open against shell-islands). Branch
  `client-side-navigation` is cut from fe-be-separation
  (5880a4d). Whether it merges into fe-be-separation or
  shell-islands depends on whether PR #3 has merged when this
  is ready.

### CodeRabbit review fixes (2026-11-14, PR #4, 7 comments — all addressed)

- **Home widgets (Major).** The claim "Home/Apps carry no bundles"
  was wrong — Home widgets DO render app bundles, and a swap would
  leave them unmounted (scripts in swapped HTML do not execute).
  Fixed: the navigation code now falls back to a native full load
  when the fresh `#os-main` contains a bundle section
  (`section[data-app-id]`) — design Decision 8. The SKILL.md
  statement is corrected. The Apps page carries no bundle sections,
  so it still swaps.
- **Stale navigation race (Major).** Clicking Apps then Home before
  the Apps response arrived would swap in the Apps content under
  the Home URL. Fixed: a navigation ownership token — each attempt
  takes an incrementing sequence number, stale responses/failures
  are ignored, and a same-page click cancels any pending navigation
  — design Decision 9.
- **pushState failure (Minor).** A `pushState` throw after the swap
  left the new content under the old URL. Fixed: the handler now
  does a native navigation to the requested URL — design
  Decision 10.
- **Harness VirtualConsole (Major).** The harness retried the
  (possibly absent) `jsdomPath` for `VirtualConsole` instead of
  using the resolved module, disabling navigation capture when
  jsdom fell back to `require('jsdom')`. Fixed: retain the resolved
  jsdom module and get both `JSDOM` and `VirtualConsole` from it.
- **Link-drop section (Minor, in shell-islands).** `ldSection()`
  ran at `DOMContentLoaded` when `document.currentScript` is null
  and fell back to the first `section[data-app-id]` on the page —
  Counter's section when Home orders Counter before Link Drop.
  Fixed: the owning section is captured during script evaluation
  (when `currentScript` is available) and `ldSection()` returns it.
  Link-drop `catalogVersion` 4 → 5, `catalog.json` regenerated.
- **Spec mount timing (Minor).** The canonical shell spec said
  both "Islands SHALL load at `DOMContentLoaded`" and that a bundle
  "reads its initial state from the seed without waiting for
  `DOMContentLoaded`". Fixed: the scenario now says the bundle reads
  the seed at mount (`DOMContentLoaded`), without scraping a span,
  and notes the seed is available from script time.
- **Lit fallback contradiction (Minor).** The SKILL.md said both
  that the shell provides `window.KodyLit` and that "Svelte and Lit
  are not provided by the shell as shipped". Fixed: Lit IS provided
  (`window.KodyLit`); Svelte is not.
- **Harness coverage.** `tests/client-nav.cjs` now has 25 checks
  (was 19): added widget fallback, stale-navigation discard, and
  pushState-failure fallback.

### CodeRabbit follow-up (2026-11-15, discussion_r4576578965 — 1 comment, addressed)

- **Pending Back navigation (Minor).** The token fix introduced an
  edge case: after Back from Apps to Home, the URL becomes Home
  immediately while Apps is still rendered and the Home fetch is
  pending. Clicking the Home link then was judged a same-page click
  by URL equality, cancelling the pending Home navigation and leaving
  Apps displayed under the Home URL. Fixed: the client tracks the
  rendered page (`renderedUrl`) separately from the URL and the
  in-flight target (`pendingUrl`). A click on a URL already being
  navigated to lets the pending navigation finish; a click on the
  rendered page cancels any pending navigation. Design Decision 9
  refined. Harness `tests/client-nav.cjs` now has 31 checks (was
  25): added test 9, a deferred popstate fetch with a Home click
  that must not cancel it.
