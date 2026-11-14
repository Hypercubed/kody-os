import { SHELL_CSS } from './shell-css.ts'
import { isSvgIcon, sanitizeSvgIcon } from './apps/registry.ts'
import { serveFeed, serveProxy } from './feeds.ts'
import { renderAboutContent } from './shell-pages.ts'
import { fileThemeToValues, get_shell_theme, reset_shell_theme, set_shell_theme } from './shell-theme.ts'
import type { AppDefinition, AppState } from './apps/types.ts'

// Re-export the MCP surface so `import { add_app } from 'kody:@hypercubed/kody-os'`
// works in Kody execute: the execute runtime resolves a `kody:` import to this
// app entry (app.ts), not to the ESM `exports` entry (index.ts). Re-exporting
// from the source module (apps/index.ts) avoids a cycle — index.ts imports
// getTheme from here, and apps/index.ts does not import this file.
export {
	act,
	actFromForm,
	add_app,
	backup,
	clear_recent,
	delete_backup,
	export_app,
	export_install,
	get_app,
	get_app_state,
	get_catalog_definition,
	get_hidden,
	get_homepage,
	get_launcher_state,
	get_pinned,
	get_recent,
	get_store_catalog_info,
	import_app,
	import_install,
	install_from_catalog,
	list_apps,
	list_backups,
	list_catalog,
	move_home,
	remove_app,
	restore,
	set_hide,
	set_hidden,
	set_home,
	set_homepage,
	set_pin,
	set_pinned,
	update_from_catalog,
	validateDefinition,
} from './apps/index.ts'

interface PackageContext {
	appBasePath?: string
	assetBasePath?: string
	clientModuleUrl?: string | null
	packageId?: string
	sourceId?: string
}

interface Chrome {
	appBasePath: string
	assetBasePath: string
	clientModuleUrl: string
	theme: ResolvedTheme
	/** Effective page-visibility flags from the merged settings file + override. */
	showHelp?: boolean
	showAbout?: boolean
}

/** Raw fork-editable theme file shape: every field optional strings. */
interface ThemeFile {
	name?: unknown
	title?: unknown
	icon?: unknown
	background?: unknown
}

/** Theme with defaults applied: today's rendering when the file is absent. */
interface ResolvedTheme {
	version?: string
	build?: string
	name: string
	titlePrefix: string
	/** Plain-text glyph mark; empty when absent or when an SVG mark is set. */
	icon: string
	/** Sanitized inline-SVG mark; empty when absent or when a glyph is set. */
	iconSvg: string
	bodyStyle: string
}

/** Closed background tokens mapping to existing CSS values. */
var THEME_BACKGROUNDS: Record<string, string> = {
	desk: '',
	paper: 'background: #fff',
}

/** Custom grid background: eight rows of eight cells, MSB leftmost. */
var THEME_GRID_ROWS = 8
var THEME_GRID_CELL_PX = 6

/**
 * Render a `{ grid: [r0..r7] }` theme background as the same inline-SVG
 * data-URI tile shape the shell already uses for stripes/checker.
 * Returns null for anything that is not eight bytes of 0-255, so a
 * hand-edited typo falls back to `desk` instead of breaking the page.
 */
function gridBodyStyle(value: unknown): string | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	var rows = (value as { grid?: unknown }).grid
	if (!Array.isArray(rows) || rows.length !== THEME_GRID_ROWS) return null
	var rects = ''
	for (var row = 0; row < THEME_GRID_ROWS; row++) {
		var byte = rows[row]
		if (typeof byte !== 'number' || !isFinite(byte) || Math.floor(byte) !== byte || byte < 0 || byte > 255) return null
		for (var col = 0; col < THEME_GRID_ROWS; col++) {
			if ((byte & (128 >> col)) === 0) continue
			rects +=
				"%3Crect x='" +
				String(col * THEME_GRID_CELL_PX) +
				"' y='" +
				String(row * THEME_GRID_CELL_PX) +
				"' width='" +
				String(THEME_GRID_CELL_PX) +
				"' height='" +
				String(THEME_GRID_CELL_PX) +
				"' fill='%23000'/%3E"
		}
	}
	var side = String(THEME_GRID_ROWS * THEME_GRID_CELL_PX)
	var tile =
		"%3Csvg xmlns='http://www.w3.org/2000/svg' width='" +
		side +
		"' height='" +
		side +
		"'%3E%3Crect width='" +
		side +
		"' height='" +
		side +
		"' fill='%23fff'/%3E" +
		rects +
		'%3C/svg%3E'
	return 'background: #fff url("data:image/svg+xml,' + tile + '") repeat'
}

/** Escape runtime values before placing them in an HTML attribute. */
function escapeAttribute(value: string): string {
	return value.replace(/[&<>"']/g, function (character: string): string {
		if (character === '&') return '&amp;'
		if (character === '<') return '&lt;'
		if (character === '>') return '&gt;'
		if (character === '"') return '&quot;'
		return '&#39;'
	})
}

/**
 * Resolve Kody's app context when the hosted runtime provides it.
 * Local typechecks and non-Kody execution use static shell defaults instead.
 */
function getPackageContext(): Promise<PackageContext> {
	try {
		// @ts-ignore Kody supplies this virtual module only in the hosted Worker.
		var req = import('kody:runtime')
		return req.then(
			function (runtime: { packageContext?: PackageContext | null }): PackageContext {
				if (runtime && runtime.packageContext) return runtime.packageContext
				return {}
			},
			function (): PackageContext {
				return {}
			},
		)
	} catch (err) {
		return Promise.resolve({})
	}
}

function str(v: unknown, fallback: string): string {
	return typeof v === 'string' ? v : fallback
}

/** Load the fork-editable theme file once per publish; missing or broken reads as {}. */
var themePromise: Promise<ThemeFile> | null = null
var packageMetaPromise: Promise<{ version: string; build: string }> | null = null
function getPackageMeta(): Promise<{ version: string; build: string }> {
	if (!packageMetaPromise) {
		try {
			// @ts-ignore optional manifest; the bundler inlines it when present.
			var req = import('../package.json', { with: { type: 'json' } })
			packageMetaPromise = req.then(
				function (m: unknown): { version: string; build: string } {
					var out = { version: '0.1.0', build: '' }
					try {
						var rec = m as { default?: unknown } | null
						var body = rec && typeof rec === 'object' && 'default' in rec ? rec.default : m
						if (body && typeof body === 'object') {
							var v = (body as { version?: unknown }).version
							if (typeof v === 'string' && v !== '') out.version = v
							var b = (body as { build?: unknown }).build
							if (typeof b === 'number' && isFinite(b)) out.build = 'b' + String(Math.floor(b))
							else if (typeof b === 'string' && b !== '') out.build = b
						}
					} catch (err) {
					}
					return out
				},
				function (): { version: string; build: string } {
					return { version: '0.1.0', build: '' }
				}
			)
		} catch (err) {
			packageMetaPromise = Promise.resolve({ version: '0.1.0', build: '' })
		}
	}
	return packageMetaPromise
}

