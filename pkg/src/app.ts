import { SHELL_CSS } from './shell-css.ts'
import { accessCookie, authenticate, checkCode, getAccessStatus, isSecureRequest, setAccessCode } from './auth.ts'

interface PackageContext {
	appBasePath?: string
	assetBasePath?: string
	clientModuleUrl?: string | null
}

interface Chrome {
	appBasePath: string
	assetBasePath: string
	clientModuleUrl: string
	theme: ResolvedTheme
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
	name: string
	titlePrefix: string
	icon: string
	bodyStyle: string
}

/** Closed background tokens mapping to existing CSS values. */
var THEME_BACKGROUNDS: Record<string, string> = {
	desk: '',
	paper: 'background: #fff',
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
			function (runtime: { packageContext?: PackageContext }): PackageContext {
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
function getTheme(): Promise<ThemeFile> {
	if (!themePromise) {
		try {
			// @ts-ignore optional theme file; the bundler inlines it when present, rejection means absent.
			var req = import('../os-theme.json', { with: { type: 'json' } })
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
	var titlePrefix = typeof src.title === 'string' && src.title !== '' ? src.title : name
	var bg = typeof src.background === 'string' && src.background in THEME_BACKGROUNDS ? src.background : 'desk'
	return { name: name, titlePrefix: titlePrefix, icon: icon, bodyStyle: THEME_BACKGROUNDS[bg] }
}

/** Join the mount path and a route without doubling or dropping the slash. */
function joinPath(base: string, suffix: string): string {
	var b = base
	while (b.length > 1 && b.charAt(b.length - 1) === '/') b = b.slice(0, -1)
	if (b === '/') b = ''
	return b + (suffix.charAt(0) === '/' ? suffix : '/' + suffix)
}

/** Strip the mount prefix when the runtime hands us a full path instead of a route. */
function routePath(path: string, appBasePath: string): string {
	if (appBasePath === '' || appBasePath === '/') return path
	var prefix = appBasePath.charAt(appBasePath.length - 1) === '/' ? appBasePath : appBasePath + '/'
	if (path === prefix || path === prefix.slice(0, -1)) return '/'
	if (path.indexOf(prefix) === 0) return '/' + path.slice(prefix.length)
	return path
}

/** Private shell pages: never cached, never leak the code through Referer. */
function pageHeaders(): Record<string, string> {
	return {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-store',
		'Referrer-Policy': 'no-referrer',
	}
}

var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function twoDigits(n: number): string {
	return n < 10 ? '0' + n : '' + n
}

/** Server-rendered UTC clock for the header bar. Plain text, updates each navigation. */
function headerClock(now?: Date): string {
	var d = now ? now : new Date()
	return WEEKDAYS[d.getUTCDay()] + ' ' + twoDigits(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ' ' + twoDigits(d.getUTCHours()) + ':' + twoDigits(d.getUTCMinutes())
}

function shellChrome(opts: {
	appBasePath: string
	assetBasePath: string
	clientModuleUrl: string
	title: string
	body: string
	theme: ResolvedTheme
	current?: string
}): string {
	var safeBase = escapeAttribute(opts.appBasePath)
	var safeTitle = escapeAttribute(opts.title)
	var safeName = escapeAttribute(opts.theme.name)
	var safePrefix = escapeAttribute(opts.theme.titlePrefix)
	var mark =
		opts.theme.icon !== ''
			? '<span class="os-mark-glyph" aria-hidden="true">' + escapeAttribute(opts.theme.icon) + '</span>'
			: '<span class="os-mark" aria-hidden="true"></span>'
	var bodyAttr = opts.theme.bodyStyle !== '' ? ' style="' + escapeAttribute(opts.theme.bodyStyle) + '"' : ''
	var homeBox =
		opts.current === 'home'
			? ''
			: '\t\t\t<a class="os-box" href="' +
				safeBase +
				'/" aria-label="Home" title="Home"></a>\n'

	var clientScript = opts.clientModuleUrl
		? '\n\t<script type="module" src="' + escapeAttribute(opts.clientModuleUrl) + '"></script>'
		: ''
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
		'\t<style>' +
		SHELL_CSS +
		'</style>\n' +
		'</head>\n' +
		'<body' +
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
		'\t\t\t<a href="' +
		safeBase +
		'/help"' +
		(opts.current === 'help' ? ' aria-current="page"' : '') +
		'>Help</a>\n' +
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
		'\t\t</div>\n' +
		'\t\t<main>\n' +
		opts.body +
		'\n\t\t</main>\n' +
		'\t\t<footer class="os-statusbar">\n' +			'\t\t\t<p class="os-status-main">Private OS shell</p>\n' +
			'\t\t</footer>\n' +
		'\t</div>' +
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

/**
 * The locked page is an honest 404: a stranger cannot tell a wrong code from a
 * missing page, and the plain GET form is the way in.
 *
 * The form posts nowhere: it navigates to the safe `next` path with `?k=<code>`,
 * which is the same path the bookmark uses and avoids the package-app edge's
 * cross-origin POST guard.
 */
function lockedPage(ctx: Chrome, message: string, next: string): Response {
	var action = escapeAttribute(safeNextPath(next, ctx.appBasePath))
	var alert = message ? '\t\t\t\t\t<p role="alert">' + escapeAttribute(message) + '</p>\n' : ''
	var body =
		'\t\t\t<section class="app gate" aria-label="Locked">\n' +
		'\t\t\t\t<div class="app-body">\n' +
		'\t\t\t\t\t<p class="gate-lead">This OS is private. Open your bookmark, or enter the access code.</p>\n' +
		alert +
		'\t\t\t\t\t<form class="gate-form" method="get" action="' +
		action +
		'">\n' +
		'\t\t\t\t\t\t<label for="access-code">Access code</label>\n' +
		'\t\t\t\t\t\t<input id="access-code" name="k" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required />\n' +
		'\t\t\t\t\t\t<button type="submit">Unlock</button>\n' +
		'\t\t\t\t\t</form>\n' +
		'\t\t\t\t\t<p class="gate-hint">No bookmark? The address can carry the code: <code>?k=your-code</code></p>\n' +
		'\t\t\t\t</div>\n' +
		'\t\t\t</section>'
	return new Response(shellChrome({ appBasePath: ctx.appBasePath, assetBasePath: ctx.assetBasePath, clientModuleUrl: ctx.clientModuleUrl, theme: ctx.theme, title: 'Locked', body: body }), {
		status: 404,
		headers: pageHeaders(),
	})
}

/**
 * Only same-OS paths may be used as a post-unlock destination.
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

/** Append the access code to one same-OS URL (raw form, for Location headers). */
function withAccessCode(url: string, code: string): string {
	if (url === '' || url.charAt(0) === '#') return url
	if (url.indexOf('http:') === 0 || url.indexOf('https:') === 0 || url.indexOf('//') === 0) return url
	// Keep the fragment last: /#apps must become /?k=<code>#apps, not /#apps?k=<code>.
	var fragment = ''
	var hashAt = url.indexOf('#')
	if (hashAt !== -1) {
		fragment = url.slice(hashAt)
		url = url.slice(0, hashAt)
	}
	if (url.indexOf('k=') !== -1) return url + fragment
	var encoded = encodeURIComponent(code)
	if (url.indexOf('?') === -1) return url + '?k=' + encoded + fragment
	return url + '&k=' + encoded + fragment
}

/**
 * Scribe has no reliable cookies, so a request authenticated by `?k=` must keep
 * carrying the code through every link and form action. Desktop browsers get a
 * cookie on the first hit and drop the code from links after that.
 */
function withAccessCodeInHtml(html: string, code: string): string {
	return html.replace(/\s(href|action)="([^"]*)"/g, function (match: string, attribute: string, url: string): string {
		var stamped = withAccessCode(url, code)
		if (stamped === url) return match
		return ' ' + attribute + '="' + stamped.replace(/&/g, '&amp;') + '"'
	})
}

/** Add the cookie, and on the code-in-URL path also stamp links and redirects. */
function finishResponse(response: Response, code: string, hash: string, appBasePath: string, request: Request): Promise<Response> {
	var headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	headers.set('Referrer-Policy', 'no-referrer')
	if (code === '') return Promise.resolve(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers }))

	headers.append('Set-Cookie', accessCookie(hash, appBasePath, isSecureRequest(request)))
	var location = headers.get('Location')
	if (location) headers.set('Location', withAccessCode(location, code))
	var type = headers.get('Content-Type') || ''
	if (type.indexOf('text/html') !== 0) {
		return Promise.resolve(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers }))
	}
	return response.text().then(function (html: string): Response {
		return new Response(withAccessCodeInHtml(html, code), { status: response.status, statusText: response.statusText, headers: headers })
	})
}

