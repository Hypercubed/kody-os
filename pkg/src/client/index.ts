/* Phase 2 bridge (decided 2026-10-30): plain ES2019 JS, no imports of its
 * own, sets window.KodyBridge. The shell client module runs before
 * DOMContentLoaded, which is when bundles init, so bundles can use the
 * bridge at init time. See pkg/src/bridge/bridge.js for the store,
 * dispatch, rebase, and span-adoption contract. */
import '../bridge/bridge.js'

/**
 * Browser enhancement for app action forms (same-origin GET JSON fast path).
 *
 * App actions stay plain GET forms, so the page works with no JavaScript: a
 * submit navigates and the server redirects or re-renders with an inline
 * error. Same-origin fetches authenticate with the HttpOnly session cookie;
 * no credential is attached to any fetch URL. Where fetch, querySelector,
 * and JSON parsing all exist, forms with
 * class "app-action" are submitted in place as the same GET URL plus
 * format=json (Accept: application/json); matching [data-app-id]
 * [data-field] value spans update without navigation and a
 * role="alert" error is cleared or shown in place. Any failure falls back
 * to a native form.submit(). Never required: no timers, no WebSockets, no
 * client routing, no frameworks.
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
