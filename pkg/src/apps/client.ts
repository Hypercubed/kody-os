/**
 * Browser-safe rendering helpers for data-driven apps.
 *
 * ZERO imports that execute at runtime (types only): the shell can bundle or
 * inline this without kody:/node: imports. These helpers only build HTML
 * strings from a definition + state snapshot; all mutation still goes through
 * server-side `act()`. The UI submits a plain GET form (edge-safe on the
 * package-app subdomain); the POST route remains for API clients.
 * Server-rendered; JS may enhance it.
 *
 * ES2019 ceiling: no ?. and no ?? in this file.
 */

import type { AppDefinition, AppState, AppSummary } from './types.ts'

/** Escape runtime values before placing them in HTML. */
export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		function (character: string): string {
			if (character === '&') return '&amp;'
			if (character === '<') return '&lt;'
			if (character === '>') return '&gt;'
			if (character === '"') return '&quot;'
			return '&#39;'
		},
	)
}

function str(value: unknown): string {
	if (value === undefined || value === null) return ''
	return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Read one bundle file as a string, or undefined when absent. */
function bundleFile(def: AppDefinition, path: string): string | undefined {
	var raw = def as unknown as Record<string, unknown>
	if (!isRecord(raw['bundle'])) return undefined
	var files = (raw['bundle'] as Record<string, unknown>)['files']
	if (!isRecord(files)) return undefined
	var content = (files as Record<string, unknown>)[path]
	return typeof content === 'string' ? content : undefined
}

/**
 * Inline bundle-relative asset references so the page carries no external
 * bundle assets: `<script src="app.js"></script>` becomes an inline script,
 * `<link rel="stylesheet" href="style.css">` becomes an inline style.
 * References with no matching bundle file are dropped, never fetched.
 * Absolute URLs are left untouched (validation keeps bundles self-contained).
 */
function inlineBundleAssets(entry: string, def: AppDefinition, used: string[]): string {
	var withScripts = entry.replace(
		/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script\s*>/gi,
		function (whole: string, pre: string, src: string): string {
			var content = bundleFile(def, src)
			if (content === undefined) return ''
			used.push(src)
			return '<script>' + content + '</script>'
		},
	)
	return withScripts.replace(
		/<link\b([^>]*?)\bhref\s*=\s*["']([^"']+)["']([^>]*?)\/?>/gi,
		function (whole: string, pre: string, href: string): string {
			if (whole.toLowerCase().indexOf('stylesheet') === -1) return whole
			var content = bundleFile(def, href)
			if (content === undefined) return ''
			used.push(href)
			return '<style>' + content + '</style>'
		},
	)
}

/**
 * Render a bundle definition's entry HTML inlined for the app panel.
 * Extra bundle .js/.css files not referenced by the entry are appended as
 * inline script/style blocks; extra .html files are ignored. Throws when the
 * stored entry is missing or unreadable so callers can degrade gracefully.
 *
 * When `actionBase` is given, the container carries it as
 * `data-action-base` so bundle scripts can resolve action URLs against the
 * owning app instead of the current page path.
 */
export function renderBundleContent(def: AppDefinition, actionBase?: string): string {
	var entry = bundleFile(def, 'index.html')
	if (typeof entry !== 'string' || entry === '') {
		throw new Error('bundle "' + def.id + '" has no readable entry')
	}
	var used: string[] = ['index.html']
	var inlined = inlineBundleAssets(entry, def, used)
	var raw = def as unknown as Record<string, unknown>
	var files = isRecord(raw['bundle']) ? ((raw['bundle'] as Record<string, unknown>)['files'] as Record<string, unknown>) : {}
	var extra = ''
	for (var path of Object.keys(files)) {
		if (used.indexOf(path) !== -1) continue
		var content = files[path]
		if (typeof content !== 'string') continue
		if (path.slice(-3) === '.js') extra += '\n<script>' + content + '</script>'
		else if (path.slice(-4) === '.css') extra += '\n<style>' + content + '</style>'
	}
	var baseAttr =
		typeof actionBase === 'string' && actionBase !== ''
			? ' data-action-base="' + escapeHtml(actionBase) + '"'
			: ''
	return '<div class="bundle" data-bundle="' + escapeHtml(def.id) + '"' + baseAttr + '>\n' + inlined + extra + '\n</div>'
}

/**
 * Render one app's bare content on the single render path: the bundle UI,
 * then every state field, then one plain form per UI action. No wrapper
 * element of its own — the shell's `<section class="app">` (see
 * `renderAppPanel`) is the single box on app pages, modal overlays, and
 * (later) widgets, so content renders identically in every placement.
 * There is no template branch: every unified app ships bundle files.
 *
 * Forms use GET because Kody's edge rejects cross-origin POSTs to a package-app
 * subdomain; some browsers and embedded views report a null origin even for a
 * same-origin form. The code travels as a hidden `k` field so the bookmark path
 * keeps working without a cookie.
 */
/** Render the JSON state seed for one app section (Phase 2, decided 2026-10-30).
 * The seed is a <script type="application/json"> element carrying the full
 * durable state, rendered BEFORE the bundle HTML so it is present at
 * bundle-script time — the 2026-10-30 Scribe probe proved the span readout
 * is not present at bundle-script time, only by DOMContentLoaded. Escaping
 * <, >, & and U+2028/U+2029 as \u escapes keeps the JSON from breaking
 * out of the script element; JSON.parse on the bundle side restores it.
 * Dual-channel migration: the span readout below is still rendered, so
 * span-reading bundles keep working until ported to the bridge. */
export function renderStateSeed(def: AppDefinition, state: AppState): string {
	var json = JSON.stringify(state)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029')
	return '<script type="application/json" data-kody-state-seed="1" data-app-id="' + escapeHtml(def.id) + '">' + json + '</script>'
}

export function renderAppSection(def: AppDefinition, state: AppState, appBasePath: string, code?: string, fromPath?: string): string {
	var bundleHtml: string
	try {
		bundleHtml = renderBundleContent(def, appBasePath + '/apps/' + def.id)
	} catch (err) {
		bundleHtml = '<p>This bundle could not be displayed. The stored definition is damaged; reinstall it with add_app.</p>'
	}
	var seedHtml = renderStateSeed(def, state)
	var hideState = def.ui.hideState === true
	var fieldNames: string[] = Object.keys(def.stateSchema.fields)
	var hiddenAttr = hideState ? ' hidden' : ''
	var fields = fieldNames
		.map(function (field: string): string {
			var value = str(state[field])
			return '<p data-field="' + escapeHtml(field) + '"' + hiddenAttr + '>' + escapeHtml(field) + ': ' + '<span>' + escapeHtml(value) + '</span></p>'
		})
		.join('\n')
	var codeField =
		typeof code === 'string' && code !== ''
			? '<input type="hidden" name="k" value="' + escapeHtml(code) + '" />'
			: ''
	var fromField =
		typeof fromPath === 'string' && fromPath !== ''
			? '<input type="hidden" name="from" value="' + escapeHtml(fromPath) + '" />'
			: ''
	var actions = def.ui.actions || []
	var forms = actions
		.map(function (entry): string {
			return (
				'<form class="app-action" method="GET" action="' +
				escapeHtml(appBasePath + '/apps/' + def.id) +
				'">' +
				codeField +
				fromField +
				'<input type="hidden" name="action" value="' +
				escapeHtml(entry.action) +
				'" />' +
				'<button type="submit">' +
				escapeHtml(entry.label) +
				'</button></form>'
			)
		})
		.join('\n')
	return seedHtml + '\n' + bundleHtml + '\n' + fields + '\n' + forms
}

/**
 * Render the single app panel box: title bar, body with bare section content,
 * and an optional back link (omitted when backHref/backLabel are empty).
 * Pass withHeader=false on full app pages, where the shell chrome already
 * names the app; overlays keep the header. Defaults to current behavior.
 * Used by the app page and the modal overlay alike.
 */
export function renderAppPanel(
	def: AppDefinition,
	state: AppState,
	appBasePath: string,
	backHref: string,
	backLabel: string,
	code?: string,
	error?: string,
	withHeader?: boolean,
	fromPath?: string,
	closeHref?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, code, fromPath)
	var errHtml = error ? '<p role="alert">Error: ' + escapeHtml(error) + '</p>\n' : ''
	var back =
		backHref !== '' && backLabel !== ''
			? '<p class="app-back"><a href="' + escapeHtml(backHref) + '">' + escapeHtml(backLabel) + '</a></p>\n'
			: ''
	var closeBtn =
		typeof closeHref === 'string' && closeHref !== ''
			? '<a class="os-box" href="' + escapeHtml(closeHref) + '" aria-label="Close"></a>'
			: ''
	var header =
		withHeader === false
			? ''
			: '<h2 class="app-titlebar' + (closeBtn !== '' ? ' has-close' : '') + '">' + closeBtn + '<span class="app-title-plate">' + title + '</span></h2>\n'
	return (
		'<section class="app" data-app-id="' +
		escapeHtml(def.id) +
		'" aria-label="' +
		title +
		'">\n' +
		header +
		'<div class="app-body">\n' +
		errHtml +
		content +
		'\n</div>\n' +
		back +
		'</section>'
	)
}

