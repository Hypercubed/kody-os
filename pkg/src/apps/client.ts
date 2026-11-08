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
 * Only assets the entry explicitly references (`<script src>` /
 * `<link rel="stylesheet" href>`) execute: unreferenced `.js`/`.css`
 * files are never appended (that append was loader magic executing code
 * the author never referenced, so it is removed — see bundle-files).
 * Extra `.html` files are ignored. References with no matching bundle
 * file are dropped, never fetched, as the fail-closed fallback for
 * already-stored definitions. Throws when the stored entry is missing
 * or unreadable so callers can degrade gracefully.
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
	var baseAttr =
		typeof actionBase === 'string' && actionBase !== ''
			? ' data-action-base="' + escapeHtml(actionBase) + '"'
			: ''
	return '<div class="bundle" data-bundle="' + escapeHtml(def.id) + '"' + baseAttr + '>\n' + inlined + '\n</div>'
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
 * same-origin form. Authentication rides the HttpOnly session cookie;
 * no credential travels in a form, link, or redirect.
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

export function renderAppSection(def: AppDefinition, state: AppState, appBasePath: string, fromPath?: string): string {
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
	error?: string,
	withHeader?: boolean,
	fromPath?: string,
	closeHref?: string,
	expandHref?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, fromPath)
	var errHtml = error ? '<p role="alert">Error: ' + escapeHtml(error) + '</p>\n' : ''
	var back =
		backHref !== '' && backLabel !== ''
			? '<p class="app-back"><a href="' + escapeHtml(backHref) + '">' + escapeHtml(backLabel) + '</a></p>\n'
			: ''
	var closeBtn =
		typeof closeHref === 'string' && closeHref !== ''
			? '<a class="os-box" href="' + escapeHtml(closeHref) + '" aria-label="Close"></a>'
			: ''
	var expandBtn =
		typeof expandHref === 'string' && expandHref !== ''
			? '<a class="modal-expand" href="' + escapeHtml(expandHref) + '" aria-label="Open ' + title + ' full page"></a>'
			: ''
	var header =
		withHeader === false
			? ''
			: '<h2 class="app-titlebar' + (closeBtn !== '' ? ' has-close' : '') + (expandBtn !== '' ? ' has-expand' : '') + '">' + closeBtn + '<span class="app-title-plate">' + title + '</span>' + expandBtn + '</h2>\n'
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
 * hides it again and an expand box that opens the full app page (mirroring
 * the widget expand box on the home screen). The outer element is a `div`
 * so the overlay markup contains exactly one `section.app`. Fully present
 * in server-rendered HTML.
 */
