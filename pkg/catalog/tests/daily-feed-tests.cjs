/* Daily Feed bundle tests (spec tasks 3.1-3.4).
 * Run with node from the repo root:
 *   node pkg/catalog/tests/daily-feed-tests.cjs
 * Loads the bundle script with document undefined, so DOM wiring
 * is skipped and the pure functions (dfParseFeed, dfLinkify,
 * dfEscape, dfFormatPubDate) are callable directly. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' -- ' + detail));
  if (!ok) { failures.push(name); }
}

var bundlePath = path.join(__dirname, '..', 'daily-feed.bundle.json');
var def = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
check('definition id is daily-feed', def.id === 'daily-feed', def.id);
check('schemaVersion is 5', def.schemaVersion === 5, def.schemaVersion);
check('catalogVersion is 4', def.catalogVersion === 4, def.catalogVersion);
check('state is feed only, maxLength 250000',
  def.stateSchema && def.stateSchema.initial && def.stateSchema.initial.feed === '' &&
  def.stateSchema.fields && def.stateSchema.fields.feed &&
  def.stateSchema.fields.feed.type === 'string' &&
  def.stateSchema.fields.feed.maxLength === 250000,
  JSON.stringify(def.stateSchema));
check('action is set_feed only',
  def.actions && Object.keys(def.actions).length === 1 && def.actions.set_feed &&
  def.actions.set_feed.effects && def.actions.set_feed.effects[0].op === 'set' &&
  def.actions.set_feed.effects[0].field === 'feed',
  JSON.stringify(def.actions));
check('ui hides state, page placement',
  def.ui && def.ui.hideState === true &&
  def.ui.placements && def.ui.placements.indexOf('page') !== -1,
  JSON.stringify(def.ui));
var html = def.bundle.files['index.html'];
check('bundle under 256 KiB', Buffer.byteLength(html, 'utf8') < 256 * 1024, Buffer.byteLength(html, 'utf8'));
check('prompt names app id and set_feed',
  html.indexOf('daily-feed') !== -1 && html.indexOf('set_feed') !== -1 && html.indexOf('14') !== -1,
  'prompt missing id/action/cap');
check('prompt is not a copy button, no Clipboard API use',
  html.indexOf('navigator.clipboard') === -1 && html.indexOf('>Copy<') === -1,
  'clipboard use or copy button found');
check('prompt is in a gate-hint code block, like Help',
  html.indexOf('<p class="gate-hint"><code>Please set up a daily feed push') !== -1,
  'gate-hint code prompt missing');
check('no digest-specific title fallback',
  html.indexOf('AI Agents Digest') === -1, 'digest regex left in');

var scriptStart = html.indexOf('<script>');
var scriptEnd = html.indexOf('</script>', scriptStart);
var script = html.slice(scriptStart + '<script>'.length, scriptEnd);
check('ceiling: no ?. / ?? / replaceAll / .at( / backtick',
  script.indexOf('?.') === -1 && script.indexOf('??') === -1 &&
  script.indexOf('replaceAll') === -1 && script.indexOf('.at(') === -1 &&
  script.indexOf('`') === -1,
  'ceiling hit');

var ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(script, ctx);
var feed2 = '<?xml version="1.0"?><rss version="2.0"><channel>' +
  '<item><title>Newest</title><link>https://example.com/new</link><guid>g2</guid>' +
  '<pubDate>Tue, 04 Nov 2026 08:00:00 GMT</pubDate><description>Source: https://example.com/new. Hello.</description></item>' +
  '<item><title>Oldest</title><link>https://example.com/old</link><guid>g1</guid>' +
  '<pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate><description>Plain text.</description></item>' +
  '</channel></rss>';
var parsed = ctx.dfParseFeed(feed2, null);
check('parser reverses to oldest-first, newest last',
  parsed.status === 'ok' && parsed.items.length === 2 &&
  parsed.items[0].title === 'Oldest' && parsed.items[1].title === 'Newest',
  JSON.stringify(parsed));
check('parser keeps guid and pubDate',
  parsed.items[1].guid === 'g2' && parsed.items[1].pubDate.indexOf('04 Nov 2026') !== -1,
  JSON.stringify(parsed.items[1]));
var empty = ctx.dfParseFeed('', null);
check('empty feed parses to empty status', empty.status === 'empty' && empty.items.length === 0, JSON.stringify(empty));
var bad = ctx.dfParseFeed('not xml at all <<<', null);
check('unparseable feed parses to unparseable status', bad.status === 'unparseable', JSON.stringify(bad));
var linkified = ctx.dfLinkify(ctx.dfEscape('Source: https://example.com/a. See https://example.com/b!'));
check('linkify: one Source link, trailing period outside',
  linkified.indexOf('<a href="https://example.com/a">Source</a>.') !== -1,
  linkified);
check('linkify: bare URL becomes its own link, bang outside',
  linkified.indexOf('<a href="https://example.com/b">https://example.com/b</a>!') !== -1,
  linkified);
check('linkify: no nested anchors',
  (linkified.match(/<a /g) || []).length === 2, linkified);
var escaped = ctx.dfLinkify(ctx.dfEscape('<script>alert(1)</script> https://example.com/x'));
check('escaping: feed script never reaches output unescaped',
  escaped.indexOf('<script>') === -1 && escaped.indexOf('&lt;script&gt;') !== -1, escaped);
var dateText = ctx.dfFormatPubDate('Tue, 04 Nov 2026 08:00:00 GMT');
check('date formats device-local long form', dateText.indexOf('2026') !== -1, dateText);
check('bad date formats to empty', ctx.dfFormatPubDate('not a date') === '', ctx.dfFormatPubDate('not a date'));
check('missing title/date fallback is a viewer concern, parser keeps empty strings',
  ctx.dfParseFeed('<?xml version="1.0"?><rss><channel><item><description>Hi</description></item></channel></rss>', null).items[0].title === '',
  'title fallback');

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nALL DAILY FEED CHECKS PASSED');