/**
 * Render a modal overlay for one modal-capable app: a `:target`-revealed panel
 * holding the same single app panel as the app page, plus a close box that
 * hides it again. The outer element is a `div` so the overlay markup contains
 * exactly one `section.app`. Fully present in server-rendered HTML.
 */
export function renderOverlaySection(def: AppDefinition, state: AppState, appBasePath: string, code?: string): string {
	var fromPath = appBasePath + '/apps#app-' + def.id
	var panel = renderAppPanel(def, state, appBasePath, '', '', code, undefined, undefined, fromPath, '#apps')
	return (
		'<div class="overlay" id="app-' +
		escapeHtml(def.id) +
		'" aria-label="' +
		escapeHtml(def.ui.title || def.name) +
		'">\n' +
		'<div class="overlay-panel">\n' +
		panel +
		'\n</div>\n</div>'
	)
}

/** True when the app may open as a home overlay (fragment link + inline section). */
export function isModalApp(app: AppSummary): boolean {
	return !!app.placements && app.placements.indexOf('modal') !== -1
}

/** Inline SVG icons were sanitized at validation; detect the stored variant. */
function looksLikeSvg(value: string): boolean {
	return value.replace(/^\s+/, '').toLowerCase().indexOf('<svg') === 0
}

function tileItem(app: AppSummary, appBasePath: string, wide?: boolean): string {
	var label = escapeHtml(app.label)
	var rawIcon = app.icon || '#'
	var icon = looksLikeSvg(rawIcon) ? rawIcon : escapeHtml(rawIcon)
	var description = typeof app.description === 'string' ? app.description : ''
	var titleAttr = ' title="' + escapeHtml(description) + '"'
	// Tiles live on the Apps page, so the app's close box returns there.
	var fromApps = encodeURIComponent(appBasePath + '/apps')
	var iconHtml = '<span class="tile-icon" aria-hidden="true">' + icon + '</span>'
	var textHtml =
		wide === true
			? '<span class="tile-text"><span class="tile-label">' +
				label +
				'</span><span class="tile-desc">' +
				escapeHtml(description) +
				'</span></span>'
			: '<span class="tile-label">' + label + '</span>'
	return (
		'<li' + (wide === true ? ' class="tile-wide"' : '') + '><a class="tile" href="' +
		escapeHtml(isModalApp(app) ? appBasePath + '/apps/' + app.id + '?touch=1&from=' + fromApps : appBasePath + '/apps/' + app.id + '?from=' + fromApps) +
		'"' + titleAttr + '>' +
		iconHtml +
		textHtml +
		'</a></li>'
	)
}

