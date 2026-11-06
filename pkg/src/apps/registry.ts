/**
 * Reference implementation of the Phase 2 app-layer contract.
 *
 * Server-side only (uses storage.ts). Callable signatures for the MCP
 * interface from the handoff Phase 2 + clarification:
 *
 *   list_apps() -> AppSummary[]
 *   get_app_state(id) -> AppState
 *   act(id, action, args?) -> { ok, state? | error? }
 *   add_app(definition) -> registry write only, no republish
 *   remove_app(id) -> uninstall definition + state + all reference lists
 *   export_app(id) -> complete AppExport JSON
 *   plus: get_app(id), import_app(json) — blank-install import without code changes
 *
 * Rules enforced: state lives in storage; every action is validated BEFORE
 * any mutation; a bad action returns { ok:false } and the stored state is
 * untouched (state is computed on a copy and written with a single set).
 *
 * Identity follows ReKindle: `id` is the stable slug (routes, storage keys),
 * `name` the display name. Export format is kody-os-app/2; v1 payloads and
 * bare definitions import with id derived from name.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import type {
	ActionDef,
	ActResult,
	AppDefinition,
	AppExport,
	OpenAs,
	AppState,
	AppSummary,
	ProxyDecl,
	StateFieldDef,
} from './types.ts'
import { get_catalog_definition, list_catalog } from './catalog.ts'
import {
	RECENT_CAP,
	createMemoryStore,
	defKey,
	deleteKey,
	readHidden,
	readHomepage,
	readJson,
	readPinned,
	readRecent,
	readRegistry,
	resolveStore,
	stateKey,
	writeHidden,
	writeHomepage,
	writeJson,
	writePinned,
	writeRecent,
	writeRegistry,
	type KeyStore,
} from './storage.ts'
import { DEFINITION_SCHEMA_VERSION } from './types.ts'

var NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
var EXPORT_FORMAT = 'kody-os-app/2'
var EXPORT_FORMAT_V1 = 'kody-os-app/1'

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneState(state: AppState): AppState {
	return JSON.parse(JSON.stringify(state)) as AppState
}

function reqStr(obj: Record<string, unknown>, key: string): string | undefined {
	var v = obj[key]
	return typeof v === 'string' ? v : undefined
}

/** Total-bytes cap for all files in one bundle (256 KiB of the 16 MiB shared budget). */
export var BUNDLE_CAP_BYTES = 256 * 1024

/** Default append cap: oldest entries drop first once the list passes this length. */
export var APPEND_CAP = 500

/** Default append entry cap: maximum UTF-8 bytes per appended string entry. */
export var APPEND_MAX_ENTRY_BYTES = 2048

/** UTF-8 byte length. TextEncoder ships in the Worker runtime, Node 22, and
 * Scribe browsers, so reference it through a typeof guard (safe when absent)
 * instead of dynamic code. Falls back to a URI-encoding estimate. */
declare var TextEncoder: undefined | { new (): { encode(value: string): Uint8Array } }
function byteLength(value: string): number {
	try {
		if (typeof TextEncoder !== 'undefined' && TextEncoder) return new TextEncoder().encode(value).length
	} catch (err) {
		// fall through to the estimate below
	}
	return encodeURIComponent(value).replace(/%[0-9A-Fa-f]{2}/g, 'x').length
}

/** Bundle paths are relative .html/.js/.css only, at most one level deep, no '..', no absolute paths. */
function isBundlePath(path: string): boolean {
	if (path === '' || path.charAt(0) === '/' || path.indexOf('\\') !== -1 || path.indexOf('..') !== -1) return false
	var segs = path.split('/')
	if (segs.length > 2) return false
	for (var si = 0; si < segs.length; si++) {
		var seg = segs[si]
		if (seg === '' || seg === '.') return false
		if (!/^[A-Za-z0-9._-]+$/.test(seg)) return false
	}
	var last = segs[segs.length - 1]
	if (last.slice(-5) === '.html') return last.length > 5
	if (last.slice(-4) === '.css') return last.length > 4
	if (last.slice(-3) === '.js') return last.length > 3
	return false
}

/**
 * Inline-SVG icon allowlist. Icons are the only author-supplied markup the
 * shell inserts unescaped, so validation is the single choke point: basic
 * shapes only, monochrome fill/stroke values only, no scripting, no external
 * refs, no animation, no inline style. Unknown elements reject the whole icon;
 * unknown benign attributes are stripped.
 */
var SVG_ICON_TAGS = ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'title']
var SVG_ICON_ATTRS = [
	'xmlns',
	'viewbox',
	'width',
	'height',
	'fill',
	'stroke',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-miterlimit',
	'stroke-dasharray',
	'stroke-opacity',
	'fill-opacity',
	'fill-rule',
	'opacity',
	'd',
	'cx',
	'cy',
	'r',
	'rx',
	'ry',
	'x',
	'x1',
	'x2',
	'y',
	'y1',
	'y2',
	'points',
	'transform',
	'role',
	'aria-hidden',
	'focusable',
]
var SVG_MONO_VALUES = ['none', 'currentcolor', 'inherit', 'black', 'white', '#000', '#000000', '#fff', '#ffffff']

/** True when a string icon is the inline-SVG variant (leading whitespace ignored). */
export function isSvgIcon(value: string): boolean {
	return value.replace(/^\s+/, '').toLowerCase().indexOf('<svg') === 0
}

function svgIconProblem(message: string): { ok: false; error: string } {
	return { ok: false as const, error: 'definition.icon ' + message }
}

function isNameChar(character: string): boolean {
	return /[A-Za-z0-9:_-]/.test(character)
}

function isSpaceChar(character: string): boolean {
	return /\s/.test(character)
}

/**
 * Validate and normalize an inline-SVG icon. Returns the canonical markup to
 * store, or an error naming the offending construct. DOM-free: the Worker has
 * no parser, so this is a small strict tokenizer plus an allowlist.
 */
export function sanitizeSvgIcon(value: string): { ok: true; icon: string } | { ok: false; error: string } {
	var source = value.replace(/^\s+/, '').replace(/\s+$/, '')
	if (source.toLowerCase().indexOf('<svg') !== 0) return svgIconProblem('SVG must start with <svg')
	var pos = 0
	var out: string[] = []
	var stack: string[] = []
	var rootCount = 0
	var inTitle = false
	while (pos < source.length) {
		var lt = source.indexOf('<', pos)
		if (lt === -1) {
			var tail = source.slice(pos)
			if (tail.replace(/\s+/g, '') !== '') {
				if (!inTitle) return svgIconProblem('has text outside a <title> element')
				if (tail.indexOf('&') !== -1) return svgIconProblem('title text contains "&"')
				out.push(tail)
			}
			pos = source.length
			break
		}
		if (lt > pos) {
			var text = source.slice(pos, lt)
			if (text.replace(/\s+/g, '') !== '') {
				if (!inTitle) return svgIconProblem('has text outside a <title> element')
				if (text.indexOf('&') !== -1) return svgIconProblem('title text contains "&"')
				out.push(text)
			}
		}
		if (source.substr(lt, 4) === '<!--' || source.substr(lt, 2) === '<!' || source.substr(lt, 2) === '<?') {
			return svgIconProblem('contains a comment, doctype, or processing instruction')
		}
		pos = lt + 1
		var closing = source.charAt(pos) === '/'
		if (closing) pos++
		var nameStart = pos
		while (pos < source.length && isNameChar(source.charAt(pos))) pos++
		var name = source.slice(nameStart, pos).toLowerCase()
		if (name === '') return svgIconProblem('has a malformed tag')
		if (SVG_ICON_TAGS.indexOf(name) === -1) return svgIconProblem('uses a disallowed element <' + name + '>')
		if (closing) {
			while (pos < source.length && isSpaceChar(source.charAt(pos))) pos++
			if (source.charAt(pos) !== '>') return svgIconProblem('has a malformed closing tag </' + name + '>')
			pos++
			if (stack.length === 0 || stack[stack.length - 1] !== name) return svgIconProblem('has a mismatched </' + name + '>')
			stack.pop()
			if (name === 'title') inTitle = false
			out.push('</' + name + '>')
			continue
		}
		var attrs: string[] = []
		var selfClosing = false
		while (pos < source.length) {
			while (pos < source.length && isSpaceChar(source.charAt(pos))) pos++
			if (pos >= source.length) return svgIconProblem('has an unclosed <' + name + '>')
			var marker = source.charAt(pos)
			if (marker === '>') {
				pos++
				break
			}
			if (marker === '/' && source.charAt(pos + 1) === '>') {
				selfClosing = true
				pos += 2
				break
			}
			var attrStart = pos
			while (pos < source.length && !/[\s=/>]/.test(source.charAt(pos))) pos++
			var attrName = source.slice(attrStart, pos)
			if (attrName === '') return svgIconProblem('has a malformed attribute')
			var lowerAttr = attrName.toLowerCase()
			while (pos < source.length && isSpaceChar(source.charAt(pos))) pos++
			var attrValue: string | undefined
			if (source.charAt(pos) === '=') {
				pos++
				while (pos < source.length && isSpaceChar(source.charAt(pos))) pos++
				var quote = source.charAt(pos)
				if (quote === '"' || quote === "'") {
					pos++
					var valueStart = pos
					while (pos < source.length && source.charAt(pos) !== quote) pos++
					if (pos >= source.length) return svgIconProblem('has an unterminated attribute value')
					attrValue = source.slice(valueStart, pos)
					pos++
				} else {
					var rawStart = pos
					while (pos < source.length && !/[\s>]/.test(source.charAt(pos))) pos++
					attrValue = source.slice(rawStart, pos)
				}
			}
			if (lowerAttr.indexOf('on') === 0) return svgIconProblem('has an event handler attribute "' + lowerAttr + '"')
			if (lowerAttr === 'style') return svgIconProblem('has a style attribute')
			if (lowerAttr === 'href' || lowerAttr === 'xlink:href' || lowerAttr === 'src') {
				return svgIconProblem('has an external reference attribute "' + lowerAttr + '"')
			}
			if (SVG_ICON_ATTRS.indexOf(lowerAttr) === -1) continue
			var valueText = attrValue === undefined ? '' : attrValue
			var lowerValue = valueText.toLowerCase()
			if (
				lowerValue.indexOf('url(') !== -1 ||
				lowerValue.indexOf('javascript:') !== -1 ||
				lowerValue.indexOf('data:') !== -1 ||
				lowerValue.indexOf('expression(') !== -1
			) {
				return svgIconProblem('has an external or script reference in "' + lowerAttr + '"')
			}
			if (lowerAttr === 'xmlns' && valueText !== 'http://www.w3.org/2000/svg') {
				return svgIconProblem('has a non-SVG xmlns')
			}
			if ((lowerAttr === 'fill' || lowerAttr === 'stroke') && SVG_MONO_VALUES.indexOf(lowerValue) === -1) {
				return svgIconProblem('uses non-monochrome ' + lowerAttr + ' "' + valueText + '"')
			}
			if (attrValue === undefined) {
				attrs.push(attrName)
			} else {
				attrs.push(
					attrName +
						'="' +
						valueText.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
						'"',
				)
			}
		}
		if (stack.length === 0) {
			if (name !== 'svg') return svgIconProblem('must be a single <svg> root')
			rootCount++
			if (rootCount > 1) return svgIconProblem('has more than one root element')
		}
		out.push('<' + name + (attrs.length === 0 ? '' : ' ' + attrs.join(' ')) + (selfClosing ? ' />' : '>'))
		if (!selfClosing) {
			stack.push(name)
			if (name === 'title') inTitle = true
		}
	}
	if (stack.length !== 0) return svgIconProblem('has an unclosed <' + stack[stack.length - 1] + '>')
	if (rootCount !== 1) return svgIconProblem('must be a single <svg> root')
	return { ok: true as const, icon: out.join('') }
}

