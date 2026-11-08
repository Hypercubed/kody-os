/**
 * Catalog harness. Run with bun from the repo root:
 *
 *   bun tests/catalog-harness.ts
 *
 * Proves, against a fresh in-memory store per app:
 *   1. Every `catalog/<id>/` holds `definition.json` + `RECIPE.md` +
 *      `index.html`, plus exactly the manifest's other bundle files on
 *      disk, and nothing else.
 *   2. The generated index `catalog/catalog.json` matches the app
 *      directories and the definitions: one entry per app, alphabetical by
 *      id, with matching label, catalogVersion, fingerprint (of the
 *      assembled definition), installMode, definitionPath, recipePath,
 *      and bundleFiles.
 *   3. The index has no `collections` section: a recipe installs only its own
 *      app, so collection recipes no longer exist.
 *   4. Every assembled definition validates via validateCatalogDefinition,
 *      installs via add_app in a blank store, appears in list_apps(), and
 *      holds its stateSchema.initial state; the assembled fingerprint
 *      equals the index fingerprint.
 *   5. Manifest agreement is the membership rule: every definition directory
 *      has a manifest entry agreeing with it (same id, catalogVersion,
 *      fingerprint), and every manifest entry has a definition directory
 *      (plus its RECIPE.md); entries are in id order. list_catalog() (via
 *      a local override server) ids match the directories exactly, and each
 *      summary carries the manifest installMode.
 *   6. installMode is excluded from the fingerprint, and an invalid
 *      installMode fails validation.
 *   7. get_catalog_definition() returns null for an unknown id.
 *
 * Kept outside pkg/ by direction: a Kody publish syncs pkg/ only, and
 * this harness is repo tooling, not shipped package code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { add_app, assembleBundleFiles, createMemoryStore, fingerprintDefinition, get_app_state, get_catalog_definition, list_apps, list_catalog, validateCatalogDefinition, validateDefinition } from '../pkg/src/apps/index.ts'
import type { AppDefinition } from '../pkg/src/apps/types.ts'

interface IndexEntry {
  id: string
  label: string
  catalogVersion: number
  fingerprint: string
  installMode: string
  definitionPath: string
  recipePath: string
  bundleFiles: string[]
}

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'catalog')
var failures: string[] = []

function check(name: string, ok: boolean, detail?: string): void {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined && !ok ? ' — ' + detail : ''))
  if (!ok) failures.push(name)
}

function subdirectories(dir: string): string[] {
  return readdirSync(dir).filter(function (name: string): boolean {
    return statSync(join(dir, name)).isDirectory()
  }).sort()
}

function readDefinition(id: string): AppDefinition {
  return JSON.parse(readFileSync(join(catalogDir, id, 'definition.json'), 'utf8')) as AppDefinition
}

/** Bundle files map for one app, assembled from disk when the definition
 * carries the on-disk manifest list, or passed through when it carries the
 * inline map (pre-migration shape). Fails the run on a missing file. */
function readBundleFiles(id: string, def: AppDefinition): Record<string, string> {
  var bundle = (def as unknown as Record<string, unknown>)['bundle']
  var assembled = assembleBundleFiles(bundle, function (path: string): string | undefined {
    try {
      if (!statSync(join(catalogDir, id, path)).isFile()) return undefined
    } catch (error) {
      return undefined
    }
    return readFileSync(join(catalogDir, id, path), 'utf8')
  })
  if (!assembled.ok) {
    console.log('FAIL assemble ' + id + ' — ' + (assembled as { ok: false; error: string }).error)
    process.exit(1)
  }
  return (assembled as { ok: true; files: Record<string, string> }).files
}

/** Definition with its bundle assembled to the runtime files map. */
function assembledDefinition(id: string): AppDefinition {
  var def = readDefinition(id)
  var files = readBundleFiles(id, def)
  var out = JSON.parse(JSON.stringify(def)) as AppDefinition
  ;(out as unknown as Record<string, unknown>)['bundle'] = { entry: 'index.html', files: files }
  return out
}

// App directories are the ones holding a definition or a recipe; `tests/`
// (the bundle harnesses) is not an app.
function isAppDirectory(id: string): boolean {
  return id !== 'tests' &&
    (statSync(join(catalogDir, id, 'definition.json'), { throwIfNoEntry: false }) !== undefined ||
      statSync(join(catalogDir, id, 'RECIPE.md'), { throwIfNoEntry: false }) !== undefined)
}

var dirIds = subdirectories(catalogDir).filter(isAppDirectory)
var index = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8')) as { apps: IndexEntry[] }
var indexIds = index.apps.map(function (entry: IndexEntry): string { return entry.id })

