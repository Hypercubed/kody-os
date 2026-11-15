/* Phase 2 bridge (decided 2026-10-30): plain ES2019 JS, no imports of its
 * own, sets window.KodyBridge. The shell client module runs before
 * DOMContentLoaded, which is when bundles init, so bundles can use the
 * bridge at init time. See pkg/src/client/bridge.js for the store,
 * dispatch, rebase, and span-adoption contract. */
import './bridge.js'
import { defineOsElements } from './os-elements.ts'

// Shared os-* elements (shell-islands): the shell defines them once here,
// before DOMContentLoaded, so app bundles mounting at DOMContentLoaded
// find the tags already defined. Does nothing when the vendored Lit
// (window.KodyLit) is absent.
defineOsElements()

/**
 * Browser enhancement for app action forms (same-origin GET JSON fast path).
 *
 * App actions stay plain GET forms, so the page works with no JavaScript: a
 * submit navigates and the server redirects or re-renders with an inline
 * error. Same-origin fetches ride the platform-verified Kody visitor;
 * no credential is attached to any fetch URL. Where fetch, querySelector,
 * and JSON parsing all exist, forms with
 * class "app-action" are submitted in place as the same GET URL plus
 * format=json (Accept: application/json); matching [data-app-id]
 * [data-field] value spans update without navigation and a
 * role="alert" error is cleared or shown in place. Any failure falls back
 * to a native form.submit(). Never required: no timers, no WebSockets, no
 * frameworks. Client-side navigation for shell pages (Home/Apps) is a
 * separate enhancement below, also with a native full-load fallback.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (see the canonical ceiling in docs/scribe-limitations.md).
 * No replaceAll, no .at.
 */
function readPakConfig(): Record<string, unknown> {
	try {
		var raw: string = document.documentElement.dataset.pakConfig || '{}'
		var config: unknown = JSON.parse(raw)
		if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
			return config as Record<string, unknown>
		}
		return {}
	} catch (err) {
		return {}
	}
}

var pakConfig = readPakConfig()

var canFastPath =
	typeof fetch !== 'undefined' &&
	typeof document.querySelector === 'function' &&
	typeof JSON !== 'undefined' &&
	typeof JSON.parse === 'function'
if (canFastPath) {
	var forms = document.querySelectorAll<HTMLFormElement>('form.app-action')
	for (var i = 0; i < forms.length; i++) {
		;(function (form: HTMLFormElement): void {
			form.addEventListener('submit', function (event: Event): void {
				event.preventDefault()
				try {
					var rawAction = form.getAttribute('action') || form.action || window.location.href
					var parts: string[] = []
					var els = form.elements
					for (var j = 0; j < els.length; j++) {
						var field = els[j] as unknown as HTMLInputElement
						var fname = field.name
						if (!fname) continue
						var ftype = field.type
						if ((ftype === 'checkbox' || ftype === 'radio') && !field.checked) continue
						parts.push(encodeURIComponent(fname) + '=' + encodeURIComponent(field.value))
					}
					parts.push('format=json')
					var sep = rawAction.indexOf('?') === -1 ? '?' : '&'
					var url = rawAction + sep + parts.join('&')
					try {
						var probe = document.createElement('a')
						probe.href = url
						var gotOrigin = String(probe.protocol + '//' + probe.host)
						var pageOrigin = String(window.location.protocol + '//' + window.location.host)
						if (gotOrigin !== pageOrigin) {
							form.submit()
							return
						}
					} catch (guardErr) {
						form.submit()
						return
					}
					fetch(url, { headers: { Accept: 'application/json' }, redirect: 'follow' })
						.then(function (response: Response): Promise<{ status: number; text: string }> {
							return response.text().then(function (text: string): { status: number; text: string } {
								return { status: response.status, text: text }
							})
						})
						.then(function (pair: { status: number; text: string }): void {
							var data: unknown
							try {
								data = JSON.parse(pair.text)
							} catch (parseErr) {
								form.submit()
								return
							}
							if (data === null || typeof data !== 'object') {
								form.submit()
								return
							}
							var rec = data as Record<string, unknown>
							if (rec['ok'] !== true && rec['ok'] !== false) {
								form.submit()
								return
							}
							var cursor: Node | null = form as unknown as Node
							var section: Element | null = null
							while (cursor) {
								if (cursor instanceof Element && cursor.hasAttribute('data-app-id')) {
									section = cursor
									break
								}
								cursor = cursor.parentNode
							}
							if (!section) {
								var walk: Node | null = form as unknown as Node
								while (walk) {
									if (walk instanceof Element && walk.tagName === 'SECTION') {
										section = walk
										break
									}
									walk = walk.parentNode
								}
							}
							var scope: Element | Document = section ? section : document
							if (rec['ok'] === true) {
								var state = rec['state']
								if (state === null || typeof state !== 'object') {
									form.submit()
									return
								}
								var st = state as Record<string, unknown>
								var rows = scope.querySelectorAll('[data-field]')
								for (var r = 0; r < rows.length; r++) {
									var row = rows[r]
									var key = row.getAttribute('data-field') || ''
									if (key === '' || !(key in st)) continue
									var sval = String(st[key])
									var target = row.querySelector('span')
									if (target) {
										target.textContent = sval
									}
								}
								var clearEl = scope.querySelector('[role="alert"]')
								if (clearEl) clearEl.textContent = ''
							} else {
								var msg = typeof rec['error'] === 'string' ? (rec['error'] as string) : 'Action failed'
								var alertEl = scope.querySelector('[role="alert"]')
								if (alertEl) {
									alertEl.textContent = 'Error: ' + msg
								} else {
									var made = document.createElement('p')
									made.setAttribute('role', 'alert')
									made.textContent = 'Error: ' + msg
									var body = scope.querySelector('.app-body')
									if (body) body.appendChild(made)
									else if (section) section.appendChild(made)
									else document.body.appendChild(made)
								}
							}
						})
						.catch(function (): void {
							form.submit()
						})
				} catch (err) {
					form.submit()
				}
			})
		})(forms[i])
	}
}

