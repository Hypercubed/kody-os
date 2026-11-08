/**
 * Pure definition language for kody-os apps: validate, migrate,
 * canonicalize, fingerprint a definition, plus the pure helpers `act`
 * also needs. No store, no network, no runtime: takes a value and
 * returns a value.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */

import type {
	ActionDef,
	AppDefinition,
	OpenAs,
	AppState,
	ProxyDecl,
	StateFieldDef,
} from './types.ts'
import { DEFINITION_SCHEMA_VERSION } from './types.ts'

export var NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function cloneState(state: AppState): AppState {
	return JSON.parse(JSON.stringify(state)) as AppState
}

export function reqStr(obj: Record<string, unknown>, key: string): string | undefined {
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
export function byteLength(value: string): number {
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

/**
 * Assemble a definition's bundle files to the runtime files map.
 * - Inline map form (`files` as `Record<path, content>`): returned as-is.
 * - Manifest list form (`files` as `string[]`): each path is resolved with
 *   `readFile` (relative to the app directory); a missing file is an error.
 * A definition carrying both forms is impossible in one field, so a `files`
 * value that is neither a map nor a list is rejected as ambiguous.
 * Returns the assembled map, or an `{ error }` (never throws).
 */
export function assembleBundleFiles(
	bundle: unknown,
	readFile: (path: string) => string | undefined,
): { ok: true; files: Record<string, string> } | { ok: false; error: string } {
	if (!isRecord(bundle)) return { ok: false as const, error: 'definition.bundle must be an object (every unified app ships its own UI files)' }
	var manifest = bundle as Record<string, unknown>
	if (manifest['entry'] !== 'index.html') return { ok: false as const, error: 'definition.bundle.entry must be "index.html"' }
	var rawFiles = manifest['files']
	if (Array.isArray(rawFiles)) {
		var out: Record<string, string> = {}
		for (var li = 0; li < rawFiles.length; li++) {
			var listPath = rawFiles[li]
			if (typeof listPath !== 'string' || !isBundlePath(listPath)) {
				return { ok: false as const, error: 'definition.bundle.files has bad path "' + String(listPath) + '" (relative .html/.js/.css only, no "..", no absolute paths)' }
			}
			if (listPath in out) return { ok: false as const, error: 'definition.bundle.files lists "' + listPath + '" twice' }
			var content = readFile(listPath)
			if (content === undefined) return { ok: false as const, error: 'definition.bundle.files lists "' + listPath + '" but it is missing on disk' }
			out[listPath] = content
		}
		return { ok: true as const, files: out }
	}
	if (!isRecord(rawFiles)) {
		return { ok: false as const, error: 'definition.bundle.files must be an object (inline contents map) or an array (on-disk manifest list); carrying both is an error' }
	}
	var inlineFiles = rawFiles as Record<string, unknown>
	var inlineOut: Record<string, string> = {}
	for (var key of Object.keys(inlineFiles)) inlineOut[key] = String(inlineFiles[key])
	return { ok: true as const, files: inlineOut }
}

/** Attribute names allowed on a bundle reference element besides its target. Quoted values are blanked first so spaces inside a value can never read as an attribute; bare (value-less) attributes are still caught. */
function bundleReferenceAttrError(tag: string, attrText: string, allowed: string[]): string | null {
	var blanked = attrText.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''")
	var tokens = blanked.split(/\s+/)
	for (var ti = 0; ti < tokens.length; ti++) {
		var nameMatch = /^([A-Za-z-]+)/.exec(tokens[ti])
		if (!nameMatch) continue
		var name = nameMatch[1].toLowerCase()
		if (name === '/') continue
		if (allowed.indexOf(name) === -1) {
			return 'bundle reference <' + tag + '> must carry no attributes beyond ' + allowed.join('/') + ' (found "' + name + '")'
		}
	}
	return null
}

function isExternalBundleRef(target: string): boolean {
	var lower = target.toLowerCase()
	if (lower.indexOf('://') !== -1) return true
	if (lower.charAt(0) === '/' && lower.charAt(1) === '/') return true
	if (/^(https?|data|blob|file):/.test(lower)) return true
	return false
}

/**
 * Validate the entry's asset references against the assembled files map.
 * The scan runs over markup only: HTML comments and inline `<script>`
 * bodies are stripped first, so `<link>`/`<script>` text inside bundle
 * JavaScript (for example an RSS regex) can never read as a reference.
 * Supported forms are exactly `<script src="path"></script>` and
 * `<link rel="stylesheet" href="path">`; every `.js`/`.css` file must
 * be referenced, dangling references are an error, and unreferenced
 * non-entry `.html` files stay ignored (never served, hence inert).
 */
export function validateBundleReferences(files: Record<string, string>): string | null {
	var entry = files['index.html']
	if (typeof entry !== 'string') return 'definition.bundle.files is missing the entry "index.html"'
	var scan = entry.replace(/<!--[\s\S]*?-->/g, '')
	scan = scan.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, '<script$1></script>')
	var used: string[] = ['index.html']
	var scriptRe = /<script\b([^>]*)>\s*<\/script\s*>/gi
	var scriptMatch: RegExpExecArray | null
	while ((scriptMatch = scriptRe.exec(scan)) !== null) {
		var scriptAttrs = scriptMatch[1]
		var srcMatch = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(scriptAttrs)
		if (!srcMatch) continue
		var srcAttrErr = bundleReferenceAttrError('script', scriptAttrs, ['src'])
		if (srcAttrErr) return srcAttrErr
		var src = srcMatch[2]
		if (src === '' || isExternalBundleRef(src) || src.charAt(0) === '/' || src.indexOf('..') !== -1 || src.indexOf('\\') !== -1) {
			return 'bundle reference <script src="' + src + '"> must be a bare relative bundle path (no absolute or external URLs)'
		}
		if (!(src in files)) return 'bundle reference <script src="' + src + '"> does not resolve to a manifest file'
		if (used.indexOf(src) === -1) used.push(src)
	}
	var linkRe = /<link\b([^>]*?)\/?>/gi
	var linkMatch: RegExpExecArray | null
	while ((linkMatch = linkRe.exec(scan)) !== null) {
		var linkAttrs = linkMatch[1]
		var relMatch = /\brel\s*=\s*(["'])(.*?)\1/i.exec(linkAttrs)
		if (!relMatch || relMatch[2].toLowerCase().indexOf('stylesheet') === -1) continue
		var linkAttrErr = bundleReferenceAttrError('link', linkAttrs, ['href', 'rel'])
		if (linkAttrErr) return linkAttrErr
		var hrefMatch = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(linkAttrs)
		if (!hrefMatch) return 'bundle reference <link rel="stylesheet"> is missing href'
		var href = hrefMatch[2]
		if (href === '' || isExternalBundleRef(href) || href.charAt(0) === '/' || href.indexOf('..') !== -1 || href.indexOf('\\') !== -1) {
			return 'bundle reference <link href="' + href + '"> must be a bare relative bundle path (no absolute or external URLs)'
		}
		if (!(href in files)) return 'bundle reference <link href="' + href + '"> does not resolve to a manifest file'
		if (used.indexOf(href) === -1) used.push(href)
	}
	for (var path of Object.keys(files)) {
		if (used.indexOf(path) !== -1) continue
		if (path.slice(-3) === '.js' || path.slice(-4) === '.css') {
			return 'bundle file "' + path + '" is unreferenced: every .js/.css file must be referenced by the entry'
		}
	}
	return null
}

/** Validate the bundle manifest of a unified app definition. Returns an error string, or null when valid.
 *
 * Both `files` forms are accepted structurally: the inline contents map is
 * validated fully (paths, string contents, 256 KiB cap, references);
 * the on-disk manifest list is validated structurally (valid paths, entry
 * included, no duplicates) and — when `readFile` is given — assembled and
 * then validated exactly like the inline form (cap plus references).
 * Without a reader the list form cannot be reference-checked, so
 * `validateDefinition` (the `add_app` transport path, which carries no
 * reader) rejects it: `add_app` transport must carry the inline map.
 */
function validateBundleManifest(def: Record<string, unknown>, readFile?: (path: string) => string | undefined): string | null {
	if (!isRecord(def['bundle'])) return 'definition.bundle must be an object (every unified app ships its own UI files)'
	var manifest = def['bundle'] as Record<string, unknown>
	if (manifest['entry'] !== 'index.html') return 'definition.bundle.entry must be "index.html"'
	if (Array.isArray(manifest['files'])) {
		var list = manifest['files'] as unknown[]
		var seen: string[] = []
		for (var li = 0; li < list.length; li++) {
			var listPath = list[li]
			if (typeof listPath !== 'string' || !isBundlePath(listPath)) {
				return 'definition.bundle.files has bad path "' + String(listPath) + '" (relative .html/.js/.css only, no "..", no absolute paths)'
			}
			if (seen.indexOf(listPath) !== -1) return 'definition.bundle.files lists "' + listPath + '" twice'
			seen.push(listPath)
		}
		if (seen.indexOf('index.html') === -1) return 'definition.bundle.files is missing the entry "index.html"'
		if (!readFile) return 'definition.bundle.files is an on-disk manifest list: assemble it with assembleBundleFiles before validating references (add_app transport must carry the inline files map)'
		var assembled = assembleBundleFiles(manifest, readFile)
		if (!assembled.ok) return assembled.error
		var listFiles = (assembled as { ok: true; files: Record<string, string> }).files
		var listTotal = 0
		for (var lp of Object.keys(listFiles)) listTotal += byteLength(listFiles[lp])
		if (listTotal > BUNDLE_CAP_BYTES) {
			return 'definition.bundle.files total ' + listTotal + ' bytes exceeds the 256 KiB cap'
		}
		return validateBundleReferences(listFiles)
	}
	if (!isRecord(manifest['files'])) return 'definition.bundle.files must be an object (inline contents map) or an array (on-disk manifest list); carrying both is an error'
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
	var stringFiles: Record<string, string> = {}
	for (var fk of Object.keys(files)) stringFiles[fk] = files[fk] as string
	return validateBundleReferences(stringFiles)
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
		if (key !== 'feeds' && key !== 'manageApps' && key !== 'proxy' && key !== 'theme') return 'definition.capabilities.' + key + ' is unknown'
	}
	if (capsRec['manageApps'] !== undefined && typeof capsRec['manageApps'] !== 'boolean') return 'definition.capabilities.manageApps must be a boolean'
	if (capsRec['theme'] !== undefined) {
		var themeCaps = capsRec['theme']
		if (!isRecord(themeCaps)) return 'definition.capabilities.theme must be an object'
		var themeRec = themeCaps as Record<string, unknown>
		for (var themeKey of Object.keys(themeRec)) {
			if (themeKey !== 'view' && themeKey !== 'set') return 'definition.capabilities.theme.' + themeKey + ' is unknown'
		}
		if (themeRec['view'] !== undefined && typeof themeRec['view'] !== 'boolean') return 'definition.capabilities.theme.view must be a boolean'
		if (themeRec['set'] !== undefined && typeof themeRec['set'] !== 'boolean') return 'definition.capabilities.theme.set must be a boolean'
	}
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
	if (capsRec['theme'] !== undefined) {
		var themeRaw = capsRec['theme'] as Record<string, unknown>
		out.theme = { view: themeRaw['view'] === true, set: themeRaw['set'] === true }
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
	themeView: boolean
	themeSet: boolean
}

export function summarizeCapabilities(def: AppDefinition | null | undefined): CapabilitySummary {
	if (!def || !def.capabilities) return { manageApps: false, feedHosts: [], proxyHosts: [], themeView: false, themeSet: false }
	return {
		manageApps: def.capabilities.manageApps === true,
		feedHosts: upstreamHosts(def.capabilities.feeds),
		proxyHosts: upstreamHosts(def.capabilities.proxy),
		themeView: def.capabilities.theme !== undefined && def.capabilities.theme.view === true,
		themeSet: def.capabilities.theme !== undefined && def.capabilities.theme.set === true,
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
	if (newSummary.themeView && !oldSummary.themeView) additions.push('view the shell theme')
	if (newSummary.themeSet && !oldSummary.themeSet) additions.push('change the shell theme')
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

/** Minimum supported definition version: derived from `SUPPORTED_SCHEMA_VERSIONS` (its minimum).
 * `add_app` refuses an app below this floor (too old for the shell), alongside
 * the `minPackageVersion` gate (shell too old for the app). Raised as a MAJOR
 * change when the shell drops an old schema. ES2019: no ?. and no ??. */
export var MIN_SUPPORTED_SCHEMA_VERSION = Math.min.apply(null, SUPPORTED_SCHEMA_VERSIONS)

/**
 * Parse a `MAJOR.MINOR.PATCH` version string (numeric parts only, no
 * pre-release or build metadata). Returns the numeric triple, or null
 * when malformed. ES2019: no ?. and no ??.
 */
export function parsePackageVersion(value: unknown): [number, number, number] | null {
	if (typeof value !== 'string') return null
	if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(value)) return null
	var parts = value.split('.')
	var major = Number(parts[0])
	var minor = Number(parts[1])
	var patch = Number(parts[2])
	if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return null
	if (major < 0 || minor < 0 || patch < 0) return null
	return [major, minor, patch]
}

/**
 * Compare two parsed versions numerically: -1 when a < b, 0 when
 * equal, 1 when a > b. MAJOR, then MINOR, then PATCH.
 */
export function comparePackageVersions(a: [number, number, number], b: [number, number, number]): number {
	if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
	if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
	if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1
	return 0
}

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
	if (def['installMode'] !== undefined) {
		var installMode = def['installMode']
		if (installMode !== 'json' && installMode !== 'recipe-only') {
			return 'definition.installMode must be "json" or "recipe-only"'
		}
	}
	if (def['minPackageVersion'] !== undefined) {
		if (parsePackageVersion(def['minPackageVersion']) === null) {
			return 'definition.minPackageVersion must be MAJOR.MINOR.PATCH (numeric parts, no pre-release or build metadata)'
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
 * stringification, catalogVersion and installMode preserved when
 * present). Callers
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
	if (definition.installMode !== undefined) def.installMode = definition.installMode
	if (definition.minPackageVersion !== undefined) def.minPackageVersion = definition.minPackageVersion
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
 * excluding catalogVersion and installMode: content equality wins whatever the version
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
	delete canon['installMode']
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

export function checkFieldValue(field: string, spec: StateFieldDef, value: unknown): string | null {
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
export function coerceArg(
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
export function backfillDefinition(raw: AppDefinition): AppDefinition {
	if (!raw || typeof raw !== 'object') return raw
	var rec = raw as unknown as Record<string, unknown>
	var version = rec['schemaVersion']
	if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0) return raw
	rec['schemaVersion'] = DEFINITION_SCHEMA_VERSION
	if (validateDefinition(rec) !== null) rec['schemaVersion'] = 1
	return rec as unknown as AppDefinition
}

/**
 * Compile one definition to its canonical stored form: validate the
 * submitted input (exactly as `add_app` does today), then canonicalize
 * (which migrates single-`effect` actions to `effects[]` per-action,
 * restamps the schema version, sanitizes the icon, derives the open
 * mode, and applies capability defaults), then fingerprint the canonical
 * form. Returns the canonical definition plus its fingerprint, or the
 * validator's error string unchanged. Validation runs on the input,
 * not on a pre-migrated copy, so a v3 single-`effect` definition keeps
 * validating exactly as before. Compilation never decides
 * installability: the schema-floor gate, the minPackageVersion gate,
 * and the new-id staleness check stay in `add_app`.
 */
export function compileDefinition(def: unknown): { ok: true; definition: AppDefinition; fingerprint: string } | { ok: false; error: string } {
	var problem = validateDefinition(def)
	if (problem) return { ok: false as const, error: problem }
	var canonical = canonicalizeDefinition(def as AppDefinition)
	return { ok: true as const, definition: canonical, fingerprint: fingerprintDefinition(canonical) }
}
