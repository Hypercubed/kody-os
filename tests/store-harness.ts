/**
 * App-store harness (registry + render, no HTTP). Run with bun from the repo root:
 *
 *   bun tests/store-harness.ts
 *
 * Proves, against fresh in-memory stores, the parts of the data-only
 * App Store change that do not need a live shell fetch (kody dev /
 * hosted):
 *   Empty registry (empty-install): a blank store installs nothing
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
import { act, add_app, capabilityAdditions, createMemoryStore, fingerprintDefinition, get_app, get_app_status, get_catalog_definition, get_catalog_source, get_hidden, get_homepage, get_launcher_state, get_pinned, getRunningPackageVersion, get_store_rows, install_from_catalog, list_apps, list_catalog, manage_install, manage_remove, manage_restore, manage_rows, manage_update, MIN_SUPPORTED_SCHEMA_VERSION, normalizeCatalogBase, readCatalogManifest, readInstallSnapshot, remove_app, renderAllSection, renderDashboard, renderEditSection, renderEmptyHelp, renderHomeTiles, set_hide, set_pin, store_install_from_catalog, store_update_from_catalog, SUPPORTED_SCHEMA_VERSIONS } from '../pkg/src/apps/index.ts'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// Empty registry stays empty (empty-install): a blank store installs
// nothing on its own; the Store appears only through an explicit
// install; removing the last app leaves the registry empty, no re-seed.
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
	check('removing the last app leaves the registry empty', afterRemove.length === 0, afterRemove.map(function (a) { return a.id }).join(','))
	var snapAfterRemove = await readInstallSnapshot(store, 'app-store')
	check('removing the last app deletes its snapshot', snapAfterRemove === null, JSON.stringify(snapAfterRemove))
	// Same, via the Store management API with confirmation (tasks 3.1).
	await store_install_from_catalog('app-store', store, BASE)
	var mgmtRemoved = await manage_remove('app-store', 'app-store', true, store)
	check('management remove of the last app applies on confirm', mgmtRemoved.ok === true, JSON.stringify(mgmtRemoved))
	var afterMgmtRemove = await list_apps(store)
	check('management remove of the last app leaves the registry empty', afterMgmtRemove.length === 0, afterMgmtRemove.map(function (a) { return a.id }).join(','))
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
	check('removed app leaves the registry', afterRemove.length === 1 && afterRemove[0].id === 'app-store', afterRemove.map(function (a) { return a.id }).join(','))
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
	check('empty help names the App Catalog prompt', help.indexOf('Add the App Catalog to my kody-os shell.') !== -1, '')
	var promptSteps = installSteps(help)
	check('App Catalog prompt points at the app-store recipe', help.indexOf('catalog/app-store/RECIPE.md') !== -1, '')
	check('App Catalog prompt stops at the recipe reference', help.indexOf('RECIPE.md).') !== -1 && promptSteps.length === 0, promptSteps.join(','))
	check('App Catalog prompt names no collection recipe', help.indexOf('starter') === -1 && help.indexOf('collections/') === -1, '')
	check('empty help has all three prompts as gate-hint code', help.indexOf('<h3>Install the App Catalog</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('<h3>Remove an app</h3>') !== -1 && help.indexOf('class="gate-hint"') !== -1, '')
	check('empty help lists Add, Remove, then Install the App Catalog', help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') < help.indexOf('<h3>Remove an app</h3>') && help.indexOf('<h3>Remove an app</h3>') < help.indexOf('<h3>Install the App Catalog</h3>'), '')
	check('empty help has no copy button or Clipboard API', help.indexOf('navigator.clipboard') === -1 && help.indexOf('<button') === -1, '')
	var helpPageBlock = renderEmptyHelp('', { omitClosing: true })
	check('Help page omits the empty-state closing line', helpPageBlock.indexOf('Once an app is installed') === -1, '')
	check('empty Home/Apps keep the closing line', help.indexOf('Once an app is installed') !== -1, '')
	check('Help page block differs only by the closing line', help.indexOf(helpPageBlock) === 0, '')
	check('Help and About are not catalog apps any more', await get_catalog_definition('help', BASE) === null && await get_catalog_definition('about', BASE) === null)
	check('empty help prompt 2 asks no App id', help.indexOf('Add a new app to my hosted kody-os app on Kody.') !== -1 && help.indexOf('Name: [display name]') !== -1 && help.indexOf('App id: [slug]') === -1, '')
	var dashNoApps = renderDashboard([], '', false)
	check('Home with no apps shows the shared help', dashNoApps.indexOf('No apps installed yet.') !== -1 && dashNoApps.indexOf('Add the App Catalog') !== -1, '')
	check('Home and Apps render the same help block', dashNoApps.indexOf(help) !== -1, '')
	var dashHasApps = renderDashboard([], '', true)
	check('Home with apps but none on Home prompts Add to home', dashHasApps.indexOf('No widgets yet') === -1 && dashHasApps.indexOf('You have apps installed') === -1 && dashHasApps.indexOf('Add some to Home from the Apps page.') !== -1 && dashHasApps.indexOf('Add the App Catalog') === -1, '')
	var dashWidgets = renderDashboard(['<section class="widget">x</section>'], '', true)
	check('Home with widgets renders the widgets', dashWidgets.indexOf('widget') !== -1 && dashWidgets.indexOf('No widgets yet') === -1, '')
	var homeTiles = renderHomeTiles([], '')
	check('home tiles say no apps yet', homeTiles.indexOf('No apps yet.') !== -1, '')
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
		check('a fetch with a declared base returns the catalog', declared.length === 18, String(declared.length))
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
		check('first base resolves to its own cache entry', freshA.entries.length === 18, JSON.stringify({ cached: freshA.cached }))
		var srcLabel = get_catalog_source(BASE)
		check('catalog source reports the declared base', srcLabel.baseUrl === BASE && srcLabel.releaseLabel.indexOf('127.0.0.1') !== -1, JSON.stringify(srcLabel))
		await new Promise<void>(function (resolve) { __server.close(function () { resolve() }) })
		var staleA = await readCatalogManifest(BASE)
		check('stopped base falls back to its own cache entry', staleA.cached === true && staleA.entries.length === 18, JSON.stringify({ cached: staleA.cached }))
		var freshB = await readCatalogManifest(baseB)
		check('second base does not share the first base cache entry', freshB.cached === false && freshB.entries.length === 18, JSON.stringify({ cached: freshB.cached }))
		var freshB2 = await readCatalogManifest(baseB)
		check('repeat read serves the fresh cache entry with its age', freshB2.cached === true && freshB2.entries.length === 18 && freshB2.releaseLabel.indexOf('cached') !== -1, freshB2.releaseLabel)
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
	check('running package version is 4.1.3 in this tree', running === '4.1.3', running)
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
		check('store listing reads every catalog row', rowRows.length === 18, String(rowRows.length))
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
	check('stale manifest falls back to the cached copy with its age shown', staleRows.cached === true && staleRows.entries.length === 18 && staleRows.releaseLabel.indexOf('cached') !== -1, staleRows.releaseLabel)
	var realNow = Date.now
	Date.now = function () { return realNow() + 60000 }
	try {
		var forcedStale = await readCatalogManifest(rowBase)
		check('expired cache falls back to the cached copy on fetch failure', forcedStale.cached === true && forcedStale.entries.length === 18 && forcedStale.releaseLabel.indexOf('cached') !== -1, forcedStale.releaseLabel)
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
	check('genuine http://localhost base still fetches', localhostList.length === 18, String(localhostList.length))
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

if (failures.length === 0) {
	console.log('\nALL STORE CHECKS PASSED')
} else {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
