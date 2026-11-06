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
 * pkg/catalog/tests/app-store-tests.cjs (jsdom, mocked fetch).
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped code.
 */
import { act, add_app, capabilityAdditions, createMemoryStore, get_app_status, get_catalog_definition, get_hidden, get_homepage, get_launcher_state, get_pinned, get_store_rows, list_apps, list_catalog, manage_remove, manage_restore, manage_rows, manage_update, readInstallSnapshot, remove_app, renderAllSection, renderDashboard, renderEditSection, renderEmptyHelp, renderHomeTiles, set_hide, set_pin, store_install_from_catalog, store_update_from_catalog } from '../pkg/src/apps/index.ts'

var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T
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
	var storeCatalogVersion = (get_catalog_definition('app-store') as { catalogVersion?: number }).catalogVersion
	var installed = await store_install_from_catalog('app-store', store)
	check('explicit store install succeeds', installed.ok === true, JSON.stringify(installed))
	var apps = await list_apps(store)
	check('explicit install installs only app-store', apps.length === 1 && apps[0].id === 'app-store', apps.map(function (a) { return a.id }).join(','))
	var snap = await readInstallSnapshot(store, 'app-store')
	check('explicit store install writes app-store snapshot', snap !== null && snap.catalogVersion === storeCatalogVersion, JSON.stringify(snap))
	var nonEmpty = createMemoryStore()
	await add_app(clone(get_catalog_definition('counter')) as never, nonEmpty)
	var nonEmptyApps = await list_apps(nonEmpty)
	check('a non-empty store is untouched without an install call', nonEmptyApps.length === 1 && nonEmptyApps[0].id === 'counter', nonEmptyApps.map(function (a) { return a.id }).join(','))
	await remove_app('app-store', store)
	var afterRemove = await list_apps(store)
	check('removing the last app leaves the registry empty', afterRemove.length === 0, afterRemove.map(function (a) { return a.id }).join(','))
	var snapAfterRemove = await readInstallSnapshot(store, 'app-store')
	check('removing the last app deletes its snapshot', snapAfterRemove === null, JSON.stringify(snapAfterRemove))
	// Same, via the Store management API with confirmation (tasks 3.1).
	await store_install_from_catalog('app-store', store)
	var mgmtRemoved = await manage_remove('app-store', 'app-store', true, store)
	check('management remove of the last app applies on confirm', mgmtRemoved.ok === true, JSON.stringify(mgmtRemoved))
	var afterMgmtRemove = await list_apps(store)
	check('management remove of the last app leaves the registry empty', afterMgmtRemove.length === 0, afterMgmtRemove.map(function (a) { return a.id }).join(','))
}

// Store install: unknown fails clean, clean install snapshots, no launcher side effects.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store)
	var unknown = await store_install_from_catalog('no-such-app', store)
	var afterUnknown = await list_apps(store)
	check('store install unknown id fails with no write', !unknown.ok && afterUnknown.length === 1, JSON.stringify(unknown))
	var installed = await store_install_from_catalog('counter', store)
	check('store install counter succeeds', installed.ok === true, JSON.stringify(installed))
	var status = await get_app_status('counter', store)
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
	await store_install_from_catalog('app-store', store)
	await store_install_from_catalog('counter', store)
	await act('counter', 'set_count', { value: 7 }, store)
	await set_pin('counter', true, store)
	var snapBefore = await readInstallSnapshot(store, 'counter')
	var catalogDef = get_catalog_definition('counter') as never
	var tampered = clone(catalogDef) as { description: string }
	tampered.description = 'tampered by test'
	await add_app(tampered as never, store)
	var snapAfterTamper = await readInstallSnapshot(store, 'counter')
	check('generic re-add does not move snapshot', snapAfterTamper !== null && snapBefore !== null && snapAfterTamper.fingerprint === snapBefore.fingerprint, JSON.stringify(snapAfterTamper))
	var tamperedStatus = await get_app_status('counter', store)
	check('tampered counter is modified-current', tamperedStatus.status === 'modified-current', tamperedStatus.status)
	var manageRows = await manage_rows('app-store', store)
	check('management rows are permission-gated to the Store', manageRows.ok === true, JSON.stringify(manageRows))
	var deniedRows = await manage_rows('counter', store)
	check('management rows deny an undeclared caller', deniedRows.ok === false && (deniedRows as { permissionDenied?: boolean }).permissionDenied === true, JSON.stringify(deniedRows))
	var restoreNo = await manage_restore('app-store', 'counter', false, store)
	check('modified-current restore requires confirmation', restoreNo.ok === false && (restoreNo as { needsConfirmation?: boolean }).needsConfirmation === true, JSON.stringify(restoreNo))
	var updated = await store_update_from_catalog('counter', store)
	check('store update succeeds', updated.ok === true, JSON.stringify(updated))
	var entryState = await import('../pkg/src/apps/index.ts').then(function (m) { return m.get_app_state('counter', store) })
	check('store update preserves state', (entryState as { count: number }).count === 7, JSON.stringify(entryState))
	var restoredStatus = await get_app_status('counter', store)
	check('store update restores up-to-date status', restoredStatus.status === 'up-to-date', restoredStatus.status)
	var pinsAfter = await get_pinned(store)
	check('store update leaves pins untouched', pinsAfter.length === 1 && pinsAfter[0] === 'counter', pinsAfter.join(','))
}

