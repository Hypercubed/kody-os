/**
 * Default-open-mode compat matrix (app-store-independent change spec
 * openspec/changes/default-open-mode, task 4.1). Run with bun from the
 * repo root:
 *
 *   bun tests/open-mode-harness.ts
 *
 * Proves, against fresh in-memory stores, using the catalog Counter
 * definition as a base (its ui carries neither openAs nor placements):
 *   1. Omitted field -> summary openAs 'page', page tile link.
 *   2. openAs 'modal' -> summary openAs 'modal', modal tile link
 *      (?touch=1), overlay section renders.
 *   3. openAs 'bogus' -> add_app { ok: false } naming 'bogus', and
 *      the store is unchanged (no writes on failure).
 *   4. Old placements derive: ["modal"] -> modal, ["page"] -> page,
 *      ["widget"] -> page, ["page","modal"] -> page.
 *   5. Both fields disagreeing -> openAs wins either way.
 *   6. Stored and exported definitions carry openAs and no
 *      placements (install an old ["modal"] definition, then read
 *      it back via get_app and export_app).
 *   7. A modal-default app still renders its full-page section
 *      (renderAppSection) — openAs is a tile default, not a
 *      restriction on direct /apps/<id> rendering.
 *
 * Tile links are checked through renderAllSection, the same
 * tilesList/isModalApp path the Apps page uses; overlay
 * collection in app.ts uses the same isModalApp predicate.
 *
 * Kept outside pkg/ by direction: repo tooling, not shipped code.
 */
import { add_app, createMemoryStore, deriveOpenAs, export_app, get_app, get_app_state, get_catalog_definition, isModalApp, list_apps, renderAllSection, renderAppSection, renderOverlaySection } from '../pkg/src/apps/index.ts'

var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T
}

var base = get_catalog_definition('counter')
if (base === null) {
	console.log('FAIL base catalog counter definition missing')
	process.exit(1)
}

async function summaryFor(ui: Record<string, unknown>): Promise<{ summary: { openAs: string } | null, store: unknown, def: Record<string, unknown> }> {
	var def = clone(base) as unknown as Record<string, unknown>
	def.ui = ui
	var store = createMemoryStore()
	var added = await add_app(def as never, store)
	if (added.ok !== true) return { summary: null, store: store, def: def }
	var apps = await list_apps(store)
	var summary = apps.filter(function (a): boolean { return a.id === 'counter' })[0] || null
	return { summary: summary as unknown as { openAs: string } | null, store: store, def: def }
}

function tileHtml(apps: { openAs: string }[]): string {
	return renderAllSection(apps as never, '/base', '', '')
}

// 1. Omitted field -> page.
{
	var r = await summaryFor({ title: 'Counter', actions: [{ action: 'reset_count', label: 'Reset count' }] })
	check('omitted field -> openAs page', r.summary !== null && r.summary.openAs === 'page', r.summary ? r.summary.openAs : 'no summary')
	if (r.summary !== null) {
		check('omitted field -> not modal tile', isModalApp(r.summary as never) === false)
		check('omitted field -> page tile link', tileHtml([r.summary]).indexOf('/apps/counter?from=') !== -1 && tileHtml([r.summary]).indexOf('touch=1') === -1)
	}
}

// 2. openAs modal -> modal tile + overlay.
{
	var r = await summaryFor({ title: 'Counter', openAs: 'modal', actions: [{ action: 'reset_count', label: 'Reset count' }] })
	check('openAs modal -> openAs modal', r.summary !== null && r.summary.openAs === 'modal')
	if (r.summary !== null) {
		check('openAs modal -> modal tile', isModalApp(r.summary as never) === true)
		check('openAs modal -> tile link has touch=1', tileHtml([r.summary]).indexOf('touch=1') !== -1)
	}
	var store = createMemoryStore()
	var def = clone(base) as unknown as Record<string, unknown>
	def.ui = { title: 'Counter', openAs: 'modal', actions: [{ action: 'reset_count', label: 'Reset count' }] }
	var added = await add_app(def as never, store)
	if (added.ok === true) {
		var entry = await get_app('counter', store)
		if ('definition' in entry) {
			var overlay = renderOverlaySection(entry.definition, entry.state, '/base', '')
			check('openAs modal -> overlay section renders', overlay.indexOf('overlay-panel') !== -1 && overlay.indexOf('Counter') !== -1)
		} else {
			check('openAs modal -> overlay section renders', false, 'get_app failed')
		}
	} else {
		check('openAs modal -> overlay section renders', false, 'install failed')
	}
}

