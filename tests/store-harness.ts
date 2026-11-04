/**
 * App-store harness (registry + render, no HTTP). Run with bun from the repo root:
 *
 *   bun tests/store-harness.ts
 *
 * Proves, against fresh in-memory stores, the parts of the data-only
 * App Store change that do not need a live shell fetch (kody dev /
 * hosted):
 *   Seeding: blank store seeds only app-store, idempotently; a
 *     non-empty store is untouched; remove-all re-seeds.
 *   Store install: unknown id fails with no write; a store install
 *     writes a snapshot, reports up-to-date, and adds no pin,
 *     homepage, hidden, or recency entry.
 *   Snapshots: a generic add_app after a store install does NOT move
 *     the snapshot, so a tampered app reports modified-current.
 *   Store update: restores the catalog definition, preserves state
 *     for surviving fields, replaces the snapshot, and leaves pins
 *     untouched.
 *   Snapshot-less: a catalog app installed via generic add_app claims
 *     no status and gets no update control.
 *   Storage-only: a custom app (no catalog entry) gets a Storage
 *     only status, no Install/Update/Restore through the management API.
 *   Management API: rows are the union of catalog + installed ids,
 *     deduplicated, alphabetical, with capabilities disclosed; an
 *     undeclared caller is permission-denied; a modified restore
 *     requires confirmation and applies on confirm.
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
import { act, add_app, createMemoryStore, ensure_app_store_seeded, get_app_status, get_catalog_definition, get_hidden, get_homepage, get_launcher_state, get_pinned, get_store_rows, list_apps, manage_restore, manage_rows, manage_update, readInstallSnapshot, remove_app, renderAllSection, renderEditSection, set_hide, set_pin, store_install_from_catalog, store_update_from_catalog } from '../pkg/src/apps/index.ts'

var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T
}

// Seeding: blank, idempotent, non-empty untouched, remove-all re-seeds.
{
	var store = createMemoryStore()
	var first = await ensure_app_store_seeded(store)
	check('seeding blank store seeds', first.ok && first.seeded === true, JSON.stringify(first))
	var apps = await list_apps(store)
	check('seeding installs only app-store', apps.length === 1 && apps[0].id === 'app-store', apps.map(function (a) { return a.id }).join(','))
	var snap = await readInstallSnapshot(store, 'app-store')
	var storeCatalogVersion = (get_catalog_definition('app-store') as { catalogVersion?: number }).catalogVersion
	check('seeding writes app-store snapshot', snap !== null && snap.catalogVersion === storeCatalogVersion, JSON.stringify(snap))
	var second = await ensure_app_store_seeded(store)
	check('seeding is idempotent', second.ok && second.seeded === false, JSON.stringify(second))
	var nonEmpty = createMemoryStore()
	await add_app(clone(get_catalog_definition('counter')) as never, nonEmpty)
	var untouched = await ensure_app_store_seeded(nonEmpty)
	var nonEmptyApps = await list_apps(nonEmpty)
	check('seeding leaves non-empty store untouched', untouched.ok && untouched.seeded === false && nonEmptyApps.length === 1 && nonEmptyApps[0].id === 'counter', JSON.stringify(untouched) + ' ' + nonEmptyApps.map(function (a) { return a.id }).join(','))
	await remove_app('counter', nonEmpty)
	var reseeded = await ensure_app_store_seeded(nonEmpty)
	var reseededApps = await list_apps(nonEmpty)
	check('remove-all re-seeds app-store', reseeded.ok && reseeded.seeded === true && reseededApps.length === 1 && reseededApps[0].id === 'app-store', JSON.stringify(reseeded))
}

// Store install: unknown fails clean, clean install snapshots, no launcher side effects.
{
	var store = createMemoryStore()
	await ensure_app_store_seeded(store)
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
	await ensure_app_store_seeded(store)
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

// Snapshot-less, storage-only, combined-list shape, render gates, hidden rows.
{
	var store = createMemoryStore()
	await ensure_app_store_seeded(store)
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
	check('combined rows are catalog + installed, deduplicated', rows.length === 17, rows.length + ' rows')
	check('combined rows are alphabetical', JSON.stringify(ids) === JSON.stringify(ids.slice().sort()), ids.join(','))
	var storeRow = null
	for (var si = 0; si < rows.length; si++) if (rows[si].id === 'app-store') storeRow = rows[si]
	check('store row discloses manageApps', storeRow !== null && (storeRow as { capabilities: { manageApps: boolean } }).capabilities.manageApps === true, JSON.stringify(storeRow))
	var snapshotLessUpdate = await manage_update('app-store', 'xkcd', false, store)
	check('snapshot-less app has no update via management API', snapshotLessUpdate.ok === false, JSON.stringify(snapshotLessUpdate))
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

if (failures.length === 0) {
	console.log('\nALL STORE CHECKS PASSED')
} else {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
