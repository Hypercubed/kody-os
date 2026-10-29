// Local preview server for kody-os: runs the real pkg/src/app.ts fetch handler
// under plain node:http with the kody:runtime virtual module stubbed out.
// Repo-local (not part of the published pkg/): safe to use in any checkout.
//
// Usage (from the repo root):
//   node --import ./dev/register.mjs --experimental-strip-types dev/preview.mjs
//
// Env (all optional):
//   PORT              listen port (default 4499)
//   HOST              listen host (default 127.0.0.1)
//   KODYOS_CODE       gate code (default previewcodeabcdefghjk; readable on
//                     purpose so curl checks are repeatable — never use a real
//                     code here; the package never logs the raw code)
//   PREVIEW_CODE_FILE where to write the code (default /tmp/kodyos-preview-code.txt)
//
// Behavior mirrors the hosted app: seeds counter plus every
// pkg/examples/*.json, serves pkg/public/styles.css and a type-stripped
// pkg/src/client/index.ts, and forwards everything else into app.fetch().
// Storage is in-memory: each restart wipes pins and states, so re-pin after
// respawning. Requires Node 22+ (stripTypeScriptTypes, getSetCookie).
import http from 'node:http'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

var ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
var PKG = path.join(ROOT, 'pkg')
var PORT = Number(process.env.PORT || 4499)
var HOST = process.env.HOST || '127.0.0.1'
var CODE_FILE = process.env.PREVIEW_CODE_FILE || '/tmp/kodyos-preview-code.txt'

var { default: app } = await import(path.join(PKG, 'src/app.ts'))
var { add_app, counterDefinition } = await import(path.join(PKG, 'src/apps/index.ts'))
var { hashCode, ACCESS_HASH_KEY, normalizeCode } = await import(path.join(PKG, 'src/auth.ts'))
var { resolveStore } = await import(path.join(PKG, 'src/apps/storage.ts'))

await add_app(counterDefinition()).catch(function () {})
// Preview-only seed: install pkg/examples definitions verbatim so they show up
// in the local preview exactly as they would after a hosted add. Reads every
// pkg/examples/*.json; a missing file or bad JSON is skipped.
async function seedFile(file) {
	try {
		var staged = JSON.parse(await readFile(file, 'utf8'))
		if (staged && typeof staged.id === 'string') await add_app(staged).catch(function () {})
	} catch (err) {}
}
try {
	var dir = await readdir(path.join(PKG, 'examples'))
	for (var f of dir.filter(function (n) { return n.endsWith('.json') })) {
		await seedFile(path.join(PKG, 'examples', f))
	}
} catch (err) {}

// Local preview only: a fixed, readable code so curl checks are repeatable.
// The real package never logs or stores the raw code (only its SHA-256 hash).
var previewCode = normalizeCode(process.env.KODYOS_CODE || 'previewcodeabcdefghjk')
var previewStore = await resolveStore()
await previewStore.set(ACCESS_HASH_KEY, await hashCode(previewCode))
await writeFile(CODE_FILE, previewCode + '\n')
console.log('preview access code:', previewCode)

var server = http.createServer(async function (req, res) {
	try {
		var pathname = new URL(req.url || '/', 'http://localhost').pathname
		if (pathname === '/styles.css') {
			var css = await readFile(path.join(PKG, 'public/styles.css'))
			res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' })
			res.end(css)
			return
		}
		// Preview-only clientModuleUrl wiring: Kody hosting builds/serves the
		// client entry and injects its URL. Locally there is no kody:runtime,
		// so serve a type-stripped build of src/client/index.ts here and
		// inject the script tag the shell omits when the URL is empty.
		if (pathname === '/client.js') {
			var ts = await readFile(path.join(PKG, 'src/client/index.ts'), 'utf8')
			var js = stripTypeScriptTypes(ts)
			res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
			res.end(js)
			return
		}
		var chunks = []
		for await (var chunk of req) chunks.push(chunk)
		var headers = {}
		for (var pair of Object.entries(req.headers)) {
			if (typeof pair[1] === 'string') headers[pair[0]] = pair[1]
			else if (Array.isArray(pair[1])) headers[pair[0]] = pair[1].join(', ')
		}
		var request = new Request('http://' + HOST + ':' + String(PORT) + req.url, {
			method: req.method,
			headers: headers,
			body: chunks.length ? Buffer.concat(chunks) : undefined,
		})
		var response = await app.fetch(request)
		var out = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
		var location = response.headers.get('location')
		if (location) out.Location = location
		var referrer = response.headers.get('referrer-policy')
		if (referrer) out['Referrer-Policy'] = referrer
		var nosniff = response.headers.get('x-content-type-options')
		if (nosniff) out['X-Content-Type-Options'] = nosniff
		var csp = response.headers.get('content-security-policy')
		if (csp) out['Content-Security-Policy'] = csp
		var setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : []
		if (setCookie.length) out['Set-Cookie'] = setCookie
		var html = await response.text()
		html = html.replaceAll('/_assets/styles.css', '/styles.css')
		if (html.indexOf('data-client-module=""') !== -1) {
			html = html.replace('data-client-module=""', 'data-client-module="/client.js"')
		}
		if (html.indexOf('</body>') !== -1 && html.indexOf('/client.js"></script>') === -1) {
			html = html.replace('</body>', '\n<script type="module" src="/client.js"></script>\n</body>')
		}
		res.writeHead(response.status, out)
		res.end(html)
	} catch (error) {
		res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
		res.end('Preview error: ' + error.message)
	}
})

server.listen(PORT, HOST, function () { console.log('dynamic preview on ' + HOST + ':' + String(PORT)) })
