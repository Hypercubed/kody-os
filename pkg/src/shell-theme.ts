/**
 * Shell theme overrides (shell-settings Phase 1: storage layer only).
 *
 * The published settings file (`pkg/settings.json`, resolved in app.ts) stays
 * the default. This module owns one durable override, stored under
 * `kody-os.shell.theme`, merged per field on every page render. No MCP
 * export, route, or panel app is added by Phase 1; later phases call
 * these same functions instead of reimplementing validation.
 *
 * Write path rejects, read path forgives (design Decision 3): a set
 * validates the whole payload first and writes nothing on any invalid
 * field, while a page render drops a corrupt or invalid stored field
 * and falls back to the file value for that field only.
 *
 * Server-side only. ES2019 ceiling: no optional chaining, no nullish
 * coalescing, no template literals (same rule as app.ts).
 */

import { deleteKey, readJson, resolveStore, writeJson } from './apps/storage.ts'
import type { KeyStore } from './apps/storage.ts'
import { isSvgIcon, sanitizeSvgIcon } from './apps/registry.ts'

export var SHELL_THEME_KEY = 'kody-os.shell.theme'

/** A partial override: only the fields present are overrides. */
export interface ShellThemeOverride {
	name?: string
	title?: string
	icon?: string
	background?: string | { grid: number[] }
	showHelp?: boolean
	showAbout?: boolean
}

/**
 * File-theme values in file terms (not the shell's internal bodyStyle).
 * `title` is the raw file title: an empty string means "no file title",
 * so the effective title falls back to the effective name, exactly as
 * resolveTheme in app.ts treats an empty title.
 */