/** Validate the bundle manifest of a unified app definition. Returns an error string, or null when valid. */
function validateBundleManifest(def: Record<string, unknown>): string | null {
	if (!isRecord(def['bundle'])) return 'definition.bundle must be an object (every unified app ships its own UI files)'
	var manifest = def['bundle'] as Record<string, unknown>
	if (manifest['entry'] !== 'index.html') return 'definition.bundle.entry must be "index.html"'
	if (!isRecord(manifest['files'])) return 'definition.bundle.files must be an object'
	var files = manifest['files'] as Record<string, unknown>
	var paths = Object.keys(files)
	if (paths.indexOf('index.html') === -1) return 'definition.bundle.files is missing the entry "index.html"'
	var total = 0
	for (var pi = 0; pi < paths.length; pi++) {
		var path = paths[pi]
		if (!isBundlePath(path)) {
			return 'definition.bundle.files has bad path "' + path + '" (relative .html/.js/.css only, no "..", no absolute paths)'
		}
		if (typeof files[path] !== 'string') {
			return 'definition.bundle.files."' + path + '" must be a string'
		}
		total += byteLength(files[path] as string)
	}
	if (total > BUNDLE_CAP_BYTES) {
		return 'definition.bundle.files total ' + total + ' bytes exceeds the 256 KiB cap'
	}
	return null
}

function validateUpstreamEntries(kind: string, entries: unknown): string | null {
	if (!Array.isArray(entries)) return 'definition.capabilities.' + kind + ' must be an array'
	if (entries.length > 8) return 'definition.capabilities.' + kind + ' allows at most 8 entries'
	var seen: string[] = []
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i]
		var prefix = 'definition.capabilities.' + kind + '[' + String(i) + ']'
		if (!isRecord(entry)) return prefix + ' must be an object'
		var name = entry['name']
		if (typeof name !== 'string' || !NAME_RE.test(name)) return prefix + '.name must match ^[a-z0-9][a-z0-9-]{0,63}$'
		if (seen.indexOf(name) !== -1) return prefix + '.name is duplicated'
		seen.push(name)
		var url = entry['url']
		if (typeof url !== 'string') return prefix + '.url must be a string'
		try {
			var parsed = new URL(url)
			if (parsed.protocol !== 'https:') return prefix + '.url must use https:'
			if (parsed.hostname === '' || parsed.username !== '' || parsed.password !== '') return prefix + '.url must be a bare https URL with no credentials'
		} catch (err) {
			return prefix + '.url must be a valid URL'
		}
		var ttl = entry['ttlSeconds']
		if (ttl !== undefined && (!Number.isSafeInteger(ttl) || (ttl as number) < 60 || (ttl as number) > 86400)) {
			return prefix + '.ttlSeconds must be an integer from 60 to 86400'
		}
		var maxBytes = entry['maxBytes']
		if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || (maxBytes as number) < 1024 || (maxBytes as number) > 262144)) {
			return prefix + '.maxBytes must be an integer from 1024 to 262144'
		}
	}
	return null
}

function validateCapabilities(def: Record<string, unknown>): string | null {
	var caps = def['capabilities']
	if (caps === undefined) return null
	if (!isRecord(caps)) return 'definition.capabilities must be an object'
	var capsRec = caps as Record<string, unknown>
	for (var key of Object.keys(capsRec)) {
		if (key !== 'feeds' && key !== 'manageApps' && key !== 'proxy') return 'definition.capabilities.' + key + ' is unknown'
	}
	if (capsRec['manageApps'] !== undefined && typeof capsRec['manageApps'] !== 'boolean') return 'definition.capabilities.manageApps must be a boolean'
	if (capsRec['feeds'] !== undefined) {
		var feedsErr = validateUpstreamEntries('feeds', capsRec['feeds'])
		if (feedsErr) return feedsErr
	}
	if (capsRec['proxy'] !== undefined) {
		var proxyErr = validateUpstreamEntries('proxy', capsRec['proxy'])
		if (proxyErr) return proxyErr
	}
	return null
}

function sanitizeUpstreamEntries(entries: unknown): { name: string; url: string; ttlSeconds: number; maxBytes: number }[] {
	var out: { name: string; url: string; ttlSeconds: number; maxBytes: number }[] = []
	if (!Array.isArray(entries)) return out
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i] as Record<string, unknown>
		out.push({
			name: entry['name'] as string,
			url: entry['url'] as string,
			ttlSeconds: typeof entry['ttlSeconds'] === 'number' ? (entry['ttlSeconds'] as number) : 3600,
			maxBytes: typeof entry['maxBytes'] === 'number' ? (entry['maxBytes'] as number) : 65536,
		})
	}
	return out
}

/** Normalize declared capabilities at install time so the handler only ever
 * sees defaults-applied values. Assumes validateCapabilities already passed. */
function sanitizeCapabilities(caps: unknown): import('./types.ts').AppCapabilities | undefined {
	if (!isRecord(caps)) return undefined
	var capsRec = caps as Record<string, unknown>
	var out: import('./types.ts').AppCapabilities = {}
	var hasAny = false
	if (capsRec['feeds'] !== undefined) {
		out.feeds = sanitizeUpstreamEntries(capsRec['feeds']) as import('./types.ts').FeedDecl[]
		hasAny = true
	}
	if (capsRec['manageApps'] !== undefined) {
		out.manageApps = capsRec['manageApps'] as boolean
		hasAny = true
	}
	if (capsRec['proxy'] !== undefined) {
		out.proxy = sanitizeUpstreamEntries(capsRec['proxy']) as ProxyDecl[]
		hasAny = true
	}
	return hasAny ? out : undefined
}

function upstreamHosts(entries: { url?: string }[] | undefined): string[] {
	var hosts: string[] = []
	if (!entries) return hosts
	for (var i = 0; i < entries.length; i++) {
		var url = entries[i].url
		if (typeof url !== 'string') continue
		try {
			var host = new URL(url).hostname
			if (host !== '' && hosts.indexOf(host) === -1) hosts.push(host)
		} catch (err) {
		}
	}
	return hosts
}

/** Plain-words summary of an app's declared capabilities, for Store
 * disclosure. Feed and proxy hosts are listed; manageApps is a flag. */
export interface CapabilitySummary {
	manageApps: boolean
	feedHosts: string[]
	proxyHosts: string[]
}

export function summarizeCapabilities(def: AppDefinition | null | undefined): CapabilitySummary {
	if (!def || !def.capabilities) return { manageApps: false, feedHosts: [], proxyHosts: [] }
	return {
		manageApps: def.capabilities.manageApps === true,
		feedHosts: upstreamHosts(def.capabilities.feeds),
		proxyHosts: upstreamHosts(def.capabilities.proxy),
	}
}

/** Capabilities the new definition adds over the old one, in plain
 * words, for the update-confirmation gate. Removing a capability or
 * changing only TTL/size parameters is not an addition. */
export function capabilityAdditions(oldDef: AppDefinition | null | undefined, newDef: AppDefinition | null | undefined): string[] {
	var additions: string[] = []
	if (!newDef) return additions
	var oldSummary = summarizeCapabilities(oldDef)
	var newSummary = summarizeCapabilities(newDef)
	if (newSummary.manageApps && !oldSummary.manageApps) additions.push('manage other apps')
	for (var i = 0; i < newSummary.feedHosts.length; i++) {
		if (oldSummary.feedHosts.indexOf(newSummary.feedHosts[i]) === -1) additions.push('feed host ' + newSummary.feedHosts[i])
	}
	for (var j = 0; j < newSummary.proxyHosts.length; j++) {
		if (oldSummary.proxyHosts.indexOf(newSummary.proxyHosts[j]) === -1) additions.push('proxy host ' + newSummary.proxyHosts[j])
	}
	return additions
}

/** Supported definition versions: 3 = legacy single-`effect` shape, 4 = v2 `effects[]` sequence, 5 = bridge era (nested/object values). */
export var SUPPORTED_SCHEMA_VERSIONS: number[] = [3, 4, 5]

/**
 * Normalize one action to the canonical `effects[]` shape for validation/storage.
 * Single-`effect` v1 actions expand to a one-entry `effects[]`; v2 actions
 * pass through unchanged. Non-objects pass through for the validator to reject.
 */
export function migrateAction(action: unknown): unknown {
	if (!isRecord(action)) return action
	var rec = action as Record<string, unknown>
	if (Array.isArray(rec['effects'])) return rec
	if (isRecord(rec['effect'])) {
		var out: Record<string, unknown> = {}
		for (var k of Object.keys(rec)) {
			if (k !== 'effect') out[k] = rec[k]
		}
		out['effects'] = [rec['effect']]
		return out
	}
	return rec
}

/**
 * Normalize one definition to the canonical `effects[]` shape (per-action
 * `migrateAction`). Non-objects pass through for the validator to reject.
 * Version and `ui.template` are left untouched: `validateDefinition` selects
 * the validator branch by version first.
 */
export function migrateDefinition(def: unknown): unknown {
	if (!isRecord(def)) return def
	var rec = def as Record<string, unknown>
	if (!isRecord(rec['actions'])) return def
	var actions = rec['actions'] as Record<string, unknown>
	var next: Record<string, unknown> = {}
	for (var name of Object.keys(actions)) next[name] = migrateAction(actions[name])
	var out: Record<string, unknown> = {}
	for (var key of Object.keys(rec)) out[key] = rec[key]
	out['actions'] = next
	return out
}

/**
 * Derive the default open mode from a definition's `ui`. An explicit
 * `openAs` wins; otherwise the deprecated `placements` derives it
 * (modal-only → modal, anything else → page); omitted fields → page.
 * Callers must have validated the definition first, so both fields
 * hold only known values here.
 */
export function deriveOpenAs(ui: unknown): OpenAs {
	if (!isRecord(ui)) return 'page'
	if (ui['openAs'] === 'page' || ui['openAs'] === 'modal') return ui['openAs'] as OpenAs
	var placements = ui['placements']
	if (Array.isArray(placements) && placements.indexOf('modal') !== -1 && placements.indexOf('page') === -1) return 'modal'
	return 'page'
}