// Snapshot-less, storage-only, catalog-only list shape, render gates, hidden rows.
{
	var store = createMemoryStore()
	await store_install_from_catalog('app-store', store)
	await add_app(clone(get_catalog_definition('xkcd')) as never, store)
	var xkcdStatus = await get_app_status('xkcd', store)
	check('generic add_app catalog app is snapshot-less', xkcdStatus.status === 'snapshot-less', xkcdStatus.status)
	var custom = clone(get_catalog_definition('counter')) as { id: string, name: string, label: string }
	custom.id = 'my-note'
	custom.name = 'My Note'
	custom.label = 'My Note'
	await add_app(custom as never, store)
	var customStatus = await get_app_status('my-note', store)
	check('custom app is storage-only', customStatus.status === 'storage-only', customStatus.status)
	var rows = await get_store_rows(store)
	var ids = rows.map(function (r) { return r.id })
	var catalogIds = list_catalog().map(function (c) { return c.id })
	check('store rows are catalog apps only', rows.length === catalogIds.length && JSON.stringify(ids) === JSON.stringify(catalogIds.slice().sort()), rows.length + ' rows')
	check('store rows are alphabetical', JSON.stringify(ids) === JSON.stringify(ids.slice().sort()), ids.join(','))
	check('storage-only app has no store row', ids.indexOf('my-note') === -1, ids.join(','))
	var storeRow = null
	for (var si = 0; si < rows.length; si++) if (rows[si].id === 'app-store') storeRow = rows[si]
	check('store row discloses manageApps', storeRow !== null && (storeRow as { capabilities: { manageApps: boolean } }).capabilities.manageApps === true, JSON.stringify(storeRow))
	var settingsRow = null
	for (var si = 0; si < rows.length; si++) if (rows[si].id === 'settings') settingsRow = rows[si]
	check('store row discloses theme flags', settingsRow !== null && (settingsRow as { capabilities: { themeView: boolean, themeSet: boolean } }).capabilities.themeView === true && (settingsRow as { capabilities: { themeView: boolean, themeSet: boolean } }).capabilities.themeSet === true, JSON.stringify(settingsRow))
	var themeAdditions = capabilityAdditions(clone(get_catalog_definition('counter')), clone(get_catalog_definition('settings')))
	check('capability additions list theme view and change', themeAdditions.indexOf('view the shell theme') !== -1 && themeAdditions.indexOf('change the shell theme') !== -1, JSON.stringify(themeAdditions))
	check('capability additions are empty without a theme change', capabilityAdditions(clone(get_catalog_definition('settings')), clone(get_catalog_definition('settings'))).length === 0, '')
	var snapshotLessUpdate = await manage_update('app-store', 'xkcd', false, store)
	check('snapshot-less Overwrite requires confirmation', snapshotLessUpdate.ok === false && (snapshotLessUpdate as { needsConfirmation?: boolean }).needsConfirmation === true, JSON.stringify(snapshotLessUpdate))
	var snapshotLessConfirmed = await manage_update('app-store', 'xkcd', true, store)
	check('snapshot-less Overwrite applies on confirm', snapshotLessConfirmed.ok === true, JSON.stringify(snapshotLessConfirmed))
	var xkcdAfterOverwrite = await get_app_status('xkcd', store)
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
	await store_install_from_catalog('app-store', store)
	await store_install_from_catalog('counter', store)
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
	var removedStatus = await get_app_status('counter', store)
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
	check('empty help names the App Store prompt', help.indexOf('Add the App Store to my empty kody-os shell.') !== -1, '')
	check('empty help has both prompts as gate-hint code', help.indexOf('<h3>Install the App Store</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('class="gate-hint"') !== -1, '')
	check('empty help lists Add your own apps before Install the App Store', help.indexOf('<h3>Add your own apps</h3>') !== -1 && help.indexOf('<h3>Add your own apps</h3>') < help.indexOf('<h3>Install the App Store</h3>'), '')
	check('empty help has no copy button or Clipboard API', help.indexOf('navigator.clipboard') === -1 && help.indexOf('<button') === -1, '')
	var helpDef = get_catalog_definition('help') as unknown as { bundle: { files: Record<string, string> } }
	var helpHtml = helpDef.bundle.files['index.html']
	check('empty help prompt 2 matches Help prompt and asks no App id', help.indexOf('Add a new app to my hosted kody-os app on Kody.') !== -1 && helpHtml.indexOf('Add a new app to my hosted kody-os app on Kody.') !== -1 && help.indexOf('Name: [display name]') !== -1 && helpHtml.indexOf('Name: [display name]') !== -1 && help.indexOf('App id: [slug]') === -1 && helpHtml.indexOf('App id: [slug]') === -1, '')
	var dashNoApps = renderDashboard([], '', false)
	check('Home with no apps shows the shared help', dashNoApps.indexOf('No apps installed yet.') !== -1 && dashNoApps.indexOf('Add the App Store') !== -1, '')
	check('Home and Apps render the same help block', dashNoApps.indexOf(help) !== -1, '')
	var dashHasApps = renderDashboard([], '', true)
	check('Home with apps but none on Home prompts Add to home', dashHasApps.indexOf('No widgets yet') !== -1 && dashHasApps.indexOf('You have apps installed') !== -1 && dashHasApps.indexOf('Add the App Store') === -1, '')
	var dashWidgets = renderDashboard(['<section class="widget">x</section>'], '', true)
	check('Home with widgets renders the widgets', dashWidgets.indexOf('widget') !== -1 && dashWidgets.indexOf('No widgets yet') === -1, '')
	var homeTiles = renderHomeTiles([], '')
	check('home tiles say no apps yet', homeTiles.indexOf('No apps yet.') !== -1, '')
}

if (failures.length === 0) {
	console.log('\nALL STORE CHECKS PASSED')
} else {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