/**
 * Return-to-opener via sessionStorage (sessionstorage-return).
 *
 * App links are plain `/apps/<id>`; the return address is browser state,
 * not URL state. A delegated click listener stores the current page
 * (`location.pathname + location.hash`) under the single sessionStorage
 * key `kody-os:return` before any shell link to an app page navigates, and
 * an app page reads it back to point the titlebar Close box at the opener.
 * One write rule covers tiles, widget expand links, home tiles, overlay
 * expand links, and menu links.
 *
 * Modal tiles keep their touch URL (`/apps/<id>?touch=1`) so the open still
 * reaches the server without JavaScript. With JavaScript the click is
 * intercepted, `?touch=1&format=json` is fetched to record the open, and
 * the overlay is revealed by setting the fragment — no navigation. Any
 * failure falls through to the native touch URL, which 303s to the
 * overlay as before.
 *
 * Nothing here is required: without JavaScript the Close box goes Home and
 * a native widget/action submit lands on the app page (the accepted no-JS
 * scope). Every storage access is guarded; any failure behaves as "no
 * stored value". ES2019 ceiling: no ?. and no ?? in this file.
 */
var returnStorageKey = 'kody-os:return'

function returnReadStored(): string {
	try {
		if (typeof sessionStorage === 'undefined') return ''
		var stored = sessionStorage.getItem(returnStorageKey)
		return typeof stored === 'string' ? stored : ''
	} catch (err) {
		return ''
	}
}

function returnWriteStored(value: string): void {
	try {
		if (typeof sessionStorage === 'undefined') return
		sessionStorage.setItem(returnStorageKey, value)
	} catch (err) {
		// Disabled or throwing storage behaves as "no stored value".
	}
}

/** The shell mount base: `data-app-base`, else the path prefix up to `/apps`. */
function returnPathBase(): string {
	var base = ''
	try {
		base = document.documentElement.getAttribute('data-app-base') || ''
	} catch (err) {
		base = ''
	}
	if (base === '') {
		var pathname = window.location.pathname || '/'
		var lower = pathname.toLowerCase()
		var at = lower.indexOf('/apps/')
		if (at === -1 && lower.length >= 5 && lower.slice(lower.length - 5) === '/apps') at = lower.length - 5
		if (at > 0) base = pathname.slice(0, at)
	}
	if (base.length > 1 && base.charAt(base.length - 1) === '/') base = base.slice(0, -1)
	if (base === '/') base = ''
	return base
}

function returnJoin(base: string, path: string): string {
	return base === '' ? path : base + path
}

/**
 * Resolve one href, rejecting anything cross-origin or outside
 * `<base>/apps/<id>`. Returns the app id or ''.
 */
function returnResolveAppLink(href: string, base: string): { id: string; url: string; search: string } | null {
	try {
		var probe = document.createElement('a')
		probe.href = href
		var origin = String(probe.protocol + '//' + probe.host)
		if (origin !== String(window.location.protocol + '//' + window.location.host)) return null
		var pathname = probe.pathname || '/'
		var prefix = base + '/apps/'
		if (pathname.indexOf(prefix) !== 0) return null
		var rest = pathname.slice(prefix.length)
		if (rest === '' || rest.indexOf('/') !== -1) return null
		var id = ''
		try {
			id = decodeURIComponent(rest)
		} catch (decodeErr) {
			id = ''
		}
		if (id === '') return null
		return { id: id, url: origin + pathname + (probe.search || ''), search: probe.search || '' }
	} catch (err) {
		return null
	}
}

