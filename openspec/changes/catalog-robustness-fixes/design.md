# Design: Catalog robustness fixes (code-review C5–C16)

## Decisions

### Decision 1 — C5: Remove stays available on gated installed rows

The Store row gate branch today suppresses **all** controls, not just install/update. An installed app whose catalog entry later raises `minPackageVersion` (so the update path refuses) then shows the "Requires shell…" note with **no Remove button** — the user must ask an agent to remove it. `index.html` already tells users "For any other app, ask an agent to remove it", so there is a fallback, but it is a UX regression vs. an up-to-date row.

The gate branch keeps suppressing Install and Update controls on an incompatible row, but a row for an **installed** app keeps its Remove control. Removal does not depend on the catalog (it deletes the installed definition, state, snapshot, and references), so there is no reason to gate it. The Store row for a gated installed app shows the requirement note **and** Remove. `safeUpdatable()` / `updateAllNow()` still skip gated rows (Remove is not an update).

Cleanup note (2026-11-11): narrowed — the Store's own self-update section already renders Remove for a gated Store (`catalog/app-store/store.js` `renderSelf`); the still-open part is list rows, which still render no control for a gated installed row (the gate branch short-circuits the control chain).

### Decision 2 — C6: Update gets the same `catalogBase` treatment as install

`install_from_catalog` and `store_install_from_catalog` accept optional `catalogBase` and resolve via `resolveAgentCatalogBase` (explicit > override > installed Store). `store_update_from_catalog` also accepts it. But agent `update_from_catalog(id, store?)` uses only `installedStoreCatalogBase(active)` — so with no Store installed it refuses with "no catalog source" **even when `KODY_CATALOG_BASE` is set** (the fetch layer would have honored the override, but the registry refuses before ever reaching it). Same pre-emption in `manage_rows`: an acting Store that declares no catalog gets installed-only rows, even with the override set.

`update_from_catalog` gains the same optional `catalogBase` parameter and the same `resolveAgentCatalogBase` treatment as the install functions. The `manage_rows` refusal point is left as-is for this change (the acting Store's declared base is the source for the management API; the override is a fetch-layer/dev concern, and C1 in handoff 13 settles where the override is consulted) — the spec records the asymmetry rather than changing it here.

Cleanup note (2026-11-11): the manage_rows note is stale — Phase 1's `resolveManagedBase` (`pkg/src/apps/registry.ts:873`) consults the dev override first, and `resolveAgentCatalogBase` (`registry.ts:919`) consults it when no explicit base is given, so the override half is fixed. The open part is the explicit `catalogBase` parameter on `update_from_catalog` (`registry.ts:1005`) and forwarding `input.base` from `pkg/scripts/catalog.ts` (which still declares `base?: string` and calls `update_from_catalog(input.id, undefined)`).

`pkg/scripts/catalog.ts`: the `update` Input variant declares `base?: string`, but the code calls `update_from_catalog(input.id, undefined)` — the base is never passed, so a caller passing `base` to `update` gets no error and no effect. Once `update_from_catalog` accepts `catalogBase`, the script forwards `input.base` the same way `install` does. If the script cannot forward it (signature mismatch), the `base` field is dropped from the `update` Input variant instead — never silently ignored.

### Decision 3 — C7: Fetch failures carry a typed error, not `null`

`get_catalog_definition` / `get_catalog_entry` / `get_catalog_recipe` swallow *every* failure (refused base, manifest fetch failure, malformed definition, bundle-file failure) into `null`, and the registry maps all of it to `'unknown catalog app "' + id + '"'`. A catalog outage or a malformed entry therefore looks exactly like a wrong id — no retry signal for agents, wrong message for users. Same masking in `get_app_status`: a transient manifest failure yields `catalogEntry === null` → installed catalog apps report `inCatalog: false` / `storage-only`, so `manage_update` refuses with "not an installed catalog app" instead of a catalog error. (`list_catalog` / `readCatalogManifest` do throw — the null-swallowers are inconsistent with them.)

The fetch layer threads a typed error out (a `{ def, error }` result, or a thrown typed error — the implementer picks the shape that fits the module) distinguishing at least three cases: **refused base** (the base failed validation), **fetch failed** (manifest/definition/recipe fetch or validation failed), and **unknown id** (the manifest has no such entry). The registry surfaces the right error in install/update/status: a refused base names the base problem; a fetch failure names the catalog as unreachable (and is retryable); only a genuinely absent id says "unknown catalog app". `get_app_status` distinguishes a transient catalog failure (status reports the catalog as unreachable, not `storage-only`) from a genuinely absent catalog entry.

### Decision 4 — C8: Verify the fetched definition against its manifest fingerprint

`fetchDefinitionJson` checks only `def.id !== entry.id`; the registry install path does no fingerprint comparison. The manifest carries `fingerprint` per entry and the Store compares installed-vs-manifest fingerprints for status — but nothing verifies the fetched `definition.json` matches the manifest fingerprint before install. A stale/mismatched publish installs fine, then the row shows `catalog-differing` forever with no clear cause. (The old `catalog.ts` also never verified — a gap carried forward, not a regression — but the remote fetch is exactly where the check belongs.) Related: `get_catalog_definition` ignores the manifest's `bundleFiles` whitelist entirely — the definition's own `bundle.files` list is what's fetched.

`get_catalog_definition` (or the install path — the implementer picks the layer) compares `fingerprintDefinition(def)` to `entry.fingerprint` and refuses on mismatch, with an error naming the app and that the fetched definition does not match the manifest. The check runs before any write. As defense-in-depth, the fetched bundle files are also cross-checked against the manifest entry's `bundleFiles` whitelist (the definition's own `bundle.files` list is not trusted alone). Installs remain backstopped by `validateBundleManifest` (extension whitelist, `index.html` required, duplicate rejection, 256 KiB byte cap).