/** Validate a unified app definition. Returns an error string, or null when valid. */
export function validateDefinition(def: unknown): string | null {
	if (!isRecord(def)) return 'definition must be an object'
	if ('kind' in def) {
		return 'definition.kind "' + String(def['kind']) + '" is retired; use the unified shape: meta + bundle { entry, files } + stateSchema + actions'
	}
	var id = reqStr(def, 'id')
	if (typeof id !== 'string' || !NAME_RE.test(id)) {
		return 'definition.id must match ^[a-z0-9][a-z0-9-]{0,63}$'
	}
	if (typeof reqStr(def, 'name') !== 'string' || (reqStr(def, 'name') as string).length === 0) {
		return 'definition.name must be a non-empty string'
	}
	if (def['label'] !== undefined && typeof def['label'] !== 'string') {
		return 'definition.label must be a string'
	}
	var schemaVersion = def['schemaVersion']
	if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion) || schemaVersion <= 0) {
		return 'definition.schemaVersion must be a positive integer; the current version is ' + DEFINITION_SCHEMA_VERSION
	}
	if (SUPPORTED_SCHEMA_VERSIONS.indexOf(schemaVersion) === -1) {
		return 'unsupported definition.schemaVersion ' + String(schemaVersion) + ' (supported: 3, 4, 5)'
	}
	if (def['catalogVersion'] !== undefined) {
		var catalogVersion = def['catalogVersion']
		if (typeof catalogVersion !== 'number' || !Number.isSafeInteger(catalogVersion) || catalogVersion < 1) {
			return 'definition.catalogVersion must be a positive integer'
		}
	}
	if (def['icon'] !== undefined) {
		if (typeof def['icon'] !== 'string') return 'definition.icon must be a string'
		var icon = def['icon'] as string
		if (isSvgIcon(icon)) {
			var iconResult = sanitizeSvgIcon(icon)
			if (!iconResult.ok) return iconResult.error
		}
	}
	if (def['category'] !== undefined && typeof def['category'] !== 'string') {
		return 'definition.category must be a string'
	}
	if (def['description'] !== undefined && typeof def['description'] !== 'string') {
		return 'definition.description must be a string'
	}
	var capsErr = validateCapabilities(def)
	if (capsErr) return capsErr
	var bundleErr = validateBundleManifest(def)
	if (bundleErr) return bundleErr
	if (!isRecord(def['ui'])) return 'definition.ui must be an object'
	var ui = def['ui'] as Record<string, unknown>
	if (schemaVersion >= 4) {
		if ('template' in ui) {
			return 'definition.ui.template is removed in schemaVersion 4 and later; delete it (renderer ignores it)'
		}
	} else {
		if (ui['template'] !== 'hello' && ui['template'] !== 'generic' && ui['template'] !== 'clock') {
			return 'definition.ui.template must be hello, generic, or clock'
		}
	}
	if (ui['title'] !== undefined && typeof ui['title'] !== 'string') {
		return 'definition.ui.title must be a string'
	}
	if (ui['placements'] !== undefined) {
		if (!Array.isArray(ui['placements']) || (ui['placements'] as unknown[]).length === 0) {
			return 'definition.ui.placements must be a non-empty array'
		}
		var allowed = ['page', 'modal', 'widget']
		for (var pli = 0; pli < (ui['placements'] as unknown[]).length; pli++) {
			var placement = (ui['placements'] as unknown[])[pli]
			if (typeof placement !== 'string' || allowed.indexOf(placement) === -1) {
				return 'definition.ui.placements has unknown placement "' + String(placement) + '" (page, modal, or widget)'
			}
		}
	}
	if (ui['openAs'] !== undefined && ui['openAs'] !== 'page' && ui['openAs'] !== 'modal') {
		return 'definition.ui.openAs must be "page" or "modal" (got "' + String(ui['openAs']) + '")'
	}
	if (ui['actions'] !== undefined) {
		if (!Array.isArray(ui['actions'])) return 'definition.ui.actions must be an array'
		var entries = ui['actions'] as unknown[]
		for (var ai = 0; ai < entries.length; ai++) {
			var entry = entries[ai]
			if (!isRecord(entry) || typeof entry['action'] !== 'string' || typeof entry['label'] !== 'string') {
				return 'definition.ui.actions entries need { action: string, label: string }'
			}
		}
	}
	if (ui['hideState'] !== undefined && typeof ui['hideState'] !== 'boolean') return 'definition.ui.hideState must be a boolean'
	if (ui['menuBar'] !== undefined && typeof ui['menuBar'] !== 'boolean') return 'definition.ui.menuBar must be a boolean'
	if (!isRecord(def['stateSchema'])) return 'definition.stateSchema must be an object'
	var schema = def['stateSchema'] as Record<string, unknown>
	if (schema['type'] !== 'object') return 'definition.stateSchema.type must be "object"'
	if (!isRecord(schema['initial'])) return 'definition.stateSchema.initial must be an object'
	if (!isRecord(schema['fields'])) return 'definition.stateSchema.fields must be an object'
	var fields = schema['fields'] as Record<string, unknown>
	var initial = schema['initial'] as Record<string, unknown>
	for (var field of Object.keys(fields)) {
		var spec = fields[field]
		if (!isRecord(spec) || (spec['type'] !== 'integer' && spec['type'] !== 'string' && spec['type'] !== 'boolean' && spec['type'] !== 'array' && spec['type'] !== 'object')) {
			return 'stateSchema.fields.' + field + '.type must be integer, string, boolean, array, or object'
		}
		if ((spec as Record<string, unknown>)['type'] === 'object' && schemaVersion < 5) {
			return 'stateSchema.fields.' + field + '.type object requires schemaVersion 5'
		}
		if ((spec as Record<string, unknown>)['type'] === 'array') {
			var items = (spec as Record<string, unknown>)['items']
			if (items !== undefined && items !== 'integer' && items !== 'string' && items !== 'boolean' && items !== 'object') {
				return 'stateSchema.fields.' + field + '.items must be integer, string, boolean, or object'
			}
			if (items === 'object' && schemaVersion < 5) {
				return 'stateSchema.fields.' + field + '.items object requires schemaVersion 5'
			}
			var maxItems = (spec as Record<string, unknown>)['maxItems']
			if (maxItems !== undefined && (!Number.isSafeInteger(maxItems) || (maxItems as number) <= 0)) {
				return 'stateSchema.fields.' + field + '.maxItems must be a positive safe integer'
			}
		}
	}
	for (var key of Object.keys(initial)) {
		if (!(key in fields)) return 'stateSchema.initial key "' + key + '" has no field declaration'
		var err0 = checkFieldValue(key, fields[key] as StateFieldDef, initial[key])
		if (err0) return 'stateSchema.initial.' + key + ': ' + err0
	}
	if (!isRecord(def['actions'])) return 'definition.actions must be an object'
	var actions = def['actions'] as Record<string, unknown>
	for (var actionName of Object.keys(actions)) {
		var err1 = validateActionDef(actionName, actions[actionName], fields as Record<string, StateFieldDef>, schemaVersion)
		if (err1) return err1
	}
	var uiActions = ui['actions'] as Array<{ action: string }> | undefined
	if (uiActions) {
		for (var ui of uiActions) {
			if (!(ui.action in actions)) {
				return 'definition.ui.actions references unknown action "' + ui.action + '"'
			}
		}
	}
	return null
}

/**
 * Catalog validation: the generic definition check plus a required,
 * valid catalogVersion. Generic add_app definitions without a
 * catalogVersion stay valid; only catalog membership requires it.
 */
export function validateCatalogDefinition(def: unknown): string | null {
	var problem = validateDefinition(def)
	if (problem) return problem
	if (!isRecord(def)) return 'definition must be an object'
	var catalogVersion = (def as Record<string, unknown>)['catalogVersion']
	if (typeof catalogVersion !== 'number' || !Number.isSafeInteger(catalogVersion) || catalogVersion < 1) {
		return 'definition.catalogVersion must be a positive integer'
	}
	return null
}

/**
 * Canonical stored form of a definition: exactly the normalization
 * add_app applies (schema version restamp, effects migration, icon
 * sanitization, open-mode derivation, capability defaults, bundle file
 * stringification, catalogVersion preserved when present). Callers
 * must have validated the definition first. Fingerprints and status
 * classification run on this form, never on a raw catalog file, so a
 * clean store install matches its own snapshot.
 */
export function canonicalizeDefinition(definition: AppDefinition): AppDefinition {
	var manifest = definition.bundle as unknown as Record<string, unknown>
	var rawFiles = (manifest['files'] as Record<string, unknown>) || {}
	var files: Record<string, string> = {}
	for (var fk of Object.keys(rawFiles)) files[fk] = String(rawFiles[fk])
	var icon = definition.icon
	if (typeof icon === 'string' && isSvgIcon(icon)) {
		var cleanIcon = sanitizeSvgIcon(icon)
		icon = cleanIcon.ok ? cleanIcon.icon : undefined
	}
	var canonicalActions: Record<string, unknown> = {}
	var inputActions = definition.actions as unknown as Record<string, unknown>
	for (var aname of Object.keys(inputActions)) canonicalActions[aname] = migrateAction(inputActions[aname])
	var uiOut: Record<string, unknown> = {}
	if (definition.ui.title !== undefined) uiOut['title'] = definition.ui.title
	uiOut['openAs'] = deriveOpenAs(definition.ui)
	if (definition.ui.actions !== undefined) uiOut['actions'] = definition.ui.actions
	if (definition.ui.hideState !== undefined) uiOut['hideState'] = definition.ui.hideState
	if (definition.ui.menuBar !== undefined) uiOut['menuBar'] = definition.ui.menuBar
	var def: AppDefinition = {
		id: definition.id,
		name: definition.name,
		label: definition.label || definition.name,
		schemaVersion: DEFINITION_SCHEMA_VERSION,
		icon: icon,
		category: definition.category,
		description: definition.description,
		capabilities: sanitizeCapabilities(definition.capabilities),
		bundle: { entry: 'index.html', files: files },
		ui: uiOut as unknown as AppDefinition['ui'],
		stateSchema: definition.stateSchema,
		actions: canonicalActions as unknown as AppDefinition['actions'],
	}
	if (definition.catalogVersion !== undefined) def.catalogVersion = definition.catalogVersion
	return def
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value)
	if (Array.isArray(value)) {
		var parts: string[] = []
		for (var i = 0; i < value.length; i++) parts.push(stableStringify(value[i]))
		return '[' + parts.join(',') + ']'
	}
	var keys = Object.keys(value as Record<string, unknown>).sort()
	var out: string[] = []
	for (var k = 0; k < keys.length; k++) {
		var v = (value as Record<string, unknown>)[keys[k]]
		if (v === undefined) continue
		out.push(JSON.stringify(keys[k]) + ':' + stableStringify(v))
	}
	return '{' + out.join(',') + '}'
}

/**
 * Deterministic fingerprint of a definition's canonical stored form,
 * excluding catalogVersion: content equality wins whatever the version
 * fields say (spec Decision 9), so a catalog version bump with no
 * content change still fingerprints as up to date, while version
 * ordering itself is carried separately in Iv/Cv and in the snapshot.
 * Two 32-bit FNV-1a hashes plus the canonical length: change detection
 * for status classification, not a cryptographic hash and not a
 * security check. Identical canonical definitions fingerprint alike
 * regardless of key order in the source file.
 */
export function fingerprintDefinition(definition: AppDefinition): string {
	var canon = canonicalizeDefinition(definition) as unknown as Record<string, unknown>
	delete canon['catalogVersion']
	var text = stableStringify(canon)
	var h1 = 2166136261
	var h2 = 2166136261
	for (var i = 0; i < text.length; i++) {
		var code = text.charCodeAt(i)
		h1 = h1 ^ code
		h1 = Math.imul(h1, 16777619) >>> 0
		h2 = h2 ^ (code + 0x9e3779b9)
		h2 = Math.imul(h2, 16777619) >>> 0
	}
	return 'fnv:' + String(h1) + '-' + String(h2) + '-' + String(text.length)
}

function validateSingleEffect(
	label: string,
	effectRec: unknown,
	fields: Record<string, StateFieldDef>,
): string | null {
	if (!isRecord(effectRec) || typeof effectRec['op'] !== 'string') {
		return label + ' must be an object with an op'
	}
	var effect = effectRec as unknown as Record<string, unknown>
	var op = effect['op'] as string
	if (op === 'increment') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return label + '.field must name a declared state field'
		}
		if (fields[effect['field'] as string].type !== 'integer') {
			return label + ' increment target must be an integer field'
		}
		if (effect['by'] !== undefined && !Number.isSafeInteger(effect['by'])) {
			return label + '.by must be a safe integer'
		}
		if (effect['byArg'] !== undefined && typeof effect['byArg'] !== 'string') {
			return label + '.byArg must be an arg name'
		}
	} else if (op === 'set') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return label + '.field must name a declared state field'
		}
		if (effect['fromArg'] !== undefined && typeof effect['fromArg'] !== 'string') {
			return label + '.fromArg must be an arg name'
		}
	} else if (op === 'append') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return label + '.field must name a declared state field'
		}
		if (fields[effect['field'] as string].type !== 'array') {
			return label + ' append target must be an array field'
		}
		if (effect['fromArg'] !== undefined && typeof effect['fromArg'] !== 'string') {
			return label + '.fromArg must be an arg name'
		}
		if (effect['cap'] !== undefined && (!Number.isSafeInteger(effect['cap']) || (effect['cap'] as unknown as number) <= 0)) {
			return label + '.cap must be a positive safe integer'
		}
		if (effect['maxEntryBytes'] !== undefined && (!Number.isSafeInteger(effect['maxEntryBytes']) || (effect['maxEntryBytes'] as unknown as number) <= 0)) {
			return label + '.maxEntryBytes must be a positive safe integer'
		}
	} else if (op === 'toggle') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return label + '.toggle target must be a boolean field'
		}
		if (fields[effect['field'] as string].type !== 'boolean') {
			return label + ' toggle target must be a boolean field'
		}
	} else if (op === 'reset') {
		// no extra fields needed
	} else {
		return label + '.op must be set, append, increment, toggle, or reset'
	}
	return null
}

