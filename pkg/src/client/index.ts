/**
 * Browser enhancement for app action forms (same-origin GET JSON fast path).
 *
 * App actions stay plain GET forms, so the page works with no JavaScript: a
 * submit navigates and the server redirects or re-renders with an inline
 * error. Where fetch, querySelector, and JSON parsing all exist, forms with
 * class "app-action" are submitted in place as the same GET URL plus
 * format=json (Accept: application/json); matching [data-app-id]
 * [data-field] value spans update without navigation and a
 * role="alert" error is cleared or shown in place. Any failure falls back
 * to a native form.submit(). Never required: no timers, no WebSockets, no
 * client routing, no frameworks.
 *
 * ES2019 ceiling: no ?. and no ?? in this file (Chromium 75 crashes on them).
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

/**
 * Key delivery for the enhancement path: prefer the stored bearer written by
 * the unlock form (the full device code, or an OTP-minted session token under
 * the same key name), fall back to the page's own DOM (hidden `k` field or
 * `?k=` URL). Every read is guarded: absent or disabled storage returns ''
 * and the caller falls back to the plain URL, then to native submit on
 * any failure.
 */
function readStoredKey(): string {
	try {
		if (typeof window.localStorage === 'undefined' || window.localStorage === null) return ''
		var stored = window.localStorage.getItem('kody_os_auth')
		return typeof stored === 'string' ? stored : ''
	} catch (err) {
		return ''
	}
}

function readDomKey(form: HTMLFormElement): string {
	try {
		var hidden = form.querySelector('input[name="k"]') as unknown as HTMLInputElement | null
		if (hidden && typeof hidden.value === 'string' && hidden.value !== '') return hidden.value
		var search = window.location.search || ''
		var at = search.indexOf('k=')
		if (at !== -1) {
			var rest = search.slice(at + 2)
			var amp = rest.indexOf('&')
			var raw = amp === -1 ? rest : rest.slice(0, amp)
			try {
				return decodeURIComponent(raw)
			} catch (decodeErr) {
				return raw
			}
		}
	} catch (err) {
		return ''
	}
	return ''
}

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
						var stored = readStoredKey()
						if (stored === '') stored = readDomKey(form)
						if (stored !== '' && url.indexOf('k=') === -1) {
							url += '&k=' + encodeURIComponent(stored)
						}
					} catch (keyErr) {
						// Never break the submit for a key lookup: fall through
						// with the plain URL, then native submit on failure.
					}
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
 * Header clock tick (enhancement layer).
 * The bar carries server-rendered UTC text so the output is complete on its
 * own. Where JavaScript runs, replace it immediately with the browser's local
 * time zone and keep it ticking every second.
 */
var clock = document.getElementById('os-clock')
if (clock && typeof setInterval !== 'undefined') {
	;(function (el: HTMLElement): void {
		var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
		var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		function two(n: number): string {
			return n < 10 ? '0' + n : '' + n
		}
		function render(): void {
			try {
				var d = new Date()
				el.textContent =
					days[d.getDay()] +
					' ' +
					two(d.getDate()) +
					' ' +
					months[d.getMonth()] +
					' ' +
					d.getFullYear() +
					' ' +
					two(d.getHours()) +
					':' +
					two(d.getMinutes())
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