### Decision 5 — C9: Guard the floor gate against a null/non-object definition

`add_app(null)` now throws a synchronous `TypeError`: the floor gate dereferences `definition.schemaVersion` before validation, but `validateDefinition` is null-safe (`if (!isRecord(def)) return 'definition must be an object'`). Previously `add_app(null)` returned `{ ok: false }`. No in-repo caller passes null (all catalog paths null-check first), so this only bites a direct agent/JS caller — but it breaks the function's documented "failed call writes nothing / returns `{ ok: false }`" contract. Also, the floor-gate error uses `definition.id` unvalidated, so an id-less schema-2 def reports `App "undefined"`.

The floor gate is guarded (`if (definition && typeof definition.schemaVersion === 'number' ...)`), or it is moved after `validateDefinition`'s record check while keeping the floor error priority for valid-shaped defs. Either way, `add_app(null)` and `add_app` with a non-object definition return `{ ok: false }` again, and the floor-gate error names the app id only when a valid id is present (otherwise it reports the definition as malformed).

### Decision 6 — C10: Check the no-source refusal before `get_app_status` in `manage_update_with_status`

When `useBase` is undefined, `get_app_status` was called with no base, so `inCatalog` is always false — the "not an installed catalog app" error fires first and the no-source branch is **unreachable**. (Contrast `manage_install`, where the same check *is* reachable because it only gates on `info.installed`.) No writes happen before either return, so this is a misleading-error bug, not a state bug.

The no-source refusal is checked **before** calling `get_app_status` in `manage_update_with_status` (or moved to the top of the function), so a caller with no catalog source gets the no-source error naming that no catalog source was given, not "not an installed catalog app".

### Decision 7 — C11: Correct the `useWhen` text for the raw listing tools

`pkg/src/index.ts` tool table says `list_catalog`: "Takes the catalog base URL; without one it uses the installed App Store's declared base (dev override applies)." / `get_catalog_definition`: "…(same fallback as list_catalog)." False. Both are the raw fetch functions, exported directly as agent tools (`pkg/src/index.ts:64,213`) with no wrapper injecting the Store base. Bare `list_catalog()` **throws** (`effectiveBaseFor(undefined)` → `normalizeCatalogBase` throws "catalog base must be a non-empty URL string", unless the dev override is set); bare `get_catalog_definition(id)` returns `null`. Only the registry functions (`install_from_catalog`, etc.) resolve the installed Store's base.

The `useWhen` strings are corrected: a bare call needs an explicit base (the dev override aside); the Store-base fallback lives in the install/update tools, not in the listing tools. The implementer may instead add a Store-base-resolving wrapper for the listing tools — but only if the wrapper is the smaller change and the `useWhen` text is updated to match whichever is true. Either way, the documented behavior and the actual behavior agree.

Cleanup note (2026-11-11): `install_from_catalog`'s `useWhen` was updated for Phase 1 (pinned listing base / discovery base); the two remaining stale strings are `list_catalog` and `get_catalog_definition`. The tool descriptions themselves are not rewritten here.

### Decision 8 — C12: `get_store_catalog_info` resolves the Store base from its `store` parameter

`get_store_catalog_info` ignores its `store` parameter (`void store`), and a bare call fails with "no catalog source given" even when a Store is installed — the tool cannot resolve the installed Store's base. It has no internal callers (only re-exported as an agent tool).