function validateActionDef(
	actionName: string,
	spec: unknown,
	fields: Record<string, StateFieldDef>,
	schemaVersion: number,
): string | null {
	var prefix = 'actions.' + actionName
	if (!isRecord(spec)) return prefix + ' must be an object'
	var action = spec as unknown as ActionDef
	if (action.args !== undefined) {
		if (!isRecord(action.args)) return prefix + '.args must be an object'
		var argEntries = action.args as Record<string, unknown>
		for (var arg of Object.keys(argEntries)) {
			var argDef = argEntries[arg]
			if (!isRecord(argDef)) return prefix + '.args.' + arg + ' must be an object'
			var t = (argDef as Record<string, unknown>)['type']
			if (t !== 'integer' && t !== 'string' && t !== 'boolean') {
				return prefix + '.args.' + arg + '.type must be integer, string, or boolean'
			}
		}
	}
	var rawRec = action as unknown as Record<string, unknown>
	if (schemaVersion >= 4) {
		if ('effect' in rawRec) return prefix + ' must use effects[] in schemaVersion 4 and later (single effect retired)'
		if (!Array.isArray(rawRec['effects']) || (rawRec['effects'] as unknown[]).length === 0) {
			return prefix + '.effects must be a non-empty array'
		}
		var seq = rawRec['effects'] as unknown[]
		for (var ei = 0; ei < seq.length; ei++) {
			var eerr = validateSingleEffect(prefix + '.effects[' + String(ei) + ']', seq[ei], fields)
			if (eerr) return eerr
		}
		return null
	}
	if ('effects' in rawRec) return prefix + '.effects requires schemaVersion 4'
	var effectRec = (action as unknown as Record<string, unknown>)['effect']
	if (!isRecord(effectRec) || typeof effectRec['op'] !== 'string') {
		return prefix + '.effect must be an object with an op'
	}
	var effect = effectRec as unknown as Record<string, unknown>
	var op = effect['op'] as string
	if (op === 'increment') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return prefix + '.effect.field must name a declared state field'
		}
		if (fields[effect['field'] as string].type !== 'integer') {
			return prefix + '.effect increment target must be an integer field'
		}
		if (effect['by'] !== undefined && !Number.isSafeInteger(effect['by'])) {
			return prefix + '.effect.by must be a safe integer'
		}
		if (effect['byArg'] !== undefined && typeof effect['byArg'] !== 'string') {
			return prefix + '.effect.byArg must be an arg name'
		}
	} else if (op === 'set') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return prefix + '.effect.field must name a declared state field'
		}
		if (effect['fromArg'] !== undefined && typeof effect['fromArg'] !== 'string') {
			return prefix + '.effect.fromArg must be an arg name'
		}
	} else if (op === 'append') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return prefix + '.effect.field must name a declared state field'
		}
		if (fields[effect['field'] as string].type !== 'array') {
			return prefix + '.effect append target must be an array field'
		}
		if (effect['fromArg'] !== undefined && typeof effect['fromArg'] !== 'string') {
			return prefix + '.effect.fromArg must be an arg name'
		}
		if (effect['cap'] !== undefined && (!Number.isSafeInteger(effect['cap']) || (effect['cap'] as unknown as number) <= 0)) {
			return prefix + '.effect.cap must be a positive safe integer'
		}
		if (effect['maxEntryBytes'] !== undefined && (!Number.isSafeInteger(effect['maxEntryBytes']) || (effect['maxEntryBytes'] as unknown as number) <= 0)) {
			return prefix + '.effect.maxEntryBytes must be a positive safe integer'
		}
	} else if (op === 'toggle') {
		if (typeof effect['field'] !== 'string' || !((effect['field'] as string) in fields)) {
			return prefix + '.effect.toggle target must be a boolean field'
		}
		if (fields[effect['field'] as string].type !== 'boolean') {
			return prefix + '.effect toggle target must be a boolean field'
		}
	} else if (op === 'reset') {
		// no extra fields needed
	} else {
		return prefix + '.effect.op must be set, append, increment, toggle, or reset'
	}
	return null
}

/** JSON-serializability + depth check for nested (schemaVersion 5) values. Depth cap 10 keeps a nested field from becoming an unbounded tree; null is allowed inside a nested value, but never as a top-level field value (see checkFieldValue). */
function jsonValueProblem(value: unknown, depth: number): string | null {
	if (depth > 10) return 'exceeds the nested depth cap of 10'
	if (value === null) return null
	if (typeof value === 'number') {
		if (!Number.isSafeInteger(value) && !isFinite(value)) return 'number is not finite'
		return null
	}
	if (typeof value === 'string' || typeof value === 'boolean') return null
	if (Array.isArray(value)) {
		for (var i = 0; i < value.length; i++) {
			var perr = jsonValueProblem(value[i], depth + 1)
			if (perr) return 'array entry ' + i + ': ' + perr
		}
		return null
	}
	if (isRecord(value)) {
		for (var k of Object.keys(value)) {
			var kerr = jsonValueProblem((value as Record<string, unknown>)[k], depth + 1)
			if (kerr) return 'key "' + k + '": ' + kerr
		}
		return null
	}
	return 'is not a JSON value'
}

function checkFieldValue(field: string, spec: StateFieldDef, value: unknown): string | null {
	if (spec.type === 'integer') {
		if (typeof value !== 'number' || !Number.isSafeInteger(value)) return field + ' must be a safe integer'
		if (spec.min !== undefined && value < spec.min) return field + ' must be >= ' + spec.min
		if (spec.max !== undefined && value > spec.max) return field + ' must be <= ' + spec.max
		return null
	}
	if (spec.type === 'string') {
		if (typeof value !== 'string') return field + ' must be a string'
		if (spec.maxLength !== undefined && value.length > spec.maxLength) {
			return field + ' must be at most ' + spec.maxLength + ' characters'
		}
		return null
	}
	if (spec.type === 'object') {
		if (!isRecord(value)) return field + ' must be an object'
		var oerr = jsonValueProblem(value, 0)
		if (oerr) return field + ' ' + oerr
		return null
	}
	if (spec.type === 'array') {
		if (!Array.isArray(value)) return field + ' must be an array'
		var list = value as unknown[]
		if (spec.maxItems !== undefined && list.length > spec.maxItems) {
			return field + ' must have at most ' + spec.maxItems + ' entries'
		}
		var itemType = spec.items || 'string'
		for (var ii = 0; ii < list.length; ii++) {
			if (itemType === 'integer') {
				if (typeof list[ii] !== 'number' || !Number.isSafeInteger(list[ii])) return field + '[' + ii + '] must be a safe integer'
			} else if (itemType === 'boolean') {
				if (typeof list[ii] !== 'boolean') return field + '[' + ii + '] must be a boolean'
			} else if (itemType === 'object') {
				if (!isRecord(list[ii])) return field + '[' + ii + '] must be an object'
				var ierr = jsonValueProblem(list[ii], 0)
				if (ierr) return field + '[' + ii + '] ' + ierr
			} else if (typeof list[ii] !== 'string') {
				return field + '[' + ii + '] must be a string'
			}
		}
		return null
	}
	if (typeof value !== 'boolean') return field + ' must be a boolean'
	return null
}

/** Coerce one raw arg (forms arrive as strings) to its declared type. */
function coerceArg(
	type: 'integer' | 'string' | 'boolean',
	raw: unknown,
): { value?: number | string | boolean; error?: string } {
	if (type === 'integer') {
		if (typeof raw === 'number' && Number.isSafeInteger(raw)) return { value: raw }
		if (typeof raw === 'string' && raw.trim() !== '') {
			var parsed = Number(raw)
			if (Number.isSafeInteger(parsed)) return { value: parsed }
		}
		return { error: 'expected integer, got ' + String(JSON.stringify(raw)) }
	}
	if (type === 'boolean') {
		if (typeof raw === 'boolean') return { value: raw }
		if (raw === 'true' || raw === '1') return { value: true }
		if (raw === 'false' || raw === '0') return { value: false }
		return { error: 'expected boolean, got ' + String(JSON.stringify(raw)) }
	}
	if (typeof raw !== 'string') return { error: 'expected string, got ' + typeof raw }
	return { value: raw }
}

/**
 * Label a stored definition with its schema version. Apps installed before
 * versioning carry no `schemaVersion`: the current shape is validated and the
 * current version stamped when it passes, else the oldest known era (1), so
 * stale apps stay readable and listable instead of bricking the shell.
 * Read-only: the label is applied to the in-memory copy, not written back.
 */
function backfillDefinition(raw: AppDefinition): AppDefinition {
	if (!raw || typeof raw !== 'object') return raw
	var rec = raw as unknown as Record<string, unknown>
	var version = rec['schemaVersion']
	if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0) return raw
	rec['schemaVersion'] = DEFINITION_SCHEMA_VERSION
	if (validateDefinition(rec) !== null) rec['schemaVersion'] = 1
	return rec as unknown as AppDefinition
}

function loadEntry(
	store: KeyStore,
	id: string,
): Promise<{ definition: AppDefinition; state: AppState } | { error: string }> {
	return Promise.all([
		readJson<AppDefinition>(store, defKey(id)),
		readJson<AppState>(store, stateKey(id)),
	]).then(function (pair): { definition: AppDefinition; state: AppState } | { error: string } {
		var definition = pair[0]
		var state = pair[1]
		if (!definition) return { error: 'unknown app "' + id + '"' }
		if (!state) return { error: 'app "' + id + '" has no state' }
		return { definition: backfillDefinition(definition), state: state }
	})
}

export interface ListAppsOptions {
	includeHidden?: boolean
}

function isKeyStore(value: unknown): value is KeyStore {
	return value !== null && typeof value === 'object' && typeof (value as KeyStore).get === 'function' && typeof (value as KeyStore).set === 'function'
}

/** Read pinned ids in pin order. Missing keys read as empty. */
export function get_pinned(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readPinned(active)
	})
}

/** Read hidden ids. Missing keys read as empty. */
export function get_hidden(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHidden(active)
	})
}

/** Read recent ids, most recent first. Missing keys read as empty. */
export function get_recent(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRecent(active)
	})
}

/** Read homepage ids in dashboard order. Missing keys read as empty. */
export function get_homepage(store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active)
	})
}

/**
 * Read the whole launcher state in one call, in stored order, missing
 * keys as []. Recency is read internally here and is NOT a separate
 * root export: recency stays internal by the 2026-10-30 direction, but
 * the aggregate still lets an agent verify a removal scrubbed every
 * list, recent included. Reads never write.
 */
export function get_launcher_state(store?: KeyStore): Promise<{ pinned: string[]; hidden: string[]; recent: string[]; homepage: string[] }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([readPinned(active), readHidden(active), readRecent(active), readHomepage(active)]).then(function (parts) {
			return { pinned: parts[0], hidden: parts[1], recent: parts[2], homepage: parts[3] }
		})
	})
}

/** Overwrite the homepage order list (order matters). */
export function set_homepage(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeHomepage(active, ids)
	})
}

/** Set or clear one homepage entry. Keeps order (new entries append). */
export function set_home(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writeHomepage(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/** Move one homepage entry up (-1) or down (+1). Single list write. */
export function move_home(id: string, delta: number, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHomepage(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (at === -1) return ids
			var to = at + (delta < 0 ? -1 : 1)
			if (to < 0 || to >= ids.length) return ids
			var next = ids.slice()
			next.splice(at, 1)
			next.splice(to, 0, id)
			return writeHomepage(active, next).then(function (): string[] {
				return next
			})
		})
	})
}

/** Overwrite the pinned list (order matters). */
export function set_pinned(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writePinned(active, ids)
	})
}

/** Overwrite the hidden list. */
export function set_hidden(ids: string[], store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeHidden(active, ids)
	})
}

