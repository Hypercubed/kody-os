# Tasks

## 1. Capability declaration and runtime surface

- [ ] 1.1 Add `kody.app.capabilities` to
  `pkg/package.json`, listing exactly the email
  capabilities the routes call:
  `emailInboxList`, `emailMessageList`,
  `emailMessageSearch`, `emailMessageGet`,
  `emailAttachmentGet`, `emailMessageClassify`,
  `emailMessageDelete`, `emailReply`. Do NOT add
  `emailSend`, `emailDestination*`, or
  `emailSenderRule*` in this change.
- [ ] 1.2 Pin the fetch-handler runtime surface
  (design Open Question 1): with a throwaway
  route or `packageAppFetch` probe, prove whether
  `runtime.kody.emailMessageList` or the
  `runtime.email` object works inside the shell's
  fetch handler. Record the proven surface in
  `pkg/docs/email.md` and use that one surface
  only in `src/email.ts`.

## 2. Server module

- [ ] 2.1 Author `pkg/src/email.ts`, modelled on
  `pkg/src/feeds.ts` (server-side only, ES2019):
  list (metadata only, `limit` capped at 50,
  default 25, optional `inbox_id`, `direction`,
  `view`), search (list shape), get (metadata +
  body, truncated at 100,000 characters with a
  truncation flag), attachment bytes
  (`Content-Disposition: attachment`), classify
  (archive / unarchive / spam / not-spam /
  quarantine), delete (refused without
  `confirm=1`), and text-only reply (non-empty,
  capped at 50,000 characters, via `emailReply`).
  Log counts and errors only, never subjects,
  addresses, or bodies.
- [ ] 2.2 Sanitize bodies in the server module
  (do not trust the bundle to do it): prefer
  `text_body`, escaped and linkified; sanitize
  `html_body` through the feed renderer's
  allowlist with `<img>` dropped entirely and
  alt text kept as a caption. No script, style,
  iframe, form, svg, video, audio, or `on*`
  attribute survives, in either body path.
- [ ] 2.3 Enforce the per-app allowlist in the
  server module: every route resolves the `:app`
  slug, loads that app's stored definition, and
  requires `capabilities.email.view` for reads
  and `capabilities.email.act` for classify /
  delete / reply. Unknown app, unknown flag, or
  malformed slug returns the feed-style plain
  404, with no mail and no capability error
  detail.

## 3. Shell routes

- [ ] 3.1 Wire the routes in `pkg/src/app.ts`
  dispatch, after the `/apps/` branches and
  alongside the `/feed/` route, so they inherit
  the device gate in `fetch()`: `GET
  /email/:app/inboxes`, `GET
  /email/:app/messages`, `GET
  /email/:app/search`, `GET
  /email/:app/messages/:id`, `GET
  /email/:app/attachments/:id`, and GET-action
  routes on a message with `format=json`
  (`{ ok: true }` / `{ ok: false, error }`,
  `no-store`). No POST route is added for mail.
  Unknown email paths fall through to the
  existing 404 and cannot shadow an app page.
- [ ] 3.2 Verify the gate end to end: an
  unauthenticated request to any email route
  gets the locked page (never mail), and a
  request with a valid session or code gets the
  route. Record the result in the task notes;
  a synthetic `packageAppFetch` pass alone does
  not close this task.

## 4. Declaration and catalog app

- [ ] 4.1 Add `capabilities.email: { view:
  boolean, act: boolean }` to
  `pkg/src/apps/types.ts` (`AppCapabilities`,
  next to `feeds`) and validate it in
  `pkg/src/apps/registry.ts`: any other shape
  fails validation, and a definition with
  neither flag true is treated as not declaring
  email. Existing `feeds` declarations and
  validation are unchanged.
- [ ] 4.2 Author `pkg/catalog/email/definition.json`
  (plus `pkg/catalog/email/RECIPE.md`)
  (id `email`, schemaVersion 5, `stateSchema`
  `{ type: "object", initial: {}, fields: {} }`,
  `actions: {}`, no `act()` calls, no mail in
  state): list view (newest N, from / subject /
  date / classification), search box (server
  search route, not a client-side filter of the
  loaded list), detail view (sanitized body from
  the server, attachment list with download
  links), and in-page actions for archive,
  spam / not-spam, delete (two-step confirm),
  and text reply. App id for routes is resolved
  from `data-action-base` (xkcd pattern) with
  a `/apps/<id>` path fallback, never hardcoded.
  ES2019 script, one inline `<style>`, inlined
  assets only, zero external links, system
  fonts, high-contrast black-on-white, 48px
  minimum tap targets, icon per the existing
  icon rules.
- [ ] 4.3 Register the definition in the catalog:
  one import line in `pkg/src/apps/catalog.ts`
  (alphabetical by id), the generated index
  regenerated (`bun scripts/build-catalog-index.ts`),
  plus one entry in `pkg/catalog/README.md`;
  verify the catalog harness passes (validate +
  install in a blank store + empty initial
  state + directory / import match) with no
  other catalog file changed.

## 5. Docs

- [ ] 5.1 Write `pkg/docs/email.md`: the
  capability list, the route table, the
  view/act declaration, the gate and runs-as
  model, the sanitization and truncation rules,
  the GET-mutation rule, and the out-of-scope
  list (compose, destinations, sender rules,
  subscriptions, caching).
- [ ] 5.2 Add a `capabilities.email` row to
  `pkg/.agents/skills/adding-an-app/SKILL.md`, next to the
  `capabilities.feeds` row, and update the
  "Adding an app" capability paragraph in
  `pkg/AGENTS.md` to name email as the second
  generic capability (this rides with the MINOR
  bump, not as a separate docs commit).

## 6. Verification

- [ ] 6.1 Prove the bundle in jsdom (harness
  outside `pkg/`): list renders metadata rows
  from a fixture route response; detail renders
  escaped text and sanitized HTML with images
  dropped; delete without the confirm step is
  never requested; reply sends text only; no
  navigation, no POST, and no `act()` call
  occurs in any flow.
- [ ] 6.2 Run the ES2019 ceiling scan on the
  bundle script (zero hits for `?.` / `??` /
  `replaceAll` / `.at(` / template literals),
  the catalog harness, and the Counter harness
  green.
- [ ] 6.3 Smoke-test the published routes with
  `packageAppFetch` (list, get, search, and one
  mutation against seeded or real platform
  mail, plus the 404 cases: unknown app, app
  without the declaration, app with `view`
  only calling an `act` route), and confirm
  design Open Questions 4 (list order and
  `limit` behavior) and 5 (`emailMessageSearch`
  exists as a callable capability) from the
  observed results.
- [ ] 6.4 Verify `openspec validate --changes`
  passes if the binary is available (otherwise
  check the change shape manually, as with
  other changes in this environment: proposal,
  design, tasks, and spec deltas present and
  internally consistent).

## 7. Version and publish

- [ ] 7.1 Apply the MINOR version bump in the
  same commit as the code per `pkg/AGENTS.md`
  (BUILD +1 on publish; `pkg/AGENTS.md` +
  `pkg/README.md` headers updated to the new
  version in that commit). Do not commit,
  push, or publish this change without the
  user's explicit direction for that step, and
  do not approve any Kody capability
  re-approval on the owner's behalf.
