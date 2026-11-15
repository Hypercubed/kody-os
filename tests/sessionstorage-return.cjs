// Return-to-opener harness (sessionstorage-return, task 6.x):
// the shell client carries the Close-box return in sessionStorage
// instead of the URL, with a legacy `?from=` migration.
//
// Kept OUTSIDE pkg/ by design: development verification, not part of
// the published package (the publish syncs pkg/ only).
//
// What it proves:
//   1. A plain app tile click stores the current page (`/apps`) under
//      `kody-os:return` and lets the browser navigate.
//   2. A home widget expand click stores `/`.
//   3. An expand click from an open overlay (`/apps#app-counter`)
//      stores the overlay path.
//   4. An app page applies a stored value to the titlebar Close box,
//      with the Apps / Home / Back label rule.
//   5. A stale `#app-<other-id>` fragment is dropped (bare path wins).
//   6. No stored value leaves the server-rendered Close box (Home).
//   7. Hostile stored values (absolute, protocol-relative, traversal,
//      backslash, CR/LF) are rejected; Close stays Home.
//   8. A legacy `?from=` is validated, wins over the stored value, and
//      is stripped from the URL with other query parameters preserved.
//   9. An invalid legacy `?from=` is ignored and stripped.
//  10. The migration does not run on the Apps page or the dashboard.
//  11. A modal tile with JavaScript fetches `?touch=1&format=json`,
//      sets the overlay fragment, and does not navigate.
//  12. A modal tile whose JSON fetch fails falls back to the native
//      touch URL; a non-modal tile never fetches.
//  13. A modified (ctrl) click neither stores nor intercepts.
//  14. Throwing sessionStorage leaves the app page working with the
//      Close box Home.
//
// The client entry (pkg/src/client/index.ts) is TypeScript, so the
// harness bundles it with bun (browser target) to a temp file, then
// loads it in jsdom. jsdom is run under node (bun + jsdom misbehaves).
//
// Run: node tests/sessionstorage-return.cjs
// jsdom resolution, in order: JSDOM_PATH env, /tmp/jsdom-test (the
// ephemeral install the Counter harness uses), or a resolvable jsdom.
// Exit code 0 = all checks passed, 1 = a check failed.
'use strict';
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var JSDOM;
var jsdomModule;
try {
  var jsdomPath = process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom';
  jsdomModule = require(jsdomPath);
  JSDOM = jsdomModule.JSDOM;
} catch (err) {
  jsdomModule = require('jsdom');
  JSDOM = jsdomModule.JSDOM;
}

var ROOT = path.join(__dirname, '..');
var LIT_PATH = path.join(ROOT, 'pkg', 'public', 'lit.js');
var CLIENT_SRC = path.join(ROOT, 'pkg', 'src', 'client', 'index.ts');
var BUNDLE_PATH = '/tmp/sessionstorage-return-test-bundle.js';

var BASE = 'http://example.com';
var HOME_URL = BASE + '/';
var APPS_URL = BASE + '/apps';
var APP_URL = BASE + '/apps/counter';

function shellHtml(title, body, opts) {
  opts = opts || {};
  var current = opts.current || '';
  var nav = '<nav aria-label="Shell">' +
    '<a href="/"' + (current === 'home' ? ' aria-current="page"' : '') + '>Home</a>' +
    '<a href="/apps"' + (current === 'apps' ? ' aria-current="page"' : '') + '>' + 'Apps</a>' +
    '<a href="/help">Help</a></nav>';
  var box = opts.closeHref
    ? '<div class="os-titlebar"><a class="os-box" href="' + opts.closeHref + '" aria-label="' + (opts.closeLabel || 'Home') + '" title="' + (opts.closeLabel || 'Home') + '"></a><h1 class="os-title">' + title + '</h1></div>'
    : '<div class="os-titlebar"><h1 class="os-title">' + title + '</h1></div>';
  return '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>' + title + ' - kody-os</title></head><body>' +
    nav + box + '<main id="os-main">' + body + '</main></body></html>';
}

var APPS_HTML = shellHtml('Apps',
  '<h1>Apps</h1>' +
  '<ul><li><a class="tile" href="/apps/counter">Counter</a></li>' +
  '<li><a class="tile" href="/apps/notes">Notes</a></li>' +
  '<li><a class="tile" href="/apps/modal-app?touch=1">Modal app</a></li></ul>',
  { current: 'apps', closeHref: '/', closeLabel: 'Home' });
