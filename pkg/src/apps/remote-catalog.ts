/**
 * Remote catalog source: the Store reads a catalog base declared by
 * the calling app (a `proxy` entry named `catalog`), not definitions
 * shipped in `pkg/`, and the shell holds no catalog source of its own.
 * Every fetch function takes the base as a parameter; a different
 * Store declares a different base and reads a different catalog.
 * The Store displays the declared catalog source it is reading.
 *
 * Fetch is server-side only (never from bundle code), HTTPS-only in
 * production with a loopback `http` carve-out for dev only
 * (`KODY_CATALOG_BASE` pointing at 127.0.0.1 / localhost). Timeout
 * follows the feed proxy discipline (8,000 ms). Size caps are set per
 * payload: the manifest cap stays small, a definition fetch allows at
 * least 256 KiB (the bundle cap — the feed proxy's 64 KiB cap MUST NOT
 * apply to definitions). Definition and recipe paths are never taken
 * from a request parameter: they come from the manifest entry only.
 *
 * Base precedence: an explicitly passed base always wins. The dev
 * override (`KODY_CATALOG_BASE`) applies only when the caller passes
 * no base, so an explicit base is never silently replaced at fetch
 * time. The registry is the single precedence point for its paths:
 * agent calls resolve explicit > override > installed-Store base,
 * and the browser management API (which takes no explicit base)
 * resolves override > acting Store's declared base; the resolved base
 * is passed on explicitly and used as-is. Bare fetch-layer calls with
 * no base resolve the same way (override, else refuse).
 *
 * Failure degrades honestly: a failed manifest fetch is an error the
 * Store shows alongside installed apps (never a blank Store); a cached
 * manifest served from the short-TTL cache or used as fallback is
 * labeled as cached with its age. Definitions are fetched on demand:
 * row display reads each entry's definition.json only (no bundle
 * assembly); bundle files are fetched only for install/update (full
 * definition assembly), never prefetched for every app.
 *
 * ES2019 ceiling: no ?. and no ?? in this file.
 */

import type { AppDefinition } from './types.ts'

/**
 * Validate a catalog base URL and normalize it to a trailing-slash
 * form. HTTPS-only, with a loopback `http` carve-out for local dev.
 * Throws before any fetch when the base is missing or refused.
 */
/** True when a fetch URL is allowed: any HTTPS host, or `http` only
 * to the exact loopback hosts 127.0.0.1 / localhost / ::1. The hostname
 * is parsed with `URL` (never a string prefix), so lookalikes such as
 * `http://localhost.evil.com/`, `http://127.0.0.1.evil.com/`, and
 * `http://127.0.0.1@evil.com/` (real host `evil.com`) are refused.
 * ES2019: no ?. and no ??. */
