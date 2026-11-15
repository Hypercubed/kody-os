// Client-side navigation harness (client-side-navigation, task 4.1):
// the shell client navigates Home and Apps client-side, with a
// native full-load fallback.
//
// Kept OUTSIDE pkg/ by design: development verification, not part of
// the published package (the publish syncs pkg/ only).
//
// What it proves:
//   1. Home -> Apps: clicking the Apps nav link fetches the Apps page
//      as HTML, swaps #os-main, updates document.title and the nav
//      aria-current, and pushes the URL with history.pushState.
//   2. Back: a popstate to Home fetches and swaps back, without a
//      reload (the document is the same one; only #os-main changed).
//   3. Fallback: a failed fetch does not swap #os-main, and the code
//      attempts a native navigation (jsdom reports it as an
//      unimplemented navigation; that is the observable fallback).
//   4. App pages stay full-load: clicking an app link does not call
//      fetch and does not swap #os-main.
//   5. Same-page click is a no-op: clicking the link to the page
//      already shown does not fetch.
//   6. Widget fallback: a page whose #os-main contains a bundle
//      section (a Home widget) is never swapped in — it falls back
//      to a native full load so the widget's script runs.
//   7. Stale navigation: a response that arrives after a newer
//      navigation (or a same-page click) is discarded and does not
//      swap or push.
//   8. pushState failure: if history.pushState throws after the
//      swap, the code falls back to a native navigation instead of
//      leaving the new content under the old URL.
//   9. Pending Back navigation: after Back changes the URL to Home
//      while Apps is still rendered and the Home fetch is pending,
//      clicking the Home link lets the pending navigation finish
//      instead of cancelling it — the Home content swaps in and
//      Apps does not stay displayed under the Home URL.
//
// The client entry (pkg/src/client/index.ts) is TypeScript, so the
// harness bundles it with bun (bun build, browser target) to a temp
// file, then loads it in jsdom after the vendored Lit. jsdom is run
// under node (bun + jsdom misbehaves).
//
// Run: node tests/client-nav.cjs
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
var BUNDLE_PATH = '/tmp/client-nav-test-bundle.js';

var BASE = 'http://example.com';
var HOME_URL = BASE + '/';
var APPS_URL = BASE + '/apps';

var HOME_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Home - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/" aria-current="page">Home</a><a href="/apps">Apps</a><a href="/help">Help</a></nav>' +
  '<main id="os-main"><h1>Home</h1><p>Welcome home.</p></main>' +
  '</body></html>';
var APPS_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Apps - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/">Home</a><a href="/apps" aria-current="page">Apps</a><a href="/help">Help</a></nav>' +
  '<main id="os-main"><h1>Apps</h1><p>All apps listed here.</p></main>' +
  '</body></html>';
var HOME_WITH_WIDGET_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Home - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/" aria-current="page">Home</a><a href="/apps">Apps</a><a href="/help">Help</a></nav>' +
  '<main id="os-main"><h1>Home</h1><section class="widget" data-app-id="counter"><h2>Counter</h2><p>Count: 5</p></section></main>' +
  '</body></html>';
// Test 10 fixtures: an app page and the shell pages with their real
// chrome titlebar Close boxes. The app page's box points at /apps
// (from=/apps); the Apps page's box points at / (Home); Home has none.
var APP_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Link Drop - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/">Home</a><a href="/apps">Apps</a><a href="/help">Help</a></nav>' +
  '<div class="os-titlebar"><a class="os-box" href="/apps" aria-label="Apps" title="Apps"></a><h1 class="os-title">Link Drop</h1></div>' +
  '<main id="os-main"><section class="app-panel" data-app-id="link-drop"><h1>Link Drop</h1></section></main>' +
  '</body></html>';
var APPS_CLOSE_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Apps - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/">Home</a><a href="/apps" aria-current="page">Apps</a><a href="/help">Help</a></nav>' +
  '<div class="os-titlebar"><a class="os-box" href="/" aria-label="Home" title="Home"></a><h1 class="os-title">Apps</h1></div>' +
  '<main id="os-main"><h1>Apps</h1><p>All apps listed here.</p></main>' +
  '</body></html>';