It resolves the Store base from `store` the same way `resolveAgentCatalogBase` does (explicit base > override > the named Store's declared base), or the dead `store` parameter is dropped. The implementer picks the smaller change; the tool's documented behavior and its actual behavior agree either way.

### Decision 9 — C13: Abort on timeout, enforce caps on bytes

The timeout only wins a `Promise.race` — the underlying fetch keeps downloading (no `AbortController`) — and the cap is checked only after `res.text()` fully buffers the body, measured in UTF-16 code units (`body.length`), not bytes, so a non-ASCII body can exceed the byte cap by ~2–3×. Cap values themselves are right (8000 ms; 64 KiB manifest / 512 KiB definition / 256 KiB bundle file / 64 KiB recipe — all call sites pass the right cap). A hostile catalog host could force large buffers before rejection.

The fetch is aborted on timeout (`AbortController`), and the cap is enforced on streamed bytes (or at least on `TextEncoder` byte length / `Content-Length`). The cap values and the per-payload caps do not change. A fetch that exceeds the cap is refused with the same cap error as today (only earlier, and on bytes).

### Decision 10 — C14: Derive `MIN_SUPPORTED_SCHEMA_VERSION` from `SUPPORTED_SCHEMA_VERSIONS`

`SUPPORTED_SCHEMA_VERSIONS = [3,4,5]`; `export var MIN_SUPPORTED_SCHEMA_VERSION = 3`. The comment says it is "the floor of `SUPPORTED_SCHEMA_VERSIONS`", but it is a separate hardcoded literal. If the list ever drops 3 or gains 2, the two diverge: the floor gate could refuse a schema `validateDefinition` would accept (or vice versa).

`MIN_SUPPORTED_SCHEMA_VERSION` is derived from the list (`Math.min.apply(null, SUPPORTED_SCHEMA_VERSIONS)`), or the list is defined from the constant. One source of truth; the value stays 3 today.

Cleanup note (2026-11-11): already true in code — verified at `pkg/src/apps/definition.ts:626`; task 4.1 is checked on that basis, and the requirement is synced to the canonical app-registry spec.

### Decision 11 — C15: Observe the `0.1.0` running-version fallback

`getRunningPackageVersion` mirrors `getPackageMeta` exactly — same `import('../../package.json', { with: { type: 'json' } })`, same `0.1.0` fallback, same permanently-cached promise — so no new drift *today* (package version is `4.2.0`; corrected 2026-11-11 — the design said `4.0.0`). But a bundler regression that stops inlining `package.json` would make every `minPackageVersion` install refuse with the confusing `requires package version X (running 0.1.0)`, and the cached promise makes a transient import failure permanent for the process. One latent divergence: `getPackageMeta` accepts any non-empty version string, while `getRunningPackageVersion` falls back to `0.1.0` for a non-`MAJOR.MINOR.PATCH` version — if the version ever became e.g. `4.0.0-beta`, the status bar and the gate would disagree.

At minimum the fallback is observed (logged) so a failed `package.json` import is visible instead of silent. The implementer may additionally surface "running version unknown" distinctly from "running 0.1.0" in the gate error — but only if that is the smaller change and the error still names the app, the required minimum, and the running version (or that it is unknown).

### Decision 12 — C16: The not-installed Store fallback becomes a copy-prompt

`pkg/src/app.ts`: the removed GET form is gone and the fallback now reads: "The App Store app is not installed. / Ask an agent to install it: follow catalog/app-store/RECIPE.md (the agent supplies the catalog source)." That names a repo-relative path with no copyable prompt and no link — a browser-only user with no repo access cannot act on it. Contrast `renderEmptyHelp` in `client.ts`, which gives a full copy-this-prompt block for the same install. Removing the one-tap path is the intended design; the fallback text is the issue.

The fallback becomes the same selectable `<code>` copy-prompt the empty-Help block gives (or a link to it), naming the install call with its catalog base, rather than a bare path. The fallback still offers no one-tap install (there is no catalog source to fetch from without one).

Cleanup note (2026-11-11): doubly stale — the fallback wording is also inconsistent with the v27 one-liner pattern (folder URLs + `OPERATIONS.md`) that replaced `RECIPE.md` links everywhere else (Help, Store rows). The fallback text itself is unchanged here (implementation, still open).

## Version decision

Deferred to publish. No install gate changes, no catalog-source model change, no MCP export removed/renamed/reshaped — the `update_from_catalog` `catalogBase` parameter is optional (additive), and the `get_store_catalog_info` `store` parameter is either used or dropped (its removal would be a reshaping — record it at commit time if the implementer drops it). The Store bundle changes (C5 Remove control, C16 fallback copy-prompt) bump the app-store `catalogVersion` by the +1 rule.
