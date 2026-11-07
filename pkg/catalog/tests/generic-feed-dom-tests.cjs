/* Generic Feed DOM wiring test (mock-preview logic, Node stub).
 * Run with node from the repo root:
 *   node pkg/catalog/tests/generic-feed-dom-tests.cjs
 * Stubs only the DOM surface the bundle uses: getElementById,
 * querySelectorAll for the seed script, querySelector, readyState,
 * addEventListener, and element style/textContent/innerHTML.
 * Proves: empty feed shows the prompt, a two-entry feed shows
 * the viewer on the newest entry with "2 of 2", Previous steps
 * to "1 of 2", and a stored-but-unparseable feed shows the
 * prompt plus the could-not-be-read note. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' -- ' + detail));
  if (!ok) { failures.push(name); }
}

var genericFeedBundlePath = path.join(__dirname, '..', 'generic-feed/definition.json');
var def = require('./read-bundle.cjs').readBundleFiles(genericFeedBundlePath).definition;
var html = require('./read-bundle.cjs').readBundleFiles(genericFeedBundlePath).files['index.html'];
var script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

function makeEl() {
  return { style: {}, textContent: '', innerHTML: '', disabled: false, handlers: {}, addEventListener: function (ev, fn) { this.handlers[ev] = fn; }, setAttribute: function (k, v) { this[k] = v; }, querySelector: function () { return null; }, getAttribute: function () { return null; }, parentNode: null };
}

function runWithFeed(feed) {
  var els = {};
  ['gf-viewer', 'gf-prompt', 'gf-note', 'gf-prev', 'gf-next', 'gf-pos', 'gf-title', 'gf-date', 'gf-body', 'gf-linkp', 'gf-link'].forEach(function (id) { els[id] = makeEl(); });
  var doc = {
    readyState: 'complete',
    getElementById: function (id) { return els[id] || null; },
    querySelectorAll: function (sel) {
      if (sel.indexOf('data-kody-state-seed') !== -1) {
        return [{ textContent: JSON.stringify({ feed: feed }) }];
      }
      return [];
    },
    querySelector: function () { return null; },
    addEventListener: function () {},
    currentScript: null
  };
  var ctx = { document: doc, window: {}, console: console };
  ctx.window = {};
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  return els;
}

var empty = runWithFeed('');
check('empty feed: viewer hidden, prompt shown, note hidden',
  empty['gf-viewer'].style.display === 'none' && empty['gf-prompt'].style.display === '' && empty['gf-note'].style.display === 'none',
  JSON.stringify({ viewer: empty['gf-viewer'].style.display, prompt: empty['gf-prompt'].style.display, note: empty['gf-note'].style.display }));

var feed2 = '<?xml version="1.0"?><rss version="2.0"><channel>' +
  '<item><title>Newest</title><link>https://example.com/new</link><guid>g2</guid><pubDate>Tue, 04 Nov 2026 08:00:00 GMT</pubDate><description>Hello https://example.com/new.</description></item>' +
  '<item><title>Oldest</title><link>https://example.com/old</link><guid>g1</guid><pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate><description>Plain.</description></item>' +
  '</channel></rss>';
var two = runWithFeed(feed2);
check('two-entry feed: viewer shown, prompt hidden, newest first',
  two['gf-viewer'].style.display === '' && two['gf-prompt'].style.display === 'none' && two['gf-title'].textContent === 'Newest',
  JSON.stringify({ viewer: two['gf-viewer'].style.display, title: two['gf-title'].textContent }));
check('two-entry feed: position is 2 of 2, next disabled, prev enabled',
  two['gf-pos'].textContent.indexOf('2 of 2') !== -1 && two['gf-next'].disabled === true && two['gf-prev'].disabled === false,
  JSON.stringify({ pos: two['gf-pos'].textContent, nextDisabled: two['gf-next'].disabled, prevDisabled: two['gf-prev'].disabled }));
check('two-entry feed: description linkified to a bare URL link',
  two['gf-body'].innerHTML.indexOf('<a href="https://example.com/new">https://example.com/new</a>') !== -1,
  two['gf-body'].innerHTML);
two['gf-prev'].handlers.click();
check('previous steps to 1 of 2, oldest title',
  two['gf-pos'].textContent.indexOf('1 of 2') !== -1 && two['gf-title'].textContent === 'Oldest',
  JSON.stringify({ pos: two['gf-pos'].textContent, title: two['gf-title'].textContent }));

var bad = runWithFeed('not xml <<<');
check('unparseable feed: prompt shown plus note, viewer hidden',
  bad['gf-viewer'].style.display === 'none' && bad['gf-prompt'].style.display === '' && bad['gf-note'].style.display === '',
  JSON.stringify({ viewer: bad['gf-viewer'].style.display, prompt: bad['gf-prompt'].style.display, note: bad['gf-note'].style.display }));

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nALL GENERIC FEED DOM CHECKS PASSED');
