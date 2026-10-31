'use strict';
// jsdom proofs for pkg/catalog/news.bundle.json (news-app spec task 2.3).
// Runs outside pkg/; jsdom lives in /tmp/jsdom-test (or JSDOM_PATH).
//
//   bun tests/news-list.cjs
//
// Covers: World by default with the long-form device-local date, one feed
// per section with an updated heading and a distinct active button, at most
// 10 items, plain-text summaries truncated to 350 characters, no
// feed-supplied HTML/script/style in the list, error state with a working
// Retry, and a section switch that re-fetches without leaving the previous
// section on screen.
var fs = require('fs');
var path = require('path');

var jsdomPath = process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom';
var JSDOM = require(jsdomPath).JSDOM;

var bundle = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'pkg', 'catalog', 'news.bundle.json'), 'utf8'));
var entry = bundle.bundle.files['index.html'];

var failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('PASS: ' + name); }
  else { failures.push(name); console.log('FAIL: ' + name + (detail ? ' — ' + detail : '')); }
}

function tick(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms === undefined ? 30 : ms); });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function item(title, desc, link, extra) {
  return '<item>\n<title><![CDATA[' + title + ']]></title>\n' +
    '<description><![CDATA[' + desc + ']]></description>\n' +
    '<link>' + link + '</link>\n' + (extra || '') + '</item>';
}

function rss(items) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">\n' +
    '<channel><title>Fixture feed</title>\n' + items.join('\n') + '\n</channel>\n</rss>';
}

var LONG_SUMMARY = '';
for (var li = 0; li < 24; li++) { LONG_SUMMARY += 'lorem ipsum dolor sit amet consectetur '; }

var worldItems = [];
worldItems.push(item(
  'Headline with <b>markup</b> &amp; entity',
  '<p>Lead with <b>bold</b> and <img src="https://evil.test/x.png" onerror="alert(1)"> then <script>alert("xss")</script> tail words.</p>',
  'https://news.test/articles/1',
  '<media:thumbnail url="https://img.test/thumb1.jpg" width="240" height="135"/>'));
// Non-CDATA title: the parser must decode the entity to "&".
worldItems.push('<item>\n<title>Long summary story &amp; more</title>\n' +
  '<description><![CDATA[' + LONG_SUMMARY + ']]></description>\n' +
  '<link>https://news.test/articles/2</link>\n</item>');
for (var wi = 3; wi <= 12; wi++) {
  worldItems.push(item('World story ' + wi, 'Plain summary for world story ' + wi + '.', 'https://news.test/articles/' + wi));
}

var techItems = [
  item('Tech story one', 'Plain technology summary one.', 'https://news.test/tech/1'),
  item('Tech story two', 'Plain technology summary two.', 'https://news.test/tech/2'),
  item('Tech story three', 'Plain technology summary three.', 'https://news.test/tech/3'),
];
var businessItems = [
  item('Business story one', 'Plain business summary one.', 'https://news.test/biz/1'),
  item('Business story two', 'Plain business summary two.', 'https://news.test/biz/2'),
];
var scienceItems = [
  item('Science story one', 'Plain science summary one.', 'https://news.test/sci/1'),
  item('Science story two', 'Plain science summary two.', 'https://news.test/sci/2'),
];
var artsItems = [
  item('Arts story one', 'Plain arts summary one.', 'https://news.test/arts/1'),
  item('Arts story two', 'Plain arts summary two.', 'https://news.test/arts/2'),
];
var financeItems = [
  item('Finance story one', 'Plain finance summary one.', 'https://news.test/fin/1',
    '<enclosure url="https://img.test/chart.png" length="1234" type="image/png"/>'),
];

var FIXTURES = {
  '/feed/news/world': rss(worldItems),
  '/feed/news/technology': rss(techItems),
  '/feed/news/business': rss(businessItems),
  '/feed/news/science': rss(scienceItems),
  '/feed/news/arts': rss(artsItems),
  '/feed/news/finance': rss(financeItems),
};

