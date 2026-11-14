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
	}

	function swapNavMain(freshDoc: Document): boolean {
		var freshMain = freshDoc.getElementById('os-main')
		var currentMain = document.getElementById('os-main')
		if (!freshMain || !currentMain) return false
		if (!freshMain.innerHTML) return false
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
		fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', redirect: 'follow' })
			.then(function (response: Response): Promise<{ url: string; text: string }> {
				return response.text().then(function (text: string): { url: string; text: string } {
					return { url: response.url || url, text: text }
				})
			})
			.then(function (pair: { url: string; text: string }): void {
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
				if (push) {
					try {
						history.pushState({}, '', pair.url)
					} catch (pushErr) {
						// The content already swapped; a pushState failure
						// leaves the URL stale but the page correct.
					}
				}
			})
			.catch(function (): void {
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
			var currentPath = window.location.pathname || '/'
			var currentSearch = window.location.search || ''
			if (resolved.pathname === currentPath && resolved.search === currentSearch) {
				event.preventDefault()
				return
			}
			event.preventDefault()
			var fullUrl = resolved.origin + resolved.pathname + resolved.search
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
			if (!isShellPagePath(resolved.pathname)) {
				window.location.reload()
				return
			}
			navigateShellTo(href, false)
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

console.log('kody-os ready', pakConfig)