function isAllowedCatalogUrl(url: string): boolean {
  var parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch (err) {
    return false
  }
  if (parsed.protocol.toLowerCase() === 'https:') return true
  if (parsed.protocol.toLowerCase() !== 'http:') return false
  var host = parsed.hostname.toLowerCase()
  if (host.charAt(0) === '[' && host.charAt(host.length - 1) === ']') host = host.slice(1, -1)
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

export function normalizeCatalogBase(base: unknown): string {
  if (typeof base !== 'string' || base === '') throw new Error('catalog base must be a non-empty URL string')
  var out = base
  if (out.slice(-1) !== '/') out = out + '/'
  if (!isAllowedCatalogUrl(out)) throw new Error('catalog base refused (HTTPS only, loopback http for local dev)')
  return out
}

var FETCH_TIMEOUT_MS = 8000
var MANIFEST_MAX_BYTES = 65536
var DEFINITION_MAX_BYTES = 524288
var BUNDLE_FILE_MAX_BYTES = 262144
var RECIPE_MAX_BYTES = 65536

export type CatalogInstallMode = 'json' | 'recipe-only'

export interface CatalogSummary {
  id: string
  name: string
  label: string
  icon?: string
  category?: string
  description?: string
  installMode: CatalogInstallMode
  /** Manifest-relative path of the app recipe, e.g. app-store/RECIPE.md. */
  recipePath: string
  /** Minimum shell version the entry's definition.json declares, when present. */
  minPackageVersion?: string
  /** Definition schema the entry's definition.json carries, when known. */
  schemaVersion?: number
}

interface ManifestEntry {
  id: string
  label: string
  catalogVersion: number
  fingerprint: string
  installMode: CatalogInstallMode
  definitionPath: string
  recipePath: string
  bundleFiles: string[]
}

interface CatalogManifest {
  entries: ManifestEntry[]
  releaseLabel: string
  cached: boolean
}

var manifestCache: Record<string, { entries: ManifestEntry[]; releaseLabel: string; at: number }> = {}

/** Fresh-cache window for the manifest: sequential row reads within one
 * Store listing reuse the first fetch instead of refetching per row.
 * A stale entry still falls back to the cached copy with its age shown. */
var MANIFEST_TTL_MS = 30000

function cachedReleaseLabel(releaseLabel: string, at: number, now: number): string {
  var ageSec = Math.max(0, Math.floor((now - at) / 1000))
  return releaseLabel + ' (cached ' + String(ageSec) + 's ago)'
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}

/** Dev-only override: when set to an HTTPS or loopback base, it is
 * used only when the caller passes no base. Kept as-is; it is an
 * override, not a catalog source. Exported for the registry's
 * agent-call base resolution; the fetch layer below applies it the
 * same way for bare calls, so an explicitly passed base always wins
 * in both layers. Dev-only by convention (the environment variable
 * is set for local verification): not enforced in code. */
export function devOverrideBase(): string | null {
  var overrideBase = ''
  try {
    var procHolder = globalThis as unknown as Record<string, unknown>
    var proc = procHolder['process'] as Record<string, unknown> | undefined
    if (proc && proc['env']) {
      var env = proc['env'] as Record<string, string | undefined>
      if (env && typeof env['KODY_CATALOG_BASE'] === 'string') overrideBase = env['KODY_CATALOG_BASE'] as string
    }
  } catch (err) {
    overrideBase = ''
  }
  try {
    var g = globalThis as unknown as Record<string, unknown>
    if (overrideBase === '' && typeof g['KODY_CATALOG_BASE'] === 'string') overrideBase = g['KODY_CATALOG_BASE'] as string
  } catch (err) {
    // ignore
  }
  if (overrideBase === '') return null
  try {
    return normalizeCatalogBase(overrideBase)
  } catch (err) {
    // A rejected override falls back to the declared base.
    return null
  }
}

/** Resolve the base actually fetched: an explicitly passed base always
 * wins (validated); only when the caller passes no base does the dev
 * override apply. Throws before any fetch when neither yields a usable
 * base. The registry resolves the same precedence (explicit > override
 * > installed-Store base) before calling, so a resolved base passed in
 * here is used as-is and never replaced. */
function resolveFetchBase(declaredBase: string | undefined): string {
  if (declaredBase !== undefined) return normalizeCatalogBase(declaredBase)
  var override = devOverrideBase()
  if (override !== null) return override
  throw new Error('catalog base must be a non-empty URL string')
}

/** Short label derived from the base for the Store display: the
 * base itself (trailing slash stripped), prefixed `local:` for
 * loopback dev bases. No catalog host is named here — the shell
 * fetches only the passed base. */
export function catalogLabelForBase(base: string): string {
  var lower = base.toLowerCase()
  if (lower.indexOf('http://') === 0) return 'local:' + base
  return base.replace(/\/$/, '')
}

/**
 * GitHub ref (branch or tag) of a raw.githubusercontent catalog base,
 * or null for any other base. The ref is the display label for a
 * pinned snapshot, never a fetch identity on its own.
 */
export function catalogGitHubRef(base: string): string | null {
  var parsed = parseGitHubRawBase(base)
  return parsed === null ? null : parsed.ref
}

/**
 * Tag label for a pinned GitHub-raw base: the bare ref (e.g. '4.1.11')
 * when the base is a raw.githubusercontent base whose ref is not
 * 'main'; null otherwise (main, loopback, or any other base). The
 * Store status line shows this instead of the full base URL when the
 * listing base is pinned to a tag. It names no snapshot beyond the ref
 * in the URL itself, so it claims nothing resolved or stale.
 */
export function catalogTagLabel(base: string): string | null {
  var ref = catalogGitHubRef(base)
  if (ref === null || ref === 'main') return null
  return ref
}

/**
 * Shared GitHub-raw base parsing: a normalized catalog base of the
 * form https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<tail>
 * (tail is the path after the ref, e.g. catalog/) yields its parts;
 * any other base yields null.
 */
function parseGitHubRawBase(base: string): { owner: string; repo: string; ref: string; tail: string } | null {
  var rawPrefix = 'https://raw.githubusercontent.com/'
  if (base.indexOf(rawPrefix) !== 0) { return null }
  var rest = base.slice(rawPrefix.length)
  var firstSlash = rest.indexOf('/')
  if (firstSlash === -1) { return null }
  var owner = rest.slice(0, firstSlash)
  var rest2 = rest.slice(firstSlash + 1)
  var secondSlash = rest2.indexOf('/')
  if (secondSlash === -1) { return null }
  var repo = rest2.slice(0, secondSlash)
  var rest3 = rest2.slice(secondSlash + 1)
  var thirdSlash = rest3.indexOf('/')
  if (thirdSlash === -1) { return null }
  return { owner: owner, repo: repo, ref: rest3.slice(0, thirdSlash), tail: rest3.slice(thirdSlash + 1) }
}


/**
 * Full URL of an app install recipe for an agent to follow: the Help
 * page blob form for GitHub raw bases, so a pinned tag or branch
 * shows in the URL instead of always reading main; the raw URL itself
 * for any other base (loopback dev bases included), which an agent can
 * fetch directly. base is a normalized catalog base (trailing slash);
 * recipePath is the manifest-relative recipe path, e.g.
 * app-store/RECIPE.md.
 */
export function recipeUrlForBase(base: string, recipePath: string): string {
  var parsed = parseGitHubRawBase(base)
  if (parsed) {
    return 'https://github.com/' + parsed.owner + '/' + parsed.repo + '/blob/' + parsed.ref + '/' + parsed.tail + recipePath
  }
  return base + recipePath
}

/**
 * Full URL of an app's catalog folder in GitHub tree form, built from
 * the resolved catalog base the same way recipeUrlForBase builds the
 * recipe URL (same ref — a pinned tag lands in it instead of main).
 * For any other base, the base plus the app id plus a trailing slash
 * (a loopback folder URL is not a browsable listing).
 */
export function folderUrlForBase(base: string, id: string): string {
  var parsed = parseGitHubRawBase(base)
  if (parsed) {
    return 'https://github.com/' + parsed.owner + '/' + parsed.repo + '/tree/' + parsed.ref + '/' + parsed.tail + id
  }
  return base + id + '/'
}

/**
 * Display URL of the catalog directory itself (no app id): the
 * GitHub tree form for GitHub raw bases, the base URL otherwise.
 * No trailing slash, matching the loading text the Store derives
 * from row folder URLs. Used by the management `info` action so
 * the bundle can name the real catalog source before rows load.
 */
export function catalogDirUrl(base: string): string {
  var url = folderUrlForBase(base, '')
  while (url.length > 0 && url.charAt(url.length - 1) === '/') { url = url.slice(0, -1) }
  return url
}

export function get_catalog_source(base?: string): { baseUrl: string; releaseLabel: string } {
  var useBase = resolveFetchBase(base)
  return { baseUrl: useBase, releaseLabel: catalogLabelForBase(useBase) }
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  var pending = fetch(url, { redirect: 'follow' })
  var timeout = new Promise<Response>(function (_resolve, reject) {
    setTimeout(function () {
      reject(new Error('catalog fetch timed out'))
    }, ms)
  })
  return Promise.race([pending, timeout])
}

function isSafeManifestPath(path: string, id: string, kind: string): boolean {
  if (typeof path !== 'string' || path === '' || path.charAt(0) === '/' || path.indexOf('\\') !== -1 || path.indexOf('..') !== -1) return false
  var want = id + '/' + kind
  if (path !== want) return false
  var segs = path.split('/')
  if (segs.length !== 2) return false
  if (!isSlug(segs[0]) || segs[0] !== id) return false
  if (segs[1] !== kind) return false
  return true
}

function validateManifestEntry(raw: unknown): ManifestEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  var r = raw as Record<string, unknown>
  if (!isSlug(r['id'])) return null
  var id = r['id'] as string
  if (typeof r['label'] !== 'string' || (r['label'] as string) === '') return null
  if (typeof r['catalogVersion'] !== 'number' || !isFinite(r['catalogVersion'] as number) || Math.floor(r['catalogVersion'] as number) !== (r['catalogVersion'] as number) || (r['catalogVersion'] as number) < 1) return null
  if (typeof r['fingerprint'] !== 'string' || (r['fingerprint'] as string) === '') return null
  var mode = r['installMode']
  if (mode !== 'json' && mode !== 'recipe-only') return null
  if (typeof r['definitionPath'] !== 'string' || !isSafeManifestPath(r['definitionPath'] as string, id, 'definition.json')) return null
  if (typeof r['recipePath'] !== 'string' || !isSafeManifestPath(r['recipePath'] as string, id, 'RECIPE.md')) return null
  var bf = r['bundleFiles']
  if (!Array.isArray(bf) || bf.length === 0) return null
  for (var i = 0; i < bf.length; i++) {
    var p = bf[i]
    if (typeof p !== 'string' || p === '' || p.charAt(0) === '/' || p.indexOf('\\') !== -1 || p.indexOf('..') !== -1) return null
    var segs = (p as string).split('/')
    if (segs.length > 2) return null
    var ok = false
    for (var s = 0; s < segs.length; s++) {
      if (segs[s] === '' || segs[s] === '.') return null
      if (!/^[A-Za-z0-9._-]+$/.test(segs[s])) return null
    }
    var last = segs[segs.length - 1]
    if (last.slice(-5) === '.html' || last.slice(-4) === '.css' || last.slice(-3) === '.js') ok = true
    if (!ok) return null
  }
  if ((bf as string[]).indexOf('index.html') === -1) return null
  return {
    id: id,
    label: r['label'] as string,
    catalogVersion: r['catalogVersion'] as number,
    fingerprint: r['fingerprint'] as string,
    installMode: mode as CatalogInstallMode,
    definitionPath: r['definitionPath'] as string,
    recipePath: r['recipePath'] as string,
    bundleFiles: (bf as string[]).slice().sort(),
  }
}

