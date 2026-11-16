/**
 * SVG Icons & <os-icon> Harness.
 *
 * Run with bun or node from repo root:
 *   bun tests/svg-icons-harness.ts
 *   node --experimental-strip-types tests/svg-icons-harness.ts
 *
 * Covers:
 *   1. definition.icon validation (kody:*, lucide:*, inline SVG, glyphs, rejection of invalid references)
 *   2. Tile rendering (tileItem) rendering <os-icon> for references, SVG for inline, escaped glyphs
 *   3. GET /icons/<name>.svg routing (200 with SVG Content-Type and Cache-Control, 404 on missing or invalid name)
 *   4. <os-icon> custom element behavior in DOM:
 *      - kody:* prefix resolution from local registry
 *      - lucide:* prefix resolution via CDN fetch
 *      - In-memory & localStorage caching
 *      - Request deduplication
 *      - SVG allowlist sanitization of fetched bodies
 *      - Accessibility: aria-hidden="true" when no label, role="img" + aria-label when label present
 *      - Offline/failure degradation without throw
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { validateDefinition, canonicalizeDefinition, isIconReference, sanitizeSvgIcon as beSanitizeSvgIcon } from '../pkg/src/apps/definition.ts'
import { ICONS, getIcon } from '../pkg/src/icons-registry.ts'
import { ICONS as CLIENT_ICONS } from '../pkg/src/client/icons-data.ts'
import { isIconReference as registryIsIconReference } from '../pkg/src/apps/registry.ts'

var __dirname = dirname(fileURLToPath(import.meta.url))

// Provide temporary icon in both BE registry and client mirror (os-icon reads the client mirror)
var testSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><title>Test Probe</title><circle cx="12" cy="12" r="9"/></svg>'
var testIcons = ICONS as Record<string, string>
testIcons['test-probe'] = testSvg
;(CLIENT_ICONS as Record<string, string>)['test-probe'] = testSvg

var failures: string[] = []

function check(msg: string, pass: boolean, detail?: string) {
	if (pass) {
		console.log('PASS ' + msg)
	} else {
		console.log('FAIL ' + msg + (detail ? ' — ' + detail : ''))
		failures.push(msg)
	}
}

// 1. definition.icon reference validation
check('isIconReference accepts kody:probe', isIconReference('kody:probe') === true)
check('isIconReference accepts lucide:compass', isIconReference('lucide:compass') === true)
check('isIconReference rejects missing prefix', isIconReference('compass') === false)
check('isIconReference rejects invalid prefix', isIconReference('other:compass') === false)
check('isIconReference rejects uppercase', isIconReference('lucide:Compass') === false)
check('isIconReference rejects underscore', isIconReference('lucide:arrow_right') === false)
check('isIconReference rejects empty name', isIconReference('lucide:') === false)

var baseDef = {
	id: 'test-app',
	name: 'Test App',
	schemaVersion: 5,
	category: 'utilities',
	description: 'Test app for icon verification',
	bundle: {
		entry: 'index.html',
		files: {
			'index.html': '<div>test</div>',
		},
	},
	ui: {
		title: 'Test App',
		openAs: 'page' as const,
		actions: [],
	},
	stateSchema: {
		type: 'object' as const,
		initial: {},
		fields: {},
	},
	actions: {},
}

var kodyDef = Object.assign({}, baseDef, { icon: 'kody:test-probe' })
check('kody:test-probe definition validates', validateDefinition(kodyDef) === null, String(validateDefinition(kodyDef)))

var lucideDef = Object.assign({}, baseDef, { icon: 'lucide:compass' })
check('lucide:compass definition validates', validateDefinition(lucideDef) === null, String(validateDefinition(lucideDef)))

var glyphDef = Object.assign({}, baseDef, { icon: '⊞' })
check('glyph definition validates', validateDefinition(glyphDef) === null, String(validateDefinition(glyphDef)))

var svgDef = Object.assign({}, baseDef, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>' })
check('inline SVG definition validates', validateDefinition(svgDef) === null, String(validateDefinition(svgDef)))

var badRefDef = Object.assign({}, baseDef, { icon: 'kody:Invalid_Name!' })
check('invalid icon reference fails validation', validateDefinition(badRefDef) !== null)

var badHostileSvg = Object.assign({}, baseDef, { icon: '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>' })
check('hostile inline SVG fails validation', validateDefinition(badHostileSvg) !== null)

// Canonicalize preserves reference
var canonLucide = canonicalizeDefinition(lucideDef as any)
check('canonicalizeDefinition preserves icon reference', canonLucide.icon === 'lucide:compass')

// 2. Tile item rendering in render.ts
var renderMod = await import('../pkg/src/apps/render.ts')
var appLucide = { id: 'test-lucide', name: 'Lucide App', label: 'Lucide App', icon: 'lucide:compass', schemaVersion: 5, openAs: 'page' as const, menuBar: false }
var appKody = { id: 'test-kody', name: 'Kody App', label: 'Kody App', icon: 'kody:test-probe', schemaVersion: 5, openAs: 'page' as const, menuBar: false }
var appGlyph = { id: 'test-glyph', name: 'Glyph App', label: 'Glyph App', icon: '⊞', schemaVersion: 5, openAs: 'page' as const, menuBar: false }
var appSvg = { id: 'test-svg', name: 'SVG App', label: 'SVG App', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>', schemaVersion: 5, openAs: 'page' as const, menuBar: false }

var pinnedHtml = renderMod.renderPinnedSection([appLucide, appKody, appGlyph, appSvg], '/test-base')
check('pinned section renders <os-icon name="lucide:compass">', pinnedHtml.indexOf('<os-icon name="lucide:compass"></os-icon>') !== -1)
check('pinned section renders <os-icon name="kody:test-probe">', pinnedHtml.indexOf('<os-icon name="kody:test-probe"></os-icon>') !== -1)
check('pinned section renders glyph ⊞', pinnedHtml.indexOf('⊞') !== -1)
check('pinned section renders inline SVG', pinnedHtml.indexOf('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>') !== -1)

// 3. GET /icons/<name>.svg dispatch in app.ts
var appEntry = (await import('../pkg/src/app.ts')).default

var validReq = new Request('http://127.0.0.1:4302/icons/test-probe.svg')
var validRes = await appEntry.fetch(validReq)
check('GET /icons/test-probe.svg returns 200', validRes.status === 200)
check('GET /icons/test-probe.svg Content-Type is image/svg+xml', (validRes.headers.get('Content-Type') || '').indexOf('image/svg+xml') === 0)
check('GET /icons/test-probe.svg Cache-Control is public cache', (validRes.headers.get('Cache-Control') || '').indexOf('public') !== -1)
var validBody = await validRes.text()
check('GET /icons/test-probe.svg body matches SVG markup', validBody.indexOf('<svg') === 0)

var missingReq = new Request('http://127.0.0.1:4302/icons/non-existent.svg')
var missingRes = await appEntry.fetch(missingReq)
check('GET /icons/non-existent.svg returns 404', missingRes.status === 404)

var invalidReq = new Request('http://127.0.0.1:4302/icons/invalid_name!.svg')
var invalidRes = await appEntry.fetch(invalidReq)
check('GET /icons/invalid_name!.svg returns 404', invalidRes.status === 404)

// 4. <os-icon> custom element behavior with JSDOM (Node-only: jsdom 31's
// custom-element upgrade path crashes under Bun's tryImplForWrapper, same as
// catalog/tests/app-store-tests.cjs which is also Node-only. Under Bun the
// validation/tile/route checks above still run; DOM checks run under Node.
var isBun = typeof (globalThis as any).Bun !== 'undefined'
if (isBun) {
	console.log('SKIP <os-icon> DOM checks under Bun (jsdom 31 incompatible) — run node --experimental-strip-types tests/svg-icons-harness.ts for full coverage')
	if (failures.length > 0) {
		console.log('\n' + failures.length + ' check(s) FAILED')
		process.exit(1)
	}
	console.log('\nALL SVG ICON HARNESS CHECKS PASSED (non-DOM subset under Bun)')
	process.exit(0)
}
var req = createRequire(import.meta.url)
var JSDOM: any
try {
	JSDOM = req('jsdom').JSDOM
} catch (e) {
	var fallback = process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom'
	JSDOM = req(fallback).JSDOM
}

var dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
	runScripts: 'outside-only',
	url: 'http://localhost/',
})

// Load vendored Lit for dom without dom.window.eval (jsdom 31 + Bun crashes
// in tryImplForWrapper during window.eval). Install jsdom globals, evaluate
// lit.js in this context via node:vm, then hand KodyLit to the dom window.
var litSource = readFileSync(join(__dirname, '..', 'pkg', 'public', 'lit.js'), 'utf8')
var g = globalThis as any
g.window = dom.window
g.document = dom.window.document
g.HTMLElement = dom.window.HTMLElement
g.customElements = dom.window.customElements
g.Node = dom.window.Node
g.Event = dom.window.Event
g.MutationObserver = dom.window.MutationObserver
g.DOMParser = dom.window.DOMParser
g.XMLSerializer = dom.window.XMLSerializer
g.fetch = dom.window.fetch
var vmMod = await import('node:vm')
vmMod.runInThisContext(litSource + '\n;globalThis.__KodyLitTmp = KodyLit;', { filename: 'lit.js' })
var KodyLit = g.__KodyLitTmp
if (!KodyLit && typeof g.KodyLit !== 'undefined') KodyLit = g.KodyLit
dom.window.KodyLit = KodyLit
g.KodyLit = KodyLit
delete g.__KodyLitTmp

dom.window.localStorage.clear()

// Wire fetch mock in dom
var fetchedUrls: string[] = []
dom.window.fetch = (async function (url: string) {
	var sUrl = String(url)
	fetchedUrls.push(sUrl)
	if (sUrl.indexOf('lucide.json?icons=compass') !== -1) {
		return {
			ok: true,
			json: async function () {
				return {
					prefix: 'lucide',
					icons: {
						compass: {
							body: '<g fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/></g>',
							width: 24,
							height: 24,
						},
					},
				}
			},
		}
	}
	if (sUrl.indexOf('icons=hostile') !== -1) {
		return {
			ok: true,
			json: async function () {
				return {
					prefix: 'lucide',
					icons: {
						hostile: {
							body: '<script>alert(1)</script><circle cx="12" cy="12" r="10"/>',
							width: 24,
							height: 24,
						},
					},
				}
			},
		}
	}
	return { ok: false, status: 404 }
}) as any

// Setup global window and fetch for os-icon
var originalWindow = globalThis.window
var originalFetch = globalThis.fetch
globalThis.window = dom.window as any
globalThis.fetch = dom.window.fetch as any

var { defineOsIcon } = await import('../pkg/src/client/os-icon.ts')
defineOsIcon(KodyLit)

// Test kody: lookup synchronously
var container = dom.window.document.getElementById('container')!
container.innerHTML = '<os-icon name="kody:test-probe"></os-icon>'
var kodyEl = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 20) })
check('<os-icon name="kody:test-probe"> renders SVG', kodyEl.innerHTML.indexOf('<svg') !== -1)
check('<os-icon> sets aria-hidden="true" when no label', kodyEl.getAttribute('aria-hidden') === 'true')
check('<os-icon> has no role="img" when no label', kodyEl.getAttribute('role') === null)

// Test label accessibility
container.innerHTML = '<os-icon name="kody:test-probe" label="Probe Icon"></os-icon>'
var labelEl = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 20) })
check('<os-icon label="..."> sets role="img"', labelEl.getAttribute('role') === 'img')
check('<os-icon label="..."> sets aria-label', labelEl.getAttribute('aria-label') === 'Probe Icon')
check('<os-icon label="..."> removes aria-hidden', labelEl.getAttribute('aria-hidden') === null)

// Test lucide CDN fetch & caching
fetchedUrls = []
container.innerHTML = '<os-icon name="lucide:compass"></os-icon>'
var lucideEl = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 50) })
check('<os-icon name="lucide:compass"> fetches and renders SVG', lucideEl.innerHTML.indexOf('<circle') !== -1)
check('lucide:compass fetch was called', fetchedUrls.length === 1)
check('localStorage cached the icon', dom.window.localStorage.getItem('os-icon:lucide:compass') !== null)

// Second render should use memory/localStorage cache with zero new fetches
var fetchCountBefore = fetchedUrls.length
container.innerHTML = '<os-icon name="lucide:compass"></os-icon>'
await new Promise(function (r) { setTimeout(r, 30) })
check('Cached lucide:compass makes zero network calls', fetchedUrls.length === fetchCountBefore)

// Shared BE/client sanitizer parity fixtures (WARNING 3): both implementations
// must agree on accept/reject. BE is the tokenizer in definition.ts, client is
// the DOM mirror in icon-sanitize.ts (same allowlist, same monochrome rule).
var parityFixtures: Array<{ name: string; svg: string; expectOk: boolean }> = [
	{ name: 'valid probe', svg: testSvg, expectOk: true },
	{ name: 'script rejected', svg: '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>', expectOk: false },
	{ name: 'use rejected', svg: '<svg viewBox="0 0 24 24"><use href="#x"/></svg>', expectOk: false },
	{ name: 'onload rejected', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" onload="alert(1)"/></svg>', expectOk: false },
	{ name: 'color fill rejected', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="red"/></svg>', expectOk: false },
	{ name: 'comment rejected', svg: '<svg viewBox="0 0 24 24"><!-- hi --><circle cx="12" cy="12" r="9"/></svg>', expectOk: false },
]
var clientSanitizeMod = await import('../pkg/src/client/icon-sanitize.ts')
for (var fixture of parityFixtures) {
	var beRes = beSanitizeSvgIcon(fixture.svg)
	var clientRes = clientSanitizeMod.sanitizeSvgIcon(fixture.svg)
	check('sanitizer parity [' + fixture.name + '] BE=' + (beRes.ok ? 'ok' : 'reject'), beRes.ok === fixture.expectOk)
	check('sanitizer parity [' + fixture.name + '] client=' + (clientRes.ok ? 'ok' : 'reject'), clientRes.ok === fixture.expectOk)
	check('sanitizer parity [' + fixture.name + '] BE agrees with client', beRes.ok === clientRes.ok)
}

// Test hostile SVG sanitization
container.innerHTML = '<os-icon name="lucide:hostile"></os-icon>'
var hostileEl = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 50) })
check('Hostile fetched SVG is sanitized and rejected', hostileEl.innerHTML.indexOf('<script') === -1 && hostileEl.innerHTML === '')

// Unprefixed name resolution (design Decision 2): kody-first, lucide fallback
container.innerHTML = '<os-icon name="test-probe"></os-icon>'
var unprefixedLocal = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 20) })
check('Unprefixed <name> resolves kody: first', unprefixedLocal.innerHTML.indexOf('<svg') !== -1)

// Offline / unknown icon degrades without throw or layout shift
container.innerHTML = '<os-icon name="lucide:does-not-exist-xyz"></os-icon>'
var unknownEl = container.firstElementChild as HTMLElement
await new Promise(function (r) { setTimeout(r, 50) })
check('Unknown lucide icon degrades to empty placeholder', unknownEl.innerHTML === '')
check('Registry re-export of isIconReference matches definition', registryIsIconReference('kody:probe') === isIconReference('kody:probe'))

// Clean up test global
globalThis.window = originalWindow
globalThis.fetch = originalFetch
delete (testIcons as Record<string, unknown>)['test-probe']
delete ((CLIENT_ICONS as unknown) as Record<string, unknown>)['test-probe']

if (failures.length > 0) {
	console.log('\n' + failures.length + ' check(s) FAILED')
	process.exit(1)
}
console.log('\nALL SVG ICON HARNESS CHECKS PASSED')
