/* Generic Feed bundle tests.
 * Run with node from the repo root:
 *   node pkg/catalog/tests/generic-feed-tests.cjs
 * Loads the bundle script with document undefined, so DOM wiring
 * is skipped and the pure functions (gfParseFeed, gfLinkify,
 * gfEscape, gfFormatPubDate) are callable directly. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' -- ' + detail));
  if (!ok) { failures.push(name); }
}

var bundlePath = path.join(__dirname, '..', 'generic-feed/definition.json');
var def = require('./read-bundle.cjs').readBundleFiles(bundlePath).definition;
check('definition id is generic-feed', def.id === 'generic-feed', def.id);
check('schemaVersion is 5', def.schemaVersion === 5, def.schemaVersion);
check('catalogVersion is 1', def.catalogVersion === 1, def.catalogVersion);
check('no capabilities declared', !def.capabilities, JSON.stringify(def.capabilities));
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
var html = require('./read-bundle.cjs').readBundleFiles(bundlePath).files['index.html'];
check('bundle under 256 KiB', Buffer.byteLength(html, 'utf8') < 256 * 1024, Buffer.byteLength(html, 'utf8'));
check('prompt names app id and set_feed',
  html.indexOf('generic-feed') !== -1 && html.indexOf('set_feed') !== -1 && html.indexOf('14') !== -1,
  'prompt missing id/action/cap');
check('prompt leaves a URL blank for the user',
  html.indexOf('RSS feed URL: [paste the RSS feed URL here]') !== -1,
  'URL blank missing');
check('prompt tells the agent not to overwrite on a failed fetch',
  html.indexOf('Do not overwrite the feed if the fetch fails') !== -1,
  'write-nothing guard missing');
check('prompt is not a copy button, no Clipboard API use',
  html.indexOf('navigator.clipboard') === -1 && html.indexOf('>Copy<') === -1,
  'clipboard use or copy button found');
check('prompt is in a gate-hint code block, like Help',
  html.indexOf('<p class="gate-hint"><code>Please set up a feed push') !== -1,
  'gate-hint code prompt missing');
check('no daily-feed leftovers',
  html.indexOf('daily-feed') === -1 && html.indexOf('Daily Feed') === -1,
  'daily-feed text left in');
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
check('read-only bundle: no fetch, no localStorage use in script',
  script.indexOf('fetch(') === -1 && script.indexOf('localStorage.') === -1 &&
  script.indexOf('localStorage[') === -1,
  'read-only violation');

var ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(script, ctx);
var feed2 = '<?xml version="1.0"?><rss version="2.0"><channel>' +
  '<item><title>Newest</title><link>https://example.com/new</link><guid>g2</guid>' +
  '<pubDate>Tue, 04 Nov 2026 08:00:00 GMT</pubDate><description>Hello https://example.com/new.</description></item>' +
  '<item><title>Oldest</title><link>https://example.com/old</link><guid>g1</guid>' +
  '<pubDate>Mon, 03 Nov 2026 08:00:00 GMT</pubDate><description>Plain text.</description></item>' +
  '</channel></rss>';
var parsed = ctx.gfParseFeed(feed2, null);
check('parser reverses to oldest-first, newest last',
  parsed.status === 'ok' && parsed.items.length === 2 &&
  parsed.items[0].title === 'Oldest' && parsed.items[1].title === 'Newest',
  JSON.stringify(parsed));
check('parser keeps guid and pubDate',
  parsed.items[1].guid === 'g2' && parsed.items[1].pubDate.indexOf('04 Nov 2026') !== -1,
  JSON.stringify(parsed.items[1]));
var empty = ctx.gfParseFeed('', null);
check('empty feed parses to empty status', empty.status === 'empty' && empty.items.length === 0, JSON.stringify(empty));
var bad = ctx.gfParseFeed('not xml at all <<<', null);
check('unparseable feed parses to unparseable status', bad.status === 'unparseable', JSON.stringify(bad));
var linkified = ctx.gfLinkify(ctx.gfEscape('See https://example.com/a. And https://example.com/b!'));
check('linkify: bare URL becomes its own link, trailing period outside',
  linkified.indexOf('<a href="https://example.com/a">https://example.com/a</a>.') !== -1,
  linkified);
check('linkify: bare URL becomes its own link, bang outside',
  linkified.indexOf('<a href="https://example.com/b">https://example.com/b</a>!') !== -1,
  linkified);
check('linkify: no nested anchors',
  (linkified.match(/<a /g) || []).length === 2, linkified);
var escaped = ctx.gfLinkify(ctx.gfEscape('<script>alert(1)</script> https://example.com/x'));
check('escaping: feed script never reaches output unescaped',
  escaped.indexOf('<script>') === -1 && escaped.indexOf('&lt;script&gt;') !== -1, escaped);
var dateText = ctx.gfFormatPubDate('Tue, 04 Nov 2026 08:00:00 GMT');
check('date formats device-local long form', dateText.indexOf('2026') !== -1, dateText);
check('bad date formats to empty', ctx.gfFormatPubDate('not a date') === '', ctx.gfFormatPubDate('not a date'));
check('missing title/date fallback is a viewer concern, parser keeps empty strings',
  ctx.gfParseFeed('<?xml version="1.0"?><rss><channel><item><description>Hi</description></item></channel></rss>', null).items[0].title === '',
  'title fallback');

if (failures.length > 0) {
  console.log('\n' + failures.length + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nALL GENERIC FEED CHECKS PASSED');