function validateManifestShape(raw: unknown): ManifestEntry[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  var apps = (raw as Record<string, unknown>)['apps']
  if (!Array.isArray(apps)) return null
  var out: ManifestEntry[] = []
  for (var i = 0; i < apps.length; i++) {
    var entry = validateManifestEntry(apps[i])
    if (entry === null) return null
    out.push(entry)
  }
  out.sort(function (a, b) {
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })
  for (var j = 1; j < out.length; j++) {
    if (out[j].id === out[j - 1].id) return null
  }
  return out
}

async function fetchTextWithCap(url: string, maxBytes: number): Promise<string> {
  if (!isAllowedCatalogUrl(url)) throw new Error('catalog fetch blocked (HTTPS only)')
  if (typeof fetch !== 'function') throw new Error('fetch unavailable')
  var res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
  var finalUrl: unknown = null
  try {
    finalUrl = (res as unknown as Record<string, unknown>)['url']
  } catch (err) {
    finalUrl = null
  }
  if (typeof finalUrl === 'string' && finalUrl !== '' && !isAllowedCatalogUrl(finalUrl)) throw new Error('catalog fetch blocked (HTTPS only)')
  if (!res.ok) throw new Error('catalog upstream HTTP ' + String(res.status))
  var body = await res.text()
  if (body === '' || body.length > maxBytes) throw new Error('catalog upstream body rejected')
  return body
}