/**
 * Validate a stored/legacy return path. Mirrors the server's former
 * `safeNextPath` rules (leading `/`, no `//`, no `\`, no `://`, no CR/LF,
 * under the mount base) plus a fragment guard and a traversal guard. A
 * `#app-<id>` fragment survives only for the current app; otherwise the
 * bare path is used when valid. Returns '' when the value is unusable.
 */
function returnValidate(value: string, base: string, appId: string): string {
	if (typeof value !== 'string' || value === '') return ''
	if (value.charAt(0) !== '/') return ''
	if (value.indexOf('//') === 0) return ''
	if (value.indexOf('\\') !== -1) return ''
	if (value.indexOf('://') !== -1) return ''
	if (value.indexOf('\n') !== -1 || value.indexOf('\r') !== -1) return ''
	var home = returnJoin(base, '/')
	var path = value
	var hashAt = value.indexOf('#')
	if (hashAt !== -1) path = value.slice(0, hashAt)
	if (path !== home && path.indexOf(home) !== 0) return ''
	if (path.indexOf('/../') !== -1 || path.slice(path.length - 3) === '/..') return ''
	if (hashAt !== -1) {
		var fragment = value.slice(hashAt)
		if (fragment !== '#app-' + appId) return path
	}
	return value
}

function returnCloseLabel(value: string, base: string): string {
	if (value === returnJoin(base, '/apps')) return 'Apps'
	if (value === returnJoin(base, '/')) return 'Home'
	return 'Back'
}

/** Apply a validated return path to the titlebar Close box. */
function returnApply(value: string, base: string): void {
	var box = document.querySelector('.os-titlebar a.os-box')
	if (!box) return
	var label = returnCloseLabel(value, base)
	box.setAttribute('href', value)
	box.setAttribute('aria-label', label)
	box.setAttribute('title', label)
}

/** The app page section, or null on the dashboard, Apps page, or elsewhere. */
function returnAppPageSection(): Element | null {
	try {
		return document.querySelector('#os-main > section.app[data-app-id]')
	} catch (err) {
		return null
	}
}

document.addEventListener('click', function (event: Event): void {
	try {
		var mouseEvent = event as MouseEvent
		if (mouseEvent.button !== 0) return
		if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey || mouseEvent.altKey) return
		var target = event.target as unknown as Node | null
		if (!target) return
		var anchor: HTMLAnchorElement | null = null
		var node: Node | null = target
		while (node) {
			if (node instanceof Element && node.tagName === 'A') {
				anchor = node as unknown as HTMLAnchorElement
				break
			}
			node = node.parentNode
		}
		if (!anchor) return
		if (anchor.getAttribute('target')) return
		if (anchor.hasAttribute('download')) return
		var href = anchor.getAttribute('href') || ''
		if (href === '') return
		var base = returnPathBase()
		var link = returnResolveAppLink(href, base)
		if (!link) return
		// Store synchronously, before any navigation can proceed.
		returnWriteStored(window.location.pathname + window.location.hash)
		// Plain app tiles navigate normally: the write above is the whole job.
		if (link.search.indexOf('touch=1') === -1) return
		// Modal tile: record the open via JSON and reveal the overlay in place.
		var linkUrl = link.url
		var linkId = link.id
		event.preventDefault()
		var sep = linkUrl.indexOf('?') === -1 ? '?' : '&'
		var fetchUrl = linkUrl + sep + 'format=json'
		var fallback = function (): void {
			window.location.href = linkUrl
		}
		if (typeof fetch === 'undefined') {
			fallback()
			return
		}
		fetch(fetchUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin', redirect: 'follow' })
			.then(function (response: Response): Promise<string> {
				return response.text()
			})
			.then(function (text: string): void {
				var data: unknown
				try {
					data = JSON.parse(text)
				} catch (parseErr) {
					fallback()
					return
				}
				if (data === null || typeof data !== 'object') {
					fallback()
					return
				}
				var rec = data as Record<string, unknown>
				if (rec['ok'] !== true) {
					fallback()
					return
				}
				window.location.hash = 'app-' + linkId
			})
			.catch(function (): void {
				fallback()
			})
	} catch (err) {
		// Never break navigation: on any error, let the browser proceed.
	}
})

// App-page load: legacy `?from=` migration, then the stored return.
var returnPageSection = returnAppPageSection()
if (returnPageSection) {
	try {
		var returnAppId = returnPageSection.getAttribute('data-app-id') || ''
		var returnBase = returnPathBase()
		var returnTarget = ''
		var legacyFrom = ''
		try {
			var returnParams = new URLSearchParams(window.location.search)
			legacyFrom = returnParams.get('from') || ''
			if (returnParams.get('from') !== null) {
				returnParams.delete('from')
				var cleanedQuery = returnParams.toString()
				var cleanedUrl = window.location.pathname + (cleanedQuery === '' ? '' : '?' + cleanedQuery) + window.location.hash
				try {
					history.replaceState({}, '', cleanedUrl)
				} catch (replaceErr) {
					// A failed strip leaves the URL as-is; the value still applies.
				}
			}
		} catch (queryErr) {
			legacyFrom = ''
		}
		if (legacyFrom !== '') {
			var migrated = returnValidate(legacyFrom, returnBase, returnAppId)
			if (migrated !== '') {
				returnWriteStored(migrated)
				returnTarget = migrated
			}
		}
		if (returnTarget === '') {
			returnTarget = returnValidate(returnReadStored(), returnBase, returnAppId)
		}
		if (returnTarget !== '') returnApply(returnTarget, returnBase)
	} catch (err) {
		// Never break the app page for a return failure: the Close box stays Home.
	}
}