function okResponse(xml) {
  return { ok: true, status: 200, text: function () { return Promise.resolve(xml); } };
}
function errResponse(status) {
  return { ok: false, status: status, text: function () { return Promise.resolve('feed unavailable'); } };
}

function defaultResponder(url) {
  var key = url.split('?')[0];
  var xml = FIXTURES[key];
  if (xml === undefined) { return Promise.resolve(errResponse(404)); }
  return Promise.resolve(okResponse(xml));
}

// The shell renders the bundle inside its section with a stamped action base;
// mirror that markup so feedUrl() exercises the real data-action-base path.
function shellHtml() {
  return '<section class="app" data-app-id="news"><div class="app-body">' +
    '<div class="bundle" data-bundle="news" data-action-base="/apps/news">' +
    entry +
    '</div></div></section>';
}

function createDom(url, responder) {
  var fetchLog = [];
  var dom = new JSDOM(shellHtml(), {
    url: url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse: function (window) {
      var RealDate = window.Date;
      function FakeDate() {
        if (arguments.length === 0) { return new RealDate(2026, 9, 30); }
        var args = Array.prototype.slice.call(arguments);
        return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
      }
      FakeDate.prototype = Object.create(RealDate.prototype);
      FakeDate.UTC = RealDate.UTC;
      FakeDate.parse = RealDate.parse;
      FakeDate.now = function () { return new RealDate(2026, 9, 30).getTime(); };
      window.Date = FakeDate;
      window.fetch = function (u) {
        fetchLog.push(String(u));
        return responder(String(u), fetchLog.length);
      };
    },
  });
  return { dom: dom, fetchLog: fetchLog };
}

function click(doc, selector) {
  var el = doc.querySelector(selector);
  el.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
}

function activeLabel(doc) {
  var on = doc.querySelectorAll('.news-tab-on');
  if (on.length !== 1) { return '(count=' + on.length + ')'; }
  return on[0].textContent;
}

function hasAttributeAnywhere(rootEl, attrName) {
  var els = rootEl.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) {
    if (els[i].hasAttribute(attrName)) { return true; }
  }
  return false;
}