var HOME_TITLEBAR_HTML = '<!doctype html><html data-app-base="" data-client-module="/_assets/client.js"><head><title>Home - kody-os</title></head><body>' +
  '<nav aria-label="Shell"><a href="/" aria-current="page">Home</a><a href="/apps">Apps</a><a href="/help">Help</a></nav>' +
  '<div class="os-titlebar"><h1 class="os-title">Home</h1></div>' +
  '<main id="os-main"><h1>Home</h1><p>Welcome home.</p></main>' +
  '</body></html>';

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

function makeWindow(html, fetchStub, navAttempts, startUrl) {
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
    url: startUrl || HOME_URL,
    runScripts: 'outside-only',
    virtualConsole: virtualConsole,
    pretendToBeVisual: true
  });
  var win = dom.window;
  win.fetch = fetchStub;
  win.eval(fs.readFileSync(LIT_PATH, 'utf8'));
  win.eval(buildClientBundle());
  return { dom: dom, win: win };
}

function nextTick() {
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}

async function flush() {
  for (var i = 0; i < 10; i++) await nextTick();
}

async function main() {
  // Test 1: Home -> Apps swap.
  var fetchCalls = [];
  var navAttempts = [];
  var fetchStub = function (url) {
    fetchCalls.push(url);
    var body = url === APPS_URL ? APPS_HTML : HOME_HTML;
    return Promise.resolve({
      url: url,
      text: function () { return Promise.resolve(body); }
    });
  };
  var ctx = makeWindow(HOME_HTML, fetchStub, navAttempts);
  var win = ctx.win;
  var doc = win.document;
  check('1. starts on Home', doc.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  var appsLink = doc.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  appsLink.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('1. fetch called for Apps', fetchCalls.length === 1 && fetchCalls[0] === APPS_URL, fetchCalls.join(','));
  check('1. #os-main swapped to Apps', doc.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  check('1. title updated to Apps', doc.title === 'Apps - kody-os', doc.title);
  check('1. aria-current moved to Apps', appsLink.getAttribute('aria-current') === 'page' && doc.querySelector('nav a[href="/"]').getAttribute('aria-current') === null);
  check('1. URL pushed to /apps', win.location.pathname === '/apps', win.location.pathname);

  // Test 2: Back (popstate) returns to Home without a reload.
  fetchCalls.length = 0;
  win.history.back();
  await flush();
  check('2. popstate fetched Home', fetchCalls.length === 1 && fetchCalls[0] === HOME_URL, fetchCalls.join(','));
  check('2. #os-main swapped back to Home', doc.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('2. title back to Home', doc.title === 'Home - kody-os', doc.title);
  check('2. aria-current back on Home', doc.querySelector('nav a[href="/"]').getAttribute('aria-current') === 'page' && appsLink.getAttribute('aria-current') === null);
  check('2. URL back to /', win.location.pathname === '/', win.location.pathname);

  // Test 3: Failed fetch falls back to native navigation.
  var failFetchCalls = [];
  var failNavAttempts = [];
  var failFetch = function (url) {
    failFetchCalls.push(url);
    return Promise.reject(new Error('network down'));
  };
  var ctx3 = makeWindow(HOME_HTML, failFetch, failNavAttempts);
  var win3 = ctx3.win;
  var doc3 = win3.document;
  var appsLink3 = doc3.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  appsLink3.dispatchEvent(new win3.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('3. fetch attempted for Apps', failFetchCalls.length === 1 && failFetchCalls[0] === APPS_URL, failFetchCalls.join(','));
  check('3. #os-main NOT swapped on failure', doc3.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('3. native navigation attempted (fallback)', failNavAttempts.length >= 1, failNavAttempts.join('; '));

  // Test 4: App pages stay full-load (not intercepted).
  var appFetchCalls = [];
  var appNavAttempts = [];
  var appFetch = function (url) {
    appFetchCalls.push(url);
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(HOME_HTML); } });
  };
  var ctx4 = makeWindow(HOME_HTML, appFetch, appNavAttempts);
  var win4 = ctx4.win;
  var doc4 = win4.document;
  var appLink = doc4.createElement('a');
  appLink.setAttribute('href', '/apps/counter');
  appLink.textContent = 'Counter';
  doc4.getElementById('os-main').appendChild(appLink);
  appLink.dispatchEvent(new win4.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('4. app link did not call fetch', appFetchCalls.length === 0, appFetchCalls.join(','));
  check('4. #os-main unchanged for app link', doc4.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('4. app link fell through to native navigation', appNavAttempts.length >= 1, appNavAttempts.join('; '));

  // Test 5: Same-page click is a no-op.
  var sameFetchCalls = [];
  var sameNavAttempts = [];
  var sameFetch = function (url) {
    sameFetchCalls.push(url);
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(HOME_HTML); } });
  };
  var ctx5 = makeWindow(HOME_HTML, sameFetch, sameNavAttempts);
  var win5 = ctx5.win;
  var doc5 = win5.document;
  var homeLink = doc5.querySelector('nav[aria-label="Shell"] a[href="/"]');
  homeLink.dispatchEvent(new win5.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('5. same-page click did not fetch', sameFetchCalls.length === 0, sameFetchCalls.join(','));
  check('5. same-page click did not navigate', sameNavAttempts.length === 0, sameNavAttempts.join('; '));

  // Test 6: A page with a bundle section (Home widget) is never
  // swapped in — it falls back to a native full load so the
  // widget's script runs and mounts the bundle.
  var widgetFetchCalls = [];
  var widgetNavAttempts = [];
  var widgetFetch = function (url) {
    widgetFetchCalls.push(url);
    var body = url === HOME_URL ? HOME_WITH_WIDGET_HTML : APPS_HTML;
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(body); } });
  };
  var ctx6 = makeWindow(APPS_HTML, widgetFetch, widgetNavAttempts, APPS_URL);
  var win6 = ctx6.win;
  var doc6 = win6.document;
  var homeLink6 = doc6.querySelector('nav[aria-label="Shell"] a[href="/"]');
  homeLink6.dispatchEvent(new win6.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('6. fetch attempted for Home', widgetFetchCalls.length === 1 && widgetFetchCalls[0] === HOME_URL, widgetFetchCalls.join(','));
  check('6. #os-main NOT swapped for widget page', doc6.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  check('6. native navigation attempted for widget page', widgetNavAttempts.length >= 1, widgetNavAttempts.join('; '));

  // Test 7: A stale navigation is discarded. Click Apps, then click
  // Home (same page) before the Apps response arrives. The Apps
  // response must not swap in afterwards.
  var deferredResolve = null;
  var staleFetchCalls = [];
  var staleNavAttempts = [];
  var staleFetch = function (url) {
    staleFetchCalls.push(url);
    return new Promise(function (resolve) {
      deferredResolve = function () {
        resolve({ url: url, text: function () { return Promise.resolve(APPS_HTML); } });
      };
    });
  };
  var ctx7 = makeWindow(HOME_HTML, staleFetch, staleNavAttempts);
  var win7 = ctx7.win;
  var doc7 = win7.document;
  var appsLink7 = doc7.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  var homeLink7 = doc7.querySelector('nav[aria-label="Shell"] a[href="/"]');
  appsLink7.dispatchEvent(new win7.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await nextTick();
  // The Apps fetch is still pending; the user clicks Home (same page).
  homeLink7.dispatchEvent(new win7.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await nextTick();
  // Now the Apps response arrives — it must be ignored.
  if (deferredResolve) deferredResolve();
  await flush();
  check('7. stale Apps response did not swap', doc7.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('7. URL stayed on Home after stale response', win7.location.pathname === '/', win7.location.pathname);
  check('7. stale response did not navigate', staleNavAttempts.length === 0, staleNavAttempts.join('; '));

  // Test 8: A pushState failure falls back to a native navigation
  // instead of leaving the new content under the old URL.
  var pushFetchCalls = [];
  var pushNavAttempts = [];
  var pushFetch = function (url) {
    pushFetchCalls.push(url);
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(APPS_HTML); } });
  };
  var ctx8 = makeWindow(HOME_HTML, pushFetch, pushNavAttempts);
  var win8 = ctx8.win;
  var doc8 = win8.document;
  win8.history.pushState = function () { throw new Error('pushState failed'); };
  var appsLink8 = doc8.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  appsLink8.dispatchEvent(new win8.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('8. content swapped before pushState', doc8.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  check('8. pushState failure fell back to native navigation', pushNavAttempts.length >= 1, pushNavAttempts.join('; '));

  // Test 9: A click does not cancel a pending Back navigation.
  // Go Home -> Apps, then Back to Home (the URL becomes Home while
  // Apps is still rendered and the Home fetch is pending). Clicking
  // the Home link then must let the pending Home navigation finish
  // instead of cancelling it — otherwise Apps stays displayed under
  // the Home URL.
  var deferredHomeResolve = null;
  var backFetchCalls = [];
  var backNavAttempts = [];
  var backFetch = function (url) {
    backFetchCalls.push(url);
    if (url === HOME_URL) {
      return new Promise(function (resolve) {
        deferredHomeResolve = function () {
          resolve({ url: url, text: function () { return Promise.resolve(HOME_HTML); } });
        };
      });
    }
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(APPS_HTML); } });
  };
  var ctx9 = makeWindow(HOME_HTML, backFetch, backNavAttempts);
  var win9 = ctx9.win;
  var doc9 = win9.document;
  var appsLink9 = doc9.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  var homeLink9 = doc9.querySelector('nav[aria-label="Shell"] a[href="/"]');
  appsLink9.dispatchEvent(new win9.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('9. navigated to Apps first', win9.location.pathname === '/apps', win9.location.pathname);
  // Back: the URL becomes Home and the Home fetch starts (deferred).
  win9.history.back();
  await nextTick();
  check('9. Back changed URL to Home', win9.location.pathname === '/', win9.location.pathname);
  check('9. Apps still rendered while Home fetch pending', doc9.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  // Click Home while the Back fetch is pending: must not cancel it.
  homeLink9.dispatchEvent(new win9.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await nextTick();
  check('9. Home click did not fetch a duplicate', backFetchCalls.filter(function (u) { return u === HOME_URL; }).length === 1, backFetchCalls.join(','));
  // The pending Home fetch resolves: it must swap in Home content.
  if (deferredHomeResolve) deferredHomeResolve();
  await flush();
  check('9. pending Home navigation finished and swapped', doc9.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('9. URL is Home after pending navigation', win9.location.pathname === '/', win9.location.pathname);
  check('9. no native navigation from the Home click', backNavAttempts.length === 0, backNavAttempts.join('; '));

  // Test 10: The chrome Close box syncs on a swap. The swap replaces
  // #os-main only, so without syncing the Close box keeps the previous
  // page's destination. Closing an app to Apps leaves a stale box
  // pointing at /apps (the page just rendered), and the same-page check
  // swallows the click — the Close button appears dead.
  var closeFetchCalls = [];
  var closeNavAttempts = [];
  var closeFetch = function (url) {
    closeFetchCalls.push(url);
    var body = url === APPS_URL ? APPS_CLOSE_HTML : HOME_TITLEBAR_HTML;
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(body); } });
  };
  var ctx10 = makeWindow(APP_HTML, closeFetch, closeNavAttempts, BASE + '/apps/link-drop?from=/apps');
  var win10 = ctx10.win;
  var doc10 = win10.document;
  var closeBox10 = doc10.querySelector('.os-titlebar a.os-box');
  check('10. app page Close box points at Apps', closeBox10 && closeBox10.getAttribute('href') === '/apps', closeBox10 ? closeBox10.getAttribute('href') : 'missing');
  closeBox10.dispatchEvent(new win10.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('10. swapped to Apps', doc10.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  check('10. URL is Apps after Close', win10.location.pathname === '/apps', win10.location.pathname);
  var closeBox10b = doc10.querySelector('.os-titlebar a.os-box');
  check('10. Close box synced to Home after swap', closeBox10b && closeBox10b.getAttribute('href') === '/', closeBox10b ? closeBox10b.getAttribute('href') : 'missing');
  check('10. Close box label synced to Home', closeBox10b && closeBox10b.getAttribute('aria-label') === 'Home', closeBox10b ? closeBox10b.getAttribute('aria-label') : 'missing');
  // Close the Apps page -> / (Home). Must fetch Home and swap; Home has
  // no Close box, so it must be removed.
  closeBox10b.dispatchEvent(new win10.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('10. Close on Apps fetched Home', closeFetchCalls.indexOf(HOME_URL) !== -1, closeFetchCalls.join(','));
  check('10. swapped to Home', doc10.getElementById('os-main').textContent.indexOf('Welcome home.') !== -1);
  check('10. URL is Home after second Close', win10.location.pathname === '/', win10.location.pathname);
  check('10. Close box removed on Home', doc10.querySelector('.os-titlebar a.os-box') === null);
  check('10. no native navigation from either Close', closeNavAttempts.length === 0, closeNavAttempts.join('; '));

  // Test 11: A same-page click that cancels a pending navigation restores
  // the browser URL to the rendered page. After Back the URL is Home
  // while Apps is still rendered and the Home fetch is pending; clicking
  // the Apps link (the rendered page) cancels the pending navigation,
  // and without restoring the URL Apps would stay displayed under the
  // Home URL.
  var cancelFetchCalls = [];
  var cancelNavAttempts = [];
  var cancelDeferredHomeResolve = null;
  var cancelFetch = function (url) {
    cancelFetchCalls.push(url);
    if (url === HOME_URL) {
      return new Promise(function (resolve) {
        cancelDeferredHomeResolve = function () {
          resolve({ url: url, text: function () { return Promise.resolve(HOME_HTML); } });
        };
      });
    }
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(APPS_HTML); } });
  };
  var ctx11 = makeWindow(HOME_HTML, cancelFetch, cancelNavAttempts);
  var win11 = ctx11.win;
  var doc11 = win11.document;
  var appsLink11 = doc11.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  appsLink11.dispatchEvent(new win11.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('11. navigated to Apps first', win11.location.pathname === '/apps', win11.location.pathname);
  // Back: URL becomes Home, Apps still rendered, Home fetch pending (deferred).
  win11.history.back();
  await nextTick();
  check('11. Back changed URL to Home', win11.location.pathname === '/', win11.location.pathname);
  check('11. Apps still rendered while Home fetch pending', doc11.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  // Click the Apps link (the rendered page): a same-page click. It must
  // cancel the pending Home navigation and restore the URL to /apps.
  appsLink11.dispatchEvent(new win11.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await nextTick();
  check('11. same-page click restored URL to Apps', win11.location.pathname === '/apps', win11.location.pathname);
  check('11. Apps still rendered after cancel', doc11.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  // The cancelled Home fetch resolves: it must not swap (stale).
  if (cancelDeferredHomeResolve) cancelDeferredHomeResolve();
  await flush();
  check('11. cancelled Home fetch did not swap', doc11.getElementById('os-main').textContent.indexOf('All apps listed here.') !== -1);
  check('11. URL still Apps after stale fetch resolves', win11.location.pathname === '/apps', win11.location.pathname);
  check('11. no native navigation from the cancel', cancelNavAttempts.length === 0, cancelNavAttempts.join('; '));

  // Test 12: A same-page cancel whose URL restore fails falls back to a
  // native full load of the rendered page. Same setup as Test 11, but
  // history.replaceState throws, so the catch must navigate natively
  // to the rendered Apps URL instead of leaving Apps displayed under
  // the Home URL.
  var failFetchCalls = [];
  var failNavAttempts = [];
  var failDeferredHomeResolve = null;
  var failFetch = function (url) {
    failFetchCalls.push(url);
    if (url === HOME_URL) {
      return new Promise(function (resolve) {
        failDeferredHomeResolve = function () {
          resolve({ url: url, text: function () { return Promise.resolve(HOME_HTML); } });
        };
      });
    }
    return Promise.resolve({ url: url, text: function () { return Promise.resolve(APPS_HTML); } });
  };
  var ctx12 = makeWindow(HOME_HTML, failFetch, failNavAttempts);
  var win12 = ctx12.win;
  var doc12 = win12.document;
  var appsLink12 = doc12.querySelector('nav[aria-label="Shell"] a[href="/apps"]');
  appsLink12.dispatchEvent(new win12.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('12. navigated to Apps first', win12.location.pathname === '/apps', win12.location.pathname);
  // Back: URL becomes Home, Apps still rendered, Home fetch pending (deferred).
  win12.history.back();
  await nextTick();
  check('12. Back changed URL to Home', win12.location.pathname === '/', win12.location.pathname);
  // Make the URL restore fail.
  win12.history.replaceState = function () { throw new Error('replaceState failed'); };
  // Click the Apps link (the rendered page): a same-page click. The
  // restore throws, so the catch must fall back to a native load of /apps.
  appsLink12.dispatchEvent(new win12.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await flush();
  check('12. failed restore fell back to a native navigation', failNavAttempts.length >= 1, failNavAttempts.join('; '));

  if (failures.length > 0) {
    console.log('FAILED: ' + failures.length + ' check(s): ' + failures.join(', '));
    process.exit(1);
  }
  console.log('All client-nav checks passed.');
}

main().catch(function (err) {
  console.error('Harness error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