export function getTheme(): Promise<ThemeFile> {
	if (!themePromise) {
		try {
			// @ts-ignore optional theme file; the bundler inlines it when present, rejection means absent.
			var req = import('../settings.json', { with: { type: 'json' } })
			themePromise = req.then(
				function (m: unknown): ThemeFile {
					var rec = m as { default?: unknown } | null
					var body = rec && typeof rec === 'object' && 'default' in rec ? rec.default : m
						return body && typeof body === 'object' ? (body as ThemeFile) : {}
					},
				function (): ThemeFile {
					return {}
				},
			)
		} catch (err) {
			themePromise = Promise.resolve({})
		}
	}
	return themePromise
}

/** Apply inline fallbacks: today's values for a missing file or missing field. */
function resolveTheme(raw: ThemeFile): ResolvedTheme {
	var src = raw && typeof raw === 'object' ? raw : {}
	var name = typeof src.name === 'string' && src.name !== '' ? src.name : 'kody-os'
	var icon = typeof src.icon === 'string' ? src.icon : ''
	var iconSvg = ''
	// A theme icon that starts with `<svg` must pass the app-icon allowlist;
	// hostile or malformed markup falls back to the stock Kody mark.
	if (icon !== '' && isSvgIcon(icon)) {
		var iconResult = sanitizeSvgIcon(icon)
		iconSvg = iconResult.ok ? iconResult.icon : ''
		icon = ''
	}
	var titlePrefix = typeof src.title === 'string' && src.title !== '' ? src.title : name
	var bodyStyle = THEME_BACKGROUNDS['desk']
	if (typeof src.background === 'string' && Object.prototype.hasOwnProperty.call(THEME_BACKGROUNDS, src.background)) {
		bodyStyle = THEME_BACKGROUNDS[src.background]
	} else if (typeof src.background === 'object') {
		var gridStyle = gridBodyStyle(src.background)
		if (gridStyle !== null) bodyStyle = gridStyle
	}
	return { name: name, titlePrefix: titlePrefix, icon: icon, iconSvg: iconSvg, bodyStyle: bodyStyle }
}

/** Join the mount path and a route without doubling or dropping the slash. */
function joinPath(base: string, suffix: string): string {
	var b = base
	while (b.length > 1 && b.charAt(b.length - 1) === '/') b = b.slice(0, -1)
	if (b === '/') b = ''
	return b + (suffix.charAt(0) === '/' ? suffix : '/' + suffix)
}

/** Private shell pages: never cached, and send no referrer. */
function pageHeaders(): Record<string, string> {
	return {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-store',
		'Referrer-Policy': 'no-referrer',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "frame-ancestors 'none'",
	}
}

/** Server-rendered UTC clock for the header bar. Plain text, updates each
 * navigation. The server has no user locale, so this renders UTC through
 * the same localized APIs the client tick uses; the client replaces it
 * immediately with the browser's local time zone and locale. */
function headerClock(now?: Date): string {
	var d = now ? now : new Date()
	return d.toLocaleDateString(undefined, { timeZone: 'UTC' }) + ' ' + d.toLocaleTimeString(undefined, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })
}

function shellChrome(opts: {
	appBasePath: string
	assetBasePath: string
	clientModuleUrl: string
	title: string
	body: string
	theme: ResolvedTheme
	current?: string
	/** Validated close destination; defaults to Home when absent. */
	closeHref?: string
	closeLabel?: string
	/** App pages opt into the page-mode expand/collapse controls. */
	expandable?: boolean
	/** Menu-bar entries, already filtered (hidden excluded) and sorted; built-in Help/About are appended. Omitted on 404 and transient pages. */
	menuApps?: { id: string, label: string, builtin?: boolean }[]
	/** Id of the menu app currently being viewed, for aria-current. */
	currentApp?: string
}): string {
	var safeBase = escapeAttribute(opts.appBasePath)
	var safeTitle = escapeAttribute(opts.title)
	var safeName = escapeAttribute(opts.theme.name)
	var safePrefix = escapeAttribute(opts.theme.titlePrefix)
	var assetBase = opts.assetBasePath !== '' ? opts.assetBasePath : '/_assets'
	var faviconHref = escapeAttribute(joinPath(assetBase, '/favicon.png'))
	var mark =
		opts.theme.iconSvg !== ''
			? '<span class="os-mark-glyph" aria-hidden="true">' + opts.theme.iconSvg + '</span>'
			: opts.theme.icon !== ''
				? '<span class="os-mark-glyph" aria-hidden="true">' + escapeAttribute(opts.theme.icon) + '</span>'
				: '<img class="os-mark-img" src="' + faviconHref + '" alt="" aria-hidden="true" />'
	var bodyAttr = opts.theme.bodyStyle !== '' ? ' style="' + escapeAttribute(opts.theme.bodyStyle) + '"' : ''
	var closeHref = typeof opts.closeHref === 'string' && opts.closeHref !== '' ? escapeAttribute(opts.closeHref) : safeBase + '/'
	var closeLabel = typeof opts.closeLabel === 'string' && opts.closeLabel !== '' ? escapeAttribute(opts.closeLabel) : 'Home'
	var homeBox =
		opts.current === 'home'
			? ''
			: '\t\t\t<a class="os-box" href="' +
				closeHref +
				'" aria-label="' + closeLabel + '" title="' + closeLabel + '"></a>\n'
	var fullId = opts.expandable === true ? ' id="os-full"' : ''
	var expandBox =
		opts.expandable === true
			? '\t\t\t<a class="os-expand" href="#os-full" aria-label="Expand app to fill window" title="Expand app to fill window"></a>\n' +
				'\t\t\t<a class="os-collapse" href="#" aria-label="Collapse app" title="Collapse app"></a>\n'
			: ''

	var clientScript = opts.clientModuleUrl
		? '\n\t<script type="module" src="' + escapeAttribute(opts.clientModuleUrl) + '"></script>'
		: ''
	var litScript = '\n\t<script src="' + escapeAttribute(joinPath(assetBase, '/lit.js')) + '"></script>'
	var menuLinks = ''
	if (opts.menuApps) {
		for (var mi = 0; mi < opts.menuApps.length; mi++) {
			var menuApp = opts.menuApps[mi]
			menuLinks +=
				'\t\t\t<a href="' +
				safeBase +
				(menuApp.builtin === true ? '/' : '/apps/') +
				escapeAttribute(menuApp.id) +
				'"' +
				(opts.currentApp === menuApp.id ? ' aria-current="page"' : '') +
				'>' +
				escapeAttribute(menuApp.label) +
				'</a>\n'
		}
	}
	var footerPath = '\t\t<footer class="os-statusbar">\n' + '\t\t\t<p class="os-status-main">Private OS shell</p>\n' + '\t\t\t<p class="os-status-meta">v' + escapeAttribute((opts.theme && opts.theme.version) || '0.1.0') + (opts.theme && opts.theme.build ? ' ' + escapeAttribute(opts.theme.build) : '') + '</p>\n' + '\t\t</footer>\n'
	return (
		'<!doctype html>\n' +
		'<html lang="en"\n' +
		'\tdata-app-base="' +
		safeBase +
		'"\n' +
		'\tdata-client-module="' +
		escapeAttribute(opts.clientModuleUrl) +
		'"\n' +
		'\tdata-pak-config="' +
		escapeAttribute(JSON.stringify({ phase: 2 })) +
		'">\n' +
		'<head>\n' +
		'\t<meta charset="utf-8" />\n' +
		'\t<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
		'\t<title>' +
		safeTitle +
		' · ' +
		safePrefix +
		'</title>\n' +
		'\t<link rel="icon" type="image/png" sizes="256x256" href="' +
		faviconHref +
		'" />\n' +
		'\t<style>' +
		SHELL_CSS +
		'</style>\n' +
		'</head>\n' +
		'<body' +
		fullId +
		bodyAttr +
		'>\n' +
		'\t<header class="os-menubar">\n' +
		'\t\t<span class="os-brand">' +
		mark +
		safeName +
		'</span>\n' +
		'\t\t<nav aria-label="Shell">\n' +			'\t\t\t<a href="' +
			safeBase +
			'/"' +
			(opts.current === 'home' ? ' aria-current="page"' : '') +
			'>Home</a>\n' +
			'\t\t\t<a href="' +
			safeBase +
			'/apps"' +
			(opts.current === 'apps' ? ' aria-current="page"' : '') +
			'>Apps</a>\n' +
		menuLinks +
		'\t\t</nav>\n' +
		'\t\t<span class="os-clock" id="os-clock">' +
		headerClock() +
		'</span>\n' +
		'\t</header>\n' +
		'\t<div class="os-window">\n' +
		'\t\t<div class="os-titlebar">\n' +
		homeBox +
		'\t\t\t<h1 class="os-title">' +
		safeTitle +
		'</h1>\n' +
		expandBox +
		'\t\t</div>\n' +
		'\t\t<main>\n' +
		opts.body +
		'\n\t\t</main>\n' +			footerPath +
			'\t</div>' +
			litScript +
			clientScript +
		'\n</body>\n</html>'
	)
}

