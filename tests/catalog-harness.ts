/**
 * Catalog harness (app-store task 1.2). Run with bun from the repo root:
 *
 *   bun tests/catalog-harness.ts
 *
 * Proves, against a fresh in-memory store per app:
 *   1. Every *.bundle.json in pkg/catalog/ validates via validateDefinition.
 *   2. Every one installs via add_app in a blank store, appears in
 *      list_apps(), and holds its stateSchema.initial state.
 *   3. list_catalog() ids match the directory contents exactly, in
 *      alphabetical (import-list) order — a file without an import entry
 *      is not listed, and the harness fails on a mismatch.
 *   4. get_catalog_definition() returns null for an unknown id.
 *
 * Kept outside pkg/ by direction: a Kody publish syncs pkg/ only, and
 * this harness is repo tooling, not shipped package code.
 */
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { add_app, createMemoryStore, get_app_state, get_catalog_definition, list_apps, list_catalog, validateDefinition } from '../pkg/src/apps/index.ts'

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'pkg', 'catalog')
var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
	console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
	if (!ok) failures.push(name)
}

var dirFiles = readdirSync(catalogDir).filter(function (f: string): boolean {
	return f.endsWith('.bundle.json')
}).sort()
var dirIds = dirFiles.map(function (f: string): string {
	return f.slice(0, -'.bundle.json'.length)
})
var listed = list_catalog()
var listedIds = listed.map(function (s): string { return s.id })
check('directory/import match: every catalog file is listed', JSON.stringify(dirIds) === JSON.stringify(listedIds), 'dir=' + dirIds.join(',') + ' listed=' + listedIds.join(','))
check('listing order is alphabetical', JSON.stringify(listedIds) === JSON.stringify(listedIds.slice().sort()))
check('unknown catalog id returns null', get_catalog_definition('no-such-app') === null)

for (var i = 0; i < listed.length; i++) {
	var id = listed[i].id
	var def = get_catalog_definition(id)
	if (def === null) {
		check(id + ' definition present', false)
		continue
	}
	var problem = validateDefinition(def)
	check(id + ' validates', problem === null, problem !== null ? problem : undefined)
	var store = createMemoryStore()
	var added = await add_app(def as never, store)
	check(id + ' installs in blank store', added.ok === true, added.ok === false ? (added as { error: string }).error : undefined)
	if (added.ok === true) {
		var apps = await list_apps(store)
		check(id + ' appears in list_apps()', apps.some(function (a): boolean { return a.id === id }))
		var state = await get_app_state(id, store)
		var initial = (def as { stateSchema: { initial: Record<string, unknown> } }).stateSchema.initial
		check(id + ' holds initial state', JSON.stringify(state) === JSON.stringify(initial), 'state=' + JSON.stringify(state) + ' initial=' + JSON.stringify(initial))
	}
}

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL CATALOG CHECKS PASSED (' + listed.length + ' apps)')