export interface ShellThemeValues {
	name: string
	title: string
	icon: string
	background: string | { grid: number[] }
	showHelp: boolean
	showAbout: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The existing background grid check from app.ts: eight integers 0-255. */
export function isValidThemeGrid(value: unknown): value is { grid: number[] } {
	if (!isRecord(value)) return false
	var grid = (value as Record<string, unknown>)['grid']
	if (!Array.isArray(grid) || grid.length !== 8) return false
	for (var i = 0; i < grid.length; i++) {
		var byte = grid[i]
		if (typeof byte !== 'number' || !isFinite(byte) || Math.floor(byte) !== byte || byte < 0 || byte > 255) return false
	}
	return true
}

function copyGrid(value: { grid: number[] }): { grid: number[] } {
	var out: number[] = []
	for (var i = 0; i < value.grid.length; i++) out.push(value.grid[i])
	return { grid: out }
}

/**
 * Normalize a raw file-theme object (the shape getTheme() returns) to
 * file-term values, applying the same fallbacks resolveTheme applies:
 * empty name falls back to 'kody-os', an unknown background falls back
 * to 'desk', a non-string icon falls back to ''.
 */
export function fileThemeToValues(raw: unknown): ShellThemeValues {
	var src = isRecord(raw) ? raw : {}
	var name = typeof src['name'] === 'string' && (src['name'] as string) !== '' ? (src['name'] as string) : 'kody-os'
	var title = typeof src['title'] === 'string' ? (src['title'] as string) : ''
	var icon = typeof src['icon'] === 'string' ? (src['icon'] as string) : ''
	var background: string | { grid: number[] } = 'desk'
	if (src['background'] === 'desk' || src['background'] === 'paper') {
		background = src['background'] as string
	} else if (isValidThemeGrid(src['background'])) {
		background = copyGrid(src['background'] as { grid: number[] })
	}
	// Page-visibility flags default to shown; a non-boolean file value falls
	// back to shown for that flag only (write path rejects, read path forgives).
	var showHelp = src['showHelp'] !== false
	var showAbout = src['showAbout'] !== false
	return { name: name, title: title, icon: icon, background: background, showHelp: showHelp, showAbout: showAbout }
}

/** Read the stored override, forgiving per field: corrupt JSON reads as no override. */
export function readThemeOverride(store: KeyStore): Promise<ShellThemeOverride> {
	return readJson<ShellThemeOverride>(store, SHELL_THEME_KEY).then(function (raw): ShellThemeOverride {
		if (!isRecord(raw)) return {}
		var out: ShellThemeOverride = {}
		if (typeof raw['name'] === 'string' && (raw['name'] as string) !== '') out.name = raw['name'] as string
		if (typeof raw['title'] === 'string' && (raw['title'] as string) !== '') out.title = raw['title'] as string
		if (typeof raw['icon'] === 'string') {
			var icon = raw['icon'] as string
			if (isSvgIcon(icon)) {
				var clean = sanitizeSvgIcon(icon)
				if (clean.ok) out.icon = clean.icon
			} else {
				out.icon = icon
			}
		}
		if (raw['background'] === 'desk' || raw['background'] === 'paper') {
			out.background = raw['background'] as string
		} else if (isValidThemeGrid(raw['background'])) {
			out.background = copyGrid(raw['background'] as { grid: number[] })
		}
		if (typeof raw['showHelp'] === 'boolean') out.showHelp = raw['showHelp']
		if (typeof raw['showAbout'] === 'boolean') out.showAbout = raw['showAbout']
		return out
	})
}

/** Merge defaults with a (forgiving-read) override, per field. */
export function resolveThemeValues(defaults: ShellThemeValues, override: ShellThemeOverride): ShellThemeValues {
	var name = override.name !== undefined ? override.name : defaults.name
	var title = override.title !== undefined ? override.title : (defaults.title !== '' ? defaults.title : name)
	var icon = override.icon !== undefined ? override.icon : defaults.icon
	var background = override.background !== undefined ? override.background : defaults.background
	var showHelp = override.showHelp !== undefined ? override.showHelp : defaults.showHelp
	var showAbout = override.showAbout !== undefined ? override.showAbout : defaults.showAbout
	return { name: name, title: title, icon: icon, background: background, showHelp: showHelp, showAbout: showAbout }
}

function writeOverride(store: KeyStore, override: ShellThemeOverride): Promise<void> {
	if (Object.keys(override).length === 0) return deleteKey(store, SHELL_THEME_KEY)
	return writeJson(store, SHELL_THEME_KEY, override)
}

export function get_shell_theme(
	defaults: ShellThemeValues,
	store?: KeyStore,
): Promise<{ defaults: ShellThemeValues; override: ShellThemeOverride; effective: ShellThemeValues }> {
	return resolveStore(store).then(function (active: KeyStore) {
		return readThemeOverride(active).then(function (override: ShellThemeOverride) {
			return { defaults: defaults, override: override, effective: resolveThemeValues(defaults, override) }
		})
	})
}

/**
 * Validate a set payload (design Decision 4). Returns a cleaned override
 * to apply, where a null value means "clear that field's override".
 * A key present with value null clears; an absent key leaves the field
 * unchanged; title '' also clears (effective title then falls back to
 * the name). Any invalid field fails the whole payload with no write.
 */
export function validateThemeSet(payload: unknown): { ok: true; cleaned: Record<string, unknown> } | { ok: false; error: string } {
	if (!isRecord(payload)) return { ok: false as const, error: 'theme set payload must be an object' }
	var allowed = ['name', 'title', 'icon', 'background', 'showHelp', 'showAbout']
	for (var key of Object.keys(payload)) {
		if (allowed.indexOf(key) === -1) return { ok: false as const, error: 'unknown theme field "' + key + '"' }
	}
	var cleaned: Record<string, unknown> = {}
	var value: unknown
	value = payload['name']
	if (value !== undefined) {
		if (value === null) {
			cleaned['name'] = null
		} else if (typeof value !== 'string' || value === '' || value.length > 200) {
			return { ok: false as const, error: 'theme name must be a non-empty string of at most 200 characters' }
		} else {
			cleaned['name'] = value
		}
	}
	value = payload['title']
	if (value !== undefined) {
		if (value === null || value === '') {
			cleaned['title'] = null
		} else if (typeof value !== 'string' || value.length > 200) {
			return { ok: false as const, error: 'theme title must be a non-empty string of at most 200 characters, or empty to clear' }
		} else {
			cleaned['title'] = value
		}
	}
	value = payload['icon']
	if (value !== undefined) {
		if (value === null) {
			cleaned['icon'] = null
		} else if (typeof value !== 'string') {
			return { ok: false as const, error: 'theme icon must be a string' }
		} else if (isSvgIcon(value)) {
			var clean = sanitizeSvgIcon(value)
			if (!clean.ok) return { ok: false as const, error: clean.error }
			cleaned['icon'] = clean.icon
		} else {
			cleaned['icon'] = value
		}
	}
	var flagFields = ['showHelp', 'showAbout']
	for (var fi = 0; fi < flagFields.length; fi++) {
		var flag = flagFields[fi]
		value = payload[flag]
		if (value === undefined) continue
		if (value === null) {
			cleaned[flag] = null
		} else if (value === true || value === '1') {
			cleaned[flag] = true
		} else if (value === false || value === '0') {
			cleaned[flag] = false
		} else {
			return { ok: false as const, error: 'theme ' + flag + ' must be a boolean or "1"/"0"' }
		}
	}
	value = payload['background']
	if (value !== undefined) {
		if (value === null) {
			cleaned['background'] = null
		} else if (value === 'desk' || value === 'paper') {
			cleaned['background'] = value
		} else if (isValidThemeGrid(value)) {
			cleaned['background'] = copyGrid(value as { grid: number[] })
		} else {
			return { ok: false as const, error: 'theme background must be "desk", "paper", or a grid of eight integers 0-255' }
		}
	}
	return { ok: true as const, cleaned: cleaned }
}

export function set_shell_theme(
	defaults: ShellThemeValues,
	payload: unknown,
	store?: KeyStore,
): Promise<{ ok: true; override: ShellThemeOverride; effective: ShellThemeValues } | { ok: false; error: string }> {
	var checked = validateThemeSet(payload)
	if (!checked.ok) return Promise.resolve({ ok: false as const, error: checked.error })
	var cleaned = checked.cleaned
	return resolveStore(store).then(function (active: KeyStore) {
		return readThemeOverride(active).then(function (current: ShellThemeOverride) {
			var next: ShellThemeOverride = {}
			var fields = ['name', 'title', 'icon', 'background', 'showHelp', 'showAbout']
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i]
				if (field in cleaned) {
					if (cleaned[field] !== null) {
						;(next as Record<string, unknown>)[field] = cleaned[field]
					}
				} else if ((current as Record<string, unknown>)[field] !== undefined) {
					;(next as Record<string, unknown>)[field] = (current as Record<string, unknown>)[field]
				}
			}
			return writeOverride(active, next).then(function (): { ok: true; override: ShellThemeOverride; effective: ShellThemeValues } {
				return { ok: true as const, override: next, effective: resolveThemeValues(defaults, next) }
			})
		})
	})
}

export function reset_shell_theme(
	defaults: ShellThemeValues,
	field?: string,
	store?: KeyStore,
): Promise<{ ok: true; effective: ShellThemeValues } | { ok: false; error: string }> {
	if (field !== undefined && ['name', 'title', 'icon', 'background', 'showHelp', 'showAbout'].indexOf(field) === -1) {
		return Promise.resolve({ ok: false as const, error: 'unknown theme field "' + field + '"' })
	}
	return resolveStore(store).then(function (active: KeyStore) {
		if (field === undefined) {
			return deleteKey(active, SHELL_THEME_KEY).then(function (): { ok: true; effective: ShellThemeValues } {
				return { ok: true as const, effective: resolveThemeValues(defaults, {}) }
			})
		}
		return readThemeOverride(active).then(function (current: ShellThemeOverride) {
			var next: ShellThemeOverride = {}
			for (var key of Object.keys(current)) {
				if (key !== field) (next as Record<string, unknown>)[key] = (current as Record<string, unknown>)[key]
			}
			return writeOverride(active, next).then(function (): { ok: true; effective: ShellThemeValues } {
				return { ok: true as const, effective: resolveThemeValues(defaults, next) }
			})
		})
	})
}