/** Plain HTML unlock form POST: verify, set the cookie, PRG back to `next`. */
function unlock(request: Request, chrome: Chrome): Promise<Response> {
	return request
		.text()
		.then(
			function (text: string): string {
				return text
			},
			function (): string {
				return ''
			},
		)
		.then(function (text: string): Promise<Response> {
			var params = new URLSearchParams(text)
			var next = safeNextPath(params.get('next') || '', chrome.appBasePath)
			return checkCode(params.get('code') || '').then(function (check): Response {
				if (!check.ok || check.hash === '') return lockedPage(chrome, 'Code not recognized.', next)
				// Redirect with the code in the URL too: works even when the Scribe drops the cookie.
				return new Response(null, {
					status: 303,
					headers: {
						Location: withAccessCode(next, check.code),
						'Set-Cookie': accessCookie(check.hash, chrome.appBasePath, isSecureRequest(request)),
						'Cache-Control': 'no-store',
						'Referrer-Policy': 'no-referrer',
					},
				})
			})
		})
}

/**
 * One-shot bootstrap: mint the first access code after publish.
 * Refuses forever once a code exists, so it cannot rotate or reset the lock.
 * Safe because the package is private until the owner approves internet access,
 * and the code is set before that approval is requested.
 */
function bootstrapAccess(request: Request, chrome: Chrome): Promise<Response> {
	return getAccessStatus().then(function (status): Promise<Response> | Response {
		if (status.configured) return lockedPage(chrome, '', joinPath(chrome.appBasePath, '/'))
		return request.text().then(function (text: string): Promise<Response> {
			var params = new URLSearchParams(text)
			return setAccessCode(params.get('code') || '').then(function (result): Response {
				if (!result.ok) return lockedPage(chrome, result.error || 'Could not set the access code.', joinPath(chrome.appBasePath, '/'))
				var code = result.code || ''
				var body =
					'\t\t\t<section class="app" aria-label="Access code">\n' +
					'\t\t\t\t<div class="app-body">\n' +
					'\t\t\t\t\t<p class="gate-lead">One-time setup. This is the only time the code is shown.</p>\n' +
					'\t\t\t\t\t<p class="gate-hint"><code>' +
					escapeAttribute(code) +
					'</code></p>\n' +
					'\t\t\t\t\t<p class="gate-hint">Bookmark: <code>?k=' +
					escapeAttribute(encodeURIComponent(code)) +
					'</code></p>\n' +
					'\t\t\t\t</div>\n' +
					'\t\t\t</section>'
				return new Response(shellChrome({ appBasePath: chrome.appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Access code', body: body }), {
					status: 200,
					headers: pageHeaders(),
				})
			})
		})
	})
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

/** Route dispatch for an authenticated request. */
function dispatch(request: Request, chrome: Chrome, path: string, method: string, code: string): Promise<Response> {
	var appBasePath = chrome.appBasePath
	return import('./apps/index.ts').then(function (m): Promise<Response> {			var actFromForm = m.actFromForm
			var clear_recent = m.clear_recent
			var get_app = m.get_app
			var get_hidden = m.get_hidden
			var get_homepage = m.get_homepage
			var get_pinned = m.get_pinned
			var get_recent = m.get_recent
			var list_apps = m.list_apps
			var move_home = m.move_home
			var record_use = m.record_use
			var set_hide = m.set_hide
			var set_home = m.set_home
			var set_pin = m.set_pin
		return import('./apps/client.ts').then(function (c): Promise<Response> {				var isModalApp = c.isModalApp
				var renderAppPanel = c.renderAppPanel
				var renderDashboard = c.renderDashboard
				var renderOverlaySection = c.renderOverlaySection
				var renderAllSection = c.renderAllSection
				var renderEditSection = c.renderEditSection
				var renderPinnedSection = c.renderPinnedSection
				var renderRecentSection = c.renderRecentSection
				var renderWidgetSection = c.renderWidgetSection

			function appBody(id: string, withError: string): Promise<Response> {
				return get_app(id).then(function (entry): Promise<Response> {
					if ('error' in entry) return Promise.resolve(notFoundPage(chrome))
					return record_use(id).then(
						function (): Response {
							return renderAppPage(id, withError, entry.definition, entry.state)
						},
						function (): Response {
							return renderAppPage(id, withError, entry.definition, entry.state)
						},
					)
				})
			}				function dashboardBody(widgetErrorId: string, widgetError: string): Promise<Response> {
					return Promise.all([list_apps(), get_homepage()]).then(function (parts): Promise<Response> {
						var apps = parts[0]
						var homepageIds = parts[1]
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
										widgets.push(renderWidgetSection(entry.definition, entry.state, appBasePath, idx, ordered.length, code, want === widgetErrorId ? widgetError : ''))
									})
								})
							})(ordered[wi], wi)
						}
						return wchain.then(function (): Response {
							var dashboard = renderDashboard(widgets, appBasePath, code)
							var lines = dashboard.split('\n')
							var indented = ''
							for (var li = 0; li < lines.length; li++) indented += '\t\t\t' + lines[li] + '\n'
							return new Response(
								shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Home', current: 'home', body: indented }),
								{ status: widgetError ? 400 : 200, headers: pageHeaders() },
							)
						})
					})
				}

				function renderAppPage(id: string, withError: string, definition: never, state: never): Response {
					var defName = (definition as unknown as { name: string }).name || id
					try {
						var panel = renderAppPanel(definition, state, appBasePath, '', '', code, withError, false)
						var lines = panel.split('\n')
						var indented = ''
						for (var i = 0; i < lines.length; i++) indented += '\t\t\t' + lines[i] + '\n'
						var body = indented
						return new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, body: body }),
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
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, body: fallback }),
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
							return appBody(id, result.error)
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
							return appBody(gid, result.error)
					})
				}
				return appBody(gid, '')
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
						var keepEdit = params.get('edit') === '1'
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
								headers: { Location: appBasePath + '/apps' + (keepEdit ? '?edit=1' : '') },
							})
						})
					})
			}

			// GET /help — static reference in full chrome.
			if (method === 'GET' && path === '/help') {
				var body =
					'\t\t\t<section class="app" aria-label="Help">\n' +
					'\t\t\t\t<div class="app-body">\n' +
					'\t\t\t\t\t<p>kody-os is a minimal shared OS shell. The home page shows your live widgets; the Apps page lists installed apps and opening one shows its live state, and every action runs through the same handler the agents use.</p>\n' +
					'<h3>Adding apps</h3>\n' +
					'<p>Copy this prompt into a Kody-connected agent and fill in the bracketed parts. The browser has no add control; the agent adds the app with MCP <code>add_app</code> — a registry write, no republish.</p>\n' +
					'<p class="gate-hint"><code>Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity package:kody-os#docs/adding-an-app.md, then follow that definition contract. Use the package\'s add_app through the Kody MCP execute wrapper. Validate before writing, verify with list_apps and get_app_state, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous.<br><br>\u2013 App id: [slug]<br>\u2013 Name: [display name]<br>\u2013 What it does: [one sentence]</code></p>\n' +
					'\t\t\t\t\t<p>The new app appears on the Apps page immediately. Add it to the home dashboard from Apps → Edit → <strong>Add to home</strong>. Pins, hidden flags, homepage order, and recent use stay on this device.</p>\n' +
					'\t\t\t\t</div>\n' +
					'\t\t\t</section>'
				return Promise.resolve(
					new Response(
						shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Help', current: 'help', body: body }),
						{ status: 200, headers: pageHeaders() },
					),
				)
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

			// GET /apps — Pinned / Recent / All-apps plus edit mode. Empty registry is honest.
			if (method === 'GET' && path === '/apps') {
				var appsQuery = new URL(request.url).searchParams
				var qPin = appsQuery.get('pin') || ''
				var qHide = appsQuery.get('hide') || ''
				var qWant = appsQuery.get('want') === '1'
				var qClear = appsQuery.get('clear') === '1'
				var qEdit = appsQuery.get('edit') === '1'
				var qHomeToggle = appsQuery.get('home') || ''
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
				var editMode = qEdit
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
						return Promise.resolve(new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', body:
							'\t\t\t<section class="category" id="apps" aria-label="Apps">\n' +
							'\t\t\t\t<h2>Apps</h2>\n' +
							'\t\t\t\t<ul class="tiles">\n' +
							'\t\t\t\t\t<li class="tile tile-empty" aria-label="No apps yet">\n' +
							'\t\t\t\t\t\t<span class="tile-icon" aria-hidden="true"></span>\n' +
							'\t\t\t\t\t\t<span class="tile-label">no apps yet</span>\n' +
							'\t\t\t\t\t</li>\n' +
							'\t\t\t\t</ul>\n' +
							'\t\t\t\t<p class="empty-hint">Ask an agent member to add an app via MCP add_app — it appears here with no republish.</p>\n' +
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
						if (recentApps.length > 0) sections.push(renderRecentSection(recentApps, appBasePath, code, appsBase))
						if (editMode) {
							sections.push(renderEditSection(apps, appBasePath, pinnedIds, hiddenIds, code, homepageIds, appsBase))
						} else {
							var visible: typeof apps = []
							for (var vi = 0; vi < apps.length; vi++) {
								if (hiddenIds.indexOf(apps[vi].id) === -1) visible.push(apps[vi])
							}
							tiled = tiled.concat(visible)
							if (visible.length === 0) {
								sections.push(
									'\t\t\t<section class="category" id="apps" aria-label="Apps">\n' +
									'\t\t\t\t<h2>All apps</h2>\n' +
									'\t\t\t\t<p class="empty-hint">All apps are hidden. Open Edit to unhide.</p>\n' +
									renderAllSection([], appBasePath, code, appsBase).split('\n').slice(2).join('\n'),
								)
							} else {
								sections.push(renderAllSection(visible, appBasePath, code, appsBase))
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
										overlays.push(renderOverlaySection(entry.definition, entry.state, appBasePath, code))
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
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', body: indentedSections }),
								{ status: 200, headers: pageHeaders() },
							)
						})
					}
				})
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
 * Every request passes the device gate first (see auth.ts). MCP exports are
 * not routed through fetch, so agents keep working while the browser is locked.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (Chromium 75 crashes on them).
 */