/**
 * App Store controls (enhancement layer).
 *
 * Store rows stay plain GET forms, so every control works with no JavaScript
 * (submit navigates and the server 303s back to the store). Where fetch and
 * DOMParser exist, the submit is intercepted, fetched as HTML, and only the
 * #store section is swapped in place. No navigation, so scroll position is
 * retained. Any failure falls back to a native form.submit().
 *
 * Delegated on document because the row forms are replaced after each swap.
 * ES2019 ceiling: no ?. and no ?? in this file.
 */
if (canFastPath && typeof DOMParser !== 'undefined') {
	function formGetUrl(form: HTMLFormElement): string {
		var rawAction = form.getAttribute('action') || form.action || window.location.href
		var parts: string[] = []
		var els = form.elements
		for (var j = 0; j < els.length; j++) {
			var field = els[j] as unknown as HTMLInputElement
			var fname = field.name
			if (!fname) continue
			var ftype = field.type
			if ((ftype === 'checkbox' || ftype === 'radio') && !field.checked) continue
			parts.push(encodeURIComponent(fname) + '=' + encodeURIComponent(field.value))
		}
		if (parts.length === 0) return rawAction
		var sep = rawAction.indexOf('?') === -1 ? '?' : '&'
		return rawAction + sep + parts.join('&')
	}

	function isSameOrigin(url: string): boolean {
		try {
			var probe = document.createElement('a')
			probe.href = url
			return String(probe.protocol + '//' + probe.host) === String(window.location.protocol + '//' + window.location.host)
		} catch (err) {
			return false
		}
	}

	/* Edit toggles (pin/hide/home) stay plain GET forms. Swapping just the
	   Edit list from the redirected HTML keeps the page (and its scroll
	   position) in place; focus returns to the equivalent toggle. */
	function submitEditToggle(form: HTMLFormElement, event: Event): void {
		if (form.getAttribute('data-busy') === '1') {
			event.preventDefault()
			return
		}
		form.setAttribute('data-busy', '1')
		event.preventDefault()
		try {
			var url = formGetUrl(form)
			if (!isSameOrigin(url)) {
				form.submit()
				return
			}
			var row = form.closest('.edit-row')
			var rowIndex = -1
			if (row && row.parentNode) {
				var rows = row.parentNode.querySelectorAll('.edit-row')
				for (var i = 0; i < rows.length; i++) {
					if (rows[i] === row) {
						rowIndex = i
						break
					}
				}
			}
			var toggleClass = form.className
			fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', redirect: 'follow' })
				.then(function (response: Response): Promise<string> {
					return response.text()
				})
				.then(function (text: string): void {
					var freshDoc: Document
					try {
						freshDoc = new DOMParser().parseFromString(text, 'text/html')
					} catch (parseErr) {
						form.submit()
						return
					}
					var freshSection = freshDoc.getElementById('apps-edit')
					var currentSection = document.getElementById('apps-edit')
					var freshList = freshSection ? freshSection.querySelector('.edit-list') : null
					var currentList = currentSection ? currentSection.querySelector('.edit-list') : null
					if (!freshList || !currentList) {
						form.submit()
						return
					}
					currentList.innerHTML = freshList.innerHTML
					if (rowIndex === -1) return
					var freshRows = currentList.querySelectorAll('.edit-row')
					var freshRow = freshRows[rowIndex] as HTMLElement | undefined
					if (!freshRow) return
					var toggles = freshRow.querySelectorAll('form.edit-toggle')
					for (var j = 0; j < toggles.length; j++) {
						if (toggles[j].className !== toggleClass) continue
						var button = toggles[j].querySelector('button') as HTMLElement | null
						if (button) {
							try {
								button.focus({ preventScroll: true })
							} catch (focusErr) {
								button.focus()
							}
						}
						break
					}
				})
				.catch(function (): void {
					form.submit()
				})
		} catch (err) {
			form.submit()
		}
	}

	document.addEventListener('submit', function (event: Event): void {
		var target = event.target as HTMLElement | null
		if (!target || target.tagName !== 'FORM') return
		var form = target as unknown as HTMLFormElement
		if (!form.classList) return
		if (form.classList.contains('edit-toggle')) {
			submitEditToggle(form, event)
			return
		}
		if (!form.classList.contains('store-control')) return
		if (form.getAttribute('data-busy') === '1') {
			event.preventDefault()
			return
		}
		form.setAttribute('data-busy', '1')
		event.preventDefault()
		try {
			var rawAction = form.getAttribute('action') || form.action || window.location.href
			var parts: string[] = []
			var els = form.elements
			for (var j = 0; j < els.length; j++) {
				var field = els[j] as unknown as HTMLInputElement
				var fname = field.name
				if (!fname) continue
				var ftype = field.type
				if ((ftype === 'checkbox' || ftype === 'radio') && !field.checked) continue
				parts.push(encodeURIComponent(fname) + '=' + encodeURIComponent(field.value))
			}
			var sep = rawAction.indexOf('?') === -1 ? '?' : '&'
			var url = parts.length > 0 ? rawAction + sep + parts.join('&') : rawAction
			try {
				var probe = document.createElement('a')
				probe.href = url
				var gotOrigin = String(probe.protocol + '//' + probe.host)
				var pageOrigin = String(window.location.protocol + '//' + window.location.host)
				if (gotOrigin !== pageOrigin) {
					form.submit()
					return
				}
			} catch (guardErr) {
				form.submit()
				return
			}
			fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', redirect: 'follow' })
				.then(function (response: Response): Promise<string> {
					return response.text()
				})
				.then(function (text: string): void {
					var fresh: Element | null = null
					try {
						var doc = new DOMParser().parseFromString(text, 'text/html')
						fresh = doc.getElementById('store')
					} catch (parseErr) {
						form.submit()
						return
					}
					var current = document.getElementById('store')
					if (!fresh || !current) {
						form.submit()
						return
					}
					current.innerHTML = fresh.innerHTML
				})
				.catch(function (): void {
					form.submit()
				})
		} catch (err) {
			form.submit()
		}
	})
}