var HOME_WIDGET_HTML = shellHtml('Home',
  '<h1>Home</h1><section class="widget" data-app-id="counter">' +
  '<h2 class="app-titlebar"><span class="app-title-plate">Counter</span>' +
  '<a class="widget-expand" href="/apps/counter" aria-label="Expand Counter"></a></h2>' +
  '<div class="app-body">Count: 5</div></section>');
var APP_HTML = shellHtml('Counter',
  '<section class="app" data-app-id="counter" aria-label="Counter"><h2 class="app-titlebar">' +
  '<span class="app-title-plate">Counter</span></h2><div class="app-body">Count: 5</div></section>',
  { closeHref: '/', closeLabel: 'Home' });

var failures = [];
function check(name, ok, detail) {
  if (ok) {
    console.log('ok - ' + name);
  } else {
    console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : ''));
    failures.push(name);
  }
}

function buildClientBundle() {
  childProcess.execFileSync('bun', ['build', CLIENT_SRC, '--target=browser', '--outfile=' + BUNDLE_PATH], { stdio: 'pipe' });
  return fs.readFileSync(BUNDLE_PATH, 'utf8');
}

var CLIENT_BUNDLE = buildClientBundle();

function makeWindow(html, opts) {
  opts = opts || {};
  var navAttempts = [];
  var virtualConsole;
  try {
    var VirtualConsole = jsdomModule.VirtualConsole;
    virtualConsole = new VirtualConsole();
  } catch (err) {
    virtualConsole = undefined;
  }
  if (virtualConsole) {
    virtualConsole.on('jsdomError', function (err) {
      if (err && err.message && err.message.indexOf('Not implemented: navigation') !== -1) {
        navAttempts.push(String(err.message));
      }
    });
  }
  var dom = new JSDOM(html, {
    url: opts.url || HOME_URL,
    runScripts: 'outside-only',
    virtualConsole: virtualConsole,
    pretendToBeVisual: true
  });
  var win = dom.window;
  if (opts.fetch) win.fetch = opts.fetch;
  if (typeof opts.stored === 'string') {
    win.sessionStorage.setItem('kody-os:return', opts.stored);
  }
  if (opts.storageThrows) {
    Object.defineProperty(win, 'sessionStorage', {
      configurable: true,
      get: function () { throw new Error('storage disabled'); }
    });
  }
  if (opts.beforeEval) opts.beforeEval(win);
  win.eval(fs.readFileSync(LIT_PATH, 'utf8'));
  win.eval(CLIENT_BUNDLE);
  return { dom: dom, win: win, doc: win.document, navAttempts: navAttempts };
}

async function flush() {
  for (var i = 0; i < 10; i++) {
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
  }
}

function click(win, el, options) {
  var init = { bubbles: true, cancelable: true, button: 0 };
  if (options) {
    if (options.ctrlKey) init.ctrlKey = true;
    if (options.button !== undefined) init.button = options.button;
  }
  el.dispatchEvent(new win.MouseEvent('click', init));
}

function appCloseBox(doc) {
  return doc.querySelector('.os-titlebar a.os-box');
}

function closeHref(doc) {
  var box = appCloseBox(doc);
  return box ? box.getAttribute('href') : '<none>';
}

function stored(win) {
  try {
    return win.sessionStorage.getItem('kody-os:return');
  } catch (err) {
    return '<threw>';
  }
}

