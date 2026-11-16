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
 * owning app instead of the current page path. When `packageRef` is
 * given, the container also carries it as `data-package-ref` so bundle
 * scripts can name the running package in agent prompts instead of
 * deriving it from the host.
 */
export function renderBundleContent(def: AppDefinition, actionBase?: string, packageRef?: string): string {
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
	var refAttr =
		typeof packageRef === 'string' && packageRef !== ''
			? ' data-package-ref="' + escapeHtml(packageRef) + '"'
			: ''
	return '<div class="bundle" data-bundle="' + escapeHtml(def.id) + '"' + baseAttr + refAttr + '>\n' + inlined + '\n</div>'
}

/**
 * The app's help text from `ui.help`, or undefined when the app defines
 * none: absent, a non-string (only possible in a stored definition that
 * predates validation), or empty / whitespace-only. Canonicalization
 * already drops the empty forms at install time; this keeps rendering
 * defensively correct for stored definitions.
 */
export function helpTextFor(def: AppDefinition): string | undefined {
	if (!def || !def.ui) return undefined
	var help = def.ui.help
	if (typeof help !== 'string' || help.replace(/\s+/g, '') === '') return undefined
	return help
}

/**
 * The title-bar help box: the literal text `?` in the shared box look,
 * opening the JS help dialog. Rendered immediately left of the expand
 * box on an app header; the caller decides whether help exists.
 * A <button> (not a link): opening help writes no fragment, changes no
 * URL, and never navigates — the client toggles the dialog in place.
 * The glyph rides in an .os-help-glyph span, absolutely centered over the
 * shared square, so it reads centered on every font's metrics.
 */
export function renderHelpButton(id: string): string {
	return '<button type="button" class="os-help" data-help-open="help-dialog-' + escapeHtml(id) + '" aria-label="Help" title="Help"><span class="os-help-glyph" aria-hidden="true">?</span></button>'
}

/**
 * The per-app help dialog: server-rendered, hidden by default, opened by
 * the shell client in place (no fragment, no navigation). Plain text
 * only — the help string is escaped, never interpreted, and line breaks
 * are preserved by CSS (`white-space: pre-wrap`). No route, no storage.
 * The dialog carries `hidden` until the client opens it; closing restores
 * the opener underneath with no URL change, so overlay and expanded state
 * are untouched. The box holds a plain header line (`{app} - Help`),
 * the help text, and a Close button, centered with a double border.
 */