/**
 * Client-side navigation for shell pages (enhancement layer).
 *
 * Home and Apps are server-rendered pages, and every navigation is a
 * full page load by default. Where fetch, DOMParser, and history
 * exist, clicks on same-origin links to Home and Apps are intercepted:
 * the target is fetched as HTML, the fresh document's #os-main content
 * replaces the current one, the document title and nav aria-current
 * are updated from the fresh document, the URL is pushed with
 * history.pushState, and the page scrolls to the top. Back/forward
 * (popstate) fetches and swaps the same way. Any failure falls back
 * to a native navigation (a full page load). App pages, Help, and
 * About stay full-load.
 *
 * The post-swap step updates title, aria-current, and scroll. It is
 * also the hook where seed adoption would go if a future shell page
 * carries JSON state seeds; Home and Apps carry none, so no seed
 * adoption is implemented here. Scripts in swapped HTML do not
 * execute, so all behaviour stays in the persistent bundle.
 *
 * A page whose #os-main contains a bundle section (a Home widget,
 * `section[data-app-id]`) is never swapped in: the widget's script
 * must run to mount the bundle, and scripts in swapped HTML do not
 * execute, so such a page falls back to a native full load.
 *
 * Overlapping navigations are discarded: each navigation takes a
 * sequence number, and a response (or failure) from an older
 * navigation is ignored once a newer one has started — including a
 * same-page click, which cancels any pending navigation. The
 * rendered page is tracked separately from the URL: a Back
 * navigation changes the URL immediately while the old page is
 * still rendered, so a click on the link to the URL's page is not
 * a same-page click while that navigation is pending — it is a
 * click to the page being navigated to, and the pending navigation
 * is allowed to finish instead of being cancelled.
 *
 * ES2019 ceiling: no ?. and no ?? in this file.
 */
