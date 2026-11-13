/**
 * Build the generated catalog index at `catalog/catalog.json`.
 *
 * Run with bun from the repo root:
 *
 *   bun scripts/build-catalog-index.ts
 *
 * For each `catalog/<id>/`, it reads `definition.json` (metadata plus a
 * bundle manifest: `{ entry: "index.html", files: [...] }`, or the legacy
 * inline files map), reads each bundle file from disk, assembles the
 * runtime files map with the package's own `assembleBundleFiles`, validates
 * the assembled definition with `validateCatalogDefinition` (paths, 256 KiB
 * cap, and the entry reference contract), computes the fingerprint with the
 * existing `fingerprintDefinition`, and requires the sibling `RECIPE.md`.
 * Each index entry records `bundleFiles` (sorted, relative to the app
 * directory) plus the display fields the Store renders its rows from
 * (`name`, `icon`, `category`, `description`, `schemaVersion`,
 * `minPackageVersion` when the definition carries one, and the
 * `capabilities` summary) — the Store builds its rows from the index
 * alone and fetches a definition only to install. Output is deterministic (sorted by id, sorted file keys,
 * two-space JSON + newline): running it twice over unchanged inputs is
 * byte-identical.
 *
 * There are no collection recipes: a recipe installs only its own app. A
 * stray `catalog/collections/` directory is an error, not quietly
 * indexed, so a leftover from the retired starter collection fails here
 * instead of shipping an index the shell no longer understands.
 *
 * Never hand-write `catalog.json`: editing an app requires re-running
 * this generator, and `tests/catalog-harness.ts` fails on a stale index.
 *
 * `fingerprintDefinition`, `assembleBundleFiles`, and
 * `validateCatalogDefinition` are imported from `registry.ts` (the source
 * that `apps/index.ts` re-exports) rather than from `apps/index.ts`:
 * index.ts imports the remote catalog module, so importing index.ts here
 * would couple the generator to the network source.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppDefinition } from '../pkg/src/apps/types.ts'
import type { CapabilitySummary } from '../pkg/src/apps/definition.ts'

type InstallMode = 'json' | 'recipe-only'

interface IndexEntry {
  id: string
  label: string
  catalogVersion: number
  fingerprint: string
  installMode: InstallMode
  definitionPath: string
  recipePath: string
  bundleFiles: string[]
  name: string
  icon: string
  category: string
  description: string
  schemaVersion: number
  minPackageVersion?: string
  capabilities: CapabilitySummary
}

var root = join(dirname(fileURLToPath(import.meta.url)), '..')
var catalogDir = join(root, 'catalog')

function fail(message: string): never {
  console.error('build-catalog-index: ' + message)
  process.exit(1)
}

function subdirectories(dir: string): string[] {
  return readdirSync(dir).filter(function (name: string): boolean {
    return statSync(join(dir, name)).isDirectory()
  }).sort()
}

function readRecipe(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    return fail('missing recipe ' + path + ' (' + String(error) + ')')
  }
}

if (statSync(join(catalogDir, 'collections'), { throwIfNoEntry: false }) !== undefined) {
  fail('catalog/collections/ is no longer supported: a recipe installs only its own app, so delete the directory')
}

var indexPath = join(catalogDir, 'catalog.json')
if (!existsSync(indexPath)) writeFileSync(indexPath, '{"apps":[]}\n', 'utf8')
var registry = await import('../pkg/src/apps/registry.ts')
var assembleBundleFiles = registry.assembleBundleFiles as (
  bundle: unknown,
  readFile: (path: string) => string | undefined,
) => { ok: true; files: Record<string, string> } | { ok: false; error: string }
var fingerprintDefinition = registry.fingerprintDefinition as (definition: AppDefinition) => string
var validateCatalogDefinition = registry.validateCatalogDefinition as (definition: unknown) => string | null
var summarizeCapabilities = registry.summarizeCapabilities as (definition: AppDefinition) => CapabilitySummary
var parsePackageVersion = registry.parsePackageVersion as (value: unknown) => [number, number, number] | null

// App directories hold a definition or a recipe; `tests/` holds bundle
// harnesses, not apps.
function isAppDirectory(id: string): boolean {
  return id !== 'tests' &&
    (statSync(join(catalogDir, id, 'definition.json'), { throwIfNoEntry: false }) !== undefined ||
      statSync(join(catalogDir, id, 'RECIPE.md'), { throwIfNoEntry: false }) !== undefined)
}

var appIds = subdirectories(catalogDir).filter(isAppDirectory)
var apps: IndexEntry[] = []
for (var id of appIds) {
  var definitionPath = id + '/definition.json'
  var recipePath = id + '/RECIPE.md'
  var definition = JSON.parse(readFileSync(join(catalogDir, definitionPath), 'utf8')) as AppDefinition
  if (definition.id !== id) fail('directory ' + id + ' holds a definition whose id is ' + String(definition.id))
  var catalogVersion = definition.catalogVersion
  if (typeof catalogVersion !== 'number' || !Number.isSafeInteger(catalogVersion) || catalogVersion < 1) {
    fail('definition ' + definitionPath + ' has no valid catalogVersion')
  }
  readRecipe(join(catalogDir, recipePath))
  var readFile = (function (appId: string): (path: string) => string | undefined {
    return function (path: string): string | undefined {
      var full = join(catalogDir, appId, path)
      try {
        if (!statSync(full).isFile()) return undefined
      } catch (error) {
        return undefined
      }
      return readFileSync(full, 'utf8')
    }
  })(id)
  var bundle = (definition as unknown as Record<string, unknown>)['bundle']
  var assembled = assembleBundleFiles(bundle, readFile)
  if (!assembled.ok) fail('app ' + id + ': ' + (assembled as { ok: false; error: string }).error)
  var files = (assembled as { ok: true; files: Record<string, string> }).files
  var assembledDef = JSON.parse(JSON.stringify(definition)) as AppDefinition
  ;(assembledDef as unknown as Record<string, unknown>)['bundle'] = { entry: 'index.html', files: files }
  var problem = validateCatalogDefinition(assembledDef)
  if (problem !== null) fail('app ' + id + ' assembled definition invalid: ' + problem)
  var bundleFiles = Object.keys(files).sort()
  var isManifestList = Array.isArray((definition as unknown as Record<string, unknown>)['bundle'] !== undefined ? ((definition as unknown as Record<string, unknown>)['bundle'] as Record<string, unknown>)['files'] : undefined)
  if (isManifestList) {
    for (var bi = 0; bi < bundleFiles.length; bi++) {
      if (readFile(bundleFiles[bi]) === undefined) fail('app ' + id + ' bundle file missing on disk: ' + bundleFiles[bi])
    }
  }
  // Display fields are required in the manifest (the Store builds its
  // rows from the index alone), even though icon/category/description
  // are optional in the definition type: a catalog definition without
  // them fails the generator here instead of shipping a row the shell
  // cannot render.
  if (typeof definition.name !== 'string' || definition.name === '') fail('definition ' + definitionPath + ' has no name')
  if (typeof definition.icon !== 'string' || definition.icon === '') fail('definition ' + definitionPath + ' has no icon')
  if (typeof definition.category !== 'string' || definition.category === '') fail('definition ' + definitionPath + ' has no category')
  if (typeof definition.description !== 'string' || definition.description === '') fail('definition ' + definitionPath + ' has no description')
  if (typeof definition.schemaVersion !== 'number' || !Number.isSafeInteger(definition.schemaVersion) || definition.schemaVersion < 1) fail('definition ' + definitionPath + ' has no valid schemaVersion')
  apps.push({
    id: id,
    label: definition.label !== undefined ? definition.label : definition.name,
    catalogVersion: catalogVersion,
    fingerprint: fingerprintDefinition(assembledDef),
    installMode: definition.installMode !== undefined ? definition.installMode : 'json',
    definitionPath: definitionPath,
    recipePath: recipePath,
    bundleFiles: bundleFiles,
    name: definition.name,
    icon: definition.icon,
    category: definition.category,
    description: definition.description,
    schemaVersion: definition.schemaVersion,
    capabilities: summarizeCapabilities(assembledDef),
  })
  var minRaw = (definition as unknown as Record<string, unknown>)['minPackageVersion']
  if (minRaw !== undefined) {
    if (parsePackageVersion(minRaw) === null) fail('definition ' + definitionPath + ' has an invalid minPackageVersion')
    apps[apps.length - 1].minPackageVersion = minRaw as string
  }
}

var output = JSON.stringify({ apps: apps }, null, 2) + '\n'
writeFileSync(indexPath, output, 'utf8')
console.log('wrote catalog/catalog.json (' + apps.length + ' apps)')
