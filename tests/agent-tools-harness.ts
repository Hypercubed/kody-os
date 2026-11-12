/**
 * Agent-tools harness (catalog + pin tools, added 2026-10-30 before a
 * pause in the app-store work). Modernized 2026-11-11: the catalog calls
 * are async and go through a loopback server (KODY_CATALOG_BASE override);
 * the update block installs a Store fixture whose declared base is that
 * server, because update_from_catalog reads only the installed Store's
 * declared base. The '16 apps' count below is stale (the catalog now
 * ships 18) and the check is left as-is as the known pre-existing
 * failure. Run with bun from the repo root:
 *
 *   bun tests/agent-tools-harness.ts
 *
 * Proves, against fresh in-memory stores:
 *   Catalog reads: list_catalog returns the 16 shipped apps in
 *     alphabetical order with label/category/description;
 *     get_catalog_definition returns a full definition for a known
 *     id and null for an unknown id.
 *   install_from_catalog: installs in a blank store with initial
 *     state; unknown id returns { ok: false } naming the id and
 *     writes nothing; re-installing after an act preserves state.
 *   update_from_catalog: refuses an uninstalled id and an
 *     unknown catalog id (both { ok: false }, nothing written);
 *     for an installed app whose definition was changed, it
 *     restores the catalog definition while preserving state.
 *   Pins: get_pinned starts empty; set_pin pins/unpins one id
 *     without duplicating; set_pinned overwrites the whole list
 *     in order; get_pinned reads it back. (Pin tools keep their
 *     existing semantics: ids are not existence-checked.)
 *   Home screen: get_homepage starts empty; set_home adds/removes
 *     one id without duplicating; move_home reorders (no-op at
 *     the edges and for unknown ids); set_homepage overwrites
 *     the whole list in order.
 *   Hidden: get_hidden starts empty; set_hide hides/unhides one
 *     id; set_hidden overwrites the whole list.
 *   NOT covered on purpose: the recency tools (get_recent,
 *     record_use, clear_recent) stay internal per user direction.
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped code.
 */
import { act, add_app, createMemoryStore, get_app, get_app_state, get_catalog_definition, get_hidden, get_homepage, get_pinned, install_from_catalog, list_apps, list_catalog, move_home, set_hidden, set_hide, set_home, set_homepage, set_pin, set_pinned, update_from_catalog } from '../pkg/src/apps/index.ts'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T
}

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
var BASE = 'http://127.0.0.1:' + String(__addr.port) + '/'
;(globalThis as unknown as Record<string, unknown>)['KODY_CATALOG_BASE'] = BASE
try { (__server as unknown as { unref?: () => void }).unref?.() } catch (err) {}

// Catalog reads (no store needed).
{
	var listed = await list_catalog(BASE)
	check('list_catalog returns 16 apps', listed.length === 16, 'got ' + listed.length)
	var ids = listed.map(function (s): string { return s.id })
	check('list_catalog is alphabetical', JSON.stringify(ids) === JSON.stringify(ids.slice().sort()), ids.join(','))
	check('list_catalog entries carry label/category/description', listed.every(function (s): boolean {
		return typeof s.label === 'string' && typeof s.category === 'string' && typeof s.description === 'string'
	}))
	var counterDef = await get_catalog_definition('counter', BASE)
	check('get_catalog_definition known id returns definition', counterDef !== null && counterDef.id === 'counter')
	check('get_catalog_definition unknown id returns null', (await get_catalog_definition('no-such-app', BASE)) === null)
}

// install_from_catalog.
{
	var store = createMemoryStore()
	var added = await install_from_catalog('counter', store)
	check('install_from_catalog installs', added.ok === true, added.ok === false ? (added as { error: string }).error : undefined)
	if (added.ok === true) {
		var apps = await list_apps(store)
		check('installed app appears in list_apps', apps.some(function (a): boolean { return a.id === 'counter' }))
		var state = await get_app_state('counter', store)
		check('installed app holds initial state', JSON.stringify(state) === JSON.stringify({ count: 0 }), JSON.stringify(state))
		var acted = await act('counter', 'set_count', { value: 3 }, store)
		check('act set_count before reinstall', acted.ok === true)
		var reinstalled = await install_from_catalog('counter', store)
		check('re-install succeeds (idempotent)', reinstalled.ok === true)
		var stateAfter = await get_app_state('counter', store)
		check('re-install preserves state', JSON.stringify(stateAfter) === JSON.stringify({ count: 3 }), JSON.stringify(stateAfter))
	}
	var badStore = createMemoryStore()
	var bad = await install_from_catalog('no-such-app', badStore)
	check('install unknown id rejected', bad.ok === false)
	if (bad.ok === false) check('install unknown id error names the id', (bad as { error: string }).error.indexOf('no-such-app') !== -1, (bad as { error: string }).error)
	var badApps = await list_apps(badStore)
	check('install unknown id writes nothing', badApps.length === 0)
}