// 1. Every app directory is complete: definition.json + RECIPE.md +
// index.html + exactly the manifest's other bundle files, nothing else.
var incomplete: string[] = []
for (var id of dirIds) {
  var def = readDefinition(id)
  var bundle = (def as unknown as Record<string, unknown>)['bundle'] as Record<string, unknown>
  var manifestFiles: string[] = Array.isArray(bundle['files']) ? (bundle['files'] as string[]).slice() : Object.keys(bundle['files'] as Record<string, unknown>)
  var expected = ['RECIPE.md', 'definition.json'].concat(manifestFiles).sort()
  var actual = readdirSync(join(catalogDir, id)).filter(function (name: string): boolean {
    return statSync(join(catalogDir, id, name)).isFile()
  }).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) incomplete.push(id + ' (has ' + actual.join(',') + ')')
  if (manifestFiles.indexOf('index.html') === -1) incomplete.push(id + ' (no index.html)')
}
check('every app directory holds definition.json + RECIPE.md + index.html and only its manifest files', incomplete.length === 0, incomplete.join('; '))

// 2. Manifest agreement: index == directories, alphabetical, no import list.
check('index lists every app directory exactly', JSON.stringify(indexIds) === JSON.stringify(dirIds), 'index=' + indexIds.join(',') + ' dirs=' + dirIds.join(','))
check('index apps are alphabetical', JSON.stringify(indexIds) === JSON.stringify(indexIds.slice().sort()), indexIds.join(','))

var entryProblems: string[] = []
for (var entry of index.apps) {
  var def = readDefinition(entry.id)
  var assembled = assembledDefinition(entry.id)
  if (entry.id !== def.id) entryProblems.push(entry.id + ':id')
  if (entry.label !== (def.label !== undefined ? def.label : def.name)) entryProblems.push(entry.id + ':label')
  if (entry.catalogVersion !== def.catalogVersion) entryProblems.push(entry.id + ':catalogVersion')
  if (entry.fingerprint !== fingerprintDefinition(assembled)) entryProblems.push(entry.id + ':fingerprint')
  if (entry.installMode !== (def.installMode !== undefined ? def.installMode : 'json')) entryProblems.push(entry.id + ':installMode')
  if (entry.definitionPath !== entry.id + '/definition.json') entryProblems.push(entry.id + ':definitionPath')
  if (entry.recipePath !== entry.id + '/RECIPE.md') entryProblems.push(entry.id + ':recipePath')
  if (JSON.stringify(entry.bundleFiles) !== JSON.stringify(Object.keys(readBundleFiles(entry.id, def)).sort())) entryProblems.push(entry.id + ':bundleFiles')
  if (!statSync(join(catalogDir, entry.recipePath)).isFile()) entryProblems.push(entry.id + ':missingRecipe')
}
check('index entries match the definitions (label, version, fingerprint, mode, paths, bundleFiles)', entryProblems.length === 0, entryProblems.join(', '))

// 3. No collections: the starter collection went away with the catalog Help
// and About apps, and a recipe installs only its own app.
check('index has no collections section', !('collections' in index), JSON.stringify(Object.keys(index)))
check('no collections directory exists', statSync(join(catalogDir, 'collections'), { throwIfNoEntry: false }) === undefined)

// Start a tiny local static server on catalog/ so the remote catalog module
// reads the working tree (same fetch code path as production, only the base
// URL differs). The override is loopback http, allowed for dev only.
async function withLocalCatalog<T>(fn: () => Promise<T>): Promise<T> {
  var http = await import('node:http')
  var server = http.createServer(function (req, res) {
    try {
      var url = new URL(req.url || '/', 'http://127.0.0.1')
      var pathname = decodeURIComponent(url.pathname)
      if (pathname.indexOf('..') !== -1) {
        res.statusCode = 404
        res.end('not found')
        return
      }
      var rel = pathname.replace(/^\//, '')
      var full = join(catalogDir, rel)
      if (!statSync(full, { throwIfNoEntry: false }) || !statSync(full).isFile()) {
        res.statusCode = 404
        res.end('not found')
        return
      }
      var ext = extname(full).toLowerCase()
      var type = 'application/octet-stream'
      if (ext === '.json') type = 'application/json; charset=utf-8'
      else if (ext === '.md') type = 'text/markdown; charset=utf-8'
      else if (ext === '.html') type = 'text/html; charset=utf-8'
      else if (ext === '.js') type = 'text/javascript; charset=utf-8'
      else if (ext === '.css') type = 'text/css; charset=utf-8'
      res.statusCode = 200
      res.setHeader('Content-Type', type)
      res.end(readFileSync(full, 'utf8'))
    } catch (err) {
      res.statusCode = 500
      res.end('error')
    }
  })
  await new Promise<void>(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve()
    })
  })
  var addr = server.address()
  var port = typeof addr === 'object' && addr !== null ? (addr as { port: number }).port : 0
  ;(globalThis as unknown as Record<string, unknown>)['KODY_CATALOG_BASE'] = 'http://127.0.0.1:' + String(port) + '/'
  try {
    return await fn()
  } finally {
    delete (globalThis as unknown as Record<string, unknown>)['KODY_CATALOG_BASE']
    await new Promise<void>(function (resolve) {
      server.close(function () {
        resolve()
      })
    })
  }
}