/** Empty the recency list without touching apps, pins, or hidden flags. */
export function clear_recent(store?: KeyStore): Promise<void> {
	return resolveStore(store).then(function (active: KeyStore) {
		return writeRecent(active, [])
	})
}

/** Move one app id to the front of recency (dedupe, capped). */
export function record_use(id: string, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRecent(active).then(function (ids: string[]): Promise<string[]> {
			var next: string[] = [id]
			for (var i = 0; i < ids.length; i++) {
				if (ids[i] !== id) next.push(ids[i])
			}
			next = next.slice(0, RECENT_CAP)
			return writeRecent(active, next).then(function (): string[] {
				return next
			})
		})
	})
}

/** Set or clear one pin. Keeps pin order (new pins append). */
export function set_pin(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readPinned(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writePinned(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/** Set or clear one hidden flag. */
export function set_hide(id: string, want: boolean, store?: KeyStore): Promise<string[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readHidden(active).then(function (ids: string[]): Promise<string[]> {
			var at = ids.indexOf(id)
			if (want && at === -1) ids.push(id)
			if (!want && at !== -1) ids.splice(at, 1)
			return writeHidden(active, ids).then(function (): string[] {
				return ids
			})
		})
	})
}

/** List every installed app. Registry-read-only. */
export function list_apps(store?: KeyStore, opts?: ListAppsOptions): Promise<AppSummary[]> {
	var activeStore: KeyStore | undefined = store
	var options: ListAppsOptions | undefined = opts
	if (store && !isKeyStore(store)) {
		options = store as unknown as ListAppsOptions
		activeStore = undefined
	}
	return resolveStore(activeStore).then(function (active: KeyStore): Promise<AppSummary[]> {
		var hiddenP: Promise<string[]> = options && options.includeHidden === false ? readHidden(active) : Promise.resolve([] as string[])
		return hiddenP.then(function (hidden: string[]): Promise<AppSummary[]> {
			return readRegistry(active).then(function (ids: string[]): Promise<AppSummary[]> {
			var out: AppSummary[] = []
			var chain = Promise.resolve()
			for (var id of ids) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						if (hidden.indexOf(want) !== -1) return Promise.resolve()
						return readJson<AppDefinition>(active, defKey(want)).then(function (raw): void {
							if (!raw) return
							var def = backfillDefinition(raw)
							out.push({
								id: def.id,
								name: def.name,
								label: def.label || def.name,
								schemaVersion: def.schemaVersion,
								icon: def.icon,
								category: def.category,
								description: def.description,
								openAs: deriveOpenAs(def.ui),
								menuBar: def.ui.menuBar === true,
							})
						})
					})
				})(id)
			}
				return chain.then(function (): AppSummary[] {
					return out
				})
			})
		})
	})
}

/** Read one app's definition plus live state. */
export function get_app(
	id: string,
	store?: KeyStore,
): Promise<{ definition: AppDefinition; state: AppState } | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id)
	})
}

/** Read one app's live state (UI refresh and MCP poll the same value). */
export function get_app_state(id: string, store?: KeyStore): Promise<AppState | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id).then(function (entry) {
			if ('error' in entry) return { error: entry.error }
			return entry.state
		})
	})
}

/**
 * Run one declarative action. Validates everything before mutating; writes the
 * new state with a single set. A bad action returns { ok:false } and the
 * stored state is untouched.
 */
export function act(
	id: string,
	action: string,
	args?: Record<string, unknown>,
	store?: KeyStore,
): Promise<ActResult> {
	return resolveStore(store).then(function (active: KeyStore): Promise<ActResult> {
		return loadEntry(active, id).then(function (entry): Promise<ActResult> {
			if ('error' in entry) return Promise.resolve({ ok: false as const, error: entry.error })
			var definition = entry.definition
			var state = entry.state

			// Unified shape: every app carries bundle files plus state plus actions,
			// so act() runs on all apps with no bundle refusal. (The legacy kind
			// discriminator and the /probe* routes are retired; the probe is a
			// unified bundle app that persists via act().)
			var actionTable: Record<string, ActionDef> | undefined = definition.actions
			var actionDef: ActionDef | undefined = actionTable ? actionTable[action] : undefined
			if (!actionDef) {
				return Promise.resolve({ ok: false as const, error: 'unknown action "' + action + '" for app "' + id + '"' })
			}

			// 1. Resolve + validate args against the action's arg schema.
			var resolved: Record<string, number | string | boolean> = {}
			var argSchema = actionDef.args || {}
			for (var argName of Object.keys(argSchema)) {
				var argDef = argSchema[argName]
				var raw: unknown = args ? args[argName] : undefined
				if (raw === undefined) {
					if (argDef.required !== true && argDef.default !== undefined) {
						resolved[argName] = argDef.default
						continue
					}
					if (argDef.required === true) {
						return Promise.resolve({ ok: false as const, error: 'missing required arg "' + argName + '"' })
					}
					continue
				}
				var coerced = coerceArg(argDef.type, raw)
				if (coerced.error || coerced.value === undefined) {
					return Promise.resolve({ ok: false as const, error: 'invalid arg "' + argName + '": ' + coerced.error })
				}
				if (argDef.type === 'integer' && typeof coerced.value === 'number') {
					if (argDef.min !== undefined && coerced.value < argDef.min) {
						return Promise.resolve({ ok: false as const, error: 'arg "' + argName + '" must be >= ' + argDef.min })
					}
					if (argDef.max !== undefined && coerced.value > argDef.max) {
						return Promise.resolve({ ok: false as const, error: 'arg "' + argName + '" must be <= ' + argDef.max })
					}
				}
				if (argDef.type === 'string' && typeof coerced.value === 'string' && argDef.maxLength !== undefined && coerced.value.length > argDef.maxLength) {
					return Promise.resolve({
						ok: false as const,
						error: 'arg "' + argName + '" must be at most ' + argDef.maxLength + ' characters',
					})
				}
				resolved[argName] = coerced.value
			}

			// 2. Apply the declarative effects to a COPY — storage untouched so far.
			// v3 definitions carry single `effect`; v4 carries `effects[]`.
			var rawAction = actionDef as unknown as Record<string, unknown>
			var seq: unknown[] = []
			if (Array.isArray(rawAction['effects'])) seq = rawAction['effects'] as unknown[]
			else if (isRecord(rawAction['effect'])) seq = [rawAction['effect']]
			else {
				return Promise.resolve({ ok: false as const, error: 'action "' + action + '" has no effects' })
			}
			var next = cloneState(state)
			var applyError: string | null = null
			for (var si = 0; si < seq.length; si++) {
				if (applyError) break
				var effect = seq[si] as import('./types.ts').ActionEffect
				if (effect.op === 'set') {
					var value: unknown = effect.fromArg !== undefined ? resolved[effect.fromArg] : effect.value
					if (value === undefined) {
						applyError = 'set action "' + action + '" has no value'
						break
					}
					next[effect.field] = value as number | string | boolean
				} else if (effect.op === 'append') {
					var entry: unknown = effect.fromArg !== undefined ? resolved[effect.fromArg] : effect.value
					if (entry === undefined) {
						applyError = 'append action "' + action + '" has no value'
						break
					}
					var list = next[effect.field]
					if (!Array.isArray(list)) {
						applyError = 'field "' + effect.field + '" is not an array'
						break
					}
					if (typeof entry === 'string') {
						var maxEntry = effect.maxEntryBytes !== undefined ? effect.maxEntryBytes : APPEND_MAX_ENTRY_BYTES
						if (byteLength(entry) > maxEntry) {
							applyError = 'append entry exceeds ' + maxEntry + ' bytes'
							break
						}
					}
					var grown = (list as Array<number | string | boolean>).concat([entry as number | string | boolean])
					var cap = effect.cap !== undefined ? effect.cap : APPEND_CAP
					if (grown.length > cap) grown = grown.slice(grown.length - cap)
					next[effect.field] = grown
				} else if (effect.op === 'increment') {
					// Deprecated sugar over set: computes the next integer and sets it.
					// Kept until migration retires it; prefer a set effect instead.
					var step: unknown = effect.byArg !== undefined ? resolved[effect.byArg] : effect.by !== undefined ? effect.by : 1
					if (typeof step !== 'number' || !Number.isSafeInteger(step)) {
						applyError = 'increment step for "' + effect.field + '" is not a safe integer'
						break
					}
					var current = next[effect.field]
					if (typeof current !== 'number') {
						applyError = 'field "' + effect.field + '" is not an integer'
						break
					}
					next[effect.field] = current + step
				} else if (effect.op === 'toggle') {
					// Deprecated sugar over set: negates the boolean field via set.
					// Kept until migration retires it; prefer a set effect instead.
					var cur = next[effect.field]
					if (typeof cur !== 'boolean') {
						applyError = 'field "' + effect.field + '" is not a boolean'
						break
					}
					next[effect.field] = !cur
				} else if (effect.op === 'reset') {
					// Deprecated sugar over set: resets every field to its initial
					// value via set. Kept until migration retires it.
					var fresh = cloneState(definition.stateSchema.initial)
					for (var k of Object.keys(next)) delete next[k]
					for (var fk of Object.keys(fresh)) next[fk] = fresh[fk]
				} else {
					applyError = 'unknown effect op "' + String((effect as unknown as Record<string, unknown>)['op']) + '"'
					break
				}
			}
			if (applyError) {
				return Promise.resolve({ ok: false as const, error: applyError })
			}

			// 3. Validate the resulting state against the schema BEFORE writing.
			for (var field of Object.keys(definition.stateSchema.fields)) {
				var ferr = checkFieldValue(field, definition.stateSchema.fields[field], next[field])
				if (ferr) {
					return Promise.resolve({ ok: false as const, error: 'action "' + action + '" rejected: ' + ferr })
				}
			}

			// 4. Single write — the only mutation point.
			return writeJson(active, stateKey(id), next).then(function (): Promise<ActResult> {
				return record_use(id, active).then(function (): ActResult {
					return { ok: true, state: next }
				})
			})
		})
	})
}

export interface AddAppOptions {
	resetState?: boolean
	migrate?: Record<string, string>
}

/**
 * Install a unified app definition. Validate-all-first, then a single
 * registry write followed by a single state write. A failed call writes
 * nothing: storage is byte-identical to before the call.
 *
 * Same-id overwrite preserves state by default (declared fields carried
 * forward, dropped fields reset to `initial`) and leaves registry order,
 * pins, hidden flags, homepage placement, and recent entries untouched.
 * `resetState: true` restores the legacy wipe; `migrate` maps old field
 * names to new ones with validator-checked values (unmappable aborts).
 */