export function renderHelpDialog(id: string, title: string, help: string): string {
	// The `dialog-` / `heading-` infixes keep the two identifiers disjoint:
	// the dialog for app `heading-foo` (`help-dialog-heading-foo`) can
	// never equal the heading for app `foo` (`help-heading-foo`), which
	// the old shared `help-` prefix allowed. Button and dialog agree.
	var dialogId = 'help-dialog-' + escapeHtml(id)
	var headingId = 'help-heading-' + escapeHtml(id)
	return (
		'<div class="os-help-dialog" id="' +
		dialogId +
		'" role="dialog" aria-modal="true" aria-labelledby="' +
		headingId +
		'" hidden>\n' +
		'<h2 class="os-help-heading" id="' +
		headingId +
		'">' +
		escapeHtml(title) +
		' - Help</h2>\n' +
		'<p class="os-help-body">' +
		escapeHtml(help) +
		'</p>\n' +
		'<p class="os-help-close"><button type="button" data-help-close>Close</button></p>\n' +
		'</div>'
	)
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

export function renderAppSection(def: AppDefinition, state: AppState, appBasePath: string, packageRef?: string): string {
	var bundleHtml: string
	try {
		bundleHtml = renderBundleContent(def, appBasePath + '/apps/' + def.id, packageRef)
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
	var actions = def.ui.actions || []
	var forms = actions
		.map(function (entry): string {
			return (
				'<form class="app-action" method="GET" action="' +
				escapeHtml(appBasePath + '/apps/' + def.id) +
				'">' +
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
	closeHref?: string,
	expandHref?: string,
	packageRef?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, packageRef)
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
	// On an app page the shell titlebar is the only header (withHeader=false),
	// so the shell chrome owns the help box and dialog; the panel renders the
	// help box only when it draws a header itself (modal overlays).
	var helpBtn = withHeader !== false && helpTextFor(def) !== undefined ? renderHelpButton(def.id) : ''
	var header =
		withHeader === false
			? ''
			: '<h2 class="app-titlebar' + (closeBtn !== '' ? ' has-close' : '') + (expandBtn !== '' ? ' has-expand' : '') + (helpBtn !== '' ? ' has-help' : '') + '">' + closeBtn + '<span class="app-title-plate"><span class="app-title-text">' + title + '</span></span>' + helpBtn + expandBtn + '</h2>\n'
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
 *
 * When the app defines help, the `[?]` box joins the panel titlebar and the
 * help dialog is rendered as this section's second element, right after the
 * overlay. The dialog opens via the shell client with no URL change, so
 * opening help leaves the overlay (and any expanded layout) exactly as it
 * was; closing help returns focus to the opener, never navigating.
 */
export function renderOverlaySection(def: AppDefinition, state: AppState, appBasePath: string, packageRef?: string): string {
	var panel = renderAppPanel(def, state, appBasePath, '', '', undefined, undefined, '#apps', appBasePath + '/apps/' + def.id, packageRef)
	var overlay =
		'<div class="overlay" id="app-' +
		escapeHtml(def.id) +
		'" aria-label="' +
		escapeHtml(def.ui.title || def.name) +
		'">\n' +
		'<div class="overlay-panel">\n' +
		panel +
		'\n</div>\n</div>'
	var help = helpTextFor(def)
	if (help === undefined) return overlay
	return overlay + '\n' + renderHelpDialog(def.id, def.ui.title || def.name, help)
}

/** True when the app's default open mode is the modal overlay (fragment link + inline section). */
export function isModalApp(app: AppSummary): boolean {
	return app.openAs === 'modal'
}

/** Inline SVG icons were sanitized at validation; detect the stored variant. */
function looksLikeSvg(value: string): boolean {
	return value.replace(/^\s+/, '').toLowerCase().indexOf('<svg') === 0
}

// Mirrors definition.ts ICON_REFERENCE_RE (kept local: this file allows zero
// runtime imports). If the canonical regex changes, update both.
var ICON_REFERENCE_RE = /^(kody|lucide):[a-z0-9-]+$/

function isIconReference(value: string): boolean {
	return ICON_REFERENCE_RE.test(value.trim())
}

function renderTileIcon(rawIcon: string): string {
	if (looksLikeSvg(rawIcon)) return rawIcon
	if (isIconReference(rawIcon)) {
		return '<os-icon name="' + escapeHtml(rawIcon.trim()) + '"></os-icon>'
	}
	return escapeHtml(rawIcon)
}

function tileItem(app: AppSummary, appBasePath: string, wide?: boolean): string {
	var label = escapeHtml(app.label)
	var rawIcon = app.icon || '#'
	var icon = renderTileIcon(rawIcon)
	var description = typeof app.description === 'string' ? app.description : ''
	var titleAttr = ' title="' + escapeHtml(description) + '"'
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
		escapeHtml(isModalApp(app) ? appBasePath + '/apps/' + app.id + '?touch=1' : appBasePath + '/apps/' + app.id) +
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

/** Edit toggle icon from the shared kody registry. Zero network calls:
 * `<os-icon name="kody:…">` resolves synchronously from the bundled
 * `pkg/icons/` map. Strokes follow the button's text color via
 * `currentColor`, so the icon inverts with the pressed state. */
function editToggleIcon(param: string): string {
	if (param === 'pin') {
		return '<os-icon name="kody:pin"></os-icon>'
	}
	if (param === 'hide') {
		return '<os-icon name="kody:eye-off"></os-icon>'
	}
	return '<os-icon name="kody:home"></os-icon>'
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
		var icon = renderTileIcon(rawIcon)
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
					escapeHtml(appBasePath + '/apps/' + app.id) +
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
	packageRef?: string,
): string {
	var title = escapeHtml(def.ui.title || def.name)
	var content = renderAppSection(def, state, appBasePath, packageRef)
	var errHtml = error ? '<p role="alert">Error: ' + escapeHtml(error) + '</p>\n' : ''
	var upDisabled = index <= 0 ? ' disabled' : ''
	var downDisabled = index >= total - 1 ? ' disabled' : ''
	return (
		'<section class="widget" data-app-id="' +
		escapeHtml(def.id) +
		'" aria-label="' +
		title +
		'">\n' +
		'<h2 class="app-titlebar"><span class="app-title-plate"><span class="app-title-text">' +
		title +
		'</span></span><a class="widget-expand" href="' +
		escapeHtml(appBasePath + '/apps/' + def.id) +
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
/**
 * The full package reference for agent prompts: @owner/leaf. The owner
 * is the subdomain of the Kody host (hypercubed in hypercubed.kody.run);
 * the leaf is the mount (the first path segment of the base path). On a
 * non-Kody host (local mock, localhost) there is no owner, so the bare
 * leaf is the reference. Mirrors the Store bundle's storePackageSlug.
 */
export function packageRefForHost(host: string, appBasePath: string): string {
	var leaf = 'kody-os'
	if (appBasePath) {
		var base = appBasePath.charAt(0) === '/' ? appBasePath.slice(1) : appBasePath
		var slash = base.indexOf('/')
		var first = slash === -1 ? base : base.slice(0, slash)
		if (first) { leaf = first }
	}
	var suffix = '.kody.run'
	if (host && host.length > suffix.length && host.slice(host.length - suffix.length) === suffix) {
		var owner = host.slice(0, host.length - suffix.length)
		if (owner) { return '@' + owner + '/' + leaf }
	}
	return leaf
}

export function renderEmptyHelp(appBasePath: string, opts?: { omitClosing?: boolean; packageRef?: string }): string {
	// The full @owner/leaf reference when the caller supplies it (the
	// shell derives it from the request host + mount); otherwise the
	// bare leaf from the mount, as before.
	var slug = 'kody-os'
	if (opts && typeof opts.packageRef === 'string' && opts.packageRef !== '') {
		slug = opts.packageRef
	} else if (appBasePath) {
		var base = appBasePath.charAt(0) === '/' ? appBasePath.slice(1) : appBasePath
		var slash = base.indexOf('/')
		var first = slash === -1 ? base : base.slice(0, slash)
		if (first) { slug = first }
	}
	var ops = 'Read package:' + slug + '#OPERATIONS.md'
	var block =
		'<p>No apps installed yet. This shell starts empty \u2014 nothing is installed until you add it. Pick a path below. Copy a prompt into a Kody-connected agent.</p>\n' +
		'<h3>Add your own apps</h3>\n' +
		'<p class="gate-hint"><code>' + ops + ', then add a new app: Name: [display name]; What it does: [describe what it should do]</code></p>\n' +
		'<h3>Remove an app</h3>\n' +
		'<p class="gate-hint"><code>' + ops + ', then remove this app: [app id]</code></p>\n' +
		'<h3>Install the App Catalog</h3>\n' +
		'<p class="gate-hint"><code>' + ops + ', then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store</code></p>\n'
	if (opts && opts.omitClosing === true) return block
	return block + '<p>Once an app is installed your apps show up on the Apps page.</p>'
}

/**
 * Render the widget dashboard grid. An empty homepage list renders one of
 * two honest empty states: the shared empty help block when no apps
 * are installed at all, or a short Add-to-home message when apps are
 * installed but none are on Home.
 */
export function renderDashboard(widgets: string[], appBasePath: string, hasApps: boolean, packageRef?: string): string {
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
			renderEmptyHelp(appBasePath, packageRef ? { packageRef: packageRef } : undefined) +
			'\n</section>'
		)
	}
	return '<div class="widgets" role="list">\n' + widgets.join('\n') + '\n</div>'
}