export function renderOverlaySection(def: AppDefinition, state: AppState, appBasePath: string): string {
	var fromPath = appBasePath + '/apps#app-' + def.id
	var panel = renderAppPanel(def, state, appBasePath, '', '', undefined, undefined, fromPath, '#apps', appBasePath + '/apps/' + def.id + '?from=' + encodeURIComponent(appBasePath + '/apps'))
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

/** True when the app's default open mode is the modal overlay (fragment link + inline section). */
export function isModalApp(app: AppSummary): boolean {
	return app.openAs === 'modal'
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
export function renderRecentSection(apps: AppSummary[], appBasePath: string, formBase?: string): string {
	return (
		'<section class="category" id="recent" aria-label="Recent">\n' +'<div class="section-head"><h2>Recent</h2>' +
		'<form method="GET" action="' +
			escapeHtml(typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/') +
			'" class="section-clear">' +
		'<input type="hidden" name="clear" value="1" />' +
		'<button type="submit">Clear</button></form></div>\n' +
		tilesList(apps, appBasePath) +
		'\n</section>'
	)
}

/** Edit-mode entry point, shown only when at least one app is installed.
 * The caller decides availability: an all-hidden registry still offers
 * Edit, even though its visible All list is empty. A GET form matches the
 * Clear control, so both header actions render as the same button. */
export function editAppsLink(appBasePath: string, formBase?: string): string {
	var base = typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/apps'
	return (
		'<form method="GET" action="' +
		escapeHtml(base) +
		'" class="section-edit">' +
		'<input type="hidden" name="edit" value="1" />' +
		'<button type="submit">Edit</button></form>'
	)
}

/** Render the All-apps section in browse mode. The Apps page is a launcher:
 * the All apps header carries the Edit link (to Edit mode) when at least one
 * app is installed. */
export function renderAllSection(
	apps: AppSummary[],
	appBasePath: string,
	formBase?: string,
	hint?: string,
	editAvailable?: boolean,
): string {
	var list = tilesList(apps, appBasePath)
	var editLink = editAvailable === true ? ' ' + editAppsLink(appBasePath, formBase) : ''
	return (
		'<section class="category" id="apps" aria-label="Apps">\n' +'<div class="section-head"><h2>All apps</h2>' + editLink + '</div>\n' +
		(typeof hint === 'string' && hint !== '' ? '<p class="empty-hint">' + escapeHtml(hint) + '</p>\n' : '') +
		list +
		'\n</section>'
	)
}

/** Monochrome line icon for one Edit toggle. Strokes follow the button's
 * text color, so the icon inverts with the pressed state. */
function editToggleIcon(param: string): string {
	if (param === 'pin') {
		return (
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			'<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>' +
			'</svg>'
		)
	}
	if (param === 'hide') {
		return (
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			'<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>' +
			'</svg>'
		)
	}
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
		'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
		'</svg>'
	)
}

/** One state toggle for an Edit row: an icon-only submit button. Its
 * aria-checked and pressed appearance carry the current state; the hidden
 * `want` field submits the opposite value, so no JavaScript is required. */
function editToggleForm(formBase: string, param: string, id: string, label: string, isOn: boolean): string {
	return (
		'<form method="GET" action="' +
		escapeHtml(formBase) +
		'" class="edit-toggle edit-control edit-control-' +
		escapeHtml(param) +
		'">' +
		'<input type="hidden" name="edit" value="1" />' +
		'<input type="hidden" name="' +
		escapeHtml(param) +
		'" value="' +
		escapeHtml(id) +
		'" />' +
		'<input type="hidden" name="want" value="' + (isOn ? '0' : '1') + '" />' +
		'<button type="submit" role="switch" aria-checked="' +
		(isOn ? 'true' : 'false') +
		'" aria-label="' +
		escapeHtml(label) +
		'" class="edit-toggle-btn' +
		(isOn ? ' edit-toggle-btn-on' : '') +
		'">' +
		editToggleIcon(param) +
		'</button></form>'
	)
}

/** Render the Apps Edit section: one row per installed app, every
 * installed app including hidden ones, alphabetical by label with id
 * as tie-break, each row with Pin/Unpin, Hide/Unhide, and Add to
 * home/Remove from home as plain GET forms through the /apps
 * mutation route, 303-ing back to ?edit=1. Pinned/Recent stay tiles;
 * only this section lists rows. No JavaScript is required. */
export function renderEditSection(
	apps: AppSummary[],
	pinnedIds: string[],
	hiddenIds: string[],
	homepageIds: string[],
	appBasePath: string,
	formBase?: string,
): string {
	var base = typeof formBase === 'string' && formBase !== '' ? formBase : appBasePath + '/apps'
	var sorted = apps.slice()
	sorted.sort(function (a, b): number {
		var al = a.label.toLowerCase()
		var bl = b.label.toLowerCase()
		if (al < bl) return -1
		if (al > bl) return 1
		if (a.id < b.id) return -1
		if (a.id > b.id) return 1
		return 0
	})
	var items: string[] = []
	for (var i = 0; i < sorted.length; i++) {
		var app = sorted[i]
		var rawIcon = app.icon || '#'
		var icon = looksLikeSvg(rawIcon) ? rawIcon : escapeHtml(rawIcon)
		var isPinned = pinnedIds.indexOf(app.id) !== -1
		var isHidden = hiddenIds.indexOf(app.id) !== -1
		var isHome = homepageIds.indexOf(app.id) !== -1
		var controls =
			editToggleForm(base, 'pin', app.id, 'Pinned', isPinned) +
			editToggleForm(base, 'hide', app.id, 'Hidden', isHidden) +
			editToggleForm(base, 'home', app.id, 'On home', isHome)
		items.push(
			'<li class="edit-row"><span class="edit-main">' +
				'<span class="edit-icon" aria-hidden="true">' +
				icon +
				'</span>' +
				'<span class="edit-label">' +
				escapeHtml(app.label) +
				'</span></span>' +
				(app.description ? '<span class="edit-desc">' + escapeHtml(app.description) + '</span>' : '') +
				'<span class="edit-controls">' +
				controls +
				'</span>' +
				'</li>',
		)
	}
	return (
		'<section class="category" id="apps-edit" aria-label="Edit apps">\n' +
		'<div class="section-head"><h2>Edit apps</h2><form method="GET" action="' + escapeHtml(base) + '" class="section-done"><button type="submit">Done</button></form></div>\n' +
		'<ul class="edit-list">\n' +
		items.join('\n') +
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
	error?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, appBasePath + '/')
	var errHtml = error ? '<p role="alert">Error: ' + escapeHtml(error) + '</p>\n' : ''
	var upDisabled = index <= 0 ? ' disabled' : ''
	var downDisabled = index >= total - 1 ? ' disabled' : ''
	return (
		'<section class="widget" data-app-id="' +
		escapeHtml(def.id) +
		'" aria-label="' +
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
 * Shared empty-state help block (empty-install + mini-apps-user-facing).
 * Rendered by the Apps page when no apps are installed and by
 * Home when the homepage is empty and no apps are installed at all.
 * One block, not two copies, so the two pages cannot silently diverge.
 * Prompts are plain selectable text in gate-hint code blocks — no copy
 * button, no Clipboard API (on-device Scribe test: navigator.clipboard
 * writeText/readText are denied with NotAllowedError).
 * appBasePath is accepted so call sites pass the same context as the
 * other renderers; the help text currently contains no links.
 *
 * The built-in Help page passes `omitClosing: true`: the closing line
 * ("Once an app is installed...") is true of the first-run empty
 * state, not of the Help page itself. Empty Home / empty Apps keep it.
 */
export function renderEmptyHelp(appBasePath: string, opts?: { omitClosing?: boolean }): string {
	void appBasePath
	var block =
		'<p>No apps installed yet. This shell starts empty \u2014 nothing is installed until you add it. Pick a path below. Copy a prompt into a Kody-connected agent.</p>\n' +
		'<h3>Add your own apps</h3>\n' +
		'<p class="gate-hint"><code>Add a new app to my hosted kody-os app on Kody. First open the published guide with Kody search entity package:kody-os#.agents/skills/adding-an-app/SKILL.md, then follow that definition contract. Use the package\'s `add_app` through the Kody MCP execute wrapper. Validate before writing, verify with `list_apps` and `get_app_state`, and do not publish or change the package source. Do not add it to the homepage unless I ask. Ask me before writing if any detail is missing or ambiguous.<br><br>\u2013 Name: [display name]<br>\u2013 What it does: [describe what it should do]</code></p>\n' +
		'<h3>Install the App Catalog</h3>\n' +
		'<p class="gate-hint"><code>Add the App Catalog to my kody-os shell. Follow the app-store recipe (catalog/app-store/RECIPE.md).</code></p>\n'
	if (opts && opts.omitClosing === true) return block
	return block + '<p>Once an app is installed your apps show up on the Apps page.</p>'
}

/**
 * Render the widget dashboard grid. An empty homepage list renders one of
 * two honest empty states: the shared empty help block when no apps
 * are installed at all, or a short Add-to-home message when apps are
 * installed but none are on Home.
 */
export function renderDashboard(widgets: string[], appBasePath: string, hasApps: boolean): string {
	if (widgets.length === 0) {
		if (hasApps === true) {
			return (
				'<section class="dashboard dashboard-empty" aria-label="Home">\n' +
				'<p class="empty-hint">Add some to Home from the Apps page. Open Apps, tap Edit, and use Add to home on a row. They appear here live.</p>\n' +
				'</section>'
			)
		}
		return (
			'<section class="dashboard dashboard-empty" aria-label="Home">\n' +
			renderEmptyHelp(appBasePath) +
			'\n</section>'
		)
	}
	return '<div class="widgets" role="list">\n' + widgets.join('\n') + '\n</div>'
}