if (canFastPath && typeof DOMParser !== 'undefined' && typeof history !== 'undefined' && typeof history.pushState === 'function') {
	function shellNavPath(suffix: string): string {
		var base = ''
		try {
			base = document.documentElement.getAttribute('data-app-base') || ''
		} catch (err) {
			base = ''
		}
		if (base.length > 1 && base.charAt(base.length - 1) === '/') base = base.slice(0, -1)
		if (base === '/') base = ''
		return base + suffix
	}

	var homePath = shellNavPath('/')
	var appsPath = shellNavPath('/apps')

	// Navigation ownership: incremented on every navigation attempt
	// (click, popstate) and on a same-page click, which cancels any
	// pending navigation. A fetch response or failure whose sequence
	// no longer matches is stale and is ignored.
	var navSeq = 0

	// The page actually rendered, as a full URL. This is NOT the
	// same as window.location.href: a Back navigation changes the
	// URL immediately while the old page is still rendered, so the
	// rendered page lags the URL until the swap happens. A click is
	// a same-page click only when it points at the rendered page,
	// not merely at the URL's page.
	var renderedUrl = navPageOrigin() + (window.location.pathname || '/') + (window.location.search || '')

	// The full URL of the in-flight navigation, or null when none
	// is in flight. A click on a link to a URL that is already
	// being navigated to does nothing — the pending navigation is
	// allowed to finish instead of starting a duplicate fetch.
	var pendingUrl: string | null = null

	function isShellPagePath(path: string): boolean {
		return path === homePath || path === appsPath
	}

	function resolveNavUrl(href: string): { origin: string; pathname: string; search: string } | null {
		try {
			var probe = document.createElement('a')
			probe.href = href
			return {
				origin: String(probe.protocol + '//' + probe.host),
				pathname: probe.pathname || '/',
				search: probe.search || ''
			}
		} catch (err) {
			return null
		}
	}

	function navPageOrigin(): string {
		return String(window.location.protocol + '//' + window.location.host)
	}

	function syncNavCurrent(freshDoc: Document): void {
		try {
			var freshNav = freshDoc.querySelector('nav[aria-label="Shell"]')
			var currentNav = document.querySelector('nav[aria-label="Shell"]')
			if (!freshNav || !currentNav) return
			var currentLinks = currentNav.querySelectorAll('a')
			var freshLinks = freshNav.querySelectorAll('a')
			for (var i = 0; i < currentLinks.length; i++) {
				var currentLink = currentLinks[i]
				var href = currentLink.getAttribute('href') || ''
				var freshLink: Element | null = null
				for (var j = 0; j < freshLinks.length; j++) {
					if ((freshLinks[j].getAttribute('href') || '') === href) {
						freshLink = freshLinks[j]
						break
					}
				}
				if (!freshLink) continue
				var freshCurrent = freshLink.getAttribute('aria-current')
				if (freshCurrent) currentLink.setAttribute('aria-current', freshCurrent)
				else currentLink.removeAttribute('aria-current')
			}
		} catch (err) {
			// Never break navigation for a nav sync failure.
		}
		// Sync the chrome Close box too. The swap replaces #os-main only,
		// so without this the Close box keeps the previous page's
		// destination. After a swap from an app page to a shell page the
		// stale box points at the page just rendered, and the same-page
		// check swallows the click — the Close button appears dead.
		// The panel Close box (inside #os-main) is swapped with the
		// content; only the chrome box (in .os-titlebar) needs syncing.
		try {
			var freshTitlebar = freshDoc.querySelector('.os-titlebar')
			var currentTitlebar = document.querySelector('.os-titlebar')
			if (!freshTitlebar || !currentTitlebar) return
			var freshBox = freshTitlebar.querySelector('a.os-box')
			var currentBox = currentTitlebar.querySelector('a.os-box')
			if (freshBox && currentBox) {
				var freshHref = freshBox.getAttribute('href') || ''
				if (freshHref !== '') currentBox.setAttribute('href', freshHref)
				var freshLabel = freshBox.getAttribute('aria-label') || ''
				if (freshLabel !== '') {
					currentBox.setAttribute('aria-label', freshLabel)
					currentBox.setAttribute('title', freshLabel)
				}
			} else if (freshBox && !currentBox) {
				// Destination has a Close box, current does not (e.g.
				// Home -> Apps): insert a copy before the title.
				var titleEl = currentTitlebar.querySelector('h1.os-title')
				var clone = freshBox.cloneNode(true) as Element
				if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(clone, titleEl)
				else currentTitlebar.appendChild(clone)
			} else if (!freshBox && currentBox) {
				// Destination has no Close box (e.g. Apps -> Home):
				// remove it.
				if (currentBox.parentNode) currentBox.parentNode.removeChild(currentBox)
			}
		} catch (err) {
			// Never break navigation for a close-box sync failure.
		}
	}

	function swapNavMain(freshDoc: Document): boolean {
		var freshMain = freshDoc.getElementById('os-main')
		var currentMain = document.getElementById('os-main')
		if (!freshMain || !currentMain) return false
		if (!freshMain.innerHTML) return false
		// A bundle section (a Home widget) carries a script that must
		// run to mount the bundle. Scripts in swapped HTML do not
		// execute, so a page with a bundle section is never swapped
		// in — the caller falls back to a native full load.
		if (freshMain.querySelector('section[data-app-id]')) return false
		var freshTitle = freshDoc.querySelector('title')
		var titleText = freshTitle ? freshTitle.textContent : null
		if (!titleText) return false
		currentMain.innerHTML = freshMain.innerHTML
		document.title = titleText
		syncNavCurrent(freshDoc)
		try {
			if (typeof window.scrollTo === 'function') window.scrollTo(0, 0)
		} catch (err) {
			// Never break navigation for a scroll failure.
		}
		return true
	}

	function navigateShellTo(url: string, push: boolean): void {
		var mySeq = ++navSeq
		pendingUrl = url
		fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', redirect: 'follow' })
			.then(function (response: Response): Promise<{ url: string; text: string }> {
				return response.text().then(function (text: string): { url: string; text: string } {
					return { url: response.url || url, text: text }
				})
			})
			.then(function (pair: { url: string; text: string }): void {
				if (mySeq !== navSeq) return
				pendingUrl = null
				var freshDoc: Document
				try {
					freshDoc = new DOMParser().parseFromString(pair.text, 'text/html')
				} catch (parseErr) {
					window.location.href = url
					return
				}
				if (!swapNavMain(freshDoc)) {
					window.location.href = url
					return
				}
				// The swap succeeded: the rendered page is now the
				// fetched page, at the fetch's final URL.
				renderedUrl = pair.url
				if (push) {
					try {
						history.pushState({}, '', pair.url)
					} catch (pushErr) {
						// The swap already happened but the URL is
						// stale, so the content and the URL no longer
						// match. A full load to the requested URL
						// restores them; Reload and Back then operate
						// on the right history entry.
						window.location.href = pair.url
					}
				}
			})
			.catch(function (): void {
				if (mySeq !== navSeq) return
				pendingUrl = null
				window.location.href = url
			})
	}

	document.addEventListener('click', function (event: Event): void {
		try {
			var mouseEvent = event as MouseEvent
			if (mouseEvent.button !== 0) return
			if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey || mouseEvent.altKey) return
			var target = event.target as unknown as Node | null
			if (!target) return
			var anchor: HTMLAnchorElement | null = null
			var node: Node | null = target
			while (node) {
				if (node instanceof Element && node.tagName === 'A') {
					anchor = node as unknown as HTMLAnchorElement
					break
				}
				node = node.parentNode
			}
			if (!anchor) return
			if (anchor.getAttribute('target')) return
			if (anchor.hasAttribute('download')) return
			var href = anchor.getAttribute('href') || ''
			if (href === '' || href.charAt(0) === '#') return
			var resolved = resolveNavUrl(href)
			if (!resolved) return
			if (resolved.origin !== navPageOrigin()) return
			if (!isShellPagePath(resolved.pathname)) return
			var fullUrl = resolved.origin + resolved.pathname + resolved.search
			if (fullUrl === pendingUrl) {
				// A navigation to this URL is already in flight
				// (e.g. a Back navigation to Home whose fetch has
				// not finished yet). Let it finish instead of
				// starting a duplicate fetch — and do not cancel it.
				event.preventDefault()
				return
			}
			if (fullUrl === renderedUrl) {
				// A same-page click cancels any pending navigation:
				// the user is staying on the rendered page, so a
				// stale response must not swap in another page
				// afterwards. This compares against the rendered
				// page, not the URL: during a pending Back
				// navigation the URL has already changed while the
				// old page is still rendered, so a click on the
				// URL's page is not a same-page click then.
				// Restore the browser URL to the rendered page:
				// after Back the URL already points at the
				// destination while the old page is still rendered,
				// and cancelling the pending navigation without
				// restoring it would leave the old page displayed
				// under the destination URL.
				navSeq++
				pendingUrl = null
				try {
					var current = resolveNavUrl(window.location.href)
					if (!current || current.origin + current.pathname + current.search !== renderedUrl) {
						history.replaceState({}, '', renderedUrl)
					}
				} catch (replaceErr) {
					// If the restore fails, fall back to a native full load of
					// the rendered page: leaving the old page displayed under
					// the destination URL would be worse than a reload.
					window.location.href = renderedUrl
				}
				event.preventDefault()
				return
			}
			event.preventDefault()
			navigateShellTo(fullUrl, true)
		} catch (err) {
			// Never break navigation: on any error, let the browser proceed.
		}
	})

	window.addEventListener('popstate', function (): void {
		try {
			var href = window.location.href
			var resolved = resolveNavUrl(href)
			if (!resolved) return
			if (resolved.origin !== navPageOrigin()) return
			// A same-document fragment change (the modal tile intercept sets
			// the overlay fragment, and Back/Forward across fragment entries
			// lands here) has already been applied by the browser. The URL
			// differs only by hash, so there is no page to fetch: fetching
			// would replace #os-main and wipe the revealed overlay.
			if (resolved.origin + resolved.pathname + resolved.search === renderedUrl) return
			if (!isShellPagePath(resolved.pathname)) {
				window.location.reload()
				return
			}
			// Pass the normalized URL (origin + path + search, no
			// hash) so pendingUrl matches the form the click
			// handler computes for the same destination.
			navigateShellTo(resolved.origin + resolved.pathname + resolved.search, false)
		} catch (err) {
			try {
				window.location.reload()
			} catch (reloadErr) {
				// Nothing more to do.
			}
		}
	})
}

