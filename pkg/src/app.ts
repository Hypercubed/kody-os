import { SHELL_CSS } from './shell-css.ts'
import { ACCESS_COOKIE, accessCookie, authenticate, authPathFor, checkCode, isKodyVerifiedVisitor, isSecureRequest, revokeSession, sessionCookie, sessionCookieName, unlockAllowed } from './auth.ts'
import { isSvgIcon, sanitizeSvgIcon } from './apps/registry.ts'
import { serveFeed } from './feeds.ts'
import type { AuthPath } from './auth.ts'

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
	authPath?: AuthPath
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
	var iconSvg = ''
	// A theme icon that starts with `<svg` must pass the app-icon allowlist;
	// hostile or malformed markup falls back to the stock checkerboard mark.
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
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "frame-ancestors 'none'",
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
	authPath?: AuthPath
	/** Validated close destination; defaults to Home when absent. */
	closeHref?: string
	closeLabel?: string
}): string {
	var safeBase = escapeAttribute(opts.appBasePath)
	var safeTitle = escapeAttribute(opts.title)
	var safeName = escapeAttribute(opts.theme.name)
	var safePrefix = escapeAttribute(opts.theme.titlePrefix)
	var mark =
		opts.theme.iconSvg !== ''
			? '<span class="os-mark-glyph" aria-hidden="true">' + opts.theme.iconSvg + '</span>'
			: opts.theme.icon !== ''
				? '<span class="os-mark-glyph" aria-hidden="true">' + escapeAttribute(opts.theme.icon) + '</span>'
				: '<span class="os-mark" aria-hidden="true"></span>'
	var bodyAttr = opts.theme.bodyStyle !== '' ? ' style="' + escapeAttribute(opts.theme.bodyStyle) + '"' : ''
	var closeHref = typeof opts.closeHref === 'string' && opts.closeHref !== '' ? escapeAttribute(opts.closeHref) : safeBase + '/'
	var closeLabel = typeof opts.closeLabel === 'string' && opts.closeLabel !== '' ? escapeAttribute(opts.closeLabel) : 'Home'
	var homeBox =
		opts.current === 'home'
			? ''
			: '\t\t\t<a class="os-box" href="' +
				closeHref +
				'" aria-label="' + closeLabel + '" title="' + closeLabel + '"></a>\n'

	var clientScript = opts.clientModuleUrl
		? '\n\t<script type="module" src="' + escapeAttribute(opts.clientModuleUrl) + '"></script>'
		: ''
	var authLabel: AuthPath = opts.authPath ? opts.authPath : 'locked'
	var footerPath = '\t\t<footer class="os-statusbar">\n' + '\t\t\t<p class="os-status-main">Private OS shell</p>\n' + '\t\t\t<p class="os-status-meta">' + escapeAttribute(authLabel) + ' \u00b7 v' + escapeAttribute((opts.theme && opts.theme.version) || '0.1.0') + (opts.theme && opts.theme.build ? ' ' + escapeAttribute(opts.theme.build) : '') + '</p>\n' + '\t\t</footer>\n'
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
			(opts.authPath === 'via cookie' || opts.authPath === 'via key'
				? '\t\t<a href="' + safeBase + '/logout">Logout</a>\n'
				: '') +
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
		footerPath +
		'\t</div>' +
		clientScript +
		'\n</body>\n</html>'
	)
}

