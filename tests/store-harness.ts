/**
 * App-store harness (registry + render, no HTTP). Run with bun from the repo root:
 *
 *   bun tests/store-harness.ts
 *
 * Proves, against fresh in-memory stores, the parts of the data-only
 * App Store change that do not need a live shell fetch (kody dev /
 * hosted):
 *   Empty installed list (empty-install): a blank store installs nothing
 *     on its own; removing the last app leaves it empty, no re-seed.
 *     The Store appears only through an explicit install.
 *   Empty states (empty-install + mini-apps-user-facing): the shared
 *     empty-help block and the two Home empty states render the
 *     app prompts, and the empty-page prompt agrees with Help's.
 *   Store install: unknown id fails with no write; a store install
 *     writes a snapshot, reports up-to-date, and adds no pin,
 *     homepage, hidden, or recency entry.
 *   Snapshots: a generic add_app after a store install does NOT move
 *     the snapshot, so a tampered app reports modified-current.
 *   Store update: restores the catalog definition, preserves state
 *     for surviving fields, replaces the snapshot, and leaves pins
 *     untouched.
 *   minPackageVersion gate: malformed minima fail validation with the
 *     exact message; a minimum newer than the running shell refuses
 *     naming the app, the minimum, and the running version; an equal
 *     or older minimum installs; an update raising the minimum is
 *     refused with the installed definition byte-identical; the
 *     fingerprint covers the minimum.
 *   Snapshot-less: a catalog app installed via generic add_app claims
 *     no status, but the Store offers a confirmed Overwrite for it
 *     (the management API requires confirmation first, then records
 *     a snapshot, so the app becomes managed).
 *   Storage-only: a custom app (no catalog entry) gets a Storage
 *     only status, no Install/Update/Restore through the management API,
 *     and no row in the Store list at all.
 *   Management API: rows are the catalog apps only, alphabetical,
 *     with capabilities disclosed (including theme flags); an undeclared caller is
 *     permission-denied; a modified restore requires confirmation
 *     and applies on confirm.
 *   Management remove: an undeclared caller is permission-denied;
 *     removal requires confirmation and then deletes the definition,
 *     state, and snapshot and scrubs pins.
 *   List shape (store-list-shape): a bare-array list() result normalizes to the documented envelope (prefix filter, key order, client-side pagination, envelope pass-through, unrecognized shape fails loudly); listInstalledIds enumerates the same ids through either shape.
 *   Split bases (compatible-catalog Phase 1): a Store with both proxy
 *     entries routes ordinary rows, installs, and updates through the
 *     listing base (catalog-apps, pinned to a tag) and its own update
 *     through the discovery base (catalog, main); a Store with only the
 *     catalog entry reads that base throughout; a newer Store on the
 *     discovery base whose minimum exceeds the running shell refuses
 *     the self-update and reports the requirement instead.
 *   Absorb (store-row-agent-prompts): a modified-current or
 *     behind-modified app absorbs through absorb_from_catalog and
 *     then reads absorbed with its snapshot carrying the catalog
 *     fingerprint; a moved catalog reads absorbed-behind and absorbs
 *     again; plain Update and Restore are refused for absorbed rows;
 *     refusals (up-to-date, mismatched catalogVersion, snapshot-less)
 *     write nothing. Throwaway catalog copies B and C serve the moved
 *     catalogs on fresh loopback bases.
 *   Edit render: Apps Edit lists every installed app including
 *     hidden ones, with Pin/Hide/Home as plain GET forms only —
 *     no Open link to an app page, no app-action class, no POST form.
 *     Hidden apps still appear, with an Unhide control.
 *
 * NOT covered here on purpose: the HTTP dispatch leg (JSON responses,
 * plain 404s for undeclared callers) — that needs `kody dev` (mock)
 * or a hosted fetch, which this environment does not have (no kody
 * CLI). The dispatch code paths call exactly the functions proven
 * here, in the order shown in pkg/src/app.ts. The bundle's own
 * rendering and confirmation UI are covered by
 * catalog/tests/app-store-tests.cjs (jsdom, mocked fetch).
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped code.
 */
import { absorb_from_catalog, act, add_app, assembleBundleFiles, capabilityAdditions, catalogGitHubRef, catalogTagLabel, createMemoryStore, fingerprintDefinition, get_app, get_app_state, get_app_status, get_catalog_definition, get_catalog_entry, get_catalog_source, get_hidden, get_homepage, get_launcher_state, get_pinned, getRunningPackageVersion, get_store_rows, install_from_catalog, list_apps, list_catalog, listInstalledIds, manage_install, manage_remove, manage_restore, manage_rows, manage_update, MIN_SUPPORTED_SCHEMA_VERSION, normalizeCatalogBase, normalizeListResult, packageRefForHost, readCatalogManifest, readInstallSnapshot, remove_app, renderAllSection, renderAppPanel, renderAppSection, renderBundleContent, renderDashboard, renderEditSection, renderEmptyHelp, renderHomeTiles, set_hide, set_pin, store_install_from_catalog, store_update_from_catalog, SUPPORTED_SCHEMA_VERSIONS, update_from_catalog, validateCatalogDefinition } from '../pkg/src/apps/index.ts'
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

// Local catalog override for the remote module: serve the working-tree
// catalog/ over loopback http so the fetch code path is identical to
// production and only the base URL differs.
var __root = join(dirname(fileURLToPath(import.meta.url)), '..')
var __catalogDir = join(__root, 'catalog')
var __http = await import('node:http')
var __server = __http.createServer(function (req, res) {
  try {
    var url = new URL(req.url || '/', 'http://127.0.0.1')
    var pathname = decodeURIComponent(url.pathname)
    if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
    var rel = pathname.replace(/^\//, '')
    var full = join(__catalogDir, rel)
    if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
    res.statusCode = 200
    res.end(readFileSync(full, 'utf8'))
  } catch (err) { res.statusCode = 500; res.end('error') }
})
await new Promise<void>(function (resolve) { __server.listen(0, '127.0.0.1', function () { resolve() }) })
var __addr = __server.address() as unknown as { port: number }
;(globalThis as unknown as Record<string, unknown>)['KODY_CATALOG_BASE'] = 'http://127.0.0.1:' + String(__addr.port) + '/'
var BASE = 'http://127.0.0.1:' + String(__addr.port) + '/'
try { (__server as unknown as { unref?: () => void }).unref?.() } catch (err) {}


var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T
}

/** Install steps named by install_from_catalog('id'), in recipe order. */
function installSteps(text: string): string[] {
	var steps: string[] = []
	var pattern = /install_from_catalog\('([a-z0-9][a-z0-9-]{0,63})'\)/g
	var match: RegExpExecArray | null
	while ((match = pattern.exec(text)) !== null) steps.push(match[1])
	return steps
}

// Empty installed list stays empty (empty-install): a blank store installs
// nothing on its own; the Store appears only through an explicit
// install; removing the last app leaves the installed list empty, no re-seed.
{
	var store = createMemoryStore()
	var blankApps = await list_apps(store)
	check('blank store starts empty', blankApps.length === 0, blankApps.map(function (a) { return a.id }).join(','))
	var blankSnap = await readInstallSnapshot(store, 'app-store')
	check('blank store has no app-store snapshot', blankSnap === null, JSON.stringify(blankSnap))
	var storeCatalogVersion = (await get_catalog_definition('app-store', BASE) as { catalogVersion?: number }).catalogVersion
	var installed = await store_install_from_catalog('app-store', store, BASE)
	check('explicit store install succeeds', installed.ok === true, JSON.stringify(installed))
	var apps = await list_apps(store)
	check('explicit install installs only app-store', apps.length === 1 && apps[0].id === 'app-store', apps.map(function (a) { return a.id }).join(','))
	var snap = await readInstallSnapshot(store, 'app-store')
	check('explicit store install writes app-store snapshot', snap !== null && snap.catalogVersion === storeCatalogVersion, JSON.stringify(snap))
	var nonEmpty = createMemoryStore()
	await add_app(clone(await get_catalog_definition('counter', BASE)) as never, nonEmpty)
	var nonEmptyApps = await list_apps(nonEmpty)
	check('a non-empty store is untouched without an install call', nonEmptyApps.length === 1 && nonEmptyApps[0].id === 'counter', nonEmptyApps.map(function (a) { return a.id }).join(','))
	await remove_app('app-store', store)
	var afterRemove = await list_apps(store)
	check('removing the last app leaves the installed list empty', afterRemove.length === 0, afterRemove.map(function (a) { return a.id }).join(','))
	var snapAfterRemove = await readInstallSnapshot(store, 'app-store')
	check('removing the last app deletes its snapshot', snapAfterRemove === null, JSON.stringify(snapAfterRemove))
	// Same, via the Store management API with confirmation (tasks 3.1).
	await store_install_from_catalog('app-store', store, BASE)
	var mgmtRemoved = await manage_remove('app-store', 'app-store', true, store)
	check('management remove of the last app applies on confirm', mgmtRemoved.ok === true, JSON.stringify(mgmtRemoved))
	var afterMgmtRemove = await list_apps(store)
	check('management remove of the last app leaves the installed list empty', afterMgmtRemove.length === 0, afterMgmtRemove.map(function (a) { return a.id }).join(','))
}

// Store install: unknown fails clean, clean install snapshots, no launcher side effects.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store, BASE)
	var unknown = await store_install_from_catalog('no-such-app', store, BASE)
	var afterUnknown = await list_apps(store)
	check('store install unknown id fails with no write', !unknown.ok && afterUnknown.length === 1, JSON.stringify(unknown))
	var installed = await store_install_from_catalog('counter', store, BASE)
	check('store install counter succeeds', installed.ok === true, JSON.stringify(installed))
	var status = await get_app_status('counter', store, BASE)
	check('store-installed counter is up-to-date', status.status === 'up-to-date', status.status)
	var pins = await get_pinned(store)
	var home = await get_homepage(store)
	var hidden = await get_hidden(store)
	var launcher = await get_launcher_state(store)
	check('store install adds no launcher entries', pins.length === 0 && home.length === 0 && hidden.length === 0 && launcher.recent.length === 0, JSON.stringify({ pins: pins, home: home, hidden: hidden, recent: launcher.recent }))
}

// Snapshot discipline + store update + render controls.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store, BASE)
	await store_install_from_catalog('counter', store, BASE)
	await act('counter', 'set_count', { value: 7 }, store)
	await set_pin('counter', true, store)
	var snapBefore = await readInstallSnapshot(store, 'counter')
	var catalogDef = await get_catalog_definition('counter', BASE) as never
	var tampered = clone(catalogDef) as { description: string }
	tampered.description = 'tampered by test'
	await add_app(tampered as never, store)
	var snapAfterTamper = await readInstallSnapshot(store, 'counter')
	check('generic re-add does not move snapshot', snapAfterTamper !== null && snapBefore !== null && snapAfterTamper.fingerprint === snapBefore.fingerprint, JSON.stringify(snapAfterTamper))
	var tamperedStatus = await get_app_status('counter', store, BASE)
	check('tampered counter is modified-current', tamperedStatus.status === 'modified-current', tamperedStatus.status)
	var manageRows = await manage_rows('app-store', store)
	check('management rows are permission-gated to the Store', manageRows.ok === true, JSON.stringify(manageRows))
	var deniedRows = await manage_rows('counter', store)
	check('management rows deny an undeclared caller', deniedRows.ok === false && (deniedRows as { permissionDenied?: boolean }).permissionDenied === true, JSON.stringify(deniedRows))
	var restoreNo = await manage_restore('app-store', 'counter', false, store)
	check('modified-current restore requires confirmation', restoreNo.ok === false && (restoreNo as { needsConfirmation?: boolean }).needsConfirmation === true, JSON.stringify(restoreNo))
	var updated = await store_update_from_catalog('counter', store, BASE)
	check('store update succeeds', updated.ok === true, JSON.stringify(updated))
	var entryState = await import('../pkg/src/apps/index.ts').then(function (m) { return m.get_app_state('counter', store) })
	check('store update preserves state', (entryState as { count: number }).count === 7, JSON.stringify(entryState))
	var restoredStatus = await get_app_status('counter', store, BASE)
	check('store update restores up-to-date status', restoredStatus.status === 'up-to-date', restoredStatus.status)
	var pinsAfter = await get_pinned(store)
	check('store update leaves pins untouched', pinsAfter.length === 1 && pinsAfter[0] === 'counter', pinsAfter.join(','))
}