/**
 * Header clock tick (enhancement layer).
 * The bar carries server-rendered UTC text so the output is complete on its
 * own. Where JavaScript runs, replace it immediately with the browser's
 * local time zone in the browser's localized date/time format, and keep it
 * ticking every second.
 */
var clock = document.getElementById('os-clock')
if (clock && typeof setInterval !== 'undefined') {
	;(function (el: HTMLElement): void {
		function render(): void {
			try {
				var d = new Date()
				el.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
			} catch (err) {
				// Never break the page for a clock refresh.
			}
		}
		render()
		setInterval(render, 1000)
	})(clock)
}

/**
 * Widget tick (progressive enhancement only).
 * Time-based widgets may render `<time data-tick="minutes">` with their
 * as-of-load local time as text. Where timers run, this re-renders those
 * elements in place each second; where timers are broken the page simply
 * keeps its server-rendered snapshot. The dashboard is complete without
 * JavaScript, so the render is byte-identical with the script disabled.
 */
var tickEls = document.querySelectorAll('time[data-tick]')
if (tickEls.length > 0 && typeof setInterval !== 'undefined') {
	;(function (els: NodeListOf<HTMLElement>): void {
		var tdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
		var tmonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		function ttwo(n: number): string {
			return n < 10 ? '0' + n : '' + n
		}
		function ttick(): void {
			try {
					var d = new Date()
					for (var ti = 0; ti < els.length; ti++) {
						var mode = els[ti].getAttribute('data-tick') || 'minutes'
						var text = tdays[d.getDay()] + ' ' + ttwo(d.getDate()) + ' ' + tmonths[d.getMonth()] + ' ' + d.getFullYear() + ' ' + ttwo(d.getHours()) + ':' + ttwo(d.getMinutes())
						if (mode === 'seconds') text += ':' + ttwo(d.getSeconds())
						els[ti].textContent = text
					}
			} catch (err) {
				// Never break the page for a widget refresh.
			}
		}
		setInterval(ttick, 1000)
	})(tickEls as unknown as NodeListOf<HTMLElement>)
}