export function add_app(
	definition: AppDefinition,
	store?: KeyStore | AddAppOptions,
	opts?: AddAppOptions,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	var activeStore: KeyStore | undefined = undefined
	var options: AddAppOptions = {}
	if (store && isKeyStore(store)) {
		activeStore = store
		if (opts) options = opts
	} else if (store && typeof store === 'object') {
		options = store as AddAppOptions
	}
	var problem = validateDefinition(definition)
	if (problem) return Promise.resolve({ ok: false as const, error: problem })
	return resolveStore(activeStore).then(function (active: KeyStore) {
		return Promise.all([
			readJson<AppDefinition>(active, defKey(definition.id)),
			readJson<AppState>(active, stateKey(definition.id)),
			readRegistry(active),
		]).then(function (triple): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
			var existing = triple[0]
			var existingState = triple[1]
			var ids = triple[2]
			if (options.resetState === true && options.migrate !== undefined) {
				return Promise.resolve({ ok: false as const, error: 'add_app options resetState and migrate are mutually exclusive' })
			}
			if (!existing && definition.schemaVersion !== DEFINITION_SCHEMA_VERSION) {
				return Promise.resolve({
					ok: false as const,
					error:
						'definition.schemaVersion ' +
						definition.schemaVersion +
						' is stale for a new app; send the current version ' +
						DEFINITION_SCHEMA_VERSION +
						' (re-adding an existing id restamps it)',
				})
			}
			var def: AppDefinition = canonicalizeDefinition(definition)
			var candidate: AppState
				var freshInitial = cloneState(definition.stateSchema.initial as AppState)
			if (!existing) {
				candidate = freshInitial
			} else if (options.resetState === true) {
				candidate = freshInitial
			} else {
				candidate = cloneState(freshInitial)
					var newFields = definition.stateSchema.fields as Record<string, StateFieldDef>
				var stored: AppState = existingState ? existingState : ({} as AppState)
					for (var fname of Object.keys(newFields)) {
						if (fname in stored) {
							var perr = checkFieldValue(fname, newFields[fname], stored[fname])
							if (perr) {
								return Promise.resolve({ ok: false as const, error: 'preserved state invalid: ' + perr })
							}
							candidate[fname] = stored[fname]
						}
					}
					if (options.migrate !== undefined) {
						if (!isRecord(options.migrate)) {
							return Promise.resolve({ ok: false as const, error: 'add_app migrate must be an object mapping old field names to new ones' })
						}
						var mapping = options.migrate as Record<string, unknown>
						for (var oldName of Object.keys(mapping)) {
							var newName = mapping[oldName]
							if (typeof newName !== 'string') {
								return Promise.resolve({ ok: false as const, error: 'migrate maps old field "' + oldName + '" to a non-string field name' })
							}
							if (!(oldName in stored)) {
								return Promise.resolve({ ok: false as const, error: 'migrate maps unknown old field "' + oldName + '"' })
							}
							if (!(newName in newFields)) {
								return Promise.resolve({ ok: false as const, error: 'migrate maps to unknown new field "' + newName + '"' })
							}
							var merr = checkFieldValue(newName, newFields[newName], stored[oldName])
							if (merr) {
								return Promise.resolve({ ok: false as const, error: 'migrate value invalid: ' + merr })
							}
							candidate[newName] = stored[oldName]
						}
					}
			}
				for (var cfield of Object.keys(def.stateSchema.fields)) {
					var cerr = checkFieldValue(cfield, def.stateSchema.fields[cfield], candidate[cfield])
				if (cerr) {
					return Promise.resolve({ ok: false as const, error: 'candidate state invalid: ' + cerr })
				}
			}
				var isNew = ids.indexOf(def.id) === -1
				return writeJson(active, defKey(def.id), def)
					.then(function () {
						return writeJson(active, stateKey(def.id), candidate)
					})
					.then(function (): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
						if (!isNew) return Promise.resolve({ ok: true as const, id: def.id })
						ids.push(def.id)
						return writeRegistry(active, ids).then(function () {
							return { ok: true as const, id: def.id }
						})
					})
			})
	})
}

/**
 * Uninstall an app: delete its definition and state and scrub every reference
 * list (registry, pinned, hidden, recent). Validation runs before any write:
 * an unknown id returns { ok:false } and storage is untouched.
 */
export function remove_app(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRegistry(active).then(function (ids: string[]) {
			if (ids.indexOf(id) === -1) {
				return { ok: false as const, error: 'unknown app "' + id + '"' }
			}
			return Promise.all([readPinned(active), readHidden(active), readRecent(active), readHomepage(active)]).then(function (lists) {
				var pinned = lists[0].filter(function (one: string): boolean { return one !== id })
				var hidden = lists[1].filter(function (one: string): boolean { return one !== id })
				var recent = lists[2].filter(function (one: string): boolean { return one !== id })
				var homepage = lists[3].filter(function (one: string): boolean { return one !== id })
				var registry = ids.filter(function (one: string): boolean { return one !== id })
				return writeRegistry(active, registry)
					.then(function () { return writePinned(active, pinned) })
					.then(function () { return writeHidden(active, hidden) })
					.then(function () { return writeRecent(active, recent) })
					.then(function () { return writeHomepage(active, homepage) })
					.then(function () { return deleteKey(active, stateKey(id)) })
					.then(function () { return deleteKey(active, defKey(id)) })
					.then(function () { return deleteInstallSnapshot(active, id) })
					.then(function (): { ok: true; id: string } {
						return { ok: true as const, id: id }
					})
			})
		})
	})
}

/**
 * Install a shipped catalog app by id, through the validated `add_app`
 * path. Idempotent: re-installing an already-installed app preserves
 * its state and restamps it to the catalog definition (same as a
 * re-add). Unknown catalog ids return `{ ok: false }` naming the id
 * and write nothing. Never passes `resetState`, so state is never
 * wiped by an install.
 */
export function install_from_catalog(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	var def = get_catalog_definition(id)
	if (def === null) return Promise.resolve({ ok: false as const, error: 'unknown catalog app "' + id + '"' })
	return add_app(def, store)
}

/**
 * Bring an already-installed app up to its shipped catalog definition,
 * preserving state (bundle and definition replaced, state carried
 * forward by `add_app`). Refuses to install: an id that is not
 * installed returns `{ ok: false }` directing the caller to
 * `install_from_catalog`, and an id that is not in the catalog
 * returns `{ ok: false }` naming the id. Nothing is written on
 * either failure.
 */
export function update_from_catalog(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	var def = get_catalog_definition(id)
	if (def === null) return Promise.resolve({ ok: false as const, error: 'unknown catalog app "' + id + '"' })
	return get_app(id, store).then(function (entry) {
		if ('error' in entry) {
			return { ok: false as const, error: 'app "' + id + '" is not installed (use install_from_catalog to install it)' }
		}
		return add_app(def as AppDefinition, store)
	})
}

/**
 * Install snapshot (app-store Decisions 8-11): recorded only by a store
 * install or store update, separate from the definition, holding the
 * catalogVersion at install time and the fingerprint of the definition
 * as actually stored (after add_app normalization). Generic add_app and
 * import_app never write it; remove_app deletes it; it is never part
 * of an export. Storage key: kody-os.apps.snapshot.<id>.
 */
export interface InstallSnapshot {
	catalogVersion: number
	fingerprint: string
}

var SNAPSHOT_PREFIX = 'kody-os.apps.snapshot.'

function snapshotKey(id: string): string {
	return SNAPSHOT_PREFIX + id
}

export function readInstallSnapshot(store: KeyStore, id: string): Promise<InstallSnapshot | null> {
	return readJson<InstallSnapshot>(store, snapshotKey(id)).then(function (raw): InstallSnapshot | null {
		if (!raw || typeof raw.catalogVersion !== 'number' || typeof raw.fingerprint !== 'string') return null
		return raw
	})
}

export function writeInstallSnapshot(store: KeyStore, id: string, snapshot: InstallSnapshot): Promise<void> {
	return writeJson(store, snapshotKey(id), snapshot)
}

export function deleteInstallSnapshot(store: KeyStore, id: string): Promise<void> {
	return deleteKey(store, snapshotKey(id))
}

function recordInstallSnapshot(store: KeyStore, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
	return readJson<AppDefinition>(store, defKey(id)).then(function (def): Promise<{ ok: true } | { ok: false; error: string }> {
		if (!def) return Promise.resolve({ ok: false as const, error: 'app "' + id + '" is not installed' })
		if (typeof def.catalogVersion !== 'number') return Promise.resolve({ ok: false as const, error: 'app "' + id + '" has no catalogVersion to snapshot' })
		return writeInstallSnapshot(store, id, { catalogVersion: def.catalogVersion, fingerprint: fingerprintDefinition(def) }).then(function (): { ok: true } {
			return { ok: true as const }
		})
	})
}

/**
 * Store install: install_from_catalog plus a snapshot write. Offered
 * only for not-installed ids by the store page; a re-install through
 * this path still records the new snapshot, matching "store install"
 * in the spec. Generic add_app callers never get a snapshot.
 */
export function store_install_from_catalog(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return install_from_catalog(id, active).then(function (result) {
			if (!result.ok) return result
			return recordInstallSnapshot(active, id).then(function (snap) {
				if (!snap.ok) return snap
				return result
			})
		})
	})
}

/**
 * Store update: update_from_catalog plus a snapshot replacement.
 * State is preserved by the add_app rule (surviving fields carry
 * forward, dropped fields reset); pins, hidden flags, homepage
 * placement, and recency are untouched by add_app. The store page,
 * not this function, owns the modified-app confirmation gate.
 */
export function store_update_from_catalog(
	id: string,
	store?: KeyStore,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return update_from_catalog(id, active).then(function (result) {
			if (!result.ok) return result
			return recordInstallSnapshot(active, id).then(function (snap) {
				if (!snap.ok) return snap
				return result
			})
		})
	})
}

/** Ensure the App Store is seeded: empty registry only, via the store install path. */
export function ensure_app_store_seeded(store?: KeyStore): Promise<{ ok: true; seeded: boolean } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readRegistry(active).then(function (ids: string[]) {
			if (ids.length !== 0) return { ok: true as const, seeded: false }
			return store_install_from_catalog('app-store', active).then(function (result) {
				if (!result.ok) return result
				return { ok: true as const, seeded: true }
			})
		})
	})
}

/**
 * Bundle management API (data-only App Store). These functions are
 * the browser-facing management path: they reuse the store
 * install/update logic and snapshot rules, and they add the two
 * gates the shell Store page used to own — the manageApps
 * capability check, and the confirmation gate for modified apps
 * and for capability expansion. They are NOT MCP exports: agents
 * keep using install_from_catalog / update_from_catalog, and
 * the agent is the installer that surfaces capabilities before
 * calling them. The shell route translates a permission failure
 * into the feed-style plain 404; other failures keep their
 * error text so the bundle can render them.
 */
export type ManageResult =
	| { ok: true; id?: string; rows?: StoreRow[] }
	| { ok: false; error: string; needsConfirmation?: boolean; additions?: string[]; permissionDenied?: boolean }

function checkManagePermission(active: KeyStore, actingId: string): Promise<boolean> {
	return readJson<AppDefinition>(active, defKey(actingId)).then(function (def) {
		return def !== null && def !== undefined && def.capabilities !== undefined && def.capabilities.manageApps === true
	})
}

export function manage_rows(actingId: string, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return get_store_rows(active).then(function (rows) {
				return { ok: true as const, rows: rows }
			})
		})
	})
}

export function manage_install(actingId: string, targetId: string, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return get_app_status(targetId, active).then(function (info) {
				if (info.installed) return { ok: false as const, error: 'App "' + targetId + '" is already installed.' }
				return store_install_from_catalog(targetId, active).then(function (result) {
					if (!result.ok) return result
					return { ok: true as const, id: targetId }
				})
			})
		})
	})
}

function manage_update_with_status(
	actingId: string,
	targetId: string,
	confirmed: boolean,
	store: KeyStore | undefined,
	kind: 'update' | 'restore',
): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return get_app_status(targetId, active).then(function (info) {
				if (!info.installed || !info.inCatalog) {
					return { ok: false as const, error: 'App "' + targetId + '" cannot be ' + kind + 'd: it is not an installed catalog app.' }
				}
				if (kind === 'update') {
					if (info.status === 'modified-current' || info.status === 'modified-ahead') {
						return { ok: false as const, error: 'App "' + targetId + '" is modified: use Restore, not Overwrite.' }
					}
					if (info.status !== 'behind-clean' && info.status !== 'catalog-differing' && info.status !== 'behind-modified' && info.status !== 'snapshot-less') {
						return { ok: false as const, error: 'App "' + targetId + '" has no update available.' }
					}
				} else {
					if (info.status !== 'modified-current' && info.status !== 'modified-ahead') {
						return { ok: false as const, error: 'App "' + targetId + '" has nothing to restore.' }
					}
				}
				return Promise.all([
					readJson<AppDefinition>(active, defKey(targetId)),
					Promise.resolve(get_catalog_definition(targetId)),
				]).then(function (pair) {
					var installedDef = pair[0]
					var catalogDef = pair[1]
					var additions = capabilityAdditions(installedDef, catalogDef)
					var needsConfirm = info.status === 'behind-modified' || info.status === 'snapshot-less' || additions.length > 0
					if (kind === 'restore') needsConfirm = true
					if (needsConfirm && !confirmed) {
						return {
							ok: false as const,
							error: 'Confirmation required before ' + kind + 'ing "' + targetId + '".',
							needsConfirmation: true,
							additions: additions,
						}
					}
					return store_update_from_catalog(targetId, active).then(function (result) {
						if (!result.ok) return result
						return { ok: true as const, id: targetId }
					})
				})
			})
		})
	})
}