// Snapshot-less, storage-only, catalog-only list shape, render gates, hidden rows.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store, BASE)
	await add_app(clone(await get_catalog_definition('xkcd', BASE)) as never, store)
	var xkcdStatus = await get_app_status('xkcd', store, BASE)
	check('generic add_app catalog app is snapshot-less', xkcdStatus.status === 'snapshot-less', xkcdStatus.status)
	var custom = clone(await get_catalog_definition('counter', BASE)) as { id: string, name: string, label: string }
	custom.id = 'my-note'
	custom.name = 'My Note'
	custom.label = 'My Note'
	await add_app(custom as never, store)
	var customStatus = await get_app_status('my-note', store, BASE)
	check('custom app is storage-only', customStatus.status === 'storage-only', customStatus.status)
	var rows = await get_store_rows(store, BASE)
	var ids = rows.map(function (r) { return r.id })
	var catalogIds = (await list_catalog(BASE)).map(function (c) { return c.id })
	check('store rows are catalog apps only', rows.length === catalogIds.length && JSON.stringify(ids) === JSON.stringify(catalogIds.slice().sort()), rows.length + ' rows')
	check('store rows are alphabetical', JSON.stringify(ids) === JSON.stringify(ids.slice().sort()), ids.join(','))
	check('storage-only app has no store row', ids.indexOf('my-note') === -1, ids.join(','))
	var storeRow = null
	for (var si = 0; si < rows.length; si++) if (rows[si].id === 'app-store') storeRow = rows[si]
	check('store row discloses manageApps', storeRow !== null && (storeRow as { capabilities: { manageApps: boolean } }).capabilities.manageApps === true, JSON.stringify(storeRow))
	var settingsRow = null
	for (var si = 0; si < rows.length; si++) if (rows[si].id === 'settings') settingsRow = rows[si]
	check('store row discloses theme flags', settingsRow !== null && (settingsRow as { capabilities: { themeView: boolean, themeSet: boolean } }).capabilities.themeView === true && (settingsRow as { capabilities: { themeView: boolean, themeSet: boolean } }).capabilities.themeSet === true, JSON.stringify(settingsRow))
	var themeAdditions = capabilityAdditions(clone(await get_catalog_definition('counter', BASE)), clone(await get_catalog_definition('settings', BASE)))
	check('capability additions list theme view and change', themeAdditions.indexOf('view the shell theme') !== -1 && themeAdditions.indexOf('change the shell theme') !== -1, JSON.stringify(themeAdditions))
	check('capability additions are empty without a theme change', capabilityAdditions(clone(await get_catalog_definition('settings', BASE)), clone(await get_catalog_definition('settings', BASE))).length === 0, '')
	var snapshotLessUpdate = await manage_update('app-store', 'xkcd', false, store)
	check('snapshot-less Overwrite requires confirmation', snapshotLessUpdate.ok === false && (snapshotLessUpdate as { needsConfirmation?: boolean }).needsConfirmation === true, JSON.stringify(snapshotLessUpdate))
	var snapshotLessConfirmed = await manage_update('app-store', 'xkcd', true, store)
	check('snapshot-less Overwrite applies on confirm', snapshotLessConfirmed.ok === true, JSON.stringify(snapshotLessConfirmed))
	var xkcdAfterOverwrite = await get_app_status('xkcd', store, BASE)
	check('overwritten snapshot-less app is up-to-date', xkcdAfterOverwrite.status === 'up-to-date', xkcdAfterOverwrite.status)
	var xkcdSnap = await readInstallSnapshot(store, 'xkcd')
	check('overwrite records a snapshot', xkcdSnap !== null, JSON.stringify(xkcdSnap))
	var storageOnlyUpdate = await manage_update('app-store', 'my-note', false, store)
	check('storage-only app has no update via management API', storageOnlyUpdate.ok === false, JSON.stringify(storageOnlyUpdate))
	var storageOnlyRestore = await manage_restore('app-store', 'my-note', false, store)
	check('storage-only app has nothing to restore', storageOnlyRestore.ok === false, JSON.stringify(storageOnlyRestore))
	await set_hide('xkcd', true, store)
	var appsAfterHide = await list_apps(store)
	var pinnedAfterHide = await get_pinned(store)
	var hiddenAfterHide = await get_hidden(store)
	var homepageAfterHide = await get_homepage(store)
	var editHtml = renderEditSection(appsAfterHide, pinnedAfterHide, hiddenAfterHide, homepageAfterHide, '', '/apps')
	check('edit render has no app page link', editHtml.indexOf('/apps/xkcd') === -1 && editHtml.indexOf('/apps/counter') === -1, '')
	check('edit render has no app-action class', editHtml.indexOf('app-action') === -1, '')
	check('edit render has no POST form', editHtml.indexOf('method="POST"') === -1 && editHtml.indexOf("method='POST'") === -1, '')
	check('edit render keeps edit mode on submit', editHtml.indexOf('name="edit" value="1"') !== -1, '')
	// Layout commit f89133f: Edit toggles are icon-only switches, not
	// Pin/Unpin text buttons. A hidden app's Hide toggle carries
	// aria-checked="true" and aria-label="Hidden"; submitting it sends
	// want=0, i.e. Unhide. The check below proves that toggle exists.
	check('hidden app still appears in Edit with Unhide toggle', editHtml.indexOf('xkcd') !== -1 && editHtml.indexOf('name="hide" value="xkcd"') !== -1 && editHtml.indexOf('aria-checked="true"') !== -1 && editHtml.indexOf('aria-label="Hidden"') !== -1, '')
	var allHtml = renderAllSection(appsAfterHide, '', '/apps', undefined, true)
	// Layout commit f89133f: Edit is a GET form matching the Clear
	// control, not a link, so the check is for the form + hidden field.
	check('all section offers Edit when apps exist', allHtml.indexOf('name="edit" value="1"') !== -1 && allHtml.indexOf('>Edit<') !== -1, '')
}

// Management remove: permission gate, confirmation gate, full uninstall.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store, BASE)
	await store_install_from_catalog('counter', store, BASE)
	await act('counter', 'set_count', { value: 7 }, store)
	await set_pin('counter', true, store)
	var deniedRemove = await manage_remove('counter', 'counter', true, store)
	check('management remove denies an undeclared caller', deniedRemove.ok === false && (deniedRemove as { permissionDenied?: boolean }).permissionDenied === true, JSON.stringify(deniedRemove))
	var removeNo = await manage_remove('app-store', 'counter', false, store)
	check('management remove requires confirmation', removeNo.ok === false && (removeNo as { needsConfirmation?: boolean }).needsConfirmation === true, JSON.stringify(removeNo))
	var stillThere = await list_apps(store)
	check('unconfirmed remove writes nothing', stillThere.length === 2, stillThere.map(function (a) { return a.id }).join(','))
	var removed = await manage_remove('app-store', 'counter', true, store)
	check('management remove applies on confirm', removed.ok === true, JSON.stringify(removed))
	var afterRemove = await list_apps(store)
	check('removed app leaves the installed list', afterRemove.length === 1 && afterRemove[0].id === 'app-store', afterRemove.map(function (a) { return a.id }).join(','))
	var removedStatus = await get_app_status('counter', store, BASE)
	check('removed app is not-installed', removedStatus.status === 'not-installed', removedStatus.status)
	var removedSnap = await readInstallSnapshot(store, 'counter')
	check('removed app loses its snapshot', removedSnap === null, JSON.stringify(removedSnap))
	var pinsAfterRemove = await get_pinned(store)
	check('removed app loses its pin', pinsAfterRemove.length === 0, pinsAfterRemove.join(','))
	var stateAfterRemove = await import('../pkg/src/apps/index.ts').then(function (m) { return m.get_app_state('counter', store) })
	check('removed app loses its state', 'error' in (stateAfterRemove as object), JSON.stringify(stateAfterRemove))
	var removeMissing = await manage_remove('app-store', 'counter', true, store)
	check('management remove of a not-installed app fails', removeMissing.ok === false, JSON.stringify(removeMissing))
}