function notFoundPage(ctx: Chrome): Response {
	return new Response(shellChrome({ appBasePath: ctx.appBasePath, assetBasePath: ctx.assetBasePath, clientModuleUrl: ctx.clientModuleUrl, theme: ctx.theme, title: 'Not found', body: '\t\t<p>Not found.</p>' }), {
		status: 404,
		headers: pageHeaders(),
	})
}

/** Plain 404 for theme-route gate failures: no theme detail, no-store. */
function themeNotFound(): Response {
	return new Response('theme not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

var themeJsonHeaders: Record<string, string> = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store',
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff',
}

/**
 * Parse a `background_grid` query value (eight comma-separated integers)
 * into a `{ grid: [...] }` background. A malformed value passes through
 * as the raw string, so validateThemeSet rejects it with the standard
 * message instead of the route inventing its own error.
 */
function themeGridValue(raw: string): unknown {
	var parts = raw.split(',')
	if (parts.length !== 8) return raw
	var grid: number[] = []
	for (var i = 0; i < parts.length; i++) {
		if (parts[i] === '') return raw
		var n = Number(parts[i])
		if (isNaN(n) || Math.floor(n) !== n) return raw
		grid.push(n)
	}
	return { grid: grid }
}/**
 * Only same-OS paths may be used as a safe `from` destination.
 * Rejects protocol-relative and absolute URLs, so this cannot become an open redirect.
 */
function safeNextPath(value: string, appBasePath: string): string {
	var home = joinPath(appBasePath, '/')
	if (typeof value !== 'string' || value === '') return home
	if (value.charAt(0) !== '/') return home
	if (value.indexOf('//') === 0) return home
	if (value.indexOf('\\') !== -1) return home
	if (value.indexOf('://') !== -1) return home
	if (value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1) return home
	if (value !== home && value.indexOf(home) !== 0) return home
	return value
}

/** Security headers for every served response. No credential is ever
 * stamped into a link, form, redirect, or header here, and nothing is
 * set on the response. */
function finishResponse(response: Response, request: Request): Promise<Response> {
	var headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	headers.set('Referrer-Policy', 'no-referrer')
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Content-Security-Policy', "frame-ancestors 'none'")
	return Promise.resolve(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers }))
}

function firstPathSegment(path: string, prefix: string): string {
	var rest = path.slice(prefix.length)
	var slash = rest.indexOf('/')
	var seg = slash === -1 ? rest : rest.slice(0, slash)
	try {
		return decodeURIComponent(seg)
	} catch (err) {
		return ''
	}
}