/**
 * Per-app help dialog (JS modal).
 *
 * The `[?]` titlebar box is a <button data-help-open> and the dialog is a
 * server-rendered `[hidden]` div. Opening removes `hidden` in place: no
 * fragment, no navigation, no page refresh — the overlay underneath and
 * any expanded layout stay exactly as they were. Closing re-hides the
 * dialog and returns focus to the opener. Escape closes the open dialog.
 *
 * ES2019 ceiling: no ?. and no ?? in this file.
 */
var helpLastFocus: Element | null = null

function helpOpenDialog(id: string): void {
	try {
		var dialog = document.getElementById(id)
		if (!dialog) return
		try {
			var active = document.activeElement
			helpLastFocus = active instanceof Element ? active : null
		} catch (focusErr) {
			helpLastFocus = null
		}
		dialog.removeAttribute('hidden')
		try {
			var closeBtn = dialog.querySelector('[data-help-close]')
			if (closeBtn instanceof HTMLElement) closeBtn.focus()
		} catch (btnErr) {
			// Showing the dialog is the job; focus is a nicety.
		}
	} catch (err) {
		// Never break the page for a help open.
	}
}

function helpCloseDialog(dialog: Element): void {
	try {
		dialog.setAttribute('hidden', '')
		if (helpLastFocus && document.contains(helpLastFocus)) {
			try {
				;(helpLastFocus as HTMLElement).focus()
			} catch (focusErr) {
				// Focus restore is a nicety.
			}
		}
		helpLastFocus = null
	} catch (err) {
		// Never break the page for a help close.
	}
}

document.addEventListener('click', function (event: Event): void {
	try {
		var target = event.target as unknown as Node | null
		if (!target) return
		var node: Node | null = target
		var opener: Element | null = null
		var closer: Element | null = null
		while (node) {
			if (node instanceof Element) {
				if (!opener && node.hasAttribute('data-help-open')) opener = node
				if (!closer && node.hasAttribute('data-help-close')) closer = node
				if (opener || closer) break
			}
			node = node.parentNode
		}
		if (opener) {
			event.preventDefault()
			var helpId = opener.getAttribute('data-help-open') || ''
			if (helpId !== '') helpOpenDialog(helpId)
			return
		}
		if (closer) {
			event.preventDefault()
			var cursor: Node | null = closer
			while (cursor) {
				if (cursor instanceof Element && cursor.classList.contains('os-help-dialog')) {
					helpCloseDialog(cursor)
					return
				}
				cursor = cursor.parentNode
			}
		}
	} catch (err) {
		// Never break navigation: on any error, let the browser proceed.
	}
})

document.addEventListener('keydown', function (event: Event): void {
	try {
		var keyEvent = event as KeyboardEvent
		var key = keyEvent.key || ''
		if (key !== 'Escape' && key !== 'Esc') return
		var open = document.querySelector('.os-help-dialog:not([hidden])')
		if (open) {
			event.preventDefault()
			helpCloseDialog(open)
		}
	} catch (err) {
		// Never break the page for an Escape press.
	}
})

console.log('kody-os ready', pakConfig)