// Empty states + prompt sync (empty-install + mini-apps-user-facing).
{
	var help = renderEmptyHelp('')
	check('empty help names the App Catalog prompt', help.indexOf('Read package:kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store') !== -1, '')
	var promptSteps = installSteps(help)
	check('App Catalog prompt points at the app-store folder', help.indexOf('https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store') !== -1 && help.indexOf('RECIPE.md') === -1, '')
	check('App Catalog prompt stops at the folder reference', help.indexOf('catalog/app-store</code>') !== -1 && promptSteps.length === 0, promptSteps.join(','))
	check('App Catalog prompt names no collection recipe', help.indexOf('starter') === -1 && help.indexOf('collections/') === -1, '')
	check('empty help has all three prompts as gate-hint code', help.indexOf('<h3>Install the App Catalog</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('<h3>Remove an app</h3>') !== -1 && help.indexOf('class="gate-hint"') !== -1, '')
	check('empty help lists Add, Remove, then Install the App Catalog', help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') < help.indexOf('<h3>Remove an app</h3>') && help.indexOf('<h3>Remove an app</h3>') < help.indexOf('<h3>Install the App Catalog</h3>'), '')
	check('empty help has no copy button or Clipboard API', help.indexOf('navigator.clipboard') === -1 && help.indexOf('<button') === -1, '')
	var helpPageBlock = renderEmptyHelp('', { omitClosing: true })
	check('Help page omits the empty-state closing line', helpPageBlock.indexOf('Once an app is installed') === -1, '')
	check('empty Home/Apps keep the closing line', help.indexOf('Once an app is installed') !== -1, '')
	check('Help page block differs only by the closing line', help.indexOf(helpPageBlock) === 0, '')
	check('Help and About are not catalog apps any more', await get_catalog_definition('help', BASE) === null && await get_catalog_definition('about', BASE) === null)
	check('empty help Add prompt references the operations file', help.indexOf('Read package:kody-os#OPERATIONS.md, then add a new app: Name: [display name]; What it does: [describe what it should do]') !== -1 && help.indexOf('App id: [slug]') === -1, '')
	check('packageRefForHost derives @owner/leaf from a Kody host', packageRefForHost('hypercubed.kody.run', '/kody-os') === '@hypercubed/kody-os', packageRefForHost('hypercubed.kody.run', '/kody-os'))
	check('packageRefForHost falls back to the leaf off Kody', packageRefForHost('localhost', '/kody-os') === 'kody-os' && packageRefForHost('127.0.0.1', '') === 'kody-os', '')
	var helpFull = renderEmptyHelp('', { packageRef: '@hypercubed/kody-os' })
	check('empty help uses the full @owner/leaf reference when supplied', helpFull.indexOf('Read package:@hypercubed/kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store') !== -1 && helpFull.indexOf('package:kody-os#OPERATIONS.md') === -1, '')
	var dashFull = renderDashboard([], '', false, '@hypercubed/kody-os')
	check('empty Home passes the full reference through', dashFull.indexOf('Read package:@hypercubed/kody-os#OPERATIONS.md') !== -1 && dashFull.indexOf('package:kody-os#OPERATIONS.md') === -1, '')
	var bundleDef = { id: 'counter', name: 'counter', schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>counter</div>' } }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, ui: { title: 'counter', openAs: 'page', actions: [] } } as never
	var bundleWithRef = renderBundleContent(bundleDef, '/kody-os/apps/counter', '@hypercubed/kody-os')
	check('bundle container carries the shell-provided package ref', bundleWithRef.indexOf('data-package-ref="@hypercubed/kody-os"') !== -1 && bundleWithRef.indexOf('data-action-base="/kody-os/apps/counter"') !== -1, bundleWithRef)
	var bundleWithoutRef = renderBundleContent(bundleDef, '/kody-os/apps/counter')
	check('bundle container omits data-package-ref when none is given', bundleWithoutRef.indexOf('data-package-ref') === -1, bundleWithoutRef)
	var sectionWithRef = renderAppSection(bundleDef, {}, '/kody-os', '', '@hypercubed/kody-os')
	check('app section passes the package ref to the bundle container', sectionWithRef.indexOf('data-package-ref="@hypercubed/kody-os"') !== -1, '')
	var panelWithRef = renderAppPanel(bundleDef, {}, '/kody-os', '', '', undefined, undefined, '', undefined, undefined, '@hypercubed/kody-os')
	check('app panel passes the package ref through', panelWithRef.indexOf('data-package-ref="@hypercubed/kody-os"') !== -1, '')
	var dashNoApps = renderDashboard([], '', false)
	check('Home with no apps shows the shared help', dashNoApps.indexOf('No apps installed yet.') !== -1 && dashNoApps.indexOf('Install the App Catalog') !== -1, '')
	check('Home and Apps render the same help block', dashNoApps.indexOf(help) !== -1, '')
	var dashHasApps = renderDashboard([], '', true)
	check('Home with apps but none on Home prompts Add to home', dashHasApps.indexOf('No widgets yet') === -1 && dashHasApps.indexOf('You have apps installed') === -1 && dashHasApps.indexOf('Add some to Home from the Apps page.') !== -1 && dashHasApps.indexOf('Add the App Catalog') === -1, '')
	var dashWidgets = renderDashboard(['<section class="widget">x</section>'], '', true)
	check('Home with widgets renders the widgets', dashWidgets.indexOf('widget') !== -1 && dashWidgets.indexOf('No widgets yet') === -1, '')
	var homeTiles = renderHomeTiles([], '')
	check('home tiles say no apps yet', homeTiles.indexOf('No apps yet.') !== -1, '')
}

// install-registry-race: KeyStore.list() enumerates by prefix, paginated,
// in key order; listInstalledIds derives installed ids from definition keys.
{
	var seeded = createMemoryStore({
		'kody-os.apps.def.counter': '{"id":"counter"}',
		'kody-os.apps.def.xkcd': '{"id":"xkcd"}',
		'kody-os.apps.def.settings': '{"id":"settings"}',
		'kody-os.apps.state.counter': '{"count":0}',
		'other.key': 'x',
	})
	var first = await seeded.list({ prefix: 'kody-os.apps.def.', pageSize: 2 })
	check('list() filters by prefix', first.entries.length === 2 && first.entries.every(function (e) { return e.key.indexOf('kody-os.apps.def.') === 0 }), JSON.stringify(first.entries.map(function (e) { return e.key })))
	check('list() returns keys in sorted order', first.entries[0].key === 'kody-os.apps.def.counter' && first.entries[1].key === 'kody-os.apps.def.settings', JSON.stringify(first.entries.map(function (e) { return e.key })))
	check('list() truncates a full page', first.truncated === true && first.nextStartAfter === 'kody-os.apps.def.settings', JSON.stringify({ truncated: first.truncated, nextStartAfter: first.nextStartAfter }))
	var rest = await seeded.list({ prefix: 'kody-os.apps.def.', pageSize: 2, startAfter: first.nextStartAfter as string })
	check('list() continues after startAfter', rest.entries.length === 1 && rest.entries[0].key === 'kody-os.apps.def.xkcd', JSON.stringify(rest.entries.map(function (e) { return e.key })))
	check('list() ends untruncated', rest.truncated === false && rest.nextStartAfter === null, JSON.stringify({ truncated: rest.truncated, nextStartAfter: rest.nextStartAfter }))
	var all = await seeded.list({ prefix: 'kody-os.apps.def.' })
	check('list() defaults to the full page', all.entries.length === 3 && all.truncated === false, String(all.entries.length))
	var derivedIds = await listInstalledIds(seeded)
	check('listInstalledIds returns id suffixes in key order', JSON.stringify(derivedIds) === JSON.stringify(['counter', 'settings', 'xkcd']), derivedIds.join(','))
	var derivedPaged = await listInstalledIds(seeded, 2)
	check('listInstalledIds paginates to completion', JSON.stringify(derivedPaged) === JSON.stringify(['counter', 'settings', 'xkcd']), derivedPaged.join(','))
}

// store-list-shape: a bare-array list() result normalizes to the
// documented envelope (prefix filter, key order, client-side
// pagination, envelope pass-through, unrecognized shape fails loudly);
// listInstalledIds enumerates the same ids through either shape.
{
	var bareIds = ['app-store', 'calculator', 'calendar', 'clock', 'counter', 'daily-feed', 'hoodie-weather', 'link-drop', 'news', 'probe', 'settings', 'three-bit-art', 'xkcd']
	var bare: Array<{ key: string; value: unknown }> = []
	// Deliberately unsorted: states, defs, and snapshots interleaved,
	// so the sorted-output check is meaningful.
	for (var bi = 0; bi < bareIds.length; bi++) {
		bare.push({ key: 'kody-os.apps.state.' + bareIds[bi], value: '{}' })
		bare.push({ key: 'kody-os.apps.def.' + bareIds[bi], value: '{"id":"' + bareIds[bi] + '"}' })
		bare.push({ key: 'kody-os.apps.snapshot.' + bareIds[bi], value: '{"catalogVersion":1}' })
	}
	var bareMisc = ['kody-os.apps.pinned', 'kody-os.apps.hidden', 'kody-os.apps.recent', 'kody-os.apps.homepage', 'kody-os.apps.registry', 'kody-os.apps.auth.otp.v2', 'kody-os.apps.auth.sessions.v2', 'kody-os.apps.theme', 'kody-os.apps.locale', 'kody-os.apps.version', 'kody-os.apps.a', 'kody-os.apps.b', 'kody-os.apps.c', 'kody-os.apps.d', 'kody-os.apps.e', 'kody-os.apps.f']
	for (var mi = 0; mi < bareMisc.length; mi++) bare.push({ key: bareMisc[mi], value: 'x' })
	check('bare array has 55 entries', bare.length === 55, String(bare.length))
	var barePage = normalizeListResult(bare, { prefix: 'kody-os.apps.def.' })
	check('bare array filters to the def prefix', barePage.entries.length === 13 && barePage.entries.every(function (e) { return e.key.indexOf('kody-os.apps.def.') === 0 }), JSON.stringify(barePage.entries.map(function (e) { return e.key })))
	check('bare array returns keys sorted despite unsorted input', JSON.stringify(barePage.entries.map(function (e) { return e.key })) === JSON.stringify(bareIds.map(function (id) { return 'kody-os.apps.def.' + id })), barePage.entries.map(function (e) { return e.key }).join(','))
	// Pagination: pageSize 2 over 13 def keys is 7 pages, ids
	// alphabetical, truncated / nextStartAfter chaining, last page
	// untruncated with nextStartAfter null.
	var pagedIds: string[] = []
	var pages = 0
	var startAfter: string | undefined = undefined
	var lastTruncated = true
	var lastNext: string | null = null
	while (lastTruncated) {
		var p = normalizeListResult(bare, startAfter === undefined ? { prefix: 'kody-os.apps.def.', pageSize: 2 } : { prefix: 'kody-os.apps.def.', pageSize: 2, startAfter: startAfter })
		pages += 1
		for (var pi = 0; pi < p.entries.length; pi++) pagedIds.push(p.entries[pi].key.slice('kody-os.apps.def.'.length))
		lastTruncated = p.truncated
		lastNext = p.nextStartAfter
		if (p.truncated) startAfter = p.nextStartAfter as string
		if (pages > 10) break
	}
	check('bare array paginates 13 def keys across 7 pages', pages === 7 && JSON.stringify(pagedIds) === JSON.stringify(bareIds), pages + ' pages: ' + pagedIds.join(','))
	check('bare array last page ends untruncated with nextStartAfter null', lastTruncated === false && lastNext === null, JSON.stringify({ truncated: lastTruncated, nextStartAfter: lastNext }))
	var firstTwo = normalizeListResult(bare, { prefix: 'kody-os.apps.def.', pageSize: 2 })
	var nextTwo = normalizeListResult(bare, { prefix: 'kody-os.apps.def.', pageSize: 2, startAfter: firstTwo.nextStartAfter as string })
	check('bare array startAfter continues exactly after it', firstTwo.entries.length === 2 && nextTwo.entries.length === 2 && nextTwo.entries[0].key === 'kody-os.apps.def.calendar' && nextTwo.entries[1].key === 'kody-os.apps.def.clock', JSON.stringify(nextTwo.entries.map(function (e) { return e.key })))
	// estimatedBytes covers only the returned page, by the
	// createMemoryStore() formula (key length + string value length).
	var expectedBytes = 0
	for (var ei = 0; ei < firstTwo.entries.length; ei++) expectedBytes += firstTwo.entries[ei].key.length + (firstTwo.entries[ei].value as string).length
	check('bare array estimatedBytes covers only the returned page', firstTwo.estimatedBytes === expectedBytes, String(firstTwo.estimatedBytes) + ' !== ' + String(expectedBytes))
	var pastEnd = normalizeListResult(bare, { prefix: 'kody-os.apps.def.', startAfter: 'kody-os.apps.def.zzz' })
	check('bare array startAfter past the last key returns an empty page', pastEnd.entries.length === 0 && pastEnd.truncated === false && pastEnd.nextStartAfter === null, JSON.stringify(pastEnd))
	// Malformed entries are skipped, the rest still enumerate.
	var bareWithBad: Array<unknown> = bare.slice()
	bareWithBad.push({ key: 42, value: 'x' })
	bareWithBad.push({ value: 'no-key' })
	bareWithBad.push({ key: null, value: 'x' })
	bareWithBad.push(null)
	bareWithBad.push('a-string-entry')
	var badPage = normalizeListResult(bareWithBad, { prefix: 'kody-os.apps.def.' })
	check('bare array skips entries without a string key', badPage.entries.length === 13 && JSON.stringify(badPage.entries.map(function (e) { return e.key })) === JSON.stringify(bareIds.map(function (id) { return 'kody-os.apps.def.' + id })), String(badPage.entries.length))
	// Envelope pass-through: returned exactly as given.
	var envelope = { entries: [{ key: 'kody-os.apps.def.b', value: '2' }, { key: 'kody-os.apps.def.a', value: '1' }], estimatedBytes: 999, truncated: true, nextStartAfter: 'kody-os.apps.def.b', pageSize: 2 }
	var passed = normalizeListResult(envelope, { prefix: 'kody-os.apps.def.' })
	check('envelope passes through untouched', passed === envelope, JSON.stringify(passed))
	// Unrecognized shapes reject naming the shape.
	function shapeError(result: unknown): string {
		try {
			normalizeListResult(result, { prefix: 'kody-os.apps.def.' })
		} catch (err) {
			return String((err as { message?: unknown }).message || err)
		}
		return ''
	}
	check('null list() result rejects naming the shape', shapeError(null).indexOf('unrecognized shape: null') !== -1, shapeError(null))
	check('undefined list() result rejects naming the shape', shapeError(undefined).indexOf('unrecognized shape: undefined') !== -1, shapeError(undefined))
	check('object without entries rejects naming the shape', shapeError({ keys: [] }).indexOf('unrecognized shape: object without an entries array') !== -1, shapeError({ keys: [] }))
	// End-to-end through listInstalledIds: a store whose list()
	// returns the bare array (routed through the normalizer, as the
	// resolveStore() adapter does) yields the same ids as the memory
	// store seeded with the same keys.
	var bareStore = {
		get: function (key: string): unknown { return undefined },
		set: function (key: string, value: string): void {},
		list: function (options: { prefix: string; pageSize?: number; startAfter?: string }): Promise<{ entries: Array<{ key: string; value: unknown }>; estimatedBytes: number; truncated: boolean; nextStartAfter: string | null; pageSize: number }> {
			return Promise.resolve(normalizeListResult(bare, options))
		},
	}
	var memSeed: Record<string, string> = {}
	for (var si = 0; si < bareIds.length; si++) memSeed['kody-os.apps.def.' + bareIds[si]] = '{"id":"' + bareIds[si] + '"}'
	for (var sj = 0; sj < bareIds.length; sj++) memSeed['kody-os.apps.state.' + bareIds[sj]] = '{}'
	var memStore = createMemoryStore(memSeed)
	var bareIdsOut = await listInstalledIds(bareStore)
	var memIdsOut = await listInstalledIds(memStore)
	check('listInstalledIds through a bare-array list() matches the memory store', JSON.stringify(bareIdsOut) === JSON.stringify(memIdsOut) && JSON.stringify(bareIdsOut) === JSON.stringify(bareIds), bareIdsOut.join(','))
	var bareIdsPaged = await listInstalledIds(bareStore, 2)
	check('listInstalledIds through a bare-array list() paginates to completion', JSON.stringify(bareIdsPaged) === JSON.stringify(bareIds), bareIdsPaged.join(','))
}

// install-registry-race: the installed list is derived from definition keys,
// so an orphaned definition lists and retired ids are filtered at read time.
{
	var derived = createMemoryStore()
	await add_app(clone(await get_catalog_definition('counter', BASE)) as never, derived)
	await add_app(clone(await get_catalog_definition('xkcd', BASE)) as never, derived)
	var orphanDef = { id: 'orphan-note', name: 'Orphan', schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>o</div>' } }, ui: { title: 'Orphan', openAs: 'page', actions: [] }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, capabilities: {} }
	var helpDef = { id: 'help', name: 'Help', schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>h</div>' } }, ui: { title: 'Help', openAs: 'page', actions: [] }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, capabilities: {} }
	var aboutDef = { id: 'about', name: 'About', schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>a</div>' } }, ui: { title: 'About', openAs: 'page', actions: [] }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, capabilities: {} }
	await derived.set('kody-os.apps.def.orphan-note', JSON.stringify(orphanDef))
	await derived.set('kody-os.apps.state.orphan-note', '{}')
	await derived.set('kody-os.apps.def.help', JSON.stringify(helpDef))
	await derived.set('kody-os.apps.state.help', '{}')
	await derived.set('kody-os.apps.def.about', JSON.stringify(aboutDef))
	await derived.set('kody-os.apps.state.about', '{}')
	var derivedApps = await list_apps(derived)
	var derivedGot = derivedApps.map(function (a) { return a.id })
	check('orphaned definition lists', derivedGot.indexOf('orphan-note') !== -1, derivedGot.join(','))
	check('retired apps are filtered at read time', derivedGot.indexOf('help') === -1 && derivedGot.indexOf('about') === -1, derivedGot.join(','))
	check('retired definition keys are deleted', (await derived.get('kody-os.apps.def.help')) === undefined && (await derived.get('kody-os.apps.def.about')) === undefined, '')
	check('retired state keys are deleted', (await derived.get('kody-os.apps.state.help')) === undefined && (await derived.get('kody-os.apps.state.about')) === undefined, '')
}

// install-registry-race: concurrent installs of different apps both land
// (no shared registry list to race on), and a stale registry key is ignored.
{
	var race = createMemoryStore()
	await Promise.all([
		add_app(clone(await get_catalog_definition('counter', BASE)) as never, race),
		add_app(clone(await get_catalog_definition('xkcd', BASE)) as never, race),
	])
	var raced = await list_apps(race)
	check('concurrent installs both land', raced.length === 2, raced.map(function (a) { return a.id }).join(','))
	var stale = createMemoryStore({ 'kody-os.apps.registry': JSON.stringify(['counter']) })
	await add_app(clone(await get_catalog_definition('counter', BASE)) as never, stale)
	await add_app(clone(await get_catalog_definition('xkcd', BASE)) as never, stale)
	var staleListed = await list_apps(stale)
	check('stale registry key does not hide apps', staleListed.length === 2, staleListed.map(function (a) { return a.id }).join(','))
	check('stale registry key is left unread and unwritten', (await stale.get('kody-os.apps.registry')) === JSON.stringify(['counter']), String(await stale.get('kody-os.apps.registry')))
}

// store-row-agent-prompts 6.3: absorb a modified catalog app.
// Two throwaway catalog copies (B: counter +1, xkcd +1; C: counter +2)
// served on fresh loopback bases, so no 30s manifest-cache entry is shared.
{
	function buildCatalogCopy(edits: Record<string, { catalogVersion: number; description: string }>): string {
		var dir = join(tmpdir(), 'kody-os-catalog-' + String(Date.now()) + '-' + String(Math.floor(Math.random() * 1000000000)))
		cpSync(__catalogDir, dir, { recursive: true })
		for (var appId of Object.keys(edits)) {
			var defPath = join(dir, appId, 'definition.json')
			var def = JSON.parse(readFileSync(defPath, 'utf8')) as { catalogVersion: number; description: string }
			def.catalogVersion = edits[appId].catalogVersion
			def.description = edits[appId].description
			writeFileSync(defPath, JSON.stringify(def, null, 2) + '\n', 'utf8')
		}
		// Rebuild the index exactly like scripts/build-catalog-index.ts
		// (same assembly + fingerprint calls), so the tmp manifest agrees
		// with the tmp definitions it serves.
		var entries: { id: string; label: string; catalogVersion: number; fingerprint: string; installMode: string; definitionPath: string; recipePath: string; bundleFiles: string[] }[] = []
		var ids = readdirSync(dir).filter(function (name: string): boolean {
			return name !== 'tests' && statSync(join(dir, name)).isDirectory()
		}).sort()
		for (var ii = 0; ii < ids.length; ii++) {
			var one = ids[ii]
			var oneDefPath = join(dir, one, 'definition.json')
			if (!statSync(oneDefPath, { throwIfNoEntry: false })) continue
			var oneDef = JSON.parse(readFileSync(oneDefPath, 'utf8')) as { id: string; label?: string; name: string; catalogVersion: number; installMode?: string; bundle: unknown }
			if (oneDef.id !== one) throw new Error('tmp catalog: directory ' + one + ' holds id ' + String(oneDef.id))
			var readOne = (function (appId: string): (path: string) => string | undefined {
				return function (path: string): string | undefined {
					var full = join(dir, appId, path)
					try { if (!statSync(full).isFile()) return undefined } catch (e) { return undefined }
					return readFileSync(full, 'utf8')
				}
			})(one)
			var assembled = assembleBundleFiles(oneDef.bundle, readOne)
			if (!assembled.ok) throw new Error('tmp catalog: app ' + one + ': ' + (assembled as { ok: false; error: string }).error)
			var files = (assembled as { ok: true; files: Record<string, string> }).files
			var assembledDef = JSON.parse(JSON.stringify(oneDef)) as Record<string, unknown>
			assembledDef['bundle'] = { entry: 'index.html', files: files }
			var problem = validateCatalogDefinition(assembledDef)
			if (problem !== null) throw new Error('tmp catalog: app ' + one + ' invalid: ' + problem)
			entries.push({ id: one, label: oneDef.label !== undefined ? oneDef.label : oneDef.name, catalogVersion: oneDef.catalogVersion, fingerprint: fingerprintDefinition(assembledDef as never), installMode: oneDef.installMode !== undefined ? oneDef.installMode : 'json', definitionPath: one + '/definition.json', recipePath: one + '/RECIPE.md', bundleFiles: Object.keys(files).sort() })
		}
		writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ apps: entries }, null, 2) + '\n', 'utf8')
		return dir
	}
	async function serveCatalogDir(dir: string): Promise<string> {
		var server = __http.createServer(function (req, res) {
			try {
				var url = new URL(req.url || '/', 'http://127.0.0.1')
				var pathname = decodeURIComponent(url.pathname)
				if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
				var rel = pathname.replace(/^\//, '')
				var full = join(dir, rel)
				if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
				res.statusCode = 200
				res.end(readFileSync(full, 'utf8'))
			} catch (err) { res.statusCode = 500; res.end('error') }
		})
		await new Promise<void>(function (resolve) { server.listen(0, '127.0.0.1', function () { resolve() }) })
		var addr = server.address() as unknown as { port: number }
		try { (server as unknown as { unref?: () => void }).unref?.() } catch (err) {}
		return 'http://127.0.0.1:' + String(addr.port) + '/'
	}
	var baseCounter = await get_catalog_definition('counter', BASE) as { catalogVersion: number; description: string }
	var baseXkcd = await get_catalog_definition('xkcd', BASE) as { catalogVersion: number; description: string }
	var counterCv = baseCounter.catalogVersion
	var xkcdCv = baseXkcd.catalogVersion
	var dirB = buildCatalogCopy({
		counter: { catalogVersion: counterCv + 1, description: baseCounter.description + ' (v2)' },
		xkcd: { catalogVersion: xkcdCv + 1, description: baseXkcd.description + ' (v2)' },
	})
	var dirC = buildCatalogCopy({
		counter: { catalogVersion: counterCv + 2, description: baseCounter.description + ' (v3)' },
	})
	var baseB = await serveCatalogDir(dirB)
	var baseC = await serveCatalogDir(dirC)
	var absorbStore = createMemoryStore()
	await store_install_from_catalog('app-store', absorbStore, BASE)
	await store_install_from_catalog('counter', absorbStore, BASE)
	await store_install_from_catalog('xkcd', absorbStore, BASE)
	await act('counter', 'set_count', { value: 7 }, absorbStore)
	await set_pin('counter', true, absorbStore)
	var counterTampered = clone(baseCounter) as { description: string }
	counterTampered.description = 'locally renamed counter'
	await add_app(counterTampered as never, absorbStore)
	var xkcdTampered = clone(baseXkcd) as { description: string }
	xkcdTampered.description = 'locally renamed xkcd'
	await add_app(xkcdTampered as never, absorbStore)
	check('tampered counter is modified-current before absorb', (await get_app_status('counter', absorbStore, BASE)).status === 'modified-current', '')
	check('tampered xkcd is modified-current before absorb', (await get_app_status('xkcd', absorbStore, BASE)).status === 'modified-current', '')
	// Absorb counter against BASE, keeping the local description.
	var mergedCounter = clone(baseCounter) as { description: string }
	mergedCounter.description = 'locally renamed counter'
	var absorbed = await absorb_from_catalog('counter', mergedCounter as never, absorbStore, BASE)
	check('absorb of a modified-current app succeeds', absorbed.ok === true, JSON.stringify(absorbed))
	check('absorbed counter reads absorbed', (await get_app_status('counter', absorbStore, BASE)).status === 'absorbed', '')
	var absorbedState = await get_app_state('counter', absorbStore) as { count: number }
	check('absorb preserves state', absorbedState.count === 7, JSON.stringify(absorbedState))
	check('absorb leaves pins untouched', (await get_pinned(absorbStore)).join(',') === 'counter', (await get_pinned(absorbStore)).join(','))
	var absorbedSnap = await readInstallSnapshot(absorbStore, 'counter')
	var baseCounterEntry = await get_catalog_entry('counter', BASE)
	var storedCounter = await get_app('counter', absorbStore) as { definition: unknown }
	check('absorb records the catalog version', absorbedSnap !== null && absorbedSnap.catalogVersion === counterCv, JSON.stringify(absorbedSnap))
	check('absorb records the fingerprint of the stored definition', absorbedSnap !== null && absorbedSnap.fingerprint === fingerprintDefinition(storedCounter.definition as never), JSON.stringify(absorbedSnap))
	check('absorb records the catalog fingerprint absorbed from', absorbedSnap !== null && baseCounterEntry !== null && absorbedSnap.catalogFingerprint === baseCounterEntry.fingerprint, JSON.stringify({ snap: absorbedSnap, entry: baseCounterEntry }))
	// A plain update is refused for an absorbed app, and so is a restore.
	var gAbs = globalThis as unknown as Record<string, unknown>
	var savedAbs = gAbs['KODY_CATALOG_BASE']
	gAbs['KODY_CATALOG_BASE'] = BASE
	try {
		var updateAbsorbed = await manage_update('app-store', 'counter', false, absorbStore)
		check('plain update is refused for an absorbed app', updateAbsorbed.ok === false && (updateAbsorbed as { error: string }).error.indexOf('has no update available') !== -1, JSON.stringify(updateAbsorbed))
		var restoreAbsorbed = await manage_restore('app-store', 'counter', false, absorbStore)
		check('restore is refused for an absorbed app', restoreAbsorbed.ok === false && (restoreAbsorbed as { error: string }).error.indexOf('has nothing to restore') !== -1, JSON.stringify(restoreAbsorbed))
	} finally {
		if (savedAbs !== undefined) gAbs['KODY_CATALOG_BASE'] = savedAbs
	}
	// Editing after absorbing drops back to the modified branches.
	var reTampered = clone(baseCounter) as { description: string }
	reTampered.description = 'renamed again after absorb'
	await add_app(reTampered as never, absorbStore)
	check('app edited after absorbing reads modified again', (await get_app_status('counter', absorbStore, BASE)).status === 'modified-current', '')
	var reMerged = clone(baseCounter) as { description: string }
	reMerged.description = 'renamed again after absorb'
	var reAbsorbed = await absorb_from_catalog('counter', reMerged as never, absorbStore, BASE)
	check('re-absorb after editing succeeds', reAbsorbed.ok === true, JSON.stringify(reAbsorbed))
	check('re-absorbed counter reads absorbed again', (await get_app_status('counter', absorbStore, BASE)).status === 'absorbed', '')
	// xkcd is behind-modified against B (catalog moved, local change kept).
	check('tampered xkcd is behind-modified against the moved catalog', (await get_app_status('xkcd', absorbStore, baseB)).status === 'behind-modified', '')
	var bXkcd = await get_catalog_definition('xkcd', baseB) as { description: string }
	var mergedXkcd = clone(bXkcd) as { description: string }
	mergedXkcd.description = 'locally renamed xkcd'
	var xkcdAbsorbed = await absorb_from_catalog('xkcd', mergedXkcd as never, absorbStore, baseB)
	check('absorb of a behind-modified app succeeds', xkcdAbsorbed.ok === true, JSON.stringify(xkcdAbsorbed))
	check('absorbed xkcd reads absorbed against its catalog', (await get_app_status('xkcd', absorbStore, baseB)).status === 'absorbed', '')
	// Counter's catalog moves again (C): absorbed-behind, then absorb again.
	check('absorbed counter reads absorbed-behind against the newer catalog', (await get_app_status('counter', absorbStore, baseC)).status === 'absorbed-behind', '')
	var cCounter = await get_catalog_definition('counter', baseC) as { description: string }
	var mergedCounterC = clone(cCounter) as { description: string }
	mergedCounterC.description = 'renamed again after absorb'
	var counterAbsorbedC = await absorb_from_catalog('counter', mergedCounterC as never, absorbStore, baseC)
	check('absorb again of an absorbed-behind app succeeds', counterAbsorbedC.ok === true, JSON.stringify(counterAbsorbedC))
	check('re-absorbed counter reads absorbed against the newer catalog', (await get_app_status('counter', absorbStore, baseC)).status === 'absorbed', '')
	var snapC = await readInstallSnapshot(absorbStore, 'counter')
	var entryC = await get_catalog_entry('counter', baseC)
	check('re-absorb records the new catalog fingerprint', snapC !== null && entryC !== null && snapC.catalogFingerprint === entryC.fingerprint && snapC.catalogVersion === counterCv + 2, JSON.stringify(snapC))
	// Refusals write nothing.
	await store_install_from_catalog('settings', absorbStore, BASE)
	var settingsBefore = JSON.stringify(await get_app('settings', absorbStore))
	var settingsSnapBefore = JSON.stringify(await readInstallSnapshot(absorbStore, 'settings'))
	var settingsAbsorb = await absorb_from_catalog('settings', clone(await get_catalog_definition('settings', BASE)) as never, absorbStore, BASE)
	check('absorb of an up-to-date app is refused', settingsAbsorb.ok === false && (settingsAbsorb as { error: string }).error.indexOf('up-to-date') !== -1, JSON.stringify(settingsAbsorb))
	check('refused absorb writes nothing (up-to-date)', JSON.stringify(await get_app('settings', absorbStore)) === settingsBefore && JSON.stringify(await readInstallSnapshot(absorbStore, 'settings')) === settingsSnapBefore, '')
	await store_install_from_catalog('calculator', absorbStore, BASE)
	var calculatorTampered = clone(await get_catalog_definition('calculator', BASE)) as { description: string; catalogVersion: number }
	calculatorTampered.description = 'locally renamed calculator'
	await add_app(calculatorTampered as never, absorbStore)
	var calculatorBefore = JSON.stringify(await get_app('calculator', absorbStore))
	var calculatorSnapBefore = JSON.stringify(await readInstallSnapshot(absorbStore, 'calculator'))
	var calculatorMerged = clone(await get_catalog_definition('calculator', BASE)) as { description: string; catalogVersion: number }
	calculatorMerged.description = 'locally renamed calculator'
	calculatorMerged.catalogVersion = calculatorMerged.catalogVersion + 99
	var calculatorAbsorb = await absorb_from_catalog('calculator', calculatorMerged as never, absorbStore, BASE)
	check('absorb with a mismatched catalogVersion is refused', calculatorAbsorb.ok === false, JSON.stringify(calculatorAbsorb))
	check('refused absorb writes nothing (mismatched version)', JSON.stringify(await get_app('calculator', absorbStore)) === calculatorBefore && JSON.stringify(await readInstallSnapshot(absorbStore, 'calculator')) === calculatorSnapBefore, '')
	await add_app(clone(await get_catalog_definition('clock', BASE)) as never, absorbStore)
	var clockBefore = JSON.stringify(await get_app('clock', absorbStore))
	var clockAbsorb = await absorb_from_catalog('clock', clone(await get_catalog_definition('clock', BASE)) as never, absorbStore, BASE)
	check('absorb of a snapshot-less app is refused', clockAbsorb.ok === false && (clockAbsorb as { error: string }).error.indexOf('snapshot-less') !== -1, JSON.stringify(clockAbsorb))
	check('refused absorb writes nothing (snapshot-less)', JSON.stringify(await get_app('clock', absorbStore)) === clockBefore && (await readInstallSnapshot(absorbStore, 'clock')) === null, '')
}

// remove-catalog-pin 2.1: the shell holds no catalog source of its own.
// The caller supplies the base; the Store declares it in its definition.
{
	// No pin identifiers remain in the shell source.
	var shellFiles = ['src/apps/remote-catalog.ts', 'src/apps/registry.ts', 'src/apps/index.ts', 'src/app.ts', 'src/index.ts']
	var pinHits: string[] = []
	for (var fi = 0; fi < shellFiles.length; fi++) {
		var srcText = readFileSync(join(__root, 'pkg', shellFiles[fi]), 'utf8')
		var tokens = ['CATALOG_REPO', 'CATALOG_RELEASE', 'catalogReleaseLabel']
		for (var ti = 0; ti < tokens.length; ti++) {
			if (srcText.indexOf(tokens[ti]) !== -1) pinHits.push(shellFiles[fi] + ':' + tokens[ti])
		}
	}
	check('no catalog pin remains in the shell source', pinHits.length === 0, pinHits.join(','))
	// Base validation: HTTPS ok, loopback ok, plain http refused.
	var httpsOk = false
	try { normalizeCatalogBase('https://example.com/catalog/'); httpsOk = true } catch (err) {}
	check('HTTPS base validates', httpsOk)
	var loopOk = false
	try { normalizeCatalogBase('http://127.0.0.1:9/catalog/'); loopOk = true } catch (err) {}
	check('loopback http base validates for dev', loopOk)
	var httpRefused = false
	try { normalizeCatalogBase('http://example.com/catalog/') } catch (err) { httpRefused = true }
	check('non-HTTPS non-loopback base is refused', httpRefused)
	// Declared-base fetching with the dev override cleared, so the
	// caller-supplied base is the one actually fetched.
	// With the override active, the Store displays the source it reads.
	var displayStore = createMemoryStore()
	var displayInstalled = await store_install_from_catalog('app-store', displayStore, BASE)
	check('display store installs', displayInstalled.ok === true, JSON.stringify(displayInstalled))
	var displayRows = await manage_rows('app-store', displayStore)
	var displayOk = displayRows.ok === true && ((displayRows as { catalogRelease?: string }).catalogRelease || '').indexOf('127.0.0.1') !== -1
	check('Store displays the declared catalog source', displayOk, JSON.stringify((displayRows as { catalogRelease?: string }).catalogRelease))
	var storeInstalled = await manage_install('app-store', 'xkcd', displayStore)
	check('Store installs through its declared base', storeInstalled.ok === true, JSON.stringify(storeInstalled))
	var afterStoreInstall = await manage_rows('app-store', displayStore)
	var xkcdRow = (afterStoreInstall.ok === true ? (afterStoreInstall as { rows: { id: string; installed: boolean }[] }).rows : []).filter(function (r) { return r.id === 'xkcd' })
	check('Store-installed app shows installed', xkcdRow.length === 1 && xkcdRow[0].installed === true, JSON.stringify(xkcdRow))
	var g = globalThis as unknown as Record<string, unknown>
	var savedOverride = g['KODY_CATALOG_BASE']
	delete g['KODY_CATALOG_BASE']
	try {
		var declared = await list_catalog(BASE)
		check('a fetch with a declared base returns the catalog', declared.length === 19, String(declared.length))
		var refusedDef = await get_catalog_definition('counter', 'http://example.com/catalog/')
		check('non-HTTPS declared base fetches nothing', refusedDef === null)
		var badStore = createMemoryStore()
		var badInstall = await install_from_catalog('counter', badStore, 'http://example.com/catalog/')
		check('explicit bad base install is refused', badInstall.ok === false, JSON.stringify(badInstall))
		check('explicit bad base install writes nothing', (await list_apps(badStore)).length === 0)
		var emptyStore = createMemoryStore()
		var noSource = await install_from_catalog('counter', emptyStore)
		var noSourceErr = noSource.ok === false ? (noSource as { error: string }).error : ''
		check('no base and no Store is refused', noSource.ok === false && noSourceErr.indexOf('no catalog source') !== -1 && noSourceErr.indexOf('counter') !== -1, noSourceErr)
		check('no-source refusal writes nothing', (await list_apps(emptyStore)).length === 0)
		var explicitStore = createMemoryStore()
		var explicit = await install_from_catalog('counter', explicitStore, BASE)
		check('explicit base installs from it', explicit.ok === true, JSON.stringify(explicit))
		// A management call from an app with no catalog entry shows installed only.
		var bareStore = createMemoryStore()
		var bareAdded = await add_app({ id: 'bare-store', name: 'Bare', schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>bare</div>' } }, ui: { title: 'Bare', openAs: 'page', actions: [] }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, capabilities: { manageApps: true } } as never, bareStore)
		check('bare store app installs', bareAdded.ok === true, JSON.stringify(bareAdded))
		var bareRows = await manage_rows('bare-store', bareStore)
		var bareOk = bareRows.ok === true && (bareRows as { rows: { id: string }[] }).rows.length === 1 && (bareRows as { rows: { id: string }[] }).rows[0].id === 'bare-store' && ((bareRows as { catalogError?: string }).catalogError || '').indexOf('no catalog source') !== -1
		check('no catalog entry shows installed apps only', bareOk, JSON.stringify(bareRows))
		// Two bases do not share a manifest cache entry.
		var second = __http.createServer(function (req, res) {
			try {
				var url = new URL(req.url || '/', 'http://127.0.0.1')
				var pathname = decodeURIComponent(url.pathname)
				if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
				var rel = pathname.replace(/^\//, '')
				var full = join(__catalogDir, rel)
				if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
				res.statusCode = 200
				res.end(readFileSync(full, 'utf8'))
			} catch (err) { res.statusCode = 500; res.end('error') }
		})
		await new Promise<void>(function (resolve) { second.listen(0, '127.0.0.1', function () { resolve() }) })
		var secondAddr = second.address() as unknown as { port: number }
		var baseB = 'http://127.0.0.1:' + String(secondAddr.port) + '/'
		try { (second as unknown as { unref?: () => void }).unref?.() } catch (err) {}
		var freshA = await readCatalogManifest(BASE)
		check('first base resolves to its own cache entry', freshA.entries.length === 19, JSON.stringify({ cached: freshA.cached }))
		var srcLabel = get_catalog_source(BASE)
		check('catalog source reports the declared base', srcLabel.baseUrl === BASE && srcLabel.releaseLabel.indexOf('127.0.0.1') !== -1, JSON.stringify(srcLabel))
		await new Promise<void>(function (resolve) { __server.close(function () { resolve() }) })
		var staleA = await readCatalogManifest(BASE)
		check('stopped base falls back to its own cache entry', staleA.cached === true && staleA.entries.length === 19, JSON.stringify({ cached: staleA.cached }))
		var freshB = await readCatalogManifest(baseB)
		check('second base does not share the first base cache entry', freshB.cached === false && freshB.entries.length === 19, JSON.stringify({ cached: freshB.cached }))
		var freshB2 = await readCatalogManifest(baseB)
		check('repeat read serves the fresh cache entry with its age', freshB2.cached === true && freshB2.entries.length === 19 && freshB2.releaseLabel.indexOf('cached') !== -1, freshB2.releaseLabel)
		await new Promise<void>(function (resolve) { second.close(function () { resolve() }) })
	} finally {
		if (savedOverride !== undefined) g['KODY_CATALOG_BASE'] = savedOverride
	}
}

// store-latest-schema-floor 2.1: schema floor gate + Store rows.
{
	check('floor is 3, the minimum supported', MIN_SUPPORTED_SCHEMA_VERSION === 3 && MIN_SUPPORTED_SCHEMA_VERSION === Math.min.apply(null, SUPPORTED_SCHEMA_VERSIONS), String(MIN_SUPPORTED_SCHEMA_VERSION))
	function eraDef(id: string, schema: number, marker: string): unknown {
		var ui: Record<string, unknown> = { title: id, openAs: 'page', actions: [] as unknown[] }
		if (schema < 4) ui['template'] = 'generic'
		return { id: id, name: id, schemaVersion: schema, bundle: { entry: 'index.html', files: { 'index.html': '<div>' + marker + '</div>' } }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, ui: ui }
	}
	var floorStore = createMemoryStore()
	var belowFloor = await add_app(eraDef('oldapp', 2, 'old') as never, floorStore)
	var belowErr = belowFloor.ok === false ? (belowFloor as { error: string }).error : ''
	check('below-floor schema refused', belowFloor.ok === false && belowErr.indexOf('oldapp') !== -1 && belowErr.indexOf('2') !== -1 && belowErr.indexOf('3') !== -1, belowErr)
	check('below-floor refusal writes nothing', (await list_apps(floorStore)).length === 0)
	var freshFive = await add_app(eraDef('vapp', 5, 'v5') as never, floorStore)
	check('current schema installs', freshFive.ok === true, JSON.stringify(freshFive))
	var restampThree = await add_app(eraDef('vapp', 3, 'v3') as never, floorStore)
	check('at-floor schema installs (re-add restamps)', restampThree.ok === true, JSON.stringify(restampThree))
	var restampFour = await add_app(eraDef('vapp', 4, 'v4') as never, floorStore)
	check('schema 4 installs (re-add restamps)', restampFour.ok === true, JSON.stringify(restampFour))
	var downTwo = await add_app(eraDef('vapp', 2, 'v2') as never, floorStore)
	check('update to below-floor schema refused', downTwo.ok === false, JSON.stringify(downTwo))
	var vappEntry = await get_app('vapp', floorStore)
	var vappBundle = 'definition' in vappEntry ? ((vappEntry.definition as { bundle: { files: Record<string, string> } }).bundle.files['index.html'] || '') : ''
	check('refused update leaves installed definition unchanged', vappBundle === '<div>v4</div>', vappBundle)
	// Below-floor Store row: a catalog copy whose definition carries schema 2.
	var __fs = await import('node:fs')
	var __os = await import('node:os')
	var __path = await import('node:path')
	var tmpCat = __fs.mkdtempSync(__path.join(__os.tmpdir(), 'oldcatalog-'))
	__fs.mkdirSync(__path.join(tmpCat, 'counter'), { recursive: true })
	var realIndex = JSON.parse(readFileSync(join(__catalogDir, 'catalog.json'), 'utf8'))
	__fs.writeFileSync(__path.join(tmpCat, 'catalog.json'), JSON.stringify(realIndex))
	var realCounter = JSON.parse(readFileSync(join(__catalogDir, 'counter', 'definition.json'), 'utf8'))
	realCounter.schemaVersion = 2
	__fs.writeFileSync(__path.join(tmpCat, 'counter', 'definition.json'), JSON.stringify(realCounter))
	__fs.writeFileSync(__path.join(tmpCat, 'counter', 'index.html'), readFileSync(join(__catalogDir, 'counter', 'index.html'), 'utf8'))
	var oldServer = __http.createServer(function (req, res) {
		try {
			var url = new URL(req.url || '/', 'http://127.0.0.1')
			var pathname = decodeURIComponent(url.pathname)
			if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
			var rel = pathname.replace(/^\//, '')
			var full = __path.join(tmpCat, rel)
			if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
			res.statusCode = 200
			res.end(readFileSync(full, 'utf8'))
		} catch (err) { res.statusCode = 500; res.end('error'); }
	})
	await new Promise<void>(function (resolve) { oldServer.listen(0, '127.0.0.1', function () { resolve() }) })
	var oldAddr = oldServer.address() as unknown as { port: number }
	var oldBase = 'http://127.0.0.1:' + String(oldAddr.port) + '/'
	try { (oldServer as unknown as { unref?: () => void }).unref?.() } catch (err) {}
	var g2 = globalThis as unknown as Record<string, unknown>
	var savedOverride2 = g2['KODY_CATALOG_BASE']
	delete g2['KODY_CATALOG_BASE']
	try {
		var oldRows = await get_store_rows(createMemoryStore(), oldBase)
		var oldRow = oldRows.filter(function (r) { return r.id === 'counter' })
		var oldOk = oldRow.length === 1 && oldRow[0].needsNewerSchema === true && oldRow[0].schemaVersion === 2 && oldRow[0].schemaFloor === 3
		check('below-floor Store row carries the schema requirement', oldOk, JSON.stringify(oldRow))
	} finally {
		if (savedOverride2 !== undefined) g2['KODY_CATALOG_BASE'] = savedOverride2
	}
	await new Promise<void>(function (resolve) { oldServer.close(function () { resolve() }) })
	__fs.rmSync(tmpCat, { recursive: true, force: true })
}

// min-package-version gate (B1): malformed minima fail validation; a
// minimum newer than the running shell refuses naming the app, the
// minimum, and the running version; equal/older minima install; an
// update raising the minimum is refused byte-identical; the
// fingerprint covers the minimum.
{
	var running = await getRunningPackageVersion()
	check('running package version is 4.2.1 in this tree', running === '4.2.1', running)
	function minDef(id: string, min: unknown): unknown {
		var def: Record<string, unknown> = { id: id, name: id, schemaVersion: 5, bundle: { entry: 'index.html', files: { 'index.html': '<div>' + id + '</div>' } }, stateSchema: { type: 'object', initial: {}, fields: {} }, actions: {}, ui: { title: id, openAs: 'page', actions: [] as unknown[] } }
		if (min !== undefined) def['minPackageVersion'] = min
		return def
	}
	var minStore = createMemoryStore()
	var malformed = await add_app(minDef('minapp', '1.2') as never, minStore)
	var malformedErr = malformed.ok === false ? (malformed as { error: string }).error : ''
	check('malformed minPackageVersion rejected with the exact message', malformed.ok === false && malformedErr === 'definition.minPackageVersion must be MAJOR.MINOR.PATCH (numeric parts, no pre-release or build metadata)', malformedErr)
	check('malformed min refusal writes nothing', (await list_apps(minStore)).length === 0)
	var tooNew = await add_app(minDef('minapp', '5.0.0') as never, minStore)
	var tooNewErr = tooNew.ok === false ? (tooNew as { error: string }).error : ''
	check('newer minPackageVersion refused naming app, minimum, and running', tooNew.ok === false && tooNewErr.indexOf('minapp') !== -1 && tooNewErr.indexOf('5.0.0') !== -1 && tooNewErr.indexOf(running) !== -1, tooNewErr)
	check('newer min refusal writes nothing', (await list_apps(minStore)).length === 0)
	var equalMin = await add_app(minDef('minapp', '4.1.3') as never, minStore)
	check('equal minPackageVersion installs', equalMin.ok === true, JSON.stringify(equalMin))
	var zeroMin = await add_app(minDef('zeroapp', '0.0.0') as never, minStore)
	check('older minPackageVersion installs', zeroMin.ok === true, JSON.stringify(zeroMin))
	var beforeRaise = await get_app('minapp', minStore)
	var raiseMin = await add_app(minDef('minapp', '5.0.0') as never, minStore)
	var raiseErr = raiseMin.ok === false ? (raiseMin as { error: string }).error : ''
	check('update raising the minimum is refused', raiseMin.ok === false && raiseErr.indexOf('5.0.0') !== -1, raiseErr)
	var afterRaise = await get_app('minapp', minStore)
	check('refused minimum raise leaves the installed definition byte-identical', JSON.stringify(beforeRaise) === JSON.stringify(afterRaise), JSON.stringify(afterRaise))
	var fpWith = fingerprintDefinition(clone(minDef('zeroapp', '0.0.0')) as never)
	var fpWithout = fingerprintDefinition(clone(minDef('zeroapp', undefined)) as never)
	check('fingerprint differs with vs without minPackageVersion', fpWith !== fpWithout, fpWith + ' vs ' + fpWithout)
}

// C1: an explicit catalog base wins over a set KODY_CATALOG_BASE; the
// override still applies when no explicit base is given. Uses its own
// live server: the shared BASE server was closed by the pin-fallback
// block above, so nothing here may depend on it.
{
	var c1Server = __http.createServer(function (req, res) {
		try {
			var url = new URL(req.url || '/', 'http://127.0.0.1')
			var pathname = decodeURIComponent(url.pathname)
			if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
			var rel = pathname.replace(/^\//, '')
			var full = join(__catalogDir, rel)
			if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
			res.statusCode = 200
			res.end(readFileSync(full, 'utf8'))
		} catch (err) { res.statusCode = 500; res.end('error'); }
	})
	await new Promise<void>(function (resolve) { c1Server.listen(0, '127.0.0.1', function () { resolve() }) })
	var c1Addr = c1Server.address() as unknown as { port: number }
	var c1base = 'http://127.0.0.1:' + String(c1Addr.port) + '/'
	try { (c1Server as unknown as { unref?: () => void }).unref?.() } catch (err) {}
	var g3 = globalThis as unknown as Record<string, unknown>
	var savedOverride3 = g3['KODY_CATALOG_BASE']
	g3['KODY_CATALOG_BASE'] = 'http://127.0.0.1:1/'
	try {
		var c1store = createMemoryStore()
		var c1explicit = await install_from_catalog('counter', c1store, c1base)
		check('explicit base wins over a set KODY_CATALOG_BASE', c1explicit.ok === true, JSON.stringify(c1explicit))
		var c1ids = (await list_apps(c1store)).map(function (a) { return a.id })
		check('explicit-base install writes the fetched app', c1ids.length === 1 && c1ids[0] === 'counter', c1ids.join(','))
		await store_install_from_catalog('app-store', c1store, c1base)
		g3['KODY_CATALOG_BASE'] = c1base
		var c1managed = await manage_install('app-store', 'xkcd', c1store)
		check('override applies to management with no explicit base', c1managed.ok === true, JSON.stringify(c1managed))
	} finally {
		if (savedOverride3 !== undefined) g3['KODY_CATALOG_BASE'] = savedOverride3
	}
	g3['KODY_CATALOG_BASE'] = c1base
	try {
		var c1over = createMemoryStore()
		var c1via = await install_from_catalog('counter', c1over)
		check('override applies with no explicit base', c1via.ok === true, JSON.stringify(c1via))
	} finally {
		if (savedOverride3 !== undefined) g3['KODY_CATALOG_BASE'] = savedOverride3
	}
	await new Promise<void>(function (resolve) { c1Server.close(function () { resolve() }) })
}

// C2/C3: a Store listing fetches no bundle files and performs a bounded
// number of manifest fetches; install still assembles the full bundle;
// a stale manifest falls back to the cached copy with its age shown.
{
	var rowServer = __http.createServer(function (req, res) {
		try {
			var url = new URL(req.url || '/', 'http://127.0.0.1')
			var pathname = decodeURIComponent(url.pathname)
			if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
			var rel = pathname.replace(/^\//, '')
			var full = join(__catalogDir, rel)
			if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
			res.statusCode = 200
			res.end(readFileSync(full, 'utf8'))
		} catch (err) { res.statusCode = 500; res.end('error'); }
	})
	await new Promise<void>(function (resolve) { rowServer.listen(0, '127.0.0.1', function () { resolve() }) })
	var rowAddr = rowServer.address() as unknown as { port: number }
	var rowBase = 'http://127.0.0.1:' + String(rowAddr.port) + '/'
	try { (rowServer as unknown as { unref?: () => void }).unref?.() } catch (err) {}
	var realFetch = (globalThis as unknown as Record<string, unknown>)['fetch']
	var manifestFetches = 0
	var definitionFetches = 0
	var bundleFetches = 0
	var countFetch = function (input: unknown, init?: unknown): Promise<unknown> {
		var u = String(input)
		if (u.indexOf('/catalog.json') !== -1) manifestFetches++
		else if (u.indexOf('/definition.json') !== -1) definitionFetches++
		else if (/\.(html|js|css)([?#]|$)/.test(u)) bundleFetches++
		return (realFetch as (i: unknown, n?: unknown) => Promise<unknown>)(input, init)
	}
	;(globalThis as unknown as Record<string, unknown>)['fetch'] = countFetch
	try {
		var rowRows = await get_store_rows(createMemoryStore(), rowBase)
		check('store listing reads every catalog row', rowRows.length === 19, String(rowRows.length))
		check('store listing fetches no bundle files', bundleFetches === 0, String(bundleFetches))
		check('store listing performs a bounded number of manifest fetches', manifestFetches <= 2, String(manifestFetches))
		manifestFetches = 0
		definitionFetches = 0
		bundleFetches = 0
		var bundleStore = createMemoryStore()
		var bundleInstalled = await store_install_from_catalog('counter', bundleStore, rowBase)
		check('install through the same base succeeds', bundleInstalled.ok === true, JSON.stringify(bundleInstalled))
		check('install still fetches and assembles bundle files', bundleFetches > 0, String(bundleFetches))
	} finally {
		;(globalThis as unknown as Record<string, unknown>)['fetch'] = realFetch
	}
	await new Promise<void>(function (resolve) { rowServer.close(function () { resolve() }) })
	var staleRows = await readCatalogManifest(rowBase)
	check('stale manifest falls back to the cached copy with its age shown', staleRows.cached === true && staleRows.entries.length === 19 && staleRows.releaseLabel.indexOf('cached') !== -1, staleRows.releaseLabel)
	var realNow = Date.now
	Date.now = function () { return realNow() + 60000 }
	try {
		var forcedStale = await readCatalogManifest(rowBase)
		check('expired cache falls back to the cached copy on fetch failure', forcedStale.cached === true && forcedStale.entries.length === 19 && forcedStale.releaseLabel.indexOf('cached') !== -1, forcedStale.releaseLabel)
	} finally {
		Date.now = realNow
	}
}

// C4: loopback http allows only the exact loopback hosts, and a
// redirect landing on a refused scheme is rejected.
{
	function baseRefused(base: string): boolean {
		try { normalizeCatalogBase(base); return false } catch (err) { return true }
	}
	check('http://localhost.evil.com base is refused', baseRefused('http://localhost.evil.com/catalog/'))
	check('http://127.0.0.1.evil.com base is refused', baseRefused('http://127.0.0.1.evil.com/catalog/'))
	check('http://127.0.0.1@evil.com base is refused', baseRefused('http://127.0.0.1@evil.com/catalog/'))
	var c4Server = __http.createServer(function (req, res) {
		try {
			var url = new URL(req.url || '/', 'http://127.0.0.1')
			var pathname = decodeURIComponent(url.pathname)
			if (pathname.indexOf('..') !== -1) { res.statusCode = 404; res.end('not found'); return }
			var rel = pathname.replace(/^\//, '')
			var full = join(__catalogDir, rel)
			if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) { res.statusCode = 404; res.end('not found'); return }
			res.statusCode = 200
			res.end(readFileSync(full, 'utf8'))
		} catch (err) { res.statusCode = 500; res.end('error'); }
	})
	await new Promise<void>(function (resolve) { c4Server.listen(0, '127.0.0.1', function () { resolve() }) })
	var c4Addr = c4Server.address() as unknown as { port: number }
	var c4base = 'http://127.0.0.1:' + String(c4Addr.port) + '/'
	try { (c4Server as unknown as { unref?: () => void }).unref?.() } catch (err) {}
	var loop127Ok = false
	try { normalizeCatalogBase(c4base); loop127Ok = true } catch (err) {}
	check('genuine http://127.0.0.1 base still validates', loop127Ok)
	var localhostBase = c4base.replace('127.0.0.1', 'localhost')
	var localhostOk = false
	try { normalizeCatalogBase(localhostBase); localhostOk = true } catch (err) {}
	check('genuine http://localhost base still validates', localhostOk)
	var localhostList = await list_catalog(localhostBase)
	check('genuine http://localhost base still fetches', localhostList.length === 19, String(localhostList.length))
	await new Promise<void>(function (resolve) { c4Server.close(function () { resolve() }) })
	var realFetch4 = (globalThis as unknown as Record<string, unknown>)['fetch']
	;(globalThis as unknown as Record<string, unknown>)['fetch'] = function () {
		return Promise.resolve({ ok: true, status: 200, url: 'http://example.com/catalog.json', text: function () { return Promise.resolve('{"apps":[]}') } })
	}
	var downgradeRefused = false
	try {
		await readCatalogManifest('https://downgrade-check.example.com/catalog/')
	} catch (err) {
		downgradeRefused = String((err as { message?: unknown }).message || err).indexOf('blocked') !== -1
	}
	check('https to http redirect is refused', downgradeRefused)
	;(globalThis as unknown as Record<string, unknown>)['fetch'] = function () {
		return Promise.resolve({ ok: true, status: 200, url: 'https://downgrade-check.example.com/catalog.json', text: function () { return Promise.resolve('{"apps":[]}') } })
	}
	var allowedFinalOk = false
	try {
		var allowedFinal = await readCatalogManifest('https://downgrade-check.example.com/catalog/')
		allowedFinalOk = allowedFinal.cached === false && allowedFinal.entries.length === 0
	} catch (err) {}
	check('https final url still fetches', allowedFinalOk)
	;(globalThis as unknown as Record<string, unknown>)['fetch'] = realFetch4
}

// compatible-catalog Phase 1: split bases (Store-as-gate). A Store with
// both proxy entries routes ordinary rows, installs, and updates through
// the listing base (catalog-apps, pinned to a tag) and its own update
// through the discovery base (catalog, main); a Store with only the
// catalog entry reads that base throughout. The bases below are distinct
// https hosts served by a fetch stub over temp catalog dirs on disk: a
// Store definition cannot declare a loopback http proxy entry (the
// definition validator requires https proxy URLs), so loopback servers
// cannot carry the split bases and the stub is the honest stand-in. The
// real 4.2.0 pin's catalog is currently byte-identical to main's, so a
// browser list cannot distinguish the two bases either.
{
  var p1Fs = await import('node:fs')
  var gP1 = globalThis as unknown as Record<string, unknown>
  var savedP1 = gP1['KODY_CATALOG_BASE']
  delete gP1['KODY_CATALOG_BASE']
  var p1Dirs: string[] = []
  var p1RealFetch = gP1['fetch']
  var LISTING = 'https://listing.example.com/catalog/'
  var DISCOVERY = 'https://discovery.example.com/catalog/'
  var GATED = 'https://gated.example.com/catalog/'
  var GATEDLISTING = 'https://gated-listing.example.com/catalog/'
  function p1RebuildIndex(dir: string): void {
    var entries: { id: string; label: string; catalogVersion: number; fingerprint: string; installMode: string; definitionPath: string; recipePath: string; bundleFiles: string[] }[] = []
    var ids = readdirSync(dir).filter(function (name: string): boolean {
      return name !== 'tests' && statSync(join(dir, name)).isDirectory()
    }).sort()
    for (var ii = 0; ii < ids.length; ii++) {
      var one = ids[ii]
      var oneDefPath = join(dir, one, 'definition.json')
      if (!statSync(oneDefPath, { throwIfNoEntry: false })) continue
      var oneDef = JSON.parse(readFileSync(oneDefPath, 'utf8')) as { id: string; label?: string; name: string; catalogVersion: number; installMode?: string; bundle: unknown }
      if (oneDef.id !== one) throw new Error('p1 catalog: directory ' + one + ' holds id ' + String(oneDef.id))
      var readOne = (function (appId: string): (path: string) => string | undefined {
        return function (path: string): string | undefined {
          var full = join(dir, appId, path)
          try { if (!statSync(full).isFile()) return undefined } catch (e) { return undefined }
          return readFileSync(full, 'utf8')
        }
      })(one)
      var assembled = assembleBundleFiles(oneDef.bundle, readOne)
      if (!assembled.ok) throw new Error('p1 catalog: app ' + one + ': ' + (assembled as { ok: false; error: string }).error)
      var files = (assembled as { ok: true; files: Record<string, string> }).files
      var assembledDef = JSON.parse(JSON.stringify(oneDef)) as Record<string, unknown>
      assembledDef['bundle'] = { entry: 'index.html', files: files }
      var problem = validateCatalogDefinition(assembledDef)
      if (problem !== null) throw new Error('p1 catalog: app ' + one + ' invalid: ' + problem)
      entries.push({ id: one, label: oneDef.label !== undefined ? oneDef.label : oneDef.name, catalogVersion: oneDef.catalogVersion, fingerprint: fingerprintDefinition(assembledDef as never), installMode: oneDef.installMode !== undefined ? oneDef.installMode : 'json', definitionPath: one + '/definition.json', recipePath: one + '/RECIPE.md', bundleFiles: Object.keys(files).sort() })
    }
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ apps: entries }, null, 2) + String.fromCharCode(10), 'utf8')
  }
  function p1EditDef(dir: string, id: string, edit: (def: Record<string, any>) => void): void {
    var defPath = join(dir, id, 'definition.json')
    var def = JSON.parse(readFileSync(defPath, 'utf8')) as Record<string, any>
    edit(def)
    writeFileSync(defPath, JSON.stringify(def, null, 2) + String.fromCharCode(10), 'utf8')
  }
  function p1SetStoreBases(dir: string, disc: string, list: string): void {
    p1EditDef(dir, 'app-store', function (def) {
      var proxy = def['capabilities']['proxy'] as { name: string; url: string }[]
      for (var i = 0; i < proxy.length; i++) {
        if (proxy[i].name === 'catalog') proxy[i].url = disc
        if (proxy[i].name === 'catalog-apps') proxy[i].url = list
      }
    })
  }
  function p1CounterLabel(dir: string, label: string): void {
    p1EditDef(dir, 'counter', function (def) {
      def['label'] = label
      def['name'] = label
    })
  }
  function p1ProxyUrl(def: { capabilities: { proxy: { name: string; url: string }[] } } | null, name: string): string | null {
    if (def === null) return null
    var proxy = def.capabilities.proxy
    for (var i = 0; i < proxy.length; i++) { if (proxy[i].name === name) return proxy[i].url }
    return null
  }
  function p1DefOf(entry: unknown): { catalogVersion: number; label: string; capabilities: { proxy: { name: string; url: string }[] } } | null {
    if (entry !== null && typeof entry === 'object' && 'definition' in (entry as Record<string, unknown>)) {
      return (entry as { definition: { catalogVersion: number; label: string; capabilities: { proxy: { name: string; url: string }[] } } }).definition
    }
    return null
  }
  type P1Rows = { ok: boolean; rows: { id: string; label: string }[]; storeSelf: { installedCatalogVersion: number; pinnedLabel: string | null; runningVersion: string; latestCatalogVersion: number | null; latestMinPackageVersion?: string; needsNewerShell: boolean; hasUpdate: boolean }; catalogRelease: string; error?: string }
  try {
    var stamp = String(Date.now()) + '-' + String(Math.floor(Math.random() * 1000000000))
    var listingDir = join(tmpdir(), 'p1-listing-' + stamp)
    var discoveryDir = join(tmpdir(), 'p1-discovery-' + stamp)
    var gatedDir = join(tmpdir(), 'p1-gated-' + stamp)
    var gatedListingDir = join(tmpdir(), 'p1-gatedlisting-' + stamp)
    p1Fs.mkdirSync(listingDir, { recursive: true })
    p1Fs.mkdirSync(discoveryDir, { recursive: true })
    p1Fs.mkdirSync(gatedDir, { recursive: true })
    p1Fs.mkdirSync(gatedListingDir, { recursive: true })
    p1Dirs.push(listingDir, discoveryDir, gatedDir, gatedListingDir)
    cpSync(__catalogDir, listingDir, { recursive: true })
    cpSync(__catalogDir, discoveryDir, { recursive: true })
    cpSync(__catalogDir, gatedDir, { recursive: true })
    cpSync(__catalogDir, gatedListingDir, { recursive: true })
    // The v27 fixture drops minPackageVersion, as the real v27 Store had
    // none: fingerprintDefinition ignores catalogVersion, so a version-only
    // difference would hash identically and read up-to-date. The v27
    // fixture keeps the catalog-apps entry (unlike the real v27) so the
    // split-base routing can be exercised at v27 at all.
    p1EditDef(listingDir, 'app-store', function (def) { def['catalogVersion'] = 27; delete def['minPackageVersion'] })
    p1SetStoreBases(listingDir, DISCOVERY, LISTING)
    p1RebuildIndex(listingDir)
    p1CounterLabel(discoveryDir, 'Counter (discovery)')
    p1SetStoreBases(discoveryDir, DISCOVERY, LISTING)
    p1RebuildIndex(discoveryDir)
    p1CounterLabel(gatedDir, 'Counter (discovery)')
    p1EditDef(gatedDir, 'app-store', function (def) { def['catalogVersion'] = 29; def['minPackageVersion'] = '99.0.0' })
    p1SetStoreBases(gatedDir, GATED, LISTING)
    p1RebuildIndex(gatedDir)
    p1EditDef(gatedListingDir, 'app-store', function (def) { def['catalogVersion'] = 27; delete def['minPackageVersion'] })
    p1SetStoreBases(gatedListingDir, GATED, GATEDLISTING)
    p1RebuildIndex(gatedListingDir)
    var p1BaseDirs: { base: string; dir: string }[] = [
      { base: LISTING, dir: listingDir },
      { base: DISCOVERY, dir: discoveryDir },
      { base: GATED, dir: gatedDir },
      { base: GATEDLISTING, dir: gatedListingDir },
    ]
    var p1Fetch = function (url: unknown, init?: unknown): Promise<unknown> {
      var urlStr = String(url)
      for (var bi = 0; bi < p1BaseDirs.length; bi++) {
        if (urlStr.indexOf(p1BaseDirs[bi].base) === 0) {
          var rel = urlStr.slice(p1BaseDirs[bi].base.length)
          var qi = rel.indexOf('?')
          if (qi !== -1) rel = rel.slice(0, qi)
          var full = join(p1BaseDirs[bi].dir, rel)
          try {
            if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) {
              return Promise.resolve({ ok: false, status: 404, url: urlStr, text: function () { return Promise.resolve('not found') } })
            }
            var body = readFileSync(full, 'utf8')
            return Promise.resolve({ ok: true, status: 200, url: urlStr, text: function () { return Promise.resolve(body) } })
          } catch (err) {
            return Promise.resolve({ ok: false, status: 500, url: urlStr, text: function () { return Promise.resolve('error') } })
          }
        }
      }
      return (p1RealFetch as (u: unknown, i?: unknown) => Promise<unknown>)(url, init)
    }
    gP1['fetch'] = p1Fetch
    var p1Store = createMemoryStore()
    var p1Install = await store_install_from_catalog('app-store', p1Store, LISTING)
    check('split-base Store installs from the listing base', p1Install.ok === true, JSON.stringify(p1Install))
    var p1StoreDef = p1DefOf(await get_app('app-store', p1Store))
    check('installed Store is v27', p1StoreDef !== null && p1StoreDef.catalogVersion === 27, JSON.stringify(p1StoreDef))
    check('installed Store declares the discovery base', p1ProxyUrl(p1StoreDef, 'catalog') === DISCOVERY, JSON.stringify(p1StoreDef))
    check('installed Store declares the listing base', p1ProxyUrl(p1StoreDef, 'catalog-apps') === LISTING, JSON.stringify(p1StoreDef))
    var p1Rows = await manage_rows('app-store', p1Store) as unknown as P1Rows
    check('split-base manage_rows succeeds', p1Rows.ok === true, JSON.stringify(p1Rows))
    var p1RowIds = p1Rows.rows.map(function (r) { return r.id })
    check('split-base list has no app-store row', p1RowIds.indexOf('app-store') === -1, p1RowIds.join(','))
    var p1CounterRow = p1Rows.rows.filter(function (r) { return r.id === 'counter' })[0]
    check('rows list the counter from the listing base', p1CounterRow !== undefined && p1CounterRow.label === 'Counter', JSON.stringify(p1CounterRow))
    check('storeSelf reports the installed Store version', p1Rows.storeSelf.installedCatalogVersion === 27, JSON.stringify(p1Rows.storeSelf))
    check('storeSelf finds the newer Store on the discovery base', p1Rows.storeSelf.latestCatalogVersion === 32, JSON.stringify(p1Rows.storeSelf))
    check('storeSelf offers the Store update', p1Rows.storeSelf.hasUpdate === true && p1Rows.storeSelf.needsNewerShell === false, JSON.stringify(p1Rows.storeSelf))
    check('storeSelf pins the listing base', p1Rows.storeSelf.pinnedLabel !== null && p1Rows.storeSelf.pinnedLabel.indexOf('listing.example.com') !== -1, JSON.stringify(p1Rows.storeSelf))
    check('status line names the listing base, not the discovery base', p1Rows.catalogRelease.indexOf('listing.example.com') !== -1 && p1Rows.catalogRelease.indexOf('discovery.example.com') === -1, p1Rows.catalogRelease)
    var p1CounterInstall = await manage_install('app-store', 'counter', p1Store)
    check('manage_install installs from the listing base', p1CounterInstall.ok === true, JSON.stringify(p1CounterInstall))
    var p1CounterDef = p1DefOf(await get_app('counter', p1Store))
    check('installed counter carries the listing label', p1CounterDef !== null && p1CounterDef.label === 'Counter', JSON.stringify(p1CounterDef))
    var p1SelfUpdate = await manage_update('app-store', 'app-store', true, p1Store)
    check('Store self-update succeeds from the discovery base', p1SelfUpdate.ok === true, JSON.stringify(p1SelfUpdate))
    var p1StoreDefAfter = p1DefOf(await get_app('app-store', p1Store))
    check('Store self-update installs v32', p1StoreDefAfter !== null && p1StoreDefAfter.catalogVersion === 32, JSON.stringify(p1StoreDefAfter))
    check('Store self-update keeps the listing pin', p1ProxyUrl(p1StoreDefAfter, 'catalog-apps') === LISTING, JSON.stringify(p1StoreDefAfter))
    check('Store self-update keeps the discovery base', p1ProxyUrl(p1StoreDefAfter, 'catalog') === DISCOVERY, JSON.stringify(p1StoreDefAfter))
    var p1Store2 = createMemoryStore()
    var p1Install2 = await store_install_from_catalog('app-store', p1Store2, LISTING)
    check('second Store installs from the listing base', p1Install2.ok === true, JSON.stringify(p1Install2))
    var p1AgentInstall = await install_from_catalog('counter', p1Store2)
    check('agent install with no base uses the listing base', p1AgentInstall.ok === true, JSON.stringify(p1AgentInstall))
    var p1AgentCounter = p1DefOf(await get_app('counter', p1Store2))
    check('agent-installed counter carries the listing label', p1AgentCounter !== null && p1AgentCounter.label === 'Counter', JSON.stringify(p1AgentCounter))
    var p1Explicit = await install_from_catalog('counter', p1Store2, DISCOVERY)
    check('explicit agent base wins over the listing base', p1Explicit.ok === true, JSON.stringify(p1Explicit))
    var p1ExplicitCounter = p1DefOf(await get_app('counter', p1Store2))
    check('explicit-base counter carries the discovery label', p1ExplicitCounter !== null && p1ExplicitCounter.label === 'Counter (discovery)', JSON.stringify(p1ExplicitCounter))
    var p1AgentUpdate = await update_from_catalog('counter', p1Store2)
    check('agent update with no base returns to the listing base', p1AgentUpdate.ok === true, JSON.stringify(p1AgentUpdate))
    var p1UpdatedCounter = p1DefOf(await get_app('counter', p1Store2))
    check('agent-updated counter carries the listing label again', p1UpdatedCounter !== null && p1UpdatedCounter.label === 'Counter', JSON.stringify(p1UpdatedCounter))
    var p1GatedStore = createMemoryStore()
    var p1GatedInstall = await store_install_from_catalog('app-store', p1GatedStore, GATEDLISTING)
    check('gated-leg Store installs from its listing base', p1GatedInstall.ok === true, JSON.stringify(p1GatedInstall))
    var p1GatedRows = await manage_rows('app-store', p1GatedStore) as unknown as P1Rows
    check('gated storeSelf finds the newer Store', p1GatedRows.storeSelf.latestCatalogVersion === 29, JSON.stringify(p1GatedRows.storeSelf))
    check('gated storeSelf reports the newer shell requirement', p1GatedRows.storeSelf.needsNewerShell === true && p1GatedRows.storeSelf.latestMinPackageVersion === '99.0.0', JSON.stringify(p1GatedRows.storeSelf))
    check('gated storeSelf offers no update', p1GatedRows.storeSelf.hasUpdate === false, JSON.stringify(p1GatedRows.storeSelf))
    var p1GatedBefore = JSON.stringify(await get_app('app-store', p1GatedStore))
    var p1GatedUpdate = await manage_update('app-store', 'app-store', true, p1GatedStore)
    check('gated Store self-update is refused', p1GatedUpdate.ok === false, JSON.stringify(p1GatedUpdate))
    check('refused gated update leaves the installed Store byte-identical', JSON.stringify(await get_app('app-store', p1GatedStore)) === p1GatedBefore, '')
    var p1CatOnlyStore = createMemoryStore()
    var p1CatOnlyDef = clone(await get_catalog_definition('app-store', DISCOVERY)) as Record<string, any>
    p1CatOnlyDef['capabilities']['proxy'] = (p1CatOnlyDef['capabilities']['proxy'] as { name: string }[]).filter(function (e) { return e.name !== 'catalog-apps' })
    var p1CatOnlyAdd = await add_app(p1CatOnlyDef as never, p1CatOnlyStore)
    check('catalog-only Store installs via generic add_app', p1CatOnlyAdd.ok === true, JSON.stringify(p1CatOnlyAdd))
    var p1CatOnlyRows = await manage_rows('app-store', p1CatOnlyStore) as unknown as P1Rows
    var p1CatOnlyCounter = p1CatOnlyRows.rows.filter(function (r) { return r.id === 'counter' })[0]
    check('catalog-only rows read the discovery base', p1CatOnlyCounter !== undefined && p1CatOnlyCounter.label === 'Counter (discovery)', JSON.stringify(p1CatOnlyCounter))
    check('catalog-only storeSelf is unpinned', p1CatOnlyRows.storeSelf.pinnedLabel === null, JSON.stringify(p1CatOnlyRows.storeSelf))
    var p1CatOnlyInstall = await manage_install('app-store', 'counter', p1CatOnlyStore)
    check('catalog-only install succeeds from the discovery base', p1CatOnlyInstall.ok === true, JSON.stringify(p1CatOnlyInstall))
    var p1CatOnlyCounterDef = p1DefOf(await get_app('counter', p1CatOnlyStore))
    check('catalog-only counter carries the discovery label', p1CatOnlyCounterDef !== null && p1CatOnlyCounterDef.label === 'Counter (discovery)', JSON.stringify(p1CatOnlyCounterDef))
    check('catalogTagLabel reads a pinned tag', catalogTagLabel('https://raw.githubusercontent.com/Hypercubed/kody-os/4.1.11/catalog/') === '4.1.11', '')
    check('catalogTagLabel is null for main', catalogTagLabel('https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/') === null, '')
    check('catalogGitHubRef reads main', catalogGitHubRef('https://raw.githubusercontent.com/Hypercubed/kody-os/main/catalog/') === 'main', '')
    check('catalogTagLabel is null for a loopback base', catalogTagLabel(LISTING) === null, '')
  } finally {
    if (savedP1 !== undefined) gP1['KODY_CATALOG_BASE'] = savedP1
    else delete gP1['KODY_CATALOG_BASE']
    gP1['fetch'] = p1RealFetch
    for (var di = 0; di < p1Dirs.length; di++) {
      try { p1Fs.rmSync(p1Dirs[di], { recursive: true, force: true }) } catch (err) {}
    }
  }
}


if (failures.length === 0) {
	console.log('\nALL STORE CHECKS PASSED')
} else {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