var app = {
	fetch: async function (request: Request): Promise<Response> {
		var context = await getPackageContext()
		var appBasePath = str(context.appBasePath, '')
		var assetBasePath = str(context.assetBasePath, '/_assets')
		var clientModuleUrl = str(context.clientModuleUrl, '')
		var theme = resolveTheme(await getTheme())
		var chrome: Chrome = { appBasePath: appBasePath, assetBasePath: assetBasePath, clientModuleUrl: clientModuleUrl, theme: theme }
		var rawPath = new URL(request.url).pathname
		var appsAt = rawPath.indexOf('/apps/')
		var path = appsAt === -1 ? rawPath : rawPath.slice(appsAt)
		var method = String(request.method || '').toUpperCase()

		// One-shot bootstrap: mint the first code while none exists.
		if (method === 'POST' && path === '/__access-code') {
			return bootstrapAccess(request, chrome)
		}

		// Unlock form: plain HTML POST, works with zero JavaScript.
		if (method === 'POST' && (path === '/' || path === '')) {
			return unlock(request, chrome)
		}

		var access = await authenticate(request)
		if (!access.ok) {
			return lockedPage(chrome, '', safeNextPath(joinPath(appBasePath, routePath(path, appBasePath)), appBasePath))
		}

		var response = await dispatch(request, chrome, path, method, access.code)
		return finishResponse(response, access.code, access.hash, appBasePath, request)
	},
}

export default app