var listed: { id: string; installMode: string }[] = []
var helpAboutOk = false
var unknownOk = false
await withLocalCatalog(async function (): Promise<void> {
  listed = await list_catalog()
  var listedIds = listed.map(function (summary): string { return summary.id })
  check('manifest agreement: every catalog app is listed', JSON.stringify(dirIds) === JSON.stringify(listedIds), 'dir=' + dirIds.join(',') + ' listed=' + listedIds.join(','))
  check('listing order is alphabetical', JSON.stringify(listedIds) === JSON.stringify(listedIds.slice().sort()))
  var helpDef = await get_catalog_definition('help')
  var aboutDef = await get_catalog_definition('about')
  helpAboutOk = helpDef === null && aboutDef === null
  var unknownDef = await get_catalog_definition('no-such-app')
  unknownOk = unknownDef === null
})
check('Help and About are not catalog apps', helpAboutOk)
check('unknown catalog id returns null', unknownOk)

// 4-6. Validate, install, state, modes (local assembled defs, no network).
for (var summary of listed) {
  var sid = summary.id
  var sdef = assembledDefinition(sid)
  var problem = validateCatalogDefinition(sdef)
  check(sid + ' validates', problem === null, problem !== null ? problem : undefined)
  var store = createMemoryStore()
  var added = await add_app(sdef as never, store)
  check(sid + ' installs in blank store', added.ok === true, added.ok === false ? (added as { error: string }).error : undefined)
  if (added.ok === true) {
    var apps = await list_apps(store)
    check(sid + ' appears in list_apps()', apps.some(function (app): boolean { return app.id === sid }))
    var state = await get_app_state(sid, store)
    var initial = sdef.stateSchema.initial
    check(sid + ' holds initial state', JSON.stringify(state) === JSON.stringify(initial), 'state=' + JSON.stringify(state) + ' initial=' + JSON.stringify(initial))
  }
  var expectedMode = (sdef as AppDefinition).installMode !== undefined ? (sdef as AppDefinition).installMode : 'json'
  check(sid + ' listing reports install mode ' + expectedMode, summary.installMode === expectedMode, summary.installMode)
  if ((sdef as AppDefinition).installMode !== undefined) {
    var withoutMode = JSON.parse(JSON.stringify(sdef)) as AppDefinition
    delete withoutMode.installMode
    check(sid + ' installMode is excluded from the fingerprint', fingerprintDefinition(withoutMode) === fingerprintDefinition(sdef))
  }
}

var recipeApps = listed.filter(function (summary): boolean { return summary.installMode !== 'json' }).map(function (summary): string { return summary.id })
check('no catalog app carries a recipe install mode', JSON.stringify(recipeApps) === JSON.stringify([]), recipeApps.join(','))
check('no catalog app reports recipe-only', listed.every(function (summary): boolean { return summary.installMode !== 'recipe-only' }))

var bogus = JSON.parse(JSON.stringify(readDefinition('settings'))) as AppDefinition & { installMode: string }
bogus.installMode = 'bogus'
check('an invalid installMode fails validation', validateDefinition(bogus) !== null, String(validateDefinition(bogus)))

// ES2019 ceiling covers on-disk .js bundle files exactly as it covers inline
// bundle scripts; reference-contract fixtures prove a dangling reference and
// an unreferenced .js file each fail validation.
var ceilingHits: string[] = []
for (var appId of dirIds) {
  var appFiles = readBundleFiles(appId, readDefinition(appId))
  for (var bundlePath of Object.keys(appFiles)) {
    if (bundlePath.slice(-3) !== '.js') continue
    var js = appFiles[bundlePath]
    if (js.indexOf('?.') !== -1 || js.indexOf('??') !== -1 || js.indexOf('replaceAll') !== -1 || js.indexOf('.at(') !== -1) {
      ceilingHits.push(appId + '/' + bundlePath)
    }
  }
}
check('on-disk .js bundle files meet the ES2019 ceiling (no ?. / ?? / replaceAll / .at()', ceilingHits.length === 0, ceilingHits.join(','))

var danglingBase = assembledDefinition('settings')
var danglingFiles = JSON.parse(JSON.stringify((danglingBase as unknown as Record<string, unknown>)['bundle'])) as { entry: string; files: Record<string, string> }
danglingFiles.files['index.html'] = danglingFiles.files['index.html'] + '<script src="missing-fixture.js"></script>'
;(danglingBase as unknown as Record<string, unknown>)['bundle'] = danglingFiles
check('a dangling script reference fails validation', validateDefinition(danglingBase) !== null, String(validateDefinition(danglingBase)))

var deadBase = assembledDefinition('settings')
var deadFiles = JSON.parse(JSON.stringify((deadBase as unknown as Record<string, unknown>)['bundle'])) as { entry: string; files: Record<string, string> }
deadFiles.files['dead-fixture.js'] = 'var deadFixture = 1;'
;(deadBase as unknown as Record<string, unknown>)['bundle'] = deadFiles
check('an unreferenced .js file fails validation', validateDefinition(deadBase) !== null, String(validateDefinition(deadBase)))

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED')
  process.exit(1)
}
console.log('\nALL CATALOG CHECKS PASSED (' + listed.length + ' apps, 0 collections)')