async function fetchCatalogManifestFresh(base: string): Promise<ManifestEntry[]> {
  var body = await fetchTextWithCap(base + 'catalog.json', MANIFEST_MAX_BYTES)
  var raw: unknown = null
  try {
    raw = JSON.parse(body)
  } catch (err) {
    throw new Error('catalog manifest is not JSON')
  }
  var entries = validateManifestShape(raw)
  if (entries === null) throw new Error('catalog manifest shape invalid')
  return entries
}

/**
 * Read the manifest at the caller's base, using the in-memory cache
 * (keyed by base) as fallback. Never throws for the cached-fallback
 * case: returns cached entries labeled as cached. Throws when the
 * base is refused and when there is no manifest at all.
 */
export async function readCatalogManifest(base?: string): Promise<CatalogManifest> {
  var useBase = resolveFetchBase(base)
  var label = catalogLabelForBase(useBase)
  var now = Date.now()
  var fresh = manifestCache[useBase]
  if (fresh !== undefined && now - fresh.at < MANIFEST_TTL_MS) {
    return { entries: fresh.entries, releaseLabel: cachedReleaseLabel(fresh.releaseLabel, fresh.at, now), cached: true }
  }
  try {
    var entries = await fetchCatalogManifestFresh(useBase)
    manifestCache[useBase] = { entries: entries, releaseLabel: label, at: Date.now() }
    return { entries: entries, releaseLabel: label, cached: false }
  } catch (err) {
    var hit = manifestCache[useBase]
    if (hit !== undefined) {
      return { entries: hit.entries, releaseLabel: cachedReleaseLabel(hit.releaseLabel, hit.at, Date.now()), cached: true }
    }
    throw err
  }
}

