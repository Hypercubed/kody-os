/* Send Link DOM wiring test (spec tasks 3.4 and 4.3 logic, Node stub).
 * Run with node:
 *   node send-link-wip/send-link-dom-tests.cjs
 * Stubs only the DOM surface the bundle uses: getElementById,
 * querySelectorAll for the seed script, querySelector, readyState,
 * addEventListener, and element style/textContent/innerHTML/
 * setAttribute/className, plus a parent appendChild recorder.
 * Proves: empty list shows the install block with a bookmarklet
 * targeting the page's own base; a two-entry list renders
 * most-recent-first with an http anchor and a javascript: entry
 * as plain text with no anchor; a non-JSON entry renders as text;
 * and a non-empty list moves the install block below the list. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' -- ' + detail));
  if (!ok) { failures.push(name); }
}

function findBundle() {
  var candidates = [
    path.join(__dirname, 'send-link.bundle.json'),
    path.join(__dirname, '..', 'send-link.bundle.json'),
    path.join(__dirname, '..', 'pkg', 'catalog', 'send-link.bundle.json')
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) { return candidates[i]; }
  }
  return candidates[0];
}

var def = JSON.parse(fs.readFileSync(findBundle(), 'utf8'));
var html = def.bundle.files['index.html'];
var script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

function makeEl() {
  return {
    style: {}, textContent: '', innerHTML: '', className: '', href: '',
    attrs: {},
    setAttribute: function (k, v) { this.attrs[k] = v; },
    getAttribute: function (k) { return this.attrs[k] || null; },
    addEventListener: function () {},
    parentNode: null
  };
}

function runWithLinks(links) {
  var parent = { moved: [], appendChild: function (el) { this.moved.push(el); } };
  var els = {};
  ['sl-install', 'sl-list', 'sl-note', 'sl-bookmarklet', 'sl-clear-form'].forEach(function (id) {
    els[id] = makeEl();
    els[id].parentNode = parent;
  });
  var doc = {
    readyState: 'complete',
    getElementById: function (id) { return els[id] || null; },
    querySelectorAll: function (sel) {
      if (sel.indexOf('data-kody-state-seed') !== -1) {
        return [{ textContent: JSON.stringify({ links: links }) }];
      }
      return [];
    },
    querySelector: function () { return null; },
    addEventListener: function () {},
    currentScript: null
  };
  var ctx = { document: doc, window: { location: { pathname: '/kody-os/apps/send-link', origin: 'http://127.0.0.1:4302' } }, console: console };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return { els: els, parent: parent };
}

var empty = runWithLinks([]);
check('empty: list hidden, install shown, bookmarklet absolute, clear form absolute',
  empty.els['sl-list'].style.display === 'none' &&
  empty.els['sl-install'].style.display === '' &&
  empty.els['sl-bookmarklet'].attrs.href &&
  empty.els['sl-bookmarklet'].attrs.href.indexOf('http://127.0.0.1:4302/kody-os/apps/send-link?action=send&entry=') !== -1 &&
  empty.els['sl-clear-form'].attrs.action === 'http://127.0.0.1:4302/kody-os/apps/send-link?action=clear' &&
  html.indexOf('sl-code') === -1 && html.indexOf('Or copy this code') === -1,
  JSON.stringify({ list: empty.els['sl-list'].style.display, href: empty.els['sl-bookmarklet'].attrs.href, clear: empty.els['sl-clear-form'].attrs.action }));

var two = runWithLinks([
  JSON.stringify({ t: '2026-11-03T10:00:00.000Z', title: 'Oldest', url: 'https://example.com/old' }),
  JSON.stringify({ t: '2026-11-04T10:00:00.000Z', title: 'Newest', url: 'https://example.com/new' })
]);
var twoHtml = two.els['sl-list'].innerHTML;
check('two entries render most-recent-first, one line name - date, no url/time divs',
  two.els['sl-list'].style.display === '' && twoHtml.indexOf('Newest') !== -1 &&
  twoHtml.indexOf('Newest') < twoHtml.indexOf('Oldest') &&
  twoHtml.indexOf('<a href="https://example.com/new">Newest</a> - ') !== -1 &&
  twoHtml.indexOf('sl-url') === -1 && twoHtml.indexOf('sl-time') === -1,
  twoHtml);

var bad = runWithLinks([
  JSON.stringify({ t: '2026-11-04T10:00:00.000Z', title: 'Evil', url: 'javascript:alert(1)' }),
  'plain text entry, not json'
]);
var badHtml = bad.els['sl-list'].innerHTML;
check('javascript: entry has no anchor, plain entry renders as text',
  badHtml.indexOf('<a href="javascript:') === -1 &&
  badHtml.indexOf('Evil') !== -1 &&
  badHtml.indexOf('plain text entry, not json') !== -1,
  badHtml);
check('non-empty list moves install block below list',
  bad.parent.moved.indexOf(bad.els['sl-install']) !== -1,
  JSON.stringify(bad.parent.moved.length));

if (failures.length > 0) { console.log('FAILURES: ' + failures.length); process.exit(1); }
console.log('ALL SEND-LINK DOM CHECKS PASSED');