(async function main() {
  // -------------------------------------------------------------------------
  // A: World by default
  // -------------------------------------------------------------------------
  var a = createDom('https://example.test/apps/news', defaultResponder);
  await tick();
  var docA = a.dom.window.document;
  var expectedDate = new Date(2026, 9, 30).toLocaleDateString(undefined,
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  check('A: opens on the world feed', a.fetchLog[0] === '/feed/news/world', a.fetchLog.join(','));
  check('A: heading is Top Headlines',
    docA.getElementById('news-title').textContent === 'Top Headlines',
    docA.getElementById('news-title').textContent);
  check('A: device-local long-form date',
    docA.getElementById('news-date').textContent === expectedDate,
    docA.getElementById('news-date').textContent + ' vs ' + expectedDate);

  var labels = Array.prototype.map.call(docA.querySelectorAll('.news-tab'),
    function (b) { return b.textContent; });
  check('A: six section buttons in feed order',
    JSON.stringify(labels) === JSON.stringify(['World', 'Technology', 'Business', 'Science', 'Arts', 'Finance']),
    labels.join(','));
  check('A: active button is distinct', activeLabel(docA) === 'World', activeLabel(docA));
  check('A: active button carries aria-pressed',
    docA.querySelector('.news-tab-on').getAttribute('aria-pressed') === 'true');

  var itemsA = docA.querySelectorAll('.news-item');
  check('A: at most ten of twelve headlines render', itemsA.length === 10, 'items=' + itemsA.length);

  var headA = itemsA[0].querySelector('.news-headline');
  check('A: headline opens the source article externally',
    headA.tagName === 'A' &&
    headA.getAttribute('href') === 'https://news.test/articles/1' &&
    headA.getAttribute('target') === '_blank' &&
    headA.getAttribute('rel') === 'noopener noreferrer',
    headA.tagName + ' ' + headA.getAttribute('href'));

  var headText = itemsA[0].querySelector('.news-headline').textContent;
  check('A: headline HTML-escaped, markup never becomes elements',
    headText.indexOf('<b>markup</b>') !== -1 && itemsA[0].getElementsByTagName('b').length === 0,
    headText);

  check('A: headline entities decoded',
    itemsA[1].querySelector('.news-headline').textContent === 'Long summary story & more',
    itemsA[1].querySelector('.news-headline').textContent);

  var sum1 = itemsA[0].querySelector('.news-summary').textContent;
  check('A: summary is plain text',
    sum1.indexOf('<') === -1 && sum1.indexOf('alert') === -1 && sum1.indexOf('bold') !== -1, sum1);
  var sum2 = itemsA[1].querySelector('.news-summary').textContent;
  check('A: summary truncated to 350 characters',
    LONG_SUMMARY.length > 350 && sum2.length <= 350 && sum2.slice(-1) === '\u2026',
    'raw=' + LONG_SUMMARY.length + ' shown=' + sum2.length);

  var bodyA = docA.getElementById('news-body');
  check('A: no script or style reaches the list',
    bodyA.getElementsByTagName('script').length === 0 &&
    bodyA.getElementsByTagName('style').length === 0);
  check('A: no feed-supplied inline style or handler attribute',
    !hasAttributeAnywhere(bodyA, 'style') && !hasAttributeAnywhere(bodyA, 'onerror'));
  var imgsA = bodyA.getElementsByTagName('img');
  check('A: thumbnail only where the feed supplies one',
    imgsA.length === 1 && imgsA[0].getAttribute('src') === 'https://img.test/thumb1.jpg',
    'imgs=' + imgsA.length);

  // -------------------------------------------------------------------------
  // B: section switch — immediate state, then the new feed
  // -------------------------------------------------------------------------
  var b = createDom('https://example.test/apps/news', defaultResponder);
  await tick();
  var docB = b.dom.window.document;
  click(docB, '.news-tabs .news-tab:nth-child(2)');
  check('B: previous section leaves the screen at once',
    docB.querySelectorAll('.news-item').length === 0);
  check('B: loading state names the new section',
    docB.getElementById('news-status').textContent.indexOf('Fetching Technology') !== -1,
    docB.getElementById('news-status').textContent);
  check('B: heading updates immediately',
    docB.getElementById('news-title').textContent === 'Technology Headlines',
    docB.getElementById('news-title').textContent);
  check('B: active button moves with the tap',
    activeLabel(docB) === 'Technology' && docB.querySelectorAll('.news-tab-on').length === 1,
    activeLabel(docB));
  await tick();
  check('B: switch re-fetches that section',
    b.fetchLog[b.fetchLog.length - 1] === '/feed/news/technology', b.fetchLog.join(','));
  var techItemsRendered = docB.querySelectorAll('.news-item');
  check('B: list holds the new section stories',
    techItemsRendered.length === 3 &&
    techItemsRendered[0].querySelector('.news-headline').textContent === 'Tech story one',
    'items=' + techItemsRendered.length);
  check('B: new section carries no thumbnail',
    docB.getElementById('news-body').getElementsByTagName('img').length === 0);
  check('B: loading status cleared', docB.getElementById('news-status').textContent === '',
    docB.getElementById('news-status').textContent);

  // -------------------------------------------------------------------------
  // C: a slow section never shows the old section as current
  // -------------------------------------------------------------------------
  var releaseBusiness = null;
  var c = createDom('https://example.test/apps/news', function (url) {
    if (url.split('?')[0] === '/feed/news/business') {
      return new Promise(function (resolve) {
        releaseBusiness = function () { resolve(okResponse(FIXTURES['/feed/news/business'])); };
      });
    }
    return defaultResponder(url);
  });
  await tick();
  var docC = c.dom.window.document;
  check('C: world is current before the switch',
    docC.querySelectorAll('.news-item').length === 10 &&
    docC.getElementById('news-title').textContent === 'Top Headlines');
  click(docC, '.news-tabs .news-tab:nth-child(3)');
  check('C: old headlines are dropped while the new feed is in flight',
    docC.querySelectorAll('.news-item').length === 0);
  check('C: loading state is shown for business',
    docC.getElementById('news-status').textContent.indexOf('Fetching Business') !== -1,
    docC.getElementById('news-status').textContent);
  check('C: heading names the section in flight, not the old one',
    docC.getElementById('news-title').textContent === 'Business Headlines',
    docC.getElementById('news-title').textContent);
  releaseBusiness();
  await tick();
  check('C: slow section renders once it lands',
    docC.querySelectorAll('.news-item').length === 2 &&
    docC.getElementById('news-title').textContent === 'Business Headlines',
    'items=' + docC.querySelectorAll('.news-item').length);

  // -------------------------------------------------------------------------
  // D: failed feed -> error state -> Retry re-fetches the current section
  // -------------------------------------------------------------------------
  var scienceCalls = 0;
  var d = createDom('https://example.test/apps/news', function (url) {
    if (url.split('?')[0] === '/feed/news/science') {
      scienceCalls = scienceCalls + 1;
      if (scienceCalls === 1) { return Promise.resolve(errResponse(502)); }
      return Promise.resolve(okResponse(FIXTURES['/feed/news/science']));
    }
    return defaultResponder(url);
  });
  await tick();
  var docD = d.dom.window.document;
  click(docD, '.news-tabs .news-tab:nth-child(4)');
  await tick();
  var errBox = docD.querySelector('.news-error');
  check('D: failed feed shows the error state',
    errBox !== null && errBox.querySelector('.news-error-text').textContent ===
    'Could not fetch the wires for this section.',
    errBox ? errBox.textContent.slice(0, 80) : 'no error box');
  check('D: error state carries a connection hint',
    errBox !== null && errBox.querySelector('.news-error-hint').textContent.length > 0,
    errBox ? errBox.querySelector('.news-error-hint').textContent : 'no error box');
  check('D: failed feed leaves no stale headlines',
    docD.querySelectorAll('.news-item').length === 0);
  check('D: error heading still names the failing section',
    docD.getElementById('news-title').textContent === 'Science Headlines',
    docD.getElementById('news-title').textContent);
  var callsBefore = d.fetchLog.length;
  if (docD.querySelector('.news-retry')) {
    click(docD, '.news-retry');
  } else {
    check('D: retry button present to click', false);
  }
  check('D: Retry clears the list at once',
    docD.querySelectorAll('.news-item').length === 0 && docD.querySelector('.news-error') === null);
  await tick();
  check('D: Retry re-fetches the current section',
    d.fetchLog.length === callsBefore + 1 &&
    d.fetchLog[d.fetchLog.length - 1] === '/feed/news/science', d.fetchLog.join(','));
  check('D: Retry recovers to the list',
    docD.querySelectorAll('.news-item').length === 2 &&
    docD.querySelector('.news-error') === null,
    'items=' + docD.querySelectorAll('.news-item').length);

  // -------------------------------------------------------------------------
  // E: a section whose feed supplies no image renders none
  // -------------------------------------------------------------------------
  var e = createDom('https://example.test/apps/news', defaultResponder);
  await tick();
  var docE = e.dom.window.document;
  click(docE, '.news-tabs .news-tab:nth-child(6)');
  await tick();
  var imgsE = docE.getElementById('news-body').getElementsByTagName('img');
  check('E: enclosure image renders for finance', imgsE.length === 1 &&
    imgsE[0].getAttribute('src') === 'https://img.test/chart.png', 'imgs=' + imgsE.length);
  click(docE, '.news-tabs .news-tab:nth-child(5)');
  await tick();
  check('E: arts renders no thumbnail', docE.getElementById('news-body')
    .getElementsByTagName('img').length === 0);
  check('E: arts list is its own feed', docE.querySelectorAll('.news-item').length === 2);

  // -------------------------------------------------------------------------
  // F: session key travels on the proxy request
  // -------------------------------------------------------------------------
  var f = createDom('https://example.test/apps/news?k=abc123', defaultResponder);
  await tick();
  check('F: feed request carries the session key',
    f.fetchLog[0] === '/feed/news/world?k=abc123', f.fetchLog.join(','));

  // -------------------------------------------------------------------------
  // G: definition shape + ES2019 ceiling scan
  // -------------------------------------------------------------------------
  var feeds = bundle.capabilities.feeds;
  check('G: exactly six feeds', feeds.length === 6, 'feeds=' + feeds.length);
  check('G: feed names in section order',
    JSON.stringify(feeds.map(function (feed) { return feed.name; })) ===
    JSON.stringify(['world', 'technology', 'business', 'science', 'arts', 'finance']),
    feeds.map(function (feed) { return feed.name; }).join(','));
  check('G: feeds are HTTPS with a 900s TTL and 65536 byte cap',
    feeds.every(function (feed) {
      return feed.url.indexOf('https://') === 0 && feed.ttlSeconds === 900 && feed.maxBytes === 65536;
    }));
  check('G: stateless definition',
    JSON.stringify(bundle.stateSchema) === JSON.stringify({ type: 'object', initial: {}, fields: {} }) &&
    JSON.stringify(bundle.actions) === '{}' &&
    JSON.stringify(bundle.ui.actions) === '[]' &&
    bundle.ui.openAs === undefined && bundle.ui.placements === undefined);
  check('G: ui.title News', bundle.ui.title === 'News', bundle.ui.title);
  var description = bundle.description.toLowerCase();
  check('G: description states the three user-facing promises',
    description.indexOf('opens on world') !== -1 &&
    description.indexOf('10 headlines') !== -1 &&
    description.indexOf('source article') !== -1, bundle.description);

  var scriptMatch = /<script>([\s\S]*)<\/script>\s*$/.exec(entry);
  check('G: bundle carries exactly one inline style and one script',
    scriptMatch !== null &&
    entry.indexOf('<style>') !== -1 && entry.split('<style').length - 1 === 1 &&
    entry.split('<script').length - 1 === 1);
  // <link and <script also appear inside the bundle's regex sources, so match
  // markup shapes (whitespace or '>' after the tag name), not bare substrings.
  check('G: no external stylesheet or script',
    !/<link[\s>]/i.test(entry) && !/<script\s+[^>]*src=/i.test(entry));
  check('G: icon is markup or a glyph, never an emoji',
    /<svg/.test(bundle.icon) || /^[^\u0080-\uffff]+$/.test(bundle.icon), bundle.icon.slice(0, 20));

  var script = scriptMatch[1];
  var ceiling = [
    { name: 'optional chaining', source: '?.' },
    { name: 'nullish coalescing', source: '??' },
    { name: 'replaceAll', source: 'replaceAll' },
    { name: 'Array.prototype.at', source: '.at(' },
    { name: 'template literal', source: '`' },
  ];
  for (var ci = 0; ci < ceiling.length; ci++) {
    var hitCount = script.split(ceiling[ci].source).length - 1;
    check('G: ceiling scan clean of ' + ceiling[ci].name, hitCount === 0, 'hits=' + hitCount);
  }

  if (failures.length > 0) {
    console.log('\n' + failures.length + ' check(s) FAILED');
    process.exit(1);
  }
  console.log('\nALL NEWS LIST CHECKS PASSED');
})().catch(function (err) {
  console.error('HARNESS ERROR', err);
  process.exit(1);
});