/** Route dispatch for a request the platform admitted. */
function dispatch(request: Request, chrome: Chrome, path: string, method: string): Promise<Response> {
	var appBasePath = chrome.appBasePath
	return import('./apps/index.ts').then(function (m): Promise<Response> {			var actFromForm = m.actFromForm
			var clear_recent = m.clear_recent
			var get_app = m.get_app
			var get_hidden = m.get_hidden
			var get_homepage = m.get_homepage
			var get_pinned = m.get_pinned
			var get_recent = m.get_recent
			var list_apps = m.list_apps
			var manage_install = m.manage_install
			var manage_remove = m.manage_remove
			var manage_restore = m.manage_restore
			var manage_rows = m.manage_rows
			var manage_update = m.manage_update
			var move_home = m.move_home
			var record_use = m.record_use
			var set_hide = m.set_hide
			var set_home = m.set_home
			var set_pin = m.set_pin
		return import('./apps/client.ts').then(function (c): Promise<Response> {				var isModalApp = c.isModalApp
				var renderAppPanel = c.renderAppPanel
				var renderDashboard = c.renderDashboard
				var renderEmptyHelp = c.renderEmptyHelp
				var renderEditSection = c.renderEditSection
				var renderOverlaySection = c.renderOverlaySection
				var renderAllSection = c.renderAllSection
				var renderPinnedSection = c.renderPinnedSection
				var renderRecentSection = c.renderRecentSection
				var renderWidgetSection = c.renderWidgetSection

			// The full @owner/leaf package reference for agent prompts,
			// derived from the request host + mount (mirrors the Store
			// bundle); the Help and empty-state prompts use it, falling
			// back to the bare leaf when the host gives no owner.
			var packageRef = c.packageRefForHost(new URL(request.url).hostname, appBasePath)

			/** Menu-bar links for one render: flagged, non-hidden apps, sorted by label (id breaks ties). */
			function menuAppsFor(apps: { id: string, label: string, menuBar: boolean }[], hiddenIds: string[], showHelp?: boolean, showAbout?: boolean): { id: string, label: string, builtin?: boolean }[] {
				var out: { id: string, label: string, builtin?: boolean }[] = []
				for (var mi = 0; mi < apps.length; mi++) {
					if (apps[mi].menuBar && hiddenIds.indexOf(apps[mi].id) === -1) out.push({ id: apps[mi].id, label: apps[mi].label })
				}
				out.sort(function (a, b): number {
					var al = a.label.toLowerCase()
					var bl = b.label.toLowerCase()
					if (al < bl) return -1
					if (al > bl) return 1
					if (a.id < b.id) return -1
					if (a.id > b.id) return 1
					return 0
				})
				// Built-in links are shell-owned: the only menu entries not
				// derived from an installed app, shown only when enabled.
				if (showHelp !== false) out.push({ id: 'help', label: 'Help', builtin: true })
				if (showAbout !== false) out.push({ id: 'about', label: 'About', builtin: true })
				return out
			}

			function appBody(id: string, withError: string, fromParam: string): Promise<Response> {
				return get_app(id).then(function (entry): Promise<Response> {
					if ('error' in entry) return Promise.resolve(notFoundPage(chrome))
					return Promise.all([list_apps(), get_hidden()]).then(function (parts): Promise<Response> {
						var menu = menuAppsFor(parts[0], parts[1], chrome.showHelp, chrome.showAbout)
						return record_use(id).then(
							function (): Response {
								return renderAppPage(id, withError, entry.definition, entry.state, fromParam, menu)
							},
							function (): Response {
								return renderAppPage(id, withError, entry.definition, entry.state, fromParam, menu)
							},
						)
					})
				})
			}				function dashboardBody(widgetErrorId: string, widgetError: string): Promise<Response> {
					return Promise.all([list_apps(), get_homepage(), get_hidden()]).then(function (parts): Promise<Response> {
						var apps = parts[0]
						var homepageIds = parts[1]
						var menu = menuAppsFor(apps, parts[2], chrome.showHelp, chrome.showAbout)
						var byId: Record<string, number> = {}
						for (var bi = 0; bi < apps.length; bi++) byId[apps[bi].id] = bi
						var ordered: string[] = []
						for (var hi = 0; hi < homepageIds.length; hi++) {
							if (byId[homepageIds[hi]] !== undefined && ordered.indexOf(homepageIds[hi]) === -1) ordered.push(homepageIds[hi])
						}
						var widgets: string[] = []
						var wchain: Promise<void> = Promise.resolve()
						for (var wi = 0; wi < ordered.length; wi++) {
							;(function (want: string, idx: number): void {
								wchain = wchain.then(function (): Promise<void> {
									return get_app(want).then(function (entry): void {
										if ('error' in entry) return
										widgets.push(renderWidgetSection(entry.definition, entry.state, appBasePath, idx, ordered.length, want === widgetErrorId ? widgetError : '', packageRef))
									})
								})
							})(ordered[wi], wi)
						}
						return wchain.then(function (): Response {
							var dashboard = renderDashboard(widgets, appBasePath, apps.length > 0, packageRef)
							var lines = dashboard.split('\n')
							var indented = ''
							for (var li = 0; li < lines.length; li++) indented += '\t\t\t' + lines[li] + '\n'
							return new Response(
								shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Home', current: 'home', menuApps: menu, body: indented }),
								{ status: widgetError ? 400 : 200, headers: pageHeaders() },
							)
						})
					})
				}

				function renderAppPage(id: string, withError: string, definition: AppDefinition, state: AppState, fromParam: string, menu?: { id: string, label: string }[]): Response {
					var defName = (definition as unknown as { name: string }).name || id
					var homePath = joinPath(appBasePath, '/')
					var appsPath = joinPath(appBasePath, '/apps')
					var closeHref = safeNextPath(fromParam, appBasePath)
					var closeLabel = closeHref === appsPath ? 'Apps' : closeHref === homePath ? 'Home' : 'Back'
					try {
						var panel = renderAppPanel(definition, state, appBasePath, '', '', withError, false, fromParam !== '' ? closeHref : '', undefined, undefined, packageRef)
						var lines = panel.split('\n')
						var indented = ''
						for (var i = 0; i < lines.length; i++) indented += '\t\t\t' + lines[i] + '\n'
						var body = indented
						return new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, closeHref: closeHref, closeLabel: closeLabel, expandable: true, menuApps: menu, currentApp: id, body: body }),
							{ status: withError ? 400 : 200, headers: pageHeaders() },
						)
					} catch (err) {
						var fallback =
							'\t\t\t<section class="app" aria-label="' + escapeAttribute(defName) + '">\n' +
							'\t\t\t\t<div class="app-body">\n' +
							'\t\t\t\t\t<p>This app could not be displayed. The stored definition may be damaged; reinstall it with add_app.</p>\n' +
							'\t\t\t\t\t<p class="app-back"><a href="' + escapeAttribute(appBasePath + '/apps') + '">Back to Apps</a></p>\n' +
							'\t\t\t\t</div>\n' +
							'\t\t\t</section>\n'
						return new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, closeHref: closeHref, closeLabel: closeLabel, expandable: true, menuApps: menu, currentApp: id, body: fallback }),
							{ status: 200, headers: pageHeaders() },
						)
					}
				}

			// POST /apps/:id — API/legacy form path, funnels into the same act() MCP uses.
			if (method === 'POST' && path.indexOf('/apps/') === 0) {
				var id = firstPathSegment(path, '/apps/')
				if (!id) return Promise.resolve(notFoundPage(chrome))
				return request
					.text()
					.then(
						function (t: string): string {
							return t
						},
						function (): string {
							return ''
						},
					)
					.then(function (text: string): Promise<Response> {
						var entries: Record<string, string> = {}
						var params = new URLSearchParams(text)
						params.forEach(function (v: string, k: string): void {
							entries[k] = v
						})
						return actFromForm(id, entries).then(function (result) {
							if (result.ok) {
								return new Response(null, {
									status: 303,
									headers: { Location: appBasePath + '/apps/' + id },
								})
							}
							return appBody(id, result.error, '')
						})
					})
			}

			// GET /apps/:id — one app page, same state MCP reads.
			// GET with ?action=... is the UI action path: the edge rejects some
			// same-origin POSTs, and a GET form works on the Scribe without a cookie.
			if (method === 'GET' && path.indexOf('/apps/') === 0) {
				var gid = firstPathSegment(path, '/apps/')
				if (!gid) return Promise.resolve(notFoundPage(chrome))
					var query = new URL(request.url).searchParams
					// App Store is a data app now: /apps/app-store is its
					// generic app page, not a shell special case. Two
					// shell-owned exceptions remain, all without rows:
					// (1) old Store launcher URLs (?pin/?hide/?home=)
					// render an inline error pointing at Apps Edit and
					// change nothing; (2) a removed Store renders a
					// short fallback pointing at the agent install path
					// (the shell holds no catalog source of its own, so
					// only an agent supplying a catalog base can install
					// the Store: see catalog/app-store/RECIPE.md).
					if (gid === 'app-store' && (query.get('pin') !== null || query.get('hide') !== null || query.get('home') !== null)) {
						return Promise.all([list_apps(), get_hidden()]).then(function (parts): Response {
							var menu = menuAppsFor(parts[0], parts[1], chrome.showHelp, chrome.showAbout)
							var body =
								'\t\t\t<section class="app" aria-label="App Store">\n' +
								'\t\t\t\t<div class="app-body">\n' +
								'\t\t\t\t\t<p role="alert">Launcher management moved to Apps Edit. This link changed nothing.</p>\n' +
								'\t\t\t\t\t<p><a href="' + escapeAttribute(appBasePath + '/apps?edit=1') + '">Open Apps Edit</a></p>\n' +
								'\t\t\t\t\t<p><a href="' + escapeAttribute(appBasePath + '/apps/app-store') + '">Back to App Store</a></p>\n' +
								'\t\t\t\t</div>\n' +
								'\t\t\t</section>'
							return new Response(
								shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'App Store', menuApps: menu, body: body }),
								{ status: 400, headers: pageHeaders() },
							)
						})
					}
					if (gid === 'app-store' && !query.get('action')) {
						return get_app('app-store').then(function (entry): Promise<Response> | Response {
							if (!('error' in entry)) return appBody(gid, '', query.get('from') || '')
							return Promise.all([list_apps(), get_hidden()]).then(function (parts): Response {
								var menu = menuAppsFor(parts[0], parts[1], chrome.showHelp, chrome.showAbout)
								var body =
									'\t\t\t<section class="app" aria-label="App Store">\n' +
									'\t\t\t\t<div class="app-body">\n' +
									'\t\t\t\t\t<p>The App Store app is not installed.</p>\n' +
									'\t\t\t\t\t<p>Ask an agent to install it: follow catalog/app-store/RECIPE.md (the agent supplies the catalog source).</p>\n' +
									'\t\t\t\t</div>\n' +
									'\t\t\t</section>'
								return new Response(
									shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'App Store', menuApps: menu, body: body }),
									{ status: 200, headers: pageHeaders() },
								)
							})
						})
					}
					// Modal tiles link here with ?touch=1: record the open in recent, then send
					// the browser back to the Apps page with the overlay fragment. Fragment links
					// alone never reach the server, so without this an opened modal never counts
					// as used. Scribe-safe: plain 303, no script needed.
					if (query.get('touch') === '1' && !query.get('action')) {
						var touchFrom = safeNextPath(query.get('from') || '', appBasePath)
						var touchDest = touchFrom + '#app-' + gid
						return get_app(gid).then(function (entry): Promise<Response> {
							if ('error' in entry) return Promise.resolve(notFoundPage(chrome))
							return record_use(gid).then(
								function (): Response {
									return new Response(null, { status: 303, headers: { Location: touchDest } })
								},
								function (): Response {
									return new Response(null, { status: 303, headers: { Location: touchDest } })
								},
							)
						})
					}
					if (query.get('action')) {
						var getEntries: Record<string, string> = {}
						query.forEach(function (v: string, k: string): void {
							if (k !== 'k' && k !== 'from' && k !== 'format') getEntries[k] = v
						})
						var wantJson = query.get('format') === 'json'
						var fromPath = query.get('from') || ''
						var dest = fromPath !== '' ? safeNextPath(fromPath, appBasePath) : appBasePath + '/apps/' + gid
						return actFromForm(gid, getEntries).then(function (result) {
							if (wantJson) {
								return new Response(JSON.stringify(result), {
									status: result.ok ? 200 : 400,
									headers: {
										'Content-Type': 'application/json; charset=utf-8',
										'Cache-Control': 'no-store',
										'Referrer-Policy': 'no-referrer',
										'X-Content-Type-Options': 'nosniff',
									},
								})
							}
							if (result.ok) {
								return new Response(null, {
									status: 303,
									headers: { Location: dest },
								})
							}
							if (fromPath !== '') return dashboardBody(gid, result.error)
							return appBody(gid, result.error, '')
					})
				}
				return appBody(gid, '', query.get('from') || '')
			}

			// POST /__prefs — API path for pin/hide/home/clear (HTML uses GET forms edge-safe).
			if (method === 'POST' && path.slice(-8) === '/__prefs') {
				return request
					.text()
					.then(
						function (x: string): string {
							return x
						},
						function (): string {
							return ''
						},
					)
					.then(function (text: string): Promise<Response> {
						var params = new URLSearchParams(text)
						var pinId = params.get('pin') || ''
						var hideId = params.get('hide') || ''
						var homeId = params.get('home') || ''
						var want = params.get('want') === '1'
						var doClear = params.get('clear') === '1'
						var moveRaw = params.get('move') || ''
						var chain: Promise<unknown> = Promise.resolve()
						if (pinId !== '') chain = chain.then(function (): Promise<unknown> { return set_pin(pinId, want) })
						if (hideId !== '') chain = chain.then(function (): Promise<unknown> { return set_hide(hideId, want) })
						if (homeId !== '' && moveRaw !== '') chain = chain.then(function (): Promise<unknown> { return move_home(homeId, moveRaw === '-1' ? -1 : 1) })
						if (homeId !== '' && moveRaw === '') chain = chain.then(function (): Promise<unknown> { return set_home(homeId, want) })
						if (doClear) chain = chain.then(function (): Promise<unknown> { return clear_recent() })
						return chain.then(function (): Response {
							return new Response(null, {
								status: 303,
								headers: { Location: appBasePath + '/apps' },
							})
						})
					})
			}

			// GET /help — built-in shell page. Same shared help block as the
			// empty Home and Apps pages, served in the shared chrome. No
			// installed-apps list: Help is not an app.
			if (method === 'GET' && path === '/help') {
				if (chrome.showHelp === false) return Promise.resolve(notFoundPage(chrome))
				return Promise.all([list_apps(), get_hidden()]).then(function (parts): Response {
					var helpLines = renderEmptyHelp(appBasePath, { omitClosing: true, packageRef: packageRef }).split('\n')
					var helpBody = ''
					for (var hli = 0; hli < helpLines.length; hli++) helpBody += '\t\t\t' + helpLines[hli] + '\n'
					return new Response(
						shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Help', menuApps: menuAppsFor(parts[0], parts[1], chrome.showHelp, chrome.showAbout), currentApp: 'help', body: helpBody }),
						{ status: 200, headers: pageHeaders() },
					)
				})
			}

			// GET /about — built-in shell page. The content is the retired about
			// catalog bundle's markup, moved verbatim into shell code.
			if (method === 'GET' && path === '/about') {
				if (chrome.showAbout === false) return Promise.resolve(notFoundPage(chrome))
				return Promise.all([list_apps(), get_hidden()]).then(function (parts): Response {
					var aboutLines = renderAboutContent().split('\n')
					var aboutBody = ''
					for (var ali = 0; ali < aboutLines.length; ali++) aboutBody += '\t\t\t' + aboutLines[ali] + '\n'
					return new Response(
						shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'About', menuApps: menuAppsFor(parts[0], parts[1], chrome.showHelp, chrome.showAbout), currentApp: 'about', body: aboutBody }),
						{ status: 200, headers: pageHeaders() },
					)
				})
			}

			// GET / — widget dashboard: live homepage widgets in homepage order.
			if (method === 'GET' && (path === '/' || path === '')) {
				var homeQuery = new URL(request.url).searchParams
				var qHome = homeQuery.get('home') || ''
				var qMove = homeQuery.get('move') || ''
				var qHomeWant = homeQuery.get('want') === '1'
				if (qHome !== '') {
					var hchain: Promise<unknown> = Promise.resolve()
					if (qMove !== '') {
						var step = qMove === '-1' ? -1 : 1
						hchain = hchain.then(function (): Promise<unknown> { return move_home(qHome, step) })
					} else {
						hchain = hchain.then(function (): Promise<unknown> { return set_home(qHome, qHomeWant) })
					}
					return hchain.then(function (): Response {
						return new Response(null, {
							status: 303,
							headers: { Location: appBasePath + '/' },
						})
					})
				}
				var dashErrorApp = homeQuery.get('app') || ''
				var dashError = homeQuery.get('error') || ''
				return dashboardBody(dashErrorApp, dashError)
			}

			// GET /apps — Pinned / Recent / All-apps as a launcher, plus
			// Edit mode (?edit=1): one row per installed app, including
			// hidden ones, with Pin/Hide/Home controls. The App Store
			// no longer offers launcher controls; install/update/
			// restore live there, pin/hide/home live here. Empty
			// registry is honest, with no Edit toggle.
			if (method === 'GET' && path === '/apps') {
				var appsQuery = new URL(request.url).searchParams
				var qPin = appsQuery.get('pin') || ''
				var qHide = appsQuery.get('hide') || ''
				var qWant = appsQuery.get('want') === '1'
				var qClear = appsQuery.get('clear') === '1'
				var qHomeToggle = appsQuery.get('home') || ''
				var qEdit = appsQuery.get('edit') === '1'
				if (qPin !== '' || qHide !== '' || qClear || qHomeToggle !== '') {
					var mchain: Promise<unknown> = Promise.resolve()
					if (qPin !== '') mchain = mchain.then(function (): Promise<unknown> { return set_pin(qPin, qWant) })
					if (qHide !== '') mchain = mchain.then(function (): Promise<unknown> { return set_hide(qHide, qWant) })
					if (qClear) mchain = mchain.then(function (): Promise<unknown> { return clear_recent() })
					if (qHomeToggle !== '') mchain = mchain.then(function (): Promise<unknown> { return set_home(qHomeToggle, qWant) })
					return mchain.then(function (): Response {
						return new Response(null, {
							status: 303,
							headers: { Location: appBasePath + '/apps' + (qEdit ? '?edit=1' : '') },
						})
					})
				}
				var appsBase = appBasePath + '/apps'
				return Promise.all([list_apps(), get_pinned(), get_hidden(), get_recent(), get_homepage()]).then(function (parts): Promise<Response> {
					var apps = parts[0]
					var pinnedIds = parts[1]
					var hiddenIds = parts[2]
					var recentIds = parts[3]
					var homepageIds = parts[4]
				var byId: Record<string, number> = {}
					for (var bi = 0; bi < apps.length; bi++) byId[apps[bi].id] = bi
					if (apps.length === 0) {
						var helpLines = renderEmptyHelp(appBasePath, { packageRef: packageRef }).split('\n')
						var helpIndented = ''
						for (var hli = 0; hli < helpLines.length; hli++) helpIndented += '\t\t\t\t' + helpLines[hli] + '\n'
						return Promise.resolve(new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', menuApps: menuAppsFor(apps, hiddenIds, chrome.showHelp, chrome.showAbout), body:
							'\t\t\t<section class="category" id="apps" aria-label="Apps">\n' +
							helpIndented +
							'\t\t\t</section>' }),
							{ status: 200, headers: pageHeaders() },
						))
					}
					{
						var pinnedApps: typeof apps = []
						for (var pi = 0; pi < pinnedIds.length; pi++) {
							if (byId[pinnedIds[pi]] !== undefined) pinnedApps.push(apps[byId[pinnedIds[pi]]])
						}
						var recentApps: typeof apps = []
						for (var ri = 0; ri < recentIds.length; ri++) {
							var rid = recentIds[ri]
							if (byId[rid] !== undefined && hiddenIds.indexOf(rid) === -1) recentApps.push(apps[byId[rid]])
						}
						var sections: string[] = []
						var tiled: typeof apps = pinnedApps.concat(recentApps)
						if (pinnedApps.length > 0) sections.push(renderPinnedSection(pinnedApps, appBasePath))
						if (recentApps.length > 0) sections.push(renderRecentSection(recentApps, appBasePath, appsBase))
						if (qEdit) {
							sections.push(renderEditSection(apps, pinnedIds, hiddenIds, homepageIds, appBasePath, appsBase))
							tiled = tiled.concat(apps)
						} else {
							var visible: typeof apps = []
							for (var vi = 0; vi < apps.length; vi++) {
								if (hiddenIds.indexOf(apps[vi].id) === -1) visible.push(apps[vi])
							}
							visible.sort(function (a, b): number {
								var al = a.label.toLowerCase()
								var bl = b.label.toLowerCase()
								if (al < bl) return -1
								if (al > bl) return 1
								if (a.id < b.id) return -1
								if (a.id > b.id) return 1
								return 0
							})
							tiled = tiled.concat(visible)
							if (visible.length === 0) {
								sections.push(
									renderAllSection([], appBasePath, appsBase, 'All apps are hidden. Use Edit to unhide.', true),
								)
							} else {
								sections.push(renderAllSection(visible, appBasePath, appsBase, undefined, true))
							}
						}
						var modalIds: string[] = []
						for (var mi = 0; mi < tiled.length; mi++) {
							if (isModalApp(tiled[mi]) && modalIds.indexOf(tiled[mi].id) === -1) modalIds.push(tiled[mi].id)
						}
						var overlays: string[] = []
						var ochain: Promise<void> = Promise.resolve()
						for (var oi = 0; oi < modalIds.length; oi++) {
							;(function (want: string): void {
								ochain = ochain.then(function (): Promise<void> {
									return get_app(want).then(function (entry): void {
										if ('error' in entry) return
										overlays.push(renderOverlaySection(entry.definition, entry.state, appBasePath, packageRef))
									})
								})
							})(modalIds[oi])
						}
						return ochain.then(function (): Response {
							var indentedSections = ''
							for (var si = 0; si < sections.length; si++) {
								var slines = sections[si].split('\n')
								for (var li = 0; li < slines.length; li++) indentedSections += '\t\t\t' + slines[li] + '\n'
							}
							for (var oii = 0; oii < overlays.length; oii++) {
								var olines = overlays[oii].split('\n')
								for (var lj = 0; lj < olines.length; lj++) indentedSections += '\t\t\t' + olines[lj] + '\n'
							}							return new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', menuApps: menuAppsFor(apps, hiddenIds, chrome.showHelp, chrome.showAbout), body: indentedSections }),
								{ status: 200, headers: pageHeaders() },
							)
						})
					}
				})
			}

			// GET /manage/<action> — bundle management API for the
			// data-only App Store (see registry.ts manage_*). GET only,
			// no POST; the acting app is named by ?app= and must have a
			// stored manageApps declaration, or the response is the
			// feed-style plain 404 with no detail. Other failures are
			// JSON so the bundle can render them, including
			// needsConfirmation for modified apps and capability
			// expansion. Placed after the /apps/ branches, inside
			// dispatch.
			if (method === 'GET' && path.indexOf('/manage/') !== -1) {
				var manageQuery = new URL(request.url).searchParams
				var actingId = manageQuery.get('app') || ''
				var targetId = manageQuery.get('id') || ''
				var manageAction = firstPathSegment(path.slice(path.indexOf('/manage/')), '/manage/')
				var jsonHeaders: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
				var plain404 = new Response('management not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
				if (actingId === '') return Promise.resolve(plain404)
				if (manageAction === 'rows') {
					return manage_rows(actingId).then(function (result) {
						if (!result.ok && (result as { permissionDenied?: boolean }).permissionDenied) return Promise.resolve(plain404)
						return Promise.resolve(new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: jsonHeaders }))
					})
				}
				if (manageAction === 'install' && targetId !== '') {
					return manage_install(actingId, targetId).then(function (result) {
						if (!result.ok && (result as { permissionDenied?: boolean }).permissionDenied) return Promise.resolve(plain404)
						return Promise.resolve(new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: jsonHeaders }))
					})
				}
				if (manageAction === 'update' && targetId !== '') {
					return manage_update(actingId, targetId, manageQuery.get('confirmed') === '1').then(function (result) {
						if (!result.ok && (result as { permissionDenied?: boolean }).permissionDenied) return Promise.resolve(plain404)
						return Promise.resolve(new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: jsonHeaders }))
					})
				}
				if (manageAction === 'restore' && targetId !== '') {
					return manage_restore(actingId, targetId, manageQuery.get('confirmed') === '1').then(function (result) {
						if (!result.ok && (result as { permissionDenied?: boolean }).permissionDenied) return Promise.resolve(plain404)
						return Promise.resolve(new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: jsonHeaders }))
					})
				}
				if (manageAction === 'remove' && targetId !== '') {
					return manage_remove(actingId, targetId, manageQuery.get('confirmed') === '1').then(function (result) {
						if (!result.ok && (result as { permissionDenied?: boolean }).permissionDenied) return Promise.resolve(plain404)
						return Promise.resolve(new Response(JSON.stringify(result), { status: result.ok ? 200 : 400, headers: jsonHeaders }))
					})
				}
				return Promise.resolve(plain404)
			}

			// GET /proxy/:app/:name — generic proxy capability (see feeds.ts):
			// allowlisted upstream fetch + storage cache, served same-origin.
			// Inside dispatch. Placed after the /apps/ branches so an app
			// id of "proxy"
			// still renders its app page. Unknown apps/proxies are plain 404s.
			if (method === 'GET') {
				var proxyAt = path.indexOf('/proxy/')
				if (proxyAt !== -1) {
					var proxyRoute = path.slice(proxyAt)
					var proxyParts = proxyRoute.split('/')
					if (proxyParts.length === 4) {
						var proxyApp = ''
						var proxyName = ''
						try { proxyApp = decodeURIComponent(proxyParts[2]) } catch (err) { proxyApp = '' }
						try { proxyName = decodeURIComponent(proxyParts[3]) } catch (err) { proxyName = '' }
						if (proxyApp !== '' && proxyName !== '') {
							return serveProxy(proxyApp, proxyName)
						}
					}
					return Promise.resolve(new Response('proxy not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }))
				}
			}

			// GET /feed/:app/:name — generic feed capability (see feeds.ts):
			// allowlisted upstream fetch + storage cache, served same-origin.
			// Inside dispatch. Placed after the /apps/ branches so an app
			// id of "feed" still
			// renders its app page. Unknown apps/feeds are plain 404s.
			if (method === 'GET') {
				var feedAt = path.indexOf('/feed/')
				if (feedAt !== -1) {
					var feedRoute = path.slice(feedAt)
					var feedParts = feedRoute.split('/')
					if (feedParts.length === 4) {
						var feedApp = ''
						var feedName = ''
						try { feedApp = decodeURIComponent(feedParts[2]) } catch (err) { feedApp = '' }
						try { feedName = decodeURIComponent(feedParts[3]) } catch (err) { feedName = '' }
						if (feedApp !== '' && feedName !== '') {
							return serveFeed(feedApp, feedName)
						}
					}
					return Promise.resolve(new Response('feed not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }))
				}
			}

			// GET /theme/:app — shell theme capability (see shell-theme.ts):
			// read/set/reset through the app's declared capabilities.theme
			// flags. Inside dispatch. Placed after /feed/, before the
			// 404 fallthrough.
			// Unknown apps, undeclared callers, and view-only callers of
			// set/reset are plain 404s with no theme detail; a gated app
			// with an invalid value gets JSON { ok: false, error } (400)
			// and writes nothing. No POST.
			if (method === 'GET') {
				var themeAt = path.indexOf('/theme/')
				if (themeAt !== -1) {
					var themeRoute = path.slice(themeAt)
					var themeParts = themeRoute.split('/')
					if (themeParts.length === 3) {
						var themeApp = ''
						try { themeApp = decodeURIComponent(themeParts[2]) } catch (err) { themeApp = '' }
						if (themeApp !== '' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(themeApp)) {
							var themeQuery = new URL(request.url).searchParams
							var themeAction = themeQuery.get('action') || ''
							if (themeAction === '' || themeAction === 'set' || themeAction === 'reset') {
								return get_app(themeApp).then(function (themeEntry) {
									if ('error' in themeEntry) return Promise.resolve(themeNotFound())
									var themeCaps = themeEntry.definition.capabilities
									var themeView = themeCaps !== undefined && themeCaps.theme !== undefined && themeCaps.theme.view === true
									var themeSet = themeCaps !== undefined && themeCaps.theme !== undefined && themeCaps.theme.set === true
									if (themeAction === '' && !themeView) return Promise.resolve(themeNotFound())
									if (themeAction !== '' && !themeSet) return Promise.resolve(themeNotFound())
									return getTheme().then(function (themeFile) {
										var themeDefaults = fileThemeToValues(themeFile)
										var themeWantJson = themeQuery.get('format') === 'json'
										var themeFrom = themeQuery.get('from') || ''
										var themeDest = themeFrom !== '' ? safeNextPath(themeFrom, appBasePath) : appBasePath + '/apps/' + themeApp
										if (themeAction === '') {
											return get_shell_theme(themeDefaults).then(function (themeRead) {
												return new Response(JSON.stringify({ ok: true, defaults: themeRead.defaults, override: themeRead.override, effective: themeRead.effective }), { status: 200, headers: themeJsonHeaders })
											})
										}
										if (themeAction === 'set') {
											var themePayload: Record<string, unknown> = {}
											var themeName = themeQuery.get('name')
											var themeTitle = themeQuery.get('title')
											var themeIcon = themeQuery.get('icon')
											var themeBackground = themeQuery.get('background')
											var themeGrid = themeQuery.get('background_grid')
											if (themeName !== null) themePayload.name = themeName
											if (themeTitle !== null) themePayload.title = themeTitle
											if (themeIcon !== null) themePayload.icon = themeIcon
											if (themeGrid !== null) themePayload.background = themeGridValue(themeGrid)
											else											if (themeBackground !== null) themePayload.background = themeBackground
											var themeShowHelp = themeQuery.get('showHelp')
											var themeShowAbout = themeQuery.get('showAbout')
											if (themeShowHelp !== null) themePayload.showHelp = themeShowHelp
											if (themeShowAbout !== null) themePayload.showAbout = themeShowAbout

											return set_shell_theme(themeDefaults, themePayload).then(function (themeSetResult) {
												if (!themeSetResult.ok) return new Response(JSON.stringify(themeSetResult), { status: 400, headers: themeJsonHeaders })
												if (themeWantJson) return new Response(JSON.stringify(themeSetResult), { status: 200, headers: themeJsonHeaders })
												return new Response(null, { status: 303, headers: { Location: themeDest } })
											})
										}
										var themeField = themeQuery.get('field') || ''
										return reset_shell_theme(themeDefaults, themeField === '' ? undefined : themeField).then(function (themeResetResult) {
											if (!themeResetResult.ok) return new Response(JSON.stringify(themeResetResult), { status: 400, headers: themeJsonHeaders })
											if (themeWantJson) {
												return get_shell_theme(themeDefaults).then(function (themeReadAfter) {
													return new Response(JSON.stringify({ ok: true, override: themeReadAfter.override, effective: themeReadAfter.effective }), { status: 200, headers: themeJsonHeaders })
												})
											}
											return new Response(null, { status: 303, headers: { Location: themeDest } })
										})
									})
								})
							}
						}
					}
					return Promise.resolve(themeNotFound())
				}
			}

			return Promise.resolve(notFoundPage(chrome))
		})
	})
}