/**
 * Management remove: permission-checked remove_app for the browser
 * Store. Only the Store's own Remove button offers it, for up-to-date
 * rows, but the API itself removes any installed app: it deletes the
 * definition, state, and snapshot and scrubs every reference list,
 * exactly like the agent remove_app it wraps. Removal always requires
 * confirmation: without confirmed, nothing is written and the caller
 * gets needsConfirmation, which the bundle answers with its own
 * confirmation dialog.
 */
export function manage_remove(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return resolveStore(store).then(function (active: KeyStore) {
		return checkManagePermission(active, actingId).then(function (allowed) {
			if (!allowed) return { ok: false as const, error: 'management not permitted', permissionDenied: true }
			return get_app_status(targetId, active).then(function (info) {
				if (!info.installed) {
					return { ok: false as const, error: 'App "' + targetId + '" is not installed.' }
				}
				if (!confirmed) {
					return {
						ok: false as const,
						error: 'Confirmation required before removing "' + targetId + '".',
						needsConfirmation: true,
						additions: [],
					}
				}
				return remove_app(targetId, active).then(function (result) {
					if (!result.ok) return result
					return { ok: true as const, id: targetId }
				})
			})
		})
	})
}

export function manage_update(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return manage_update_with_status(actingId, targetId, confirmed, store, 'update')
}

export function manage_restore(actingId: string, targetId: string, confirmed: boolean, store?: KeyStore): Promise<ManageResult> {
	return manage_update_with_status(actingId, targetId, confirmed, store, 'restore')
}

export type AppStoreStatus =
	| 'not-installed'
	| 'up-to-date'
	| 'behind-clean'
	| 'catalog-differing'
	| 'behind-modified'
	| 'modified-current'
	| 'modified-ahead'
	| 'snapshot-less'
	| 'storage-only'
	| 'storage-only-formerly'

export interface AppStoreStatusInfo {
	status: AppStoreStatus
	installed: boolean
	inCatalog: boolean
	/** True when the installed definition differs from its snapshot. False for clean installs; meaningless for snapshot-less rows. */
	modified: boolean
	installedVersion?: number
	catalogVersion?: number
	snapshotVersion?: number
}

/**
 * Derive one app's store status from installed fingerprint (I), snapshot
 * fingerprint (S), catalog fingerprint (C, canonicalized the same way),
 * installed catalogVersion (Iv), and catalog catalogVersion (Cv).
 * Content equality wins: I == C is up to date whatever the version
 * fields say. Edge case not named in the spec matrix: an app matching
 * its snapshot, ahead of the catalog (Iv > Cv), with a differing
 * catalog copy is classified modified-ahead for control purposes
 * (Restore, confirmed, never Update) with modified=false, since the
 * user changed nothing but the catalog copy is not the installed one.
 */
export function get_app_status(
	id: string,
	store?: KeyStore,
): Promise<AppStoreStatusInfo> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([
			readJson<AppDefinition>(active, defKey(id)),
			readInstallSnapshot(active, id),
		]).then(function (parts) {
			var installed = parts[0]
			var snapshot = parts[1]
			var catalogDef = get_catalog_definition(id)
			if (!installed) {
				return {
					status: 'not-installed' as const,
					installed: false,
					inCatalog: catalogDef !== null,
					modified: false,
					catalogVersion: catalogDef !== null && catalogDef.catalogVersion !== undefined ? catalogDef.catalogVersion : undefined,
				}
			}
			if (catalogDef === null) {
				return {
					status: snapshot !== null ? ('storage-only-formerly' as const) : ('storage-only' as const),
					installed: true,
					inCatalog: false,
					modified: false,
					installedVersion: installed.catalogVersion,
					snapshotVersion: snapshot !== null ? snapshot.catalogVersion : undefined,
				}
			}
			if (snapshot === null) {
				return {
					status: 'snapshot-less' as const,
					installed: true,
					inCatalog: true,
					modified: false,
					installedVersion: installed.catalogVersion,
					catalogVersion: catalogDef.catalogVersion,
				}
			}
			var installedFingerprint = fingerprintDefinition(installed)
			var catalogFingerprint = fingerprintDefinition(catalogDef)
			var iv = typeof installed.catalogVersion === 'number' ? installed.catalogVersion : 0
			var cv = typeof catalogDef.catalogVersion === 'number' ? catalogDef.catalogVersion : 0
			var modified = installedFingerprint !== snapshot.fingerprint
			var status: AppStoreStatus
			if (installedFingerprint === catalogFingerprint) {
				status = 'up-to-date'
			} else if (!modified && iv < cv) {
				status = 'behind-clean'
			} else if (!modified && iv === cv) {
				status = 'catalog-differing'
			} else if (iv < cv) {
				status = 'behind-modified'
			} else if (iv === cv) {
				status = 'modified-current'
			} else {
				status = 'modified-ahead'
			}
			return {
				status: status,
				installed: true,
				inCatalog: true,
				modified: modified,
				installedVersion: installed.catalogVersion,
				catalogVersion: catalogDef.catalogVersion,
				snapshotVersion: snapshot.catalogVersion,
			}
		})
	})
}

export interface StoreRow {
	id: string
	label: string
	name: string
	icon?: string
	category?: string
	description?: string
	installed: boolean
	inCatalog: boolean
	status: AppStoreStatus
	modified: boolean
	pinned: boolean
	hidden: boolean
	homepage: boolean
	/** Declared capabilities of the catalog definition when present,
	 * else of the installed definition, for Store disclosure. */
	capabilities: CapabilitySummary
}

/**
 * Catalog-only list rows: one row per catalog id, in
 * alphabetical-by-id order, with each row's status and launcher flags.
 * Installed apps with no catalog entry do not appear here; they are
 * managed from Apps Edit and by agents, not from the Store. Hidden
 * apps are included (the list is unfiltered); Hide affects launcher
 * tiles only.
 */
export function get_store_rows(store?: KeyStore): Promise<StoreRow[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([
			readPinned(active),
			readHidden(active),
			readHomepage(active),
		]).then(function (parts) {
			var pinned = parts[0]
			var hidden = parts[1]
			var homepage = parts[2]
			var catalog = list_catalog()
			var idSet: Record<string, boolean> = {}
			var ids: string[] = []
			for (var ci = 0; ci < catalog.length; ci++) {
				if (!idSet[catalog[ci].id]) {
					idSet[catalog[ci].id] = true
					ids.push(catalog[ci].id)
				}
			}
			ids.sort()
			var rows: StoreRow[] = []
			var chain = Promise.resolve()
			for (var ii = 0; ii < ids.length; ii++) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return Promise.all([
							readJson<AppDefinition>(active, defKey(want)),
							get_app_status(want, active),
						]).then(function (pair): void {
							var installedDef = pair[0]
							var info = pair[1]
							var catalogEntry: { id: string; label: string; name: string; icon?: string; category?: string; description?: string } | null = null
							for (var cj = 0; cj < catalog.length; cj++) {
								if (catalog[cj].id === want) catalogEntry = catalog[cj]
							}
							var label = installedDef ? (installedDef.label || installedDef.name) : (catalogEntry ? catalogEntry.label : want)
							var name = installedDef ? installedDef.name : (catalogEntry ? catalogEntry.name : want)
							var catalogDef = get_catalog_definition(want)
							rows.push({
								id: want,
								label: label,
								name: name,
								icon: installedDef ? installedDef.icon : (catalogEntry ? catalogEntry.icon : undefined),
								category: installedDef ? installedDef.category : (catalogEntry ? catalogEntry.category : undefined),
								description: catalogEntry && catalogEntry.description !== undefined ? catalogEntry.description : (installedDef ? installedDef.description : undefined),
								installed: info.installed,
								inCatalog: info.inCatalog,
								status: info.status,
								modified: info.modified,
								pinned: pinned.indexOf(want) !== -1,
								hidden: hidden.indexOf(want) !== -1,
								homepage: homepage.indexOf(want) !== -1,
								capabilities: summarizeCapabilities(catalogDef !== null ? catalogDef : installedDef),
							})
						})
					})
				})(ids[ii])
			}
			return chain.then(function (): StoreRow[] {
				return rows
			})
		})
	})
}

/**
 * Export one app as complete JSON: full definition plus a state snapshot.
 * The result re-imports into a blank install with no code changes.
 */
export function export_app(id: string, store?: KeyStore): Promise<AppExport | { error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return loadEntry(active, id).then(function (entry) {
			if ('error' in entry) return { error: entry.error }
			return {
				format: EXPORT_FORMAT,
				exportedAt: new Date().toISOString(),
				definition: entry.definition,
				state: entry.state,
			} as AppExport
		})
	})
}

export interface InstallExport {
	format: 'kody-os-install/1'
	exportedAt: string
	apps: AppExport[]
	pinned: string[]
	hidden: string[]
	homepage?: string[]
}

/** Export the whole install: every app plus pinned/hidden prefs. Recency stays local. */
export function export_install(store?: KeyStore): Promise<InstallExport> {
	return resolveStore(store).then(function (active: KeyStore) {
		return Promise.all([readRegistry(active), readPinned(active), readHidden(active), readHomepage(active)]).then(function (parts) {
			var ids = parts[0]
			var pinned = parts[1]
			var hidden = parts[2]
			var homepage = parts[3]
			var apps: AppExport[] = []
			var chain = Promise.resolve()
			for (var id of ids) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return loadEntry(active, want).then(function (entry): void {
							if ('error' in entry) return
							apps.push({
								format: EXPORT_FORMAT,
								exportedAt: new Date().toISOString(),
								definition: entry.definition,
								state: entry.state,
							} as AppExport)
						})
					})
				})(id)
			}
			return chain.then(function (): InstallExport {					return {
						format: 'kody-os-install/1',
						exportedAt: new Date().toISOString(),
						apps: apps,
						pinned: pinned,
						hidden: hidden,
						homepage: homepage,
					}
			})
		})
	})
}

/** Import an install payload into a blank store. Restores apps plus pinned/hidden; Recent starts empty. */
export function import_install(
	payload: unknown,
	store?: KeyStore,
	options?: { overwrite?: boolean },
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
		if (!isRecord(payload) || !Array.isArray((payload as Record<string, unknown>)['apps'])) {
			return Promise.resolve({ ok: false as const, error: 'import payload needs an apps array' })
		}
		var rec = payload as Record<string, unknown>
		var list = rec['apps'] as unknown[]
		var ids: string[] = []
		var chain: Promise<{ ok: true; id: string } | { ok: false; error: string } | null> = Promise.resolve(null)
		for (var item of list) {
			;(function (one: unknown): void {
				var prev = chain
				chain = prev.then(function (blocked): Promise<{ ok: true; id: string } | { ok: false; error: string } | null> {
					if (blocked && 'ok' in blocked && blocked.ok === false) return blocked
					return import_app(one, active, options).then(function (r) {
						if (!r.ok) return r
						ids.push(r.id)
						return null
					})
				})
			})(item)
		}
		return chain.then(function (failed): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
			if (failed && 'ok' in failed && failed.ok === false) return Promise.resolve(failed as { ok: false; error: string })
			return readRegistry(active).then(function (installed: string[]) {
				var pinnedRaw = Array.isArray(rec['pinned']) ? (rec['pinned'] as unknown[]) : []
				var hiddenRaw = Array.isArray(rec['hidden']) ? (rec['hidden'] as unknown[]) : []
				var homepageRaw = Array.isArray(rec['homepage']) ? (rec['homepage'] as unknown[]) : []
				var pinned: string[] = []
				var hidden: string[] = []
				var homepage: string[] = []
				for (var pi = 0; pi < pinnedRaw.length; pi++) {
					if (typeof pinnedRaw[pi] === 'string' && installed.indexOf(pinnedRaw[pi] as string) !== -1 && pinned.indexOf(pinnedRaw[pi] as string) === -1) pinned.push(pinnedRaw[pi] as string)
				}
				for (var hi = 0; hi < hiddenRaw.length; hi++) {
					if (typeof hiddenRaw[hi] === 'string' && installed.indexOf(hiddenRaw[hi] as string) !== -1 && hidden.indexOf(hiddenRaw[hi] as string) === -1) hidden.push(hiddenRaw[hi] as string)
				}
				for (var gi = 0; gi < homepageRaw.length; gi++) {
					if (typeof homepageRaw[gi] === 'string' && installed.indexOf(homepageRaw[gi] as string) !== -1 && homepage.indexOf(homepageRaw[gi] as string) === -1) homepage.push(homepageRaw[gi] as string)
				}
				return Promise.all([writePinned(active, pinned), writeHidden(active, hidden), writeHomepage(active, homepage)]).then(function (): { ok: true; ids: string[] } {
					return { ok: true as const, ids: ids }
				})
			})
		})
	})
}

