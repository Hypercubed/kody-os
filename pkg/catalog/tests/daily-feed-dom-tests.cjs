/* Daily Feed DOM wiring test (mock-preview logic, Node stub).
 * Run with node from the repo root:
 *   node pkg/catalog/tests/daily-feed-dom-tests.cjs
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

var def = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'daily-feed.bundle.json'), 'utf8'));
var html = def.bundle.files['index.html'];
var script = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));

function makeEl() {
  return { style: {}, textContent: '', innerHTML: '', disabled: false, handlers: {}, addEventListener: function (ev, fn) { this.handlers[ev] = fn; }, setAttribute: function (k, v) { this[k] = v; }, querySelector: function () { return null; }, getAttribute: function () { return null; }, parentNode: null };
}

function runWithFeed(feed) {
  var els = {};
  ['df-viewer', 'df-prompt', 'df-note', 'df-prev', 'df-next', 'df-pos', 'df-title', 'df-date', 'df-body', 'df-linkp', 'df-link'].forEach(function (id) { els[id] = makeEl(); });
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
  empty['df-viewer'].style.display === 'none' && empty['df-prompt'].style.display === '' && empty['df-note'].style.display === 'none',
  JSON.stringify({ viewer: empty['df-viewer'].style.display, prompt: empty['df-prompt'].style.display, note: empty['df-note'].style.display }));

var feed2 = '<?xml version="1.0"?><rss version="2.0"><channel>' +
  '<item><title>Newest</title><link>https://example.com/new</link><guid>g2</guid><pubDate>Tue, 04 Nov 2026 08:00:00 GMT</pubDate><description>Source: https://example.com/new. Hello.</description></item>' +
  '<item><title>Oldest</title><link>https://example.com/old</link><guid>g1</guid><pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate><description>Plain.</description></item>' +
  '</channel></rss>';
var two = runWithFeed(feed2);
check('two-entry feed: viewer shown, prompt hidden, newest first',
  two['df-viewer'].style.display === '' && two['df-prompt'].style.display === 'none' && two['df-title'].textContent === 'Newest',
  JSON.stringify({ viewer: two['df-viewer'].style.display, title: two['df-title'].textContent }));
check('two-entry feed: position is 2 of 2, next disabled, prev enabled',
  two['df-pos'].textContent.indexOf('2 of 2') !== -1 && two['df-next'].disabled === true && two['df-prev'].disabled === false,
  JSON.stringify({ pos: two['df-pos'].textContent, nextDisabled: two['df-next'].disabled, prevDisabled: two['df-prev'].disabled }));
check('two-entry feed: description linkified to a Source link',
  two['df-body'].innerHTML.indexOf('<a href="https://example.com/new">Source</a>') !== -1,
  two['df-body'].innerHTML);
two['df-prev'].handlers.click();
check('previous steps to 1 of 2, oldest title',
  two['df-pos'].textContent.indexOf('1 of 2') !== -1 && two['df-title'].textContent === 'Oldest',
  JSON.stringify({ pos: two['df-pos'].textContent, title: two['df-title'].textContent }));

var bad = runWithFeed('not xml <<<');
check('unparseable feed: prompt shown plus note, viewer hidden',
  bad['df-viewer'].style.display === 'none' && bad['df-prompt'].style.display === '' && bad['df-note'].style.display === '',
  JSON.stringify({ viewer: bad['df-viewer'].style.display, prompt: bad['df-prompt'].style.display, note: bad['df-note'].style.display }));

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nALL DAILY FEED DOM CHECKS PASSED');