function tilesList(apps: AppSummary[], appBasePath: string, wide?: boolean): string {
	var items: string[] = []
	for (var i = 0; i < apps.length; i++) {
		items.push(tileItem(apps[i], appBasePath, wide))
	}
	return '<ul class="tiles">\n' + items.join('\n') + '\n</ul>'
}

/** Render the Pinned section (omitted when empty by the caller). */
export function renderPinnedSection(apps: AppSummary[], appBasePath: string): string {
	return (
		'<section class="category" id="pinned" aria-label="Pinned">\n' +
		'<div class="section-head"><h2>Pinned</h2></div>\n' +
		tilesList(apps, appBasePath, true) +
		'\n</section>'
	)
}

/** Render the Recent section with a Clear control (omitted when empty by the caller). */
export function renderRecentSection(apps: AppSummary[], appBasePath: string, code?: string, formBase?: string): string {
	var codeField =
		typeof code === 'string' && code !== ''
			? '<input type="hidden" name="k" value="' + escapeHtml(code) + '" />'
			: ''
	return (
		'<section class="category" id="recent" aria-label="Recent">\n' +'<div class="section-head"><h2>Recent</h2>' +
		'<form method="GET" action="' +
			escapeHtml(typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/') +
			'" class="section-clear">' +
		codeField +
		'<input type="hidden" name="clear" value="1" />' +
		'<button type="submit">Clear</button></form></div>\n' +
		tilesList(apps, appBasePath) +
		'\n</section>'
	)
}

/** Render the All-apps section in browse mode with an Edit toggle. */
export function renderAllSection(
	apps: AppSummary[],
	appBasePath: string,
	code?: string,
	formBase?: string,
): string {
	var codeField =
		typeof code === 'string' && code !== ''
			? '<input type="hidden" name="k" value="' + escapeHtml(code) + '" />'
			: ''
	var list = tilesList(apps, appBasePath)
	return (
		'<section class="category" id="apps" aria-label="Apps">\n' +'<div class="section-head"><h2>All apps</h2>' +
		'<form method="GET" action="' +
			escapeHtml(typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/') +
			'" class="section-edit">' +
		codeField +
		'<input type="hidden" name="edit" value="1" />' +
		'<button type="submit">Edit</button></form></div>\n' +
		list +
		'\n</section>'
	)
}

/** Render edit mode: every app with pin + hide + homepage toggles. */
export function renderEditSection(
	apps: AppSummary[],
	appBasePath: string,
	pinnedIds: string[],
	hiddenIds: string[],
	code?: string,
	homepageIds?: string[],
	formBase?: string,
): string {
	var codeField =
		typeof code === 'string' && code !== ''
			? '<input type="hidden" name="k" value="' + escapeHtml(code) + '" />'
			: ''
	var base = typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/'
	var homeIds = homepageIds || []
	var rows: string[] = []
	for (var i = 0; i < apps.length; i++) {
		var app = apps[i]
		var isPinned = pinnedIds.indexOf(app.id) !== -1
		var isHidden = hiddenIds.indexOf(app.id) !== -1
		var isHome = homeIds.indexOf(app.id) !== -1
		rows.push(
			'<li class="edit-row"><span class="edit-label">' +
				escapeHtml(app.label) +
			'</span>' +				'<form method="GET" action="' +
				escapeHtml(base) +
			'" class="edit-toggle">' +
			codeField +
			'<input type="hidden" name="edit" value="1" />' +
			'<input type="hidden" name="pin" value="' +
				escapeHtml(app.id) +
			'" /><input type="hidden" name="want" value="' +
				(isPinned ? '0' : '1') +
				'" /><button type="submit">' +
				(isPinned ? 'Unpin' : 'Pin') +
				'</button></form>' +
			'<form method="GET" action="' +
				escapeHtml(base) +
			'" class="edit-toggle">' +
			codeField +
			'<input type="hidden" name="edit" value="1" />' +
			'<input type="hidden" name="hide" value="' +
				escapeHtml(app.id) +
				'" /><input type="hidden" name="want" value="' +
				(isHidden ? '0' : '1') +
				'" /><button type="submit">' +
				(isHidden ? 'Unhide' : 'Hide') +
				'</button></form>' +
			'<form method="GET" action="' +
				escapeHtml(base) +
			'" class="edit-toggle">' +
			codeField +
			'<input type="hidden" name="edit" value="1" />' +
			'<input type="hidden" name="home" value="' +
				escapeHtml(app.id) +
				'" /><input type="hidden" name="want" value="' +
				(isHome ? '0' : '1') +
				'" /><button type="submit">' +
				(isHome ? 'Remove from home' : 'Add to home') +
				'</button></form></li>',
			)
	}
	return (
		'<section class="category" id="apps" aria-label="Apps">\n' +
		'<div class="section-head"><h2>All apps (edit)</h2>' +
		'<form method="GET" action="' +
			escapeHtml(base) +
		'" class="section-edit">' +
		codeField +
		'<button type="submit">Done</button></form></div>\n' +
		'<ul class="edit-list">\n' +
		rows.join('\n') +
		'\n</ul>\n</section>'
	)
}

/**
 * Render a plain list of installed apps (fallback content).
 * The shell's preferred home rendering is its own themed tile grid.
 */
export function renderHomeTiles(apps: AppSummary[], appBasePath: string): string {
	if (apps.length === 0) return '<p>No apps yet.</p>'
	return (
		'<ul>\n' +
		apps
			.map(function (app: AppSummary): string {
				var mark = app.icon ? app.icon + ' ' : ''
				return (
					'<li><a href="' +
					escapeHtml(appBasePath + '/apps/' + app.id + '?from=' + encodeURIComponent(appBasePath + '/')) +
					'">' +
					escapeHtml(mark + app.label) +
					'</a></li>'
				)
			})
			.join('\n') +
		'\n</ul>'
	)
}

/**
 * Render one dashboard widget: the app's own compact view (same bare content
 * as the app page) with live state, action forms that PRG back to `/`,
 * up/down reorder controls, and a link to the full app page.
 *
 * `index`/`total` position the widget in homepage order; boundary buttons
 * render disabled. Fully present in server-rendered HTML.
 */
export function renderWidgetSection(
	def: AppDefinition,
	state: AppState,
	appBasePath: string,
	index: number,
	total: number,
	code?: string,
	error?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, code, appBasePath + '/')
	var errHtml = error ? '<p role="alert">Error: ' + escapeHtml(error) + '</p>\n' : ''
	var codeField =
		typeof code === 'string' && code !== ''
			? '<input type="hidden" name="k" value="' + escapeHtml(code) + '" />'
			: ''
	var upDisabled = index <= 0 ? ' disabled' : ''
	var downDisabled = index >= total - 1 ? ' disabled' : ''
	return (
		'<section class="widget" aria-label="' +
		title +
		'">\n' +
		'<h2 class="app-titlebar"><span class="app-title-plate">' +
		title +
		'</span><a class="widget-expand" href="' +
		escapeHtml(appBasePath + '/apps/' + def.id + '?from=' + encodeURIComponent(appBasePath + '/')) +
		'" aria-label="Expand ' +
		title +
		'" title="Expand"></a></h2>\n' +
		'<div class="app-body">\n' +
		errHtml +
		content +
		'\n</div>\n' +
		'<div class="widget-controls">\n' +
		'<form method="GET" action="' +
		escapeHtml(appBasePath + '/') +
		'" class="widget-move move-left">' +
		codeField +
		'<input type="hidden" name="home" value="' +
			escapeHtml(def.id) +
			'" /><input type="hidden" name="move" value="-1" />' +
			'<button type="submit" class="widget-arrow" aria-label="Move ' +
		title +
		' left"' +
		upDisabled +
		'><span class="wa-mark wa-left" aria-hidden="true"></span></button></form>\n' +
		'<form method="GET" action="' +
			escapeHtml(appBasePath + '/') +
		'" class="widget-move move-right">' +
		codeField +
		'<input type="hidden" name="home" value="' +
			escapeHtml(def.id) +
			'" /><input type="hidden" name="move" value="1" />' +
			'<button type="submit" class="widget-arrow" aria-label="Move ' +
		title +
		' right"' +
		downDisabled +
		'><span class="wa-mark wa-right" aria-hidden="true"></span></button></form>\n' +
		'</div>\n</section>'
	)
}

/**
 * Render the widget dashboard grid. An empty homepage list renders an honest
 * empty state pointing at Apps → Edit → "Add to home".
 */
export function renderDashboard(widgets: string[], appBasePath: string, code?: string): string {
	if (widgets.length === 0) {
		var appsHref = escapeHtml(appBasePath + '/apps')
		var editHref = escapeHtml(appBasePath + '/apps?edit=1')
		return (
			'<section class="dashboard dashboard-empty" aria-label="Home">\n' +
			'<h2>No widgets yet</h2>\n' +
			'<p class="empty-hint">Pin apps to your home from <a href="' +
				appsHref +
			'">Apps</a> → <a href="' +
				editHref +
				'">Edit</a> → “Add to home”. They appear here live with no republish.</p>\n' +
			'</section>'
		)
	}
	return '<div class="widgets" role="list">\n' + widgets.join('\n') + '\n</div>'
}