function migrateImportPayload(payload: unknown): { def?: AppDefinition; error?: string } {
	if (!isRecord(payload)) return { error: 'import payload must be an object' }
	var body: unknown = payload
	if (isRecord(payload['definition'])) {
		// Export envelope (v1 or v2).
		body = payload['definition']
	}
	if (!isRecord(body)) return { error: 'import payload has no definition object' }
	var rec = body as Record<string, unknown>
	var id = reqStr(rec, 'id')
	var name = reqStr(rec, 'name')
	var label = reqStr(rec, 'label')
	if (!id) {
		// v1 payloads keyed by name: derive the id.
		if (!name) return { error: 'import payload needs an id (or a v1 name to derive it)' }
		id = name
	}
	if (!name) name = label || id
	var migrated: Record<string, unknown> = {}
	for (var k of Object.keys(rec)) migrated[k] = rec[k]
	migrated['id'] = id
	migrated['name'] = name
	if (migrated['label'] === undefined) migrated['label'] = name
	var problem = validateDefinition(migrated)
	if (problem) return { error: problem }
	return { def: migrated as unknown as AppDefinition }
}

/**
 * Import an export_app payload (v2, v1, or a bare definition) into this
 * install. Registry-write-only like add_app; no code changes, no republish.
 */
export function import_app(
	payload: unknown,
	store?: KeyStore,
	options?: { overwrite?: boolean },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	return resolveStore(store).then(function (active: KeyStore) {
		var m = migrateImportPayload(payload)
		if (m.error || !m.def) return { ok: false as const, error: m.error || 'invalid payload' }
		var def = m.def
		var needCheck = !options || options.overwrite !== true
		var checkExisting: Promise<{ ok: true; id: string } | { ok: false; error: string } | null> =
			needCheck
				? readJson(active, defKey(def.id)).then(function (existing) {
						if (existing) return { ok: false as const, error: 'app "' + def.id + '" already installed (pass overwrite:true to replace)' }
						return null
					})
				: Promise.resolve(null)
		return checkExisting.then(function (blocked) {
			if (blocked) return blocked
			return add_app(def, active).then(function (added) {
				if (!added.ok) return added
				var rawState: unknown = isRecord(payload) && isRecord(payload['state']) ? payload['state'] : undefined
				if (rawState === undefined && isRecord(payload) && isRecord(payload['definition'])) {
					var env = payload as Record<string, unknown>
					if (isRecord(env['state'])) rawState = env['state']
				}
				if (!isRecord(rawState)) return { ok: true as const, id: def.id }
				var st = rawState as Record<string, unknown>
				for (var field of Object.keys(def.stateSchema.fields)) {
					var ferr = checkFieldValue(field, def.stateSchema.fields[field], st[field])
					if (ferr) return { ok: false as const, error: 'imported state invalid: ' + ferr }
				}
				return writeJson(active, stateKey(def.id), cloneState(st as AppState)).then(function () {
					return { ok: true as const, id: def.id }
				})
			})
		})
	})
}

/**
 * Install backups (replace-with-auto-snapshot). A backup is the
 * export_install envelope plus a backup tag, stored under
 * `kody-os.backups.<name>`. Recency is not captured, exactly as
 * export_install excludes it; auth keys are never captured or touched.
 *
 * packageStorage() has no key listing, so backup names are also kept
 * in an index key, `kody-os.backups.index` (an array of names). The
 * index is maintained by backup/delete_backup only, is never wiped by
 * restore, and is never part of an export_install payload.
 */

export interface BackupEntry {
	format: 'kody-os-backup/1'
	name: string
	capturedAt: string
	install: InstallExport
}

export interface BackupSummary {
	name: string
	capturedAt: string
	appCount: number
	size: number
}

var BACKUP_PREFIX = 'kody-os.backups.'
var BACKUP_INDEX_KEY = 'kody-os.backups.index'

function backupKey(name: string): string {
	return BACKUP_PREFIX + name
}

function isBackupName(name: unknown): name is string {
	return typeof name === 'string' && NAME_RE.test(name)
}

function readBackupIndex(store: KeyStore): Promise<string[]> {
	return readJson<string[]>(store, BACKUP_INDEX_KEY).then(function (raw): string[] {
		if (!Array.isArray(raw)) return []
		var out: string[] = []
		for (var i = 0; i < raw.length; i++) {
			if (typeof raw[i] === 'string' && out.indexOf(raw[i]) === -1) out.push(raw[i])
		}
		return out
	})
}

function writeBackupIndex(store: KeyStore, names: string[]): Promise<void> {
	return writeJson(store, BACKUP_INDEX_KEY, names)
}

function readBackupEntry(store: KeyStore, name: string): Promise<BackupEntry | null> {
	return readJson<BackupEntry>(store, backupKey(name)).then(function (raw): BackupEntry | null {
		if (!raw || raw.format !== 'kody-os-backup/1' || typeof raw.name !== 'string' || !isRecord(raw.install)) return null
		return raw
	})
}

function writeBackupEntry(store: KeyStore, entry: BackupEntry): Promise<void> {
	return readBackupIndex(store).then(function (names: string[]): Promise<void> {
		if (names.indexOf(entry.name) === -1) names.push(entry.name)
		return writeJson(store, backupKey(entry.name), entry).then(function (): Promise<void> {
			return writeBackupIndex(store, names)
		})
	})
}

export function backup(
	name: string,
	optsOrStore?: KeyStore | { overwrite?: boolean },
	maybeStore?: KeyStore,
): Promise<{ ok: true; name: string; capturedAt: string; appCount: number; size: number } | { ok: false; error: string }> {
	var activeStore: KeyStore | undefined = undefined
	var overwrite = false
	if (optsOrStore && isKeyStore(optsOrStore)) {
		activeStore = optsOrStore
	} else if (optsOrStore && typeof optsOrStore === 'object') {
		overwrite = (optsOrStore as { overwrite?: boolean }).overwrite === true
		if (maybeStore) activeStore = maybeStore
	}
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'backup name must match ^[a-z0-9][a-z0-9-]{0,63}$' })
	return resolveStore(activeStore).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (existing) {
			if (existing && !overwrite) return { ok: false as const, error: 'backup "' + name + '" already exists (pass overwrite:true to replace it)' }
			return export_install(active).then(function (install: InstallExport) {
				var entry: BackupEntry = {
					format: 'kody-os-backup/1',
					name: name,
					capturedAt: new Date().toISOString(),
					install: install,
				}
				return writeBackupEntry(active, entry).then(function (): { ok: true; name: string; capturedAt: string; appCount: number; size: number } {
					return { ok: true as const, name: name, capturedAt: entry.capturedAt, appCount: install.apps.length, size: JSON.stringify(entry).length }
				})
			})
		})
	})
}

export function list_backups(store?: KeyStore): Promise<BackupSummary[]> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupIndex(active).then(function (names: string[]) {
			var out: BackupSummary[] = []
			var chain = Promise.resolve()
			for (var i = 0; i < names.length; i++) {
				;(function (want: string): void {
					chain = chain.then(function (): Promise<void> {
						return readBackupEntry(active, want).then(function (entry): void {
							if (!entry) return
							out.push({
								name: entry.name,
								capturedAt: entry.capturedAt,
								appCount: Array.isArray(entry.install.apps) ? entry.install.apps.length : 0,
								size: JSON.stringify(entry).length,
							})
						})
					})
				})(names[i])
			}
			return chain.then(function (): BackupSummary[] {
				return out
			})
		})
	})
}

export function delete_backup(
	name: string,
	store?: KeyStore,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'unknown backup "' + String(name) + '"' })
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (existing) {
			if (!existing) return { ok: false as const, error: 'unknown backup "' + name + '"' }
			return deleteKey(active, backupKey(name)).then(function () {
				return readBackupIndex(active).then(function (names: string[]) {
					var next = names.filter(function (one: string): boolean { return one !== name })
					return writeBackupIndex(active, next).then(function (): { ok: true; name: string } {
						return { ok: true as const, name: name }
					})
				})
			})
		})
	})
}

function validateBackupInstall(install: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!isRecord(install) || !Array.isArray((install as Record<string, unknown>)['apps'])) {
		return Promise.resolve({ ok: false as const, error: 'backup install payload needs an apps array' })
	}
	var temp = createMemoryStore()
	return import_install(install, temp).then(function (result) {
		if (!result.ok) return { ok: false as const, error: result.error }
		return { ok: true as const }
	})
}

/**
 * Restore a named backup: validate the snapshot fully (in a throwaway
 * memory store) before any delete, auto-snapshot the current install
 * first, wipe only install keys (registry, per-app def/state, pinned,
 * hidden, recent, homepage — never backups.* and never auth keys),
 * then write the snapshot contents. Unknown names, unknown format
 * tags, and corrupt entries return { ok:false } with the install
 * untouched. The result names the auto-snapshot so the caller can undo.
 */
export function restore(
	name: string,
	store?: KeyStore,
): Promise<{ ok: true; name: string; autoSnapshot: string; ids: string[] } | { ok: false; error: string }> {
	if (!isBackupName(name)) return Promise.resolve({ ok: false as const, error: 'unknown backup "' + String(name) + '"' })
	return resolveStore(store).then(function (active: KeyStore) {
		return readBackupEntry(active, name).then(function (entry) {
			if (!entry) return { ok: false as const, error: 'unknown backup "' + name + '"' }
			return validateBackupInstall(entry.install).then(function (valid) {
				if (!valid.ok) return valid
				var autoBase = 'auto-' + String(Date.now())
				return readBackupIndex(active).then(function (names: string[]) {
					var autoName = autoBase
					var counter = 1
					while (names.indexOf(autoName) !== -1) {
						counter++
						autoName = autoBase + '-' + String(counter)
					}
					return export_install(active).then(function (current: InstallExport) {
						var currentEntry: BackupEntry = {
							format: 'kody-os-backup/1',
							name: autoName,
							capturedAt: new Date().toISOString(),
							install: current,
						}
						return writeBackupEntry(active, currentEntry).then(function () {
							return readRegistry(active).then(function (ids: string[]) {
								var chain: Promise<void> = Promise.resolve()
								for (var i = 0; i < ids.length; i++) {
									;(function (want: string): void {
										chain = chain.then(function (): Promise<void> {
											return deleteKey(active, defKey(want)).then(function (): Promise<void> {
												return deleteKey(active, stateKey(want)).then(function (): Promise<void> {
													return deleteInstallSnapshot(active, want)
												})
											})
										})
									})(ids[i])
								}
								return chain.then(function () {
									return Promise.all([
										writeRegistry(active, []),
										writePinned(active, []),
										writeHidden(active, []),
										writeRecent(active, []),
										writeHomepage(active, []),
									])
								}).then(function () {
									return import_install(entry.install, active).then(function (imported) {
										if (!imported.ok) return imported
										return { ok: true as const, name: name, autoSnapshot: autoName, ids: imported.ids }
									})
								})
							})
						})
					})
				})
			})
		})
	})
}