function notFoundPage(ctx: Chrome): Response {
	return new Response(shellChrome({ appBasePath: ctx.appBasePath, assetBasePath: ctx.assetBasePath, clientModuleUrl: ctx.clientModuleUrl, theme: ctx.theme, title: 'Not found', authPath: ctx.authPath ? ctx.authPath : 'locked', body: '\t\t<p>Not found.</p>' }), {
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
	var basePath = ctx.appBasePath && ctx.appBasePath.charAt(0) === '/' ? ctx.appBasePath : '/'
	if (basePath.charAt(basePath.length - 1) !== '/') basePath += '/'
	var safeBase = escapeAttribute(basePath)
	var alert = message ? '\t\t\t\t\t<p role="alert">' + escapeAttribute(message) + '</p>\n' : ''
	var body =
		'\t\t\t<section class="app gate" aria-label="Locked">\n' +
		'\t\t\t\t<div class="app-body">\n' +
		'\t\t\t\t\t<p class="gate-lead">This OS is private. Ask your agent for a one-time code and enter it below.</p>\n' +
		alert +
		'\t\t\t\t\t<form class="gate-form" method="get" action="' +
		action +
		'" data-base="' + safeBase + '">\n' +
		'\t\t\t\t\t\t<label for="access-code">Access code</label>\n' +
		'\t\t\t\t\t\t<input id="access-code" name="k" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required />\n' +
		'\t\t\t\t\t\t<button type="submit">Unlock</button>\n' +
		'\t\t\t\t\t\t<script>(function(){try{var f=document.querySelector("form.gate-form");if(!f||!f.addEventListener)return;f.addEventListener("submit",function(){try{var i=f.querySelector("input[name=k]");if(i&&i.value){try{localStorage.setItem("kody_os_auth",i.value)}catch(s){}try{var b=f.getAttribute("data-base")||"/";f.action=b+"unlock/"+encodeURIComponent(i.value)}catch(a){}}}catch(e){}})}catch(e){}})();</script>\n' +
		'\t\t\t\t\t</form>\n' +
		'\t\t\t\t\t<p class="gate-hint">Codes are 4 digits, single use, and expire after 10 minutes.</p>\n' +
		'\t\t\t\t</div>\n' +
		'\t\t\t</section>'
	return new Response(shellChrome({ appBasePath: ctx.appBasePath, assetBasePath: ctx.assetBasePath, clientModuleUrl: ctx.clientModuleUrl, theme: ctx.theme, title: 'Locked', authPath: 'locked', body: body }), {
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

/** Add the cookie on the query path; stamp links/redirects only when viaQuery. Kody- and cookie-authenticated responses pass stamp=false and render clean URLs; query-authenticated responses pass stamp=true (viaQuery) and keep `?k=` exactly as today. The branch is explicit so it never depends on code emptiness. */
function finishResponse(response: Response, code: string, hash: string, appBasePath: string, request: Request, stamp: boolean): Promise<Response> {
	var headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	headers.set('Referrer-Policy', 'no-referrer')
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Content-Security-Policy', "frame-ancestors 'none'")
	if (!stamp) return Promise.resolve(new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers }))

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

/** Clear the session cookie (logout): prefixed and legacy bare names, so one logout clears either. */
function clearSessionCookies(appBasePath: string, secure: boolean): string[] {
	var path = appBasePath && appBasePath.charAt(0) === '/' ? appBasePath : '/'
	if (path.charAt(path.length - 1) !== '/') path += '/'
	var names = [sessionCookieName()]
	if (names[0] !== ACCESS_COOKIE) names.push(ACCESS_COOKIE)
	var out: string[] = []
	for (var i = 0; i < names.length; i++) {
		var parts = [names[i] + '=deleted', 'Path=' + path, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax']
		if (secure) parts.push('Secure')
		out.push(parts.join('; '))
	}
	return out
}

/** Plain HTML unlock form POST: verify, set the cookie, land on a `next` interstitial that stores the code in localStorage where available. */
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
			return unlockAllowed().then(function (allowed): Promise<Response> {
				if (!allowed) return Promise.resolve(lockedPage(chrome, 'Too many attempts. Try again in a few minutes.', next))
				return checkCode(params.get('code') || '', undefined, request).then(function (check): Response {
					if (!check.ok || check.hash === '') return lockedPage(chrome, 'Code not recognized.', next)
					// Success lands on an interstitial, not a bare 303, so a guarded
					// inline script can store the bearer in localStorage where available;
					// later enhancement requests then authenticate with clean links.
					// The cookie and the continue URL are the Scribe-safe path:
					// absent or disabled storage never blocks the meta refresh or the
					// plain Continue link below. OTP unlocks mint a session: the
					// stored value is the session token (same key name) and the
					// continue URL stays clean, since the OTP is already burned.
					var isSession = check.sessionToken !== ''
					var dest = isSession ? next : withAccessCode(next, check.code)
					var stored = isSession ? check.sessionToken : check.code
					var codeJs = JSON.stringify(stored)
					var destJs = JSON.stringify(dest)
					var unlockedBody =
						'\t\t\t<section class="app gate" aria-label="Unlocked">\n' +
						'\t\t\t\t<div class="app-body">\n' +
						'\t\t\t\t\t<meta http-equiv="refresh" content="0;url=' + escapeAttribute(dest) + '" />\n' +
						'\t\t\t\t\t<p class="gate-lead">Unlocked. Continuing...</p>\n' +
						'\t\t\t\t\t<p class="gate-hint"><a href="' + escapeAttribute(dest) + '">Continue</a></p>\n' +
						'\t\t\t\t</div>\n' +
						'\t\t\t</section>' +
						'<script>(function(){try{localStorage.setItem("kody_os_auth",' + codeJs + ')}catch(e){}try{location.replace(' + destJs + ')}catch(f){try{location.href=' + destJs + '}catch(g){}}})();</script>'
					var cookie = isSession
						? sessionCookie(check.sessionToken, chrome.appBasePath, isSecureRequest(request))
						: accessCookie(check.hash, chrome.appBasePath, isSecureRequest(request))
					return new Response(shellChrome({ appBasePath: chrome.appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Unlocked', authPath: isSession ? 'via cookie' : 'via key', body: unlockedBody }), {
						status: 200,
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
							'Set-Cookie': cookie,
							'Cache-Control': 'no-store',
							'Referrer-Policy': 'no-referrer',
							'X-Content-Type-Options': 'nosniff',
							'Content-Security-Policy': "frame-ancestors 'none'",
						},
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
function dispatch(request: Request, chrome: Chrome, path: string, method: string, code: string, authPath: AuthPath): Promise<Response> {
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

			function appBody(id: string, withError: string, fromParam: string): Promise<Response> {
				return get_app(id).then(function (entry): Promise<Response> {
					if ('error' in entry) return Promise.resolve(notFoundPage(chrome))
					return record_use(id).then(
						function (): Response {
							return renderAppPage(id, withError, entry.definition, entry.state, fromParam)
						},
						function (): Response {
							return renderAppPage(id, withError, entry.definition, entry.state, fromParam)
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
								shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Home', current: 'home', authPath: authPath, body: indented }),
								{ status: widgetError ? 400 : 200, headers: pageHeaders() },
							)
						})
					})
				}

				function renderAppPage(id: string, withError: string, definition: never, state: never, fromParam: string): Response {
					var defName = (definition as unknown as { name: string }).name || id
					var homePath = joinPath(appBasePath, '/')
					var appsPath = joinPath(appBasePath, '/apps')
					var closeHref = safeNextPath(fromParam, appBasePath)
					var closeLabel = closeHref === appsPath ? 'Apps' : closeHref === homePath ? 'Home' : 'Back'
					try {
						var panel = renderAppPanel(definition, state, appBasePath, '', '', code, withError, false, fromParam !== '' ? closeHref : '')
						var lines = panel.split('\n')
						var indented = ''
						for (var i = 0; i < lines.length; i++) indented += '\t\t\t' + lines[i] + '\n'
						var body = indented
						return new Response(
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, authPath: authPath, closeHref: closeHref, closeLabel: closeLabel, body: body }),
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
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: defName, authPath: authPath, closeHref: closeHref, closeLabel: closeLabel, body: fallback }),
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
					'\t\t\t\t<div class="app-body help-body">\n' +
					'\t\t\t\t\t<p>kody-os is a minimal shared OS shell. The home page shows your live widgets; the Apps page lists installed apps and opening one shows its live state, and every action runs through the same handler the agents use.</p>\n' +
					'<h3>Adding apps</h3>\n' +
					'<p>Copy this prompt into a Kody-connected agent and fill in the bracketed parts. The browser has no add control; the agent adds the app with MCP <code>add_app</code> — a registry write, no republish.</p>\n' +
					'<p class="gate-hint"><code>Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity package:kody-os#docs/adding-an-app.md, then follow that definition contract. Use the package\'s add_app through the Kody MCP execute wrapper. Validate before writing, verify with list_apps and get_app_state, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous.<br><br>\u2013 App id: [slug]<br>\u2013 Name: [display name]<br>\u2013 What it does: [one sentence]</code></p>\n' +
					'\t\t\t\t\t<p>The new app appears on the Apps page immediately. Add it to the home dashboard from Apps → Edit → <strong>Add to home</strong>. Pins, hidden flags, homepage order, and recent use stay on this device.</p>\n' +
					'\t\t\t\t\t<p>Setting up a fresh fork or opening the OS for the first time? Follow the setup guide: open the published guide with Kody search entity <code>package:kody-os#docs/setup.md</code> and follow its sequence, ending with your first installed app.</p>\n' +
					'\t\t\t\t</div>\n' +
					'\t\t\t</section>'
				return Promise.resolve(
					new Response(
						shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Help', current: 'help', authPath: authPath, body: body }),
						{ status: 200, headers: pageHeaders() },
					),
				)
			}

			// GET /logout — revoke this device's session on both sides, then land home.
			if (method === 'GET' && path === '/logout') {
				return revokeSession(request).then(function (): Response {
					var headers = new Headers(pageHeaders())
					var doomed = clearSessionCookies(appBasePath, isSecureRequest(request))
					for (var ci = 0; ci < doomed.length; ci++) headers.append('Set-Cookie', doomed[ci])
					headers.set('Location', appBasePath + '/')
					return new Response(null, { status: 303, headers: headers })
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
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', authPath: authPath, body:
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
							shellChrome({ appBasePath: appBasePath, assetBasePath: chrome.assetBasePath, clientModuleUrl: chrome.clientModuleUrl, theme: chrome.theme, title: 'Apps', current: 'apps', authPath: authPath, body: indentedSections }),
								{ status: 200, headers: pageHeaders() },
							)
						})
					}
				})
			}

			// GET /feed/:app/:name — generic feed capability (see feeds.ts):
			// allowlisted upstream fetch + storage cache, served same-origin.
			// Inside dispatch, so the device gate in fetch() has already run.
			// Placed after the /apps/ branches so an app id of "feed" still
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
 * ES2019 ceiling: no optional chaining and no nullish coalescing in this file (see the canonical ceiling in docs/scribe-limitations.md).
 */
var app = {
	fetch: async function (request: Request): Promise<Response> {
		var context = await getPackageContext()
		var appBasePath = str(context.appBasePath, '')
		var assetBasePath = str(context.assetBasePath, '/_assets')
		var clientModuleUrl = str(context.clientModuleUrl, '')
		var theme = resolveTheme(await getTheme())
		try {
			var meta = await getPackageMeta()
			theme.version = meta.version
			theme.build = meta.build
		} catch (err) {
			theme.version = '0.1.0'
			theme.build = ''
		}
		var chrome: Chrome = { appBasePath: appBasePath, assetBasePath: assetBasePath, clientModuleUrl: clientModuleUrl, theme: theme }
		var rawPath = new URL(request.url).pathname
		var appsAt = rawPath.indexOf('/apps/')
		var path = appsAt === -1 ? rawPath : rawPath.slice(appsAt)
		var method = String(request.method || '').toUpperCase()
		// Path-carried OTP: the edge drops query strings before the fetch
		// handler runs, so /unlock/<code> carries the code in the path.
		// Re-attach it as ?k= on a cloned request; everything downstream
		// (auth, redirect, cookie, messages) then works unchanged.
		var unlockAt = path.indexOf('/unlock/')
		if (method === 'GET' && unlockAt !== -1) {
			var seg = path.slice(unlockAt + 8)
			var cutAt = seg.indexOf('/')
			var rawCode = cutAt === -1 ? seg : seg.slice(0, cutAt)
			var pathCode = ''
			try {
				pathCode = decodeURIComponent(rawCode)
			} catch (err) {
				pathCode = ''
			}
			if (pathCode !== '') {
				try {
					var sep = request.url.indexOf('?') === -1 ? '?' : '&'
					request = new Request(request.url + sep + 'k=' + encodeURIComponent(pathCode), request)
				} catch (err) {
				}
			}
		}

		// Unlock form: plain HTML POST, works with zero JavaScript.
		if (method === 'POST' && (path === '/' || path === '')) {
			return unlock(request, chrome)
		}

		// Kody-login bypass: a platform-verified visitor skips the device gate.
		// Anonymous (no header, or metaGetCurrentUser throws) falls through to
		// the device gate; the Scribe never sends the header so its `?k=` flow
		// is byte-identical to today. Never fails open.
		var kodyVisitor = await isKodyVerifiedVisitor(request)
		var access = await authenticate(request)
		if (kodyVisitor) {
			var kodyAccess = { ok: true, viaQuery: false, viaCookie: false, viaKody: true, code: '', hash: access.hash }
			chrome.authPath = authPathFor(kodyAccess)
			var kodyResponse = await dispatch(request, chrome, path, method, '', chrome.authPath)
			return finishResponse(kodyResponse, '', access.hash, appBasePath, request, false)
		}
		if (!access.ok) {
			chrome.authPath = 'locked'
			var triedCode = ''
			try {
				triedCode = new URL(request.url).searchParams.get('k') || ''
			} catch (err) {
				triedCode = ''
			}
			var lockedMsg = ''
		if (triedCode !== '') {
			var allowedNow = true
			try {
				allowedNow = await unlockAllowed()
			} catch (err) {
				allowedNow = true
			}
			lockedMsg = allowedNow ? 'Code not recognized. Ask your agent for a fresh code and try again.' : 'Too many attempts. Try again in a few minutes.'
		}
			return lockedPage(chrome, lockedMsg, safeNextPath(joinPath(appBasePath, routePath(path, appBasePath)), appBasePath))
		}

		chrome.authPath = authPathFor(access)
		if (access.sessionToken !== '' && method === 'GET') {
			var cleanHeaders = new Headers(pageHeaders())
			cleanHeaders.append('Set-Cookie', sessionCookie(access.sessionToken, appBasePath, isSecureRequest(request)))
			// Land on the app home with a clean URL: the /unlock/<code> path
			// must not linger (the code is single-use anyway), and deep-link
			// resume is out of scope while query strings are stripped.
			// Re-prefix the mount or the redirect escapes to the host root.
			cleanHeaders.set('Location', joinPath(appBasePath, '/'))
			return Promise.resolve(new Response(null, { status: 303, headers: cleanHeaders }))
		}
		var response = await dispatch(request, chrome, path, method, access.code, chrome.authPath)
		return finishResponse(response, access.code, access.hash, appBasePath, request, access.viaQuery).then(function (finished): Promise<Response> {
			// A fresh OTP session mints its bearer here (the GET-form path): the
			// legacy finish never stamps or sets a cookie for it (clean URLs),
			// so append the HttpOnly session cookie carrying the raw token.
			if (access.sessionToken === '') return Promise.resolve(finished)
			var outHeaders = new Headers(finished.headers)
			outHeaders.append('Set-Cookie', sessionCookie(access.sessionToken, appBasePath, isSecureRequest(request)))
			return finished.text().then(function (body): Response {
				return new Response(body, { status: finished.status, statusText: finished.statusText, headers: outHeaders })
			})
		})
	},
}

export default app