/**
 * Phase 2 data-driven shell: home tiles + app pages share one registry,
 * one act() handler, one state — UI and MCP see the same values.
 * Adding an app is a registry write; no OS republish.
 *
 * Access is decided by Kody's platform gate before shell code runs
 * (see pkg/docs/setup.md). MCP exports are not routed through fetch.
 *
 * ES2019 ceiling: no optional chaining and no nullish coalescing in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */
var app = {
	fetch: async function (request: Request): Promise<Response> {
		var context = await getPackageContext()
		var appBasePath = str(context.appBasePath, '')
		var assetBasePath = str(context.assetBasePath, '/_assets')
		var clientModuleUrl = str(context.clientModuleUrl, '')
		// The platform stamps an absolute client-module URL using the
		// package's configured host (e.g. the mock's LAN IP). A browser
		// that loaded the page via a different host (loopback, Tailscale)
		// cannot fetch it, so the client never loads and no shared element
		// is defined. Strip the scheme + host so the browser fetches the
		// module from the same host as the page, like lit.js does (served
		// via the relative asset base).
		var schemeIdx = clientModuleUrl.indexOf('://')
		if (schemeIdx !== -1) {
			var pathIdx = clientModuleUrl.indexOf('/', schemeIdx + 3)
			if (pathIdx !== -1) {
				clientModuleUrl = clientModuleUrl.slice(pathIdx)
			}
		}
		// Shell-settings Phase 1: resolve the file theme exactly as today
		// (including its once-per-publish cache), then merge the durable
		// storage override fresh on every request, per field. With no
		// override stored, rendering is byte-identical to today; a theme
		// read failure never breaks the shell, it falls back to the file.
		var fileThemeValues = fileThemeToValues(await getTheme())
		try {
			var mergedTheme = await get_shell_theme(fileThemeValues)
			fileThemeValues = mergedTheme.effective
		} catch (err) {
		}
		// Page visibility rides the same file-default + override merge as the
		// theme; both flags default to shown when absent or non-boolean.
		var showHelp = fileThemeValues.showHelp !== false
		var showAbout = fileThemeValues.showAbout !== false
		var theme = resolveTheme({
			name: fileThemeValues.name,
			title: fileThemeValues.title,
			icon: fileThemeValues.icon,
			background: fileThemeValues.background,
		} as ThemeFile)
		try {
			var meta = await getPackageMeta()
			theme.version = meta.version
			theme.build = meta.build
		} catch (err) {
			theme.version = '0.1.0'
			theme.build = ''
		}
		var chrome: Chrome = { appBasePath: appBasePath, assetBasePath: assetBasePath, clientModuleUrl: clientModuleUrl, theme: theme, showHelp: showHelp, showAbout: showAbout }
		var rawPath = new URL(request.url).pathname
		var appsAt = rawPath.indexOf('/apps/')
		var path = appsAt === -1 ? rawPath : rawPath.slice(appsAt)
		var method = String(request.method || '').toUpperCase()
		// No shell gate: every request that reaches fetch() was already
		// admitted by Kody's platform gate, so it is served. Access is
		// granted and revoked in Kody itself (Use / `app:execute` on the
		// app); the shell performs no access check of its own.
		return finishResponse(await dispatch(request, chrome, path, method), request)
	},
}

export default app