function definitionDirOf(definitionPath: string): string {
  var idx = definitionPath.lastIndexOf('/')
  if (idx === -1) return ''
  return definitionPath.slice(0, idx)
}

async function fetchDefinitionJson(base: string, entry: ManifestEntry): Promise<AppDefinition | null> {
  var body: string
  try {
    body = await fetchTextWithCap(base + entry.definitionPath, DEFINITION_MAX_BYTES)
  } catch (err) {
    return null
  }
  var parsed: unknown = null
  try {
    parsed = JSON.parse(body)
  } catch (err) {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  var def = parsed as AppDefinition
  if (def.id !== entry.id) return null
  return def
}

/**
 * Summaries for the Store listing: membership and order come from the
 * manifest; display fields come from each entry's definition.json.
 * A definition fetch failure for one entry falls back to the manifest
 * label so one bad definition never blanks the Store.
 */
export async function list_catalog(base?: string): Promise<CatalogSummary[]> {
  var useBase = resolveFetchBase(base)
  var manifest = await readCatalogManifest(useBase)
  var out: CatalogSummary[] = []
  for (var i = 0; i < manifest.entries.length; i++) {
    var entry = manifest.entries[i]
    var def = await fetchDefinitionJson(useBase, entry)
    if (def !== null) {
      var minRaw = (def as unknown as Record<string, unknown>)['minPackageVersion']
      var schemaRaw = (def as unknown as Record<string, unknown>)['schemaVersion']
      out.push({
        id: entry.id,
        name: def.name,
        label: entry.label,
        icon: (def as AppDefinition).icon,
        category: (def as AppDefinition).category,
        description: (def as AppDefinition).description,
        installMode: entry.installMode,
        recipePath: entry.recipePath,
        minPackageVersion: typeof minRaw === 'string' ? minRaw : undefined,
        schemaVersion: typeof schemaRaw === 'number' ? schemaRaw as number : undefined,
      })
    } else {
      out.push({
        id: entry.id,
        name: entry.label,
        label: entry.label,
        icon: undefined,
        category: undefined,
        description: undefined,
        installMode: entry.installMode,
        recipePath: entry.recipePath,
      })
    }
  }
  return out
}

/** Manifest entry for one id, or null for unknown ids and fetch failures. */
export async function get_catalog_entry(id: string, base?: string): Promise<ManifestEntry | null> {
  if (!isSlug(id)) return null
  var manifest: CatalogManifest
  try {
    manifest = await readCatalogManifest(base)
  } catch (err) {
    return null
  }
  for (var i = 0; i < manifest.entries.length; i++) {
    if (manifest.entries[i].id === id) return manifest.entries[i]
  }
  return null
}

/**
 * Lightweight definition for row display, or null for unknown ids and
 * fetch failures (no write): the entry's definition.json only, with no
 * bundle assembly (no bundle-file fetches). Install/update paths must
 * keep using `get_catalog_definition` for the full assembled bundle.
 */
export async function get_catalog_definition_meta(id: string, base?: string): Promise<AppDefinition | null> {
  if (!isSlug(id)) return null
  var useBase: string
  try {
    useBase = resolveFetchBase(base)
  } catch (err) {
    return null
  }
  var manifest: CatalogManifest
  try {
    manifest = await readCatalogManifest(useBase)
  } catch (err) {
    return null
  }
  var entry: ManifestEntry | null = null
  for (var i = 0; i < manifest.entries.length; i++) {
    if (manifest.entries[i].id === id) entry = manifest.entries[i]
  }
  if (entry === null) return null
  return fetchDefinitionJson(useBase, entry)
}

/**
 * Full definition for install, or null for unknown ids and fetch
 * failures (no write). Manifest-list bundles are assembled to the
 * runtime files map by fetching each listed bundle file; paths come
 * from the manifest entry only, never from a request parameter.
 */
export async function get_catalog_definition(id: string, base?: string): Promise<AppDefinition | null> {
  var def = await get_catalog_definition_meta(id, base)
  if (def === null) return null
  var manifest: CatalogManifest
  var useBase: string
  try {
    useBase = resolveFetchBase(base)
    manifest = await readCatalogManifest(useBase)
  } catch (err) {
    return null
  }
  var entry: ManifestEntry | null = null
  for (var i = 0; i < manifest.entries.length; i++) {
    if (manifest.entries[i].id === id) entry = manifest.entries[i]
  }
  if (entry === null) return null
  var raw = (def as unknown as Record<string, unknown>)['bundle'] as Record<string, unknown>
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw['files'])) {
    // Inline files map already (unexpected for catalog, but pass through).
    return def
  }
  var files = raw['files'] as string[]
  var dir = definitionDirOf(entry.definitionPath)
  var assembled: Record<string, string> = {}
  for (var f = 0; f < files.length; f++) {
    var p = files[f]
    if (typeof p !== 'string' || p === '' || p.charAt(0) === '/' || p.indexOf('..') !== -1 || p.indexOf('\\') !== -1) return null
    var url = useBase + dir + '/' + p
    var content: string
    try {
      content = await fetchTextWithCap(url, BUNDLE_FILE_MAX_BYTES)
    } catch (err) {
      return null
    }
    assembled[p] = content
  }
  var out = JSON.parse(JSON.stringify(def)) as AppDefinition
  ;(out as unknown as Record<string, unknown>)['bundle'] = { entry: 'index.html', files: assembled }
  return out
}

/** Recipe text for one id, or null for unknown ids and fetch failures. */
export async function get_catalog_recipe(id: string, base?: string): Promise<string | null> {
  if (!isSlug(id)) return null
  var useBase: string
  try {
    useBase = resolveFetchBase(base)
  } catch (err) {
    return null
  }
  var manifest: CatalogManifest
  try {
    manifest = await readCatalogManifest(useBase)
  } catch (err) {
    return null
  }
  var entry: ManifestEntry | null = null
  for (var i = 0; i < manifest.entries.length; i++) {
    if (manifest.entries[i].id === id) entry = manifest.entries[i]
  }
  if (entry === null) return null
  try {
    return await fetchTextWithCap(useBase + entry.recipePath, RECIPE_MAX_BYTES)
  } catch (err) {
    return null
  }
}
