# Tasks

Fixes C5–C16 from the staged-tree code review (handoff 09 + 10 + 11 + 12). B1 and C1–C4 are fixed separately in handoff 13, not here. No task in this file commits, pushes, or publishes anything.

## 1. Store rows and update path (C5, C6, C16)

- [ ] 1.1 C5: Keep Remove available on a gated installed row. The gate branch in `catalog/app-store/store.js` keeps suppressing Install and Update controls on an incompatible row, but a row for an **installed** app keeps its Remove control. `safeUpdatable()` / `updateAllNow()` still skip gated rows. Verify: an installed app whose catalog entry raises `minPackageVersion` shows the requirement note **and** a Remove control; Update All still skips it; removing it works.
- [ ] 1.2 C6: Give agent `update_from_catalog(id, store?)` the same optional `catalogBase` parameter and the same `resolveAgentCatalogBase` treatment as the install functions, so it does not refuse with "no catalog source" when `KODY_CATALOG_BASE` is set and no Store is installed. Forward `input.base` from `pkg/scripts/catalog.ts` `update` the same way `install` does (or drop `base` from the `update` Input variant if it cannot be forwarded — never silently ignore it). Verify: update with an explicit base works with no Store installed; update with a base passed to the script works; the script's `update` no longer declares a field it ignores.
- [ ] 1.3 C16: Replace the not-installed Store fallback in `pkg/src/app.ts` with the same selectable `<code>` copy-prompt the empty-Help block (`renderEmptyHelp` in `client.ts`) gives, naming the install call with its catalog base. No one-tap install is added. Verify: the fallback renders a copyable prompt (jsdom or browser check); it names the catalog base.

## 2. Fetch errors, fingerprints, and caps (C7, C8, C13)

- [ ] 2.1 C7: Thread a typed error out of the fetch layer (`get_catalog_definition` / `get_catalog_entry` / `get_catalog_recipe`) distinguishing refused-base vs fetch-failed vs unknown-id, and surface the right error in install/update/status. `get_app_status` distinguishes a transient catalog failure (catalog unreachable, retryable) from a genuinely absent catalog entry (not `storage-only`). Verify: a refused base, a failed manifest fetch, and an unknown id each produce a distinct, correct error; a transient manifest failure does not report installed catalog apps as `storage-only`.
- [ ] 2.2 C8: Verify the fetched definition against its manifest fingerprint before install (compare `fingerprintDefinition(def)` to `entry.fingerprint`, refuse on mismatch naming the app), and cross-check the fetched bundle files against the manifest entry's `bundleFiles` whitelist. Verify: a definition whose fingerprint does not match its manifest entry is refused with nothing written; a matching definition installs.
- [ ] 2.3 C13: Abort the fetch on timeout (`AbortController`) and enforce the cap on streamed bytes (or at least on `TextEncoder` byte length / `Content-Length`). Cap values unchanged (8000 ms; 64 KiB manifest / 512 KiB definition / 256 KiB bundle file / 64 KiB recipe). Verify: a slow fetch is aborted (not just out-raced); a non-ASCII body over the byte cap is refused.

## 3. Null-safety, dead branches, and tool text (C9, C10, C11, C12)

- [ ] 3.1 C9: Guard the floor gate so `add_app(null)` and `add_app` with a non-object definition return `{ ok: false }` again instead of throwing a `TypeError`, and the floor-gate error names the app id only when a valid id is present. Verify: `add_app(null)` returns `{ ok: false }`; an id-less schema-2 def does not report `App "undefined"`.
- [ ] 3.2 C10: Check the no-source refusal **before** calling `get_app_status` in `manage_update_with_status` (or move it to the top of the function), so a caller with no catalog source gets the no-source error, not "not an installed catalog app". Verify: update with no catalog source returns the no-source error.
- [ ] 3.3 C11: Correct the `useWhen` text for `list_catalog` / `get_catalog_definition` in `pkg/src/index.ts` (a bare call needs an explicit base; the Store-base fallback lives in the install/update tools) — or add a Store-base-resolving wrapper for the listing tools and update the text to match. Verify: the documented behavior matches the actual behavior (bare `list_catalog()` throws without a base; bare `get_catalog_definition(id)` returns `null`).
- [ ] 3.4 C12: Make `get_store_catalog_info` resolve the Store base from its `store` parameter (like `resolveAgentCatalogBase`), or drop the dead `store` parameter. Record the choice; if the parameter is dropped, record it as an MCP export reshaping for the version decision. Verify: the tool works with a Store installed (or the parameter is gone and the tool's shape is updated).

## 4. Single source of truth and observability (C14, C15)

- [ ] 4.1 C14: Derive `MIN_SUPPORTED_SCHEMA_VERSION` from `SUPPORTED_SCHEMA_VERSIONS` (`Math.min.apply(null, SUPPORTED_SCHEMA_VERSIONS)`), or define the list from the constant. Value stays 3 today. Verify: the two cannot diverge (change the list in a test and confirm the floor follows, or assert the derivation in the harness).
- [ ] 4.2 C15: Observe (log) the `0.1.0` running-version fallback in `getRunningPackageVersion`, so a failed `package.json` import is visible instead of silent. Optionally surface "running version unknown" distinctly from "running 0.1.0" in the gate error if that is the smaller change. Verify: a failed `package.json` import produces a visible log/observation (not a silent `0.1.0`).

## 5. Verify and sync specs

- [ ] 5.1 Verify: catalog harness ALL PASSED (18 apps); store harness ALL PASSED (including new checks for C5 Remove-on-gated-installed-row, C6 update-with-base, C7 distinct errors, C8 fingerprint mismatch refused, C9 `add_app(null)`, C10 no-source error, C13 abort/byte-cap, C14 derivation); `bun build pkg/src/app.ts --target=browser --external 'kody:*'` succeeds; ES2019 scan clean. `kody execute --target mock` (server stopped) and jsdom where a live browser is not available; record any substitution with its reason, the same way handoffs 10/11/12 recorded theirs.
- [ ] 5.2 Sync the canonical specs: the app-registry and shell deltas in this change become canonical (see `specs/`). Record the version decision in the implementation commit (app-store `catalogVersion` +1 by the bundle-change rule; no MCP export removed/renamed/reshaped unless C12 drops the `store` parameter, in which case record it).
- [ ] 5.3 Archive with a close-out note recording what was verified, what was substituted, and what was left open.