async function main() {
  // 1. Plain tile on the Apps page stores /apps and does not intercept.
  var fetchCalls = [];
  var fetchStub = function (url) {
    fetchCalls.push(url);
    return Promise.resolve({ text: function () { return Promise.resolve('{"ok":true}'); } });
  };
  var c1 = makeWindow(APPS_HTML, { url: APPS_URL, fetch: fetchStub });
  var tile = c1.doc.querySelector('a.tile[href="/apps/counter"]');
  click(c1.win, tile);
  await flush();
  check('1. tile click stored /apps', stored(c1.win) === '/apps', stored(c1.win));
  check('1. plain tile called no fetch', fetchCalls.length === 0, fetchCalls.join(','));
  check('1. plain tile fell through to navigation', c1.navAttempts.length >= 1, c1.navAttempts.join('; '));

  // 2. Home widget expand stores /.
  var c2 = makeWindow(HOME_WIDGET_HTML, { url: HOME_URL });
  click(c2.win, c2.doc.querySelector('a.widget-expand'));
  await flush();
  check('2. widget expand stored /', stored(c2.win) === '/', stored(c2.win));

  // 3. Expand from an open overlay stores the overlay path.
  var c3 = makeWindow(APPS_HTML, { url: APPS_URL + '#app-modal-app' });
  click(c3.win, c3.doc.querySelector('a.tile[href="/apps/counter"]'));
  await flush();
  check('3. overlay open stored /apps#app-modal-app', stored(c3.win) === '/apps#app-modal-app', stored(c3.win));

  // 4. App page applies a stored value, with the label rule.
  var c4 = makeWindow(APP_HTML, { url: APP_URL, stored: '/apps' });
  check('4. stored /apps applied', closeHref(c4.doc) === '/apps', closeHref(c4.doc));
  check('4. stored /apps labelled Apps', appCloseBox(c4.doc).getAttribute('aria-label') === 'Apps' && appCloseBox(c4.doc).getAttribute('title') === 'Apps', appCloseBox(c4.doc).getAttribute('aria-label'));
  var c4b = makeWindow(APP_HTML, { url: APP_URL, stored: '/' });
  check('4. stored / applied', closeHref(c4b.doc) === '/', closeHref(c4b.doc));
  check('4. stored / labelled Home', appCloseBox(c4b.doc).getAttribute('aria-label') === 'Home', appCloseBox(c4b.doc).getAttribute('aria-label'));
  var c4c = makeWindow(APP_HTML, { url: APP_URL, stored: '/apps#app-counter' });
  check('4. stored overlay path kept for this app', closeHref(c4c.doc) === '/apps#app-counter', closeHref(c4c.doc));
  check('4. overlay path labelled Back', appCloseBox(c4c.doc).getAttribute('aria-label') === 'Back', appCloseBox(c4c.doc).getAttribute('aria-label'));

  // 5. Stale fragment for another app is dropped.
  var c5 = makeWindow(APP_HTML, { url: APP_URL, stored: '/apps#app-other' });
  check('5. stale fragment dropped to bare path', closeHref(c5.doc) === '/apps', closeHref(c5.doc));
  check('5. stale fragment labelled Apps', appCloseBox(c5.doc).getAttribute('aria-label') === 'Apps', appCloseBox(c5.doc).getAttribute('aria-label'));

  // 6. No stored value: server-rendered Close box (Home) untouched.
  var c6 = makeWindow(APP_HTML, { url: APP_URL });
  check('6. no stored value keeps Home', closeHref(c6.doc) === '/', closeHref(c6.doc));
  check('6. no stored value keeps Home label', appCloseBox(c6.doc).getAttribute('aria-label') === 'Home', appCloseBox(c6.doc).getAttribute('aria-label'));

  // 7. Hostile stored values are rejected.
  var hostile = [
    'https://evil.example/',
    '//evil.example/',
    '/apps/../../etc',
    '/apps\\evil',
    '/apps\nx',
    '/apps\rx'
  ];
  for (var h = 0; h < hostile.length; h++) {
    var ch = makeWindow(APP_HTML, { url: APP_URL, stored: hostile[h] });
    check('7. hostile value rejected: ' + JSON.stringify(hostile[h]), closeHref(ch.doc) === '/', closeHref(ch.doc));
  }

  // 8. Legacy ?from= wins over storage, is stored, and is stripped.
  var c8 = makeWindow(APP_HTML, { url: APP_URL + '?from=%2Fapps&keep=1', stored: '/' });
  check('8. legacy from wins over stored value', closeHref(c8.doc) === '/apps', closeHref(c8.doc));
  check('8. legacy from written to storage', stored(c8.win) === '/apps', stored(c8.win));
  check('8. legacy from stripped from URL', c8.win.location.search === '?keep=1', c8.win.location.search);

  // 9. Invalid legacy ?from= is ignored and stripped.
  var c9 = makeWindow(APP_HTML, { url: APP_URL + '?from=%2F%2Fevil.example%2F', stored: '/apps' });
  check('9. invalid legacy from ignored', closeHref(c9.doc) === '/apps', closeHref(c9.doc));
  check('9. invalid legacy from stripped', c9.win.location.search === '', c9.win.location.search);

  // 10. Migration does not run on the Apps page or the dashboard.
  var c10 = makeWindow(APPS_HTML, { url: APPS_URL + '?from=%2Fapps', stored: '/' });
  check('10. Apps page keeps its query', c10.win.location.search === '?from=%2Fapps', c10.win.location.search);
  check('10. Apps page does not rewrite storage', stored(c10.win) === '/', stored(c10.win));
  var c10b = makeWindow(HOME_WIDGET_HTML, { url: HOME_URL + '?from=%2F', stored: '/' });
  check('10. dashboard keeps its query', c10b.win.location.search === '?from=%2F', c10b.win.location.search);

  // 11. Modal tile fetches JSON, sets the overlay fragment, no navigation.
  var modalCalls = [];
  var modalFetch = function (url) {
    modalCalls.push(url);
    return Promise.resolve({ text: function () { return Promise.resolve('{"ok":true}'); } });
  };
  var c11 = makeWindow(APPS_HTML, { url: APPS_URL, fetch: modalFetch });
  click(c11.win, c11.doc.querySelector('a.tile[href="/apps/modal-app?touch=1"]'));
  await flush();
  check('11. modal tile fetched the touch URL as JSON', modalCalls.length === 1 && modalCalls[0] === BASE + '/apps/modal-app?touch=1&format=json', modalCalls.join(','));
  check('11. modal tile revealed the overlay fragment', c11.win.location.hash === '#app-modal-app', c11.win.location.hash);
  check('11. modal tile did not navigate', c11.navAttempts.length === 0, c11.navAttempts.join('; '));
  check('11. modal tile still stored the return', stored(c11.win) === '/apps', stored(c11.win));

  // 12. Modal fetch failure falls back to the native touch URL.
  var failCalls = [];
  var failFetch = function (url) {
    failCalls.push(url);
    return Promise.reject(new Error('network down'));
  };
  var c12 = makeWindow(APPS_HTML, { url: APPS_URL, fetch: failFetch });
  click(c12.win, c12.doc.querySelector('a.tile[href="/apps/modal-app?touch=1"]'));
  await flush();
  check('12. failed modal fetch attempted the JSON URL', failCalls.length === 1, failCalls.join(','));
  check('12. failed modal fetch fell back to the touch URL', c12.navAttempts.length >= 1, c12.navAttempts.join('; '));

  // 12b. A non-modal tile never fetches.
  var plainCalls = [];
  var plainFetch = function (url) {
    plainCalls.push(url);
    return Promise.resolve({ text: function () { return Promise.resolve('{"ok":true}'); } });
  };
  var c12b = makeWindow(APPS_HTML, { url: APPS_URL, fetch: plainFetch });
  click(c12b.win, c12b.doc.querySelector('a.tile[href="/apps/notes"]'));
  await flush();
  check('12b. non-modal tile never fetches', plainCalls.length === 0, plainCalls.join(','));

  // 13. Modified click neither stores nor intercepts.
  var ctrlCalls = [];
  var ctrlFetch = function (url) {
    ctrlCalls.push(url);
    return Promise.resolve({ text: function () { return Promise.resolve('{"ok":true}'); } });
  };
  var c13 = makeWindow(APPS_HTML, { url: APPS_URL, fetch: ctrlFetch, stored: '/' });
  click(c13.win, c13.doc.querySelector('a.tile[href="/apps/modal-app?touch=1"]'), { ctrlKey: true });
  await flush();
  check('13. ctrl-click never fetches', ctrlCalls.length === 0, ctrlCalls.join(','));
  check('13. ctrl-click stores nothing', stored(c13.win) === '/', stored(c13.win));

  // 14. Throwing sessionStorage leaves the app page working, Close Home.
  var c14 = makeWindow(APP_HTML, { url: APP_URL, storageThrows: true });
  check('14. throwing storage keeps the page rendered', c14.doc.getElementById('os-main').textContent.indexOf('Count: 5') !== -1);
  check('14. throwing storage keeps Close Home', closeHref(c14.doc) === '/', closeHref(c14.doc));

  if (failures.length > 0) {
    console.log('FAILED: ' + failures.length + ' check(s): ' + failures.join(', '));
    process.exit(1);
  }
  console.log('All sessionstorage-return checks passed.');
}

main().catch(function (err) {
  console.error('Harness error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