// 3. Bogus openAs rejected, no writes.
{
	var store = createMemoryStore()
	var def = clone(base) as unknown as Record<string, unknown>
	def.ui = { title: 'Counter', openAs: 'bogus', actions: [] }
	var added = await add_app(def as never, store)
	check('openAs bogus -> rejected', added.ok === false, added.ok === true ? 'accepted' : undefined)
	if (added.ok === false) {
		check('openAs bogus -> error names the value', (added as { error: string }).error.indexOf('bogus') !== -1, (added as { error: string }).error)
	}
	var apps = await list_apps(store)
	check('openAs bogus -> no writes', apps.length === 0, 'apps=' + apps.length)
}

// 4. Old placements derive.
var deriveCases: Array<[unknown, string]> = [
	[['modal'], 'modal'],
	[['page'], 'page'],
	[['widget'], 'page'],
	[['page', 'modal'], 'page'],
]
for (var ci = 0; ci < deriveCases.length; ci++) {
	var placements = deriveCases[ci][0] as string[]
	var want = deriveCases[ci][1]
	var r = await summaryFor({ title: 'Counter', placements: placements, actions: [] })
	check('placements ' + JSON.stringify(placements) + ' -> ' + want, r.summary !== null && r.summary.openAs === want, r.summary ? r.summary.openAs : 'no summary')
	check('deriveOpenAs direct ' + JSON.stringify(placements) + ' -> ' + want, deriveOpenAs({ placements: placements }) === want)
}

// 5. openAs wins on disagreement.
{
	var r1 = await summaryFor({ title: 'Counter', openAs: 'page', placements: ['modal'], actions: [] })
	check('openAs page + placements modal -> page', r1.summary !== null && r1.summary.openAs === 'page')
	var r2 = await summaryFor({ title: 'Counter', openAs: 'modal', placements: ['page'], actions: [] })
	check('openAs modal + placements page -> modal', r2.summary !== null && r2.summary.openAs === 'modal')
}

// 6. Stored and exported definitions migrate.
{
	var store = createMemoryStore()
	var def = clone(base) as unknown as Record<string, unknown>
	def.ui = { title: 'Counter', placements: ['modal'], actions: [{ action: 'reset_count', label: 'Reset count' }] }
	var added = await add_app(def as never, store)
	check('old modal def installs', added.ok === true)
	if (added.ok === true) {
		var entry = await get_app('counter', store)
		if ('definition' in entry) {
			var ui = entry.definition.ui as unknown as Record<string, unknown>
			check('stored def carries openAs modal', ui.openAs === 'modal', String(ui.openAs))
			check('stored def has no placements', !('placements' in ui))
		} else {
			check('stored def carries openAs modal', false, 'get_app failed')
			check('stored def has no placements', false, 'get_app failed')
		}
		var exported = await export_app('counter', store)
		if ('definition' in exported) {
			var eui = exported.definition.ui as unknown as Record<string, unknown>
			check('exported def carries openAs modal', eui.openAs === 'modal', String(eui.openAs))
			check('exported def has no placements', !('placements' in eui))
		} else {
			check('exported def carries openAs modal', false, 'export failed')
			check('exported def has no placements', false, 'export failed')
		}
	}
}

// 7. Modal-default app still renders its full-page section.
{
	var store = createMemoryStore()
	var def = clone(base) as unknown as Record<string, unknown>
	def.ui = { title: 'Counter', openAs: 'modal', actions: [{ action: 'reset_count', label: 'Reset count' }] }
	var added = await add_app(def as never, store)
	if (added.ok === true) {
		var entry = await get_app('counter', store)
		if ('definition' in entry) {
			var section = renderAppSection(entry.definition, entry.state, '/base', '')
			check('modal-default app renders full-page section', section.indexOf('Counter') !== -1 && section.indexOf('count') !== -1)
		} else {
			check('modal-default app renders full-page section', false, 'get_app failed')
		}
	} else {
		check('modal-default app renders full-page section', false, 'install failed')
	}
}

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL OPEN-MODE CHECKS PASSED')