// update_from_catalog.
{
	var store = createMemoryStore()
	// update_from_catalog reads only the installed Store's declared base,
	// and a loopback http base cannot be installed through add_app
	// (definition validation requires proxy URLs to use https), so seed
	// the Store's definition key directly, pointing its catalog at the
	// loopback base.
	var storeDef = clone(await get_catalog_definition('app-store', BASE)) as { capabilities: { proxy: { name: string; url: string }[] } }
	storeDef.capabilities.proxy = [{ name: 'catalog', url: BASE }]
	await store.set('kody-os.apps.def.app-store', JSON.stringify(storeDef))
	var notInstalled = await update_from_catalog('counter', store)
	check('update uninstalled id rejected', notInstalled.ok === false)
	if (notInstalled.ok === false) check('update uninstalled id error points to install', (notInstalled as { error: string }).error.indexOf('install_from_catalog') !== -1, (notInstalled as { error: string }).error)
	var bad = await update_from_catalog('no-such-app', store)
	check('update unknown catalog id rejected', bad.ok === false)
	// Install a tampered counter (changed description), set state, then update.
	var tampered = clone(await get_catalog_definition('counter', BASE)) as unknown as Record<string, unknown>
	tampered.description = 'tampered description'
	var added = await add_app(tampered as never, store)
	check('tampered counter installs', added.ok === true)
	var acted = await act('counter', 'set_count', { value: 7 }, store)
	check('act set_count before update', acted.ok === true)
	var updated = await update_from_catalog('counter', store)
	check('update installed app succeeds', updated.ok === true, updated.ok === false ? (updated as { error: string }).error : undefined)
	if (updated.ok === true) {
		var entry = await get_app('counter', store)
		if ('definition' in entry) {
			var catalogDef = await get_catalog_definition('counter', BASE)
			check('update restores catalog definition', entry.definition.description === (catalogDef !== null ? catalogDef.description : null), entry.definition.description)
		} else {
			check('update restores catalog definition', false, 'get_app failed')
		}
		var state = await get_app_state('counter', store)
		check('update preserves state', JSON.stringify(state) === JSON.stringify({ count: 7 }), JSON.stringify(state))
	}
}

// Home screen.
{
	var store = createMemoryStore()
	check('get_homepage starts empty', JSON.stringify(await get_homepage(store)) === JSON.stringify([]))
	var afterAdd = await set_home('counter', true, store)
	check('set_home adds one id', JSON.stringify(afterAdd) === JSON.stringify(['counter']), JSON.stringify(afterAdd))
	var afterDup = await set_home('counter', true, store)
	check('set_home does not duplicate', JSON.stringify(afterDup) === JSON.stringify(['counter']), JSON.stringify(afterDup))
	var afterSecond = await set_home('clock', true, store)
	check('set_home appends in order', JSON.stringify(afterSecond) === JSON.stringify(['counter', 'clock']), JSON.stringify(afterSecond))
	var afterMove = await move_home('counter', 1, store)
	check('move_home moves down', JSON.stringify(afterMove) === JSON.stringify(['clock', 'counter']), JSON.stringify(afterMove))
	var afterEdge = await move_home('counter', 1, store)
	check('move_home at edge is a no-op', JSON.stringify(afterEdge) === JSON.stringify(['clock', 'counter']), JSON.stringify(afterEdge))
	var afterUnknown = await move_home('no-such-app', 1, store)
	check('move_home unknown id is a no-op', JSON.stringify(afterUnknown) === JSON.stringify(['clock', 'counter']), JSON.stringify(afterUnknown))
	var afterRemove = await set_home('clock', false, store)
	check('set_home removes', JSON.stringify(afterRemove) === JSON.stringify(['counter']), JSON.stringify(afterRemove))
	await set_homepage(['xkcd', 'counter'], store)
	check('set_homepage overwrites in order', JSON.stringify(await get_homepage(store)) === JSON.stringify(['xkcd', 'counter']))
}

// Hidden.
{
	var store = createMemoryStore()
	check('get_hidden starts empty', JSON.stringify(await get_hidden(store)) === JSON.stringify([]))
	var afterHide = await set_hide('counter', true, store)
	check('set_hide hides one id', JSON.stringify(afterHide) === JSON.stringify(['counter']), JSON.stringify(afterHide))
	var afterUnhide = await set_hide('counter', false, store)
	check('set_hide unhides', JSON.stringify(afterUnhide) === JSON.stringify([]), JSON.stringify(afterUnhide))
	await set_hidden(['clock', 'xkcd'], store)
	check('set_hidden overwrites', JSON.stringify(await get_hidden(store)) === JSON.stringify(['clock', 'xkcd']))
}

// Pins.
{
	var store = createMemoryStore()
	check('get_pinned starts empty', JSON.stringify(await get_pinned(store)) === JSON.stringify([]))
	var afterPin = await set_pin('counter', true, store)
	check('set_pin pins one id', JSON.stringify(afterPin) === JSON.stringify(['counter']), JSON.stringify(afterPin))
	var afterDup = await set_pin('counter', true, store)
	check('set_pin does not duplicate', JSON.stringify(afterDup) === JSON.stringify(['counter']), JSON.stringify(afterDup))
	var afterSecond = await set_pin('clock', true, store)
	check('set_pin appends in order', JSON.stringify(afterSecond) === JSON.stringify(['counter', 'clock']), JSON.stringify(afterSecond))
	var afterUnpin = await set_pin('counter', false, store)
	check('set_pin unpins', JSON.stringify(afterUnpin) === JSON.stringify(['clock']), JSON.stringify(afterUnpin))
	await set_pinned(['xkcd', 'counter'], store)
	check('set_pinned overwrites in order', JSON.stringify(await get_pinned(store)) === JSON.stringify(['xkcd', 'counter']))
}

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL AGENT-TOOLS CHECKS PASSED')
