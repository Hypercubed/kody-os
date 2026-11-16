/**
 * `os-icon` — the shared provider-agnostic SVG icon custom element.
 *
 * Light-DOM only (`createRenderRoot` returns `this`), inherits `currentColor`
 * and sizing (`1em` default, `1.5rem` inside `.tile-icon`), strictly within the
 * ES2019 ceiling (no `?.`, no `??`, `declare` properties initialized in constructor).
 *
 * Resolves:
 * - `kody:<name>`: Synchronously from bundled `pkg/src/icons-registry.ts` (zero network calls).
 * - `<prefix>:<name>` (e.g. `lucide:<name>`): On demand via Iconify's CORS-enabled JSON API,
 *   with in-memory + localStorage caching, request deduplication, and allowlist sanitization.
 * - Unprefixed `<name>`: Checks local `kody:<name>` first; if absent, defaults to `lucide:<name>`.
 *
 * Accessibility:
 * - When `label` is provided, sets `role="img"` and `aria-label="<label>"`.
 * - When `label` is omitted or empty, sets `aria-hidden="true"`.
 */

import { getIcon } from './icons-data.ts'
import { sanitizeSvgIcon } from './icon-sanitize.ts'

type KodyLitGlobal = {
	LitElement: any
	html: any
	css: any
	nothing: any
}

var iconMemoryCache = new Map<string, string>()
var inFlightFetches = new Map<string, Promise<string | null>>()

function getFromStorage(key: string): string | null {
	try {
		if (typeof window !== 'undefined' && window.localStorage) {
			return window.localStorage.getItem(key)
		}
	} catch (err) {
	}
	return null
}

function setInStorage(key: string, value: string): void {
	try {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.setItem(key, value)
		}
	} catch (err) {
	}
}

function fetchIconFromCdn(prefix: string, name: string): Promise<string | null> {
	var primaryUrl = 'https://api.iconify.design/' + encodeURIComponent(prefix) + '.json?icons=' + encodeURIComponent(name)
	var fallbackUrl = 'https://api.simplesvg.com/' + encodeURIComponent(prefix) + '.json?icons=' + encodeURIComponent(name)

	function parseIconResponse(res: Response): Promise<string | null> {
		if (!res.ok) return Promise.resolve(null)
		return res.json().then(function (data: any): string | null {
			if (!data || !data.icons || !data.icons[name]) return null
			var iconData = data.icons[name]
			var width = iconData.width || data.width || 24
			var height = iconData.height || data.height || 24
			var body = iconData.body || ''
			var rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>' + name + '</title>' + body + '</svg>'
			var sanitized = sanitizeSvgIcon(rawSvg)
			if (sanitized.ok === true) {
				return sanitized.icon
			}
			return null
		}).catch(function (): null {
			return null
		})
	}

	return fetch(primaryUrl)
		.then(function (res: Response): Promise<string | null> {
			if (res.ok) return parseIconResponse(res)
			return fetch(fallbackUrl).then(parseIconResponse)
		})
		.catch(function (): Promise<string | null> {
			return fetch(fallbackUrl).then(parseIconResponse).catch(function (): null {
				return null
			})
		})
}

/** Define the `os-icon` tag once. Safe to call repeatedly; a tag
 * that is already defined is left alone. */
export function defineOsIcon(KodyLit: KodyLitGlobal): void {
	var LitElement = KodyLit.LitElement
	class OsIcon extends LitElement {
		static get properties(): Record<string, unknown> {
			return {
				name: { type: String },
				label: { type: String },
			}
		}

		declare name: string
		declare label: string
		declare _svg: string
		declare _loading: boolean

		constructor() {
			super()
			this.name = ''
			this.label = ''
			this._svg = ''
			this._loading = false
		}

		createRenderRoot(): HTMLElement {
			return this as unknown as HTMLElement
		}

		connectedCallback(): void {
			super.connectedCallback()
			this._syncAccessibility()
			this._loadIcon()
		}

		_syncAccessibility(): void {
			var lbl = this.label || this.getAttribute('label') || ''
			if (lbl !== '') {
				this.setAttribute('role', 'img')
				this.setAttribute('aria-label', lbl)
				this.removeAttribute('aria-hidden')
			} else {
				this.setAttribute('aria-hidden', 'true')
				this.removeAttribute('role')
				this.removeAttribute('aria-label')
			}
		}

		_loadIcon(): void {
			var rawName = (this.name || this.getAttribute('name') || '').trim()
			if (rawName === '') {
				this._svg = ''
				this._loading = false
				this.requestUpdate()
				return
			}

			var prefix = ''
			var iconName = ''
			var colon = rawName.indexOf(':')
			if (colon !== -1) {
				prefix = rawName.slice(0, colon)
				iconName = rawName.slice(colon + 1)
			} else {
				// Unprefixed: check local kody: first, fallback to lucide:
				var local = getIcon(rawName)
				if (local !== undefined) {
					prefix = 'kody'
					iconName = rawName
				} else {
					prefix = 'lucide'
					iconName = rawName
				}
			}

			if (prefix === 'kody') {
				var svg = getIcon(iconName)
				this._svg = svg !== undefined ? svg : ''
				this._loading = false
				this.requestUpdate()
				return
			}

			// External icon prefix (e.g. lucide)
			var cacheKey = 'os-icon:' + prefix + ':' + iconName
			if (iconMemoryCache.has(cacheKey)) {
				this._svg = iconMemoryCache.get(cacheKey) as string
				this._loading = false
				this.requestUpdate()
				return
			}

			var cached = getFromStorage(cacheKey)
			if (cached !== null) {
				iconMemoryCache.set(cacheKey, cached)
				this._svg = cached
				this._loading = false
				this.requestUpdate()
				return
			}

			// Cache miss — fetch on demand with deduplication
			this._loading = true
			var self = this
			var currentName = rawName

			var inFlight = inFlightFetches.get(cacheKey)
			if (!inFlight) {
				inFlight = fetchIconFromCdn(prefix, iconName)
				inFlightFetches.set(cacheKey, inFlight)
			}

			inFlight.then(function (result: string | null): void {
				inFlightFetches.delete(cacheKey)
				if (result !== null) {
					iconMemoryCache.set(cacheKey, result)
					setInStorage(cacheKey, result)
					if (self.name === currentName || self.getAttribute('name') === currentName) {
						self._svg = result
						self._loading = false
						self.requestUpdate()
					}
				} else {
					if (self.name === currentName || self.getAttribute('name') === currentName) {
						self._svg = ''
						self._loading = false
						self.requestUpdate()
					}
				}
			}).catch(function (): void {
				inFlightFetches.delete(cacheKey)
				if (self.name === currentName || self.getAttribute('name') === currentName) {
					self._svg = ''
					self._loading = false
					self.requestUpdate()
				}
			})
		}

		updated(changedProperties: Map<string | number | symbol, unknown>): void {
			super.updated(changedProperties)
			if (changedProperties.has('label')) {
				this._syncAccessibility()
			}
			if (changedProperties.has('name')) {
				this._loadIcon()
			}
			this.innerHTML = this._svg
		}

		render(): unknown {
			return KodyLit.nothing
		}
	}

	try {
		window.customElements.define('os-icon', OsIcon as unknown as CustomElementConstructor)
	} catch (err) {
		// Already defined (safe no-op)
	}
}
