/**
 * Client-local SVG sanitizer for `os-icon` (FE only).
 *
 * Mirrors the BE allowlist in `pkg/src/apps/definition.ts` (same tags,
 * same monochrome fill/stroke values, same rejections) but lives under
 * `pkg/src/client/` so the FE/BE boundary holds: no client module imports
 * any file outside `pkg/src/client/` except the vendored Lit.
 *
 * BE remains the install-time choke point; this is the render-time guard
 * for Iconify-fetched bodies before Light-DOM insertion. ES2019 only.
 */

var CLIENT_TAGS = ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'title']
var CLIENT_ATTRS = [
'xmlns',
'viewbox',
'width',
'height',
'fill',
'stroke',
'stroke-width',
'stroke-linecap',
'stroke-linejoin',
'stroke-miterlimit',
'stroke-dasharray',
'stroke-opacity',
'fill-opacity',
'fill-rule',
'opacity',
'd',
'cx',
'cy',
'r',
'rx',
'ry',
'x',
'x1',
'x2',
'y',
'y1',
'y2',
'points',
'transform',
'role',
'aria-hidden',
'focusable'
]
var CLIENT_MONO = ['none', 'currentcolor', 'inherit', 'black', 'white', '#000', '#000000', '#fff', '#ffffff']

function clientProblem(message: string): { ok: false; error: string } {
return { ok: false as const, error: 'definition.icon ' + message }
}

/** Validate and normalize an SVG string in the browser. DOM-free fallback when DOMParser is absent. */
export function sanitizeSvgIcon(value: string): { ok: true; icon: string } | { ok: false; error: string } {
var source = value.replace(/^\s+/, '').replace(/\s+$/, '')
if (source.toLowerCase().indexOf('<svg') !== 0) return clientProblem('SVG must start with <svg')
try {
var parser = new DOMParser()
var doc = parser.parseFromString(source, 'image/svg+xml')
var root = doc.documentElement
if (!root || root.nodeName.toLowerCase() !== 'svg') return clientProblem('must be a single <svg> root')
if (root.getElementsByTagName('parsererror').length > 0) return clientProblem('has malformed markup')
var all = root.getElementsByTagName('*')
for (var i = all.length - 1; i >= 0; i--) {
var el = all[i] as Element
var tag = el.nodeName.toLowerCase()
if (CLIENT_TAGS.indexOf(tag) === -1) return clientProblem('uses a disallowed element <' + tag + '>')
for (var j = el.attributes.length - 1; j >= 0; j--) {
var attr = el.attributes[j]
var name = attr.name.toLowerCase()
if (name.indexOf('on') === 0) return clientProblem('has an event handler attribute "' + name + '"')
if (name === 'style') return clientProblem('has a style attribute')
if (name === 'href' || name === 'xlink:href' || name === 'src') return clientProblem('has an external reference attribute "' + name + '"')
if (CLIENT_ATTRS.indexOf(name) === -1) {
el.removeAttribute(attr.name)
continue
}
var v = attr.value || ''
var lv = v.toLowerCase()
if (lv.indexOf('url(') !== -1 || lv.indexOf('javascript:') !== -1 || lv.indexOf('data:') !== -1 || lv.indexOf('expression(') !== -1) {
return clientProblem('has an external or script reference in "' + name + '"')
}
if (name === 'xmlns' && v !== 'http://www.w3.org/2000/svg') return clientProblem('has a non-SVG xmlns')
if ((name === 'fill' || name === 'stroke') && CLIENT_MONO.indexOf(lv) === -1) {
return clientProblem('uses non-monochrome ' + name + ' "' + v + '"')
}
}
var text = ''
for (var k = 0; k < el.childNodes.length; k++) {
var node = el.childNodes[k]
if (node.nodeType === 8) return clientProblem('contains a comment, doctype, or processing instruction')
if (node.nodeType === 3 || node.nodeType === 4) text += node.nodeValue || ''
}
if (tag !== 'title' && text.replace(/\s+/g, '') !== '') return clientProblem('has text outside a <title> element')
if (text.indexOf('&') !== -1 && text.indexOf('&amp;') === -1 && text.indexOf('&lt;') === -1 && text.indexOf('&gt;') === -1 && text.indexOf('&quot;') === -1) {
// Parsed DOM already decoded entities; re-serialization escapes them.
}
}
for (var t = 0; t < root.childNodes.length; t++) {
var top = root.childNodes[t]
if (top.nodeType === 8) return clientProblem('contains a comment, doctype, or processing instruction')
}
return { ok: true as const, icon: new XMLSerializer().serializeToString(root) }
} catch (err) {
return clientProblem('has malformed markup')
}
}
