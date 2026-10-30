// Regression test for the Oct 2026 home-widget Counter bug.
//
// Before the fix, renderWidgetSection emitted <section class="widget">
// with no data-app-id, so on the home dashboard the Counter bundle
// handed the bridge a null section, the bridge returned the FIRST seed
// script on the page (another app's, e.g. {}), and the Counter painted
// "undefined" until a button press treated it as 0.
//
// This test mirrors a home page: a Clock widget FIRST (seed {}), then
// the Counter widget (seed {count: 7}). It asserts the Counter paints
// 7, not "undefined", and that a +1 step dispatches value 8.
// Kept OUTSIDE pkg/ by design (development verification, not published).
//
// Run: node tests/home-widget-counter.cjs
// jsdom resolution, in order: JSDOM_PATH env, /tmp/jsdom-test, resolvable jsdom.
'use strict';
var fs = require('fs');
var path = require('path');
var JSDOM;
try {
  JSDOM = require(process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom').JSDOM;
} catch (err) {
  JSDOM = require('jsdom').JSDOM;
}
var failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) failures += 1;
}

var bridgeJs = fs.readFileSync(path.join(__dirname, '..', 'pkg', 'src', 'bridge', 'bridge.js'), 'utf8');
var counterDef = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pkg', 'examples', 'counter.bundle.json'), 'utf8'));
var counterScript = counterDef.bundle.files['index.html'].match(/<script>([\s\S]*?)<\/script>/)[1];

var fetchCalls = [];
var resolveFetch = null;
function mockFetch(url) {
  fetchCalls.push(url);
  return new Promise(function (res) {
    resolveFetch = function (data) { res({ json: function () { return Promise.resolve(data); } }); };
  });
}

var html = '<!doctype html><html><head><script>' + bridgeJs.replace(/<\/script>/g, '<\\/script>') + '</script></head><body>' +
  '<section class="widget" data-app-id="clock" aria-label="Clock">' +
  '<script type="application/json" data-kody-state-seed="1" data-app-id="clock">{}</script>' +
  '<div class="bundle" data-bundle="clock"></div></section>' +
  '<section class="widget" data-app-id="counter" aria-label="Counter">' +
  '<div class="app-body">' +
  '<script type="application/json" data-kody-state-seed="1" data-app-id="counter">{"count":7}</script>' +
  '<div class="bundle" data-bundle="counter" data-action-base="/apps/counter">' +
  '<div class="counter-wrap"><p class="counter-num">7</p>' +
  '<button class="counter-step" data-delta="1">+1</button>' +
  '<button class="counter-step" data-delta="-1">-1</button></div>' +
  '<script>' + counterScript.replace(/<\/script>/g, '<\\/script>') + '</script>' +
  '</div>' +
  '<p data-field="count">count: <span>7</span></p>' +
  '<form class="app-action" method="GET" action="/apps/counter"><input type="hidden" name="action" value="reset_count" /><button type="submit">Reset</button></form>' +
  '</div></section></body></html>';

var dom = new JSDOM(html, {
  url: 'https://x/kody-os/?k=TEST',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse: function (window) { window.fetch = mockFetch; }
});

dom.window.addEventListener('load', function () {
  setTimeout(function () {
    var num = dom.window.document.querySelector('.counter-num');
    check('1. home widget Counter paints real count, not undefined',
      num && num.textContent === '7', 'counter-num=' + (num && num.textContent));
    check('2. bridge refuses an unmatched seed',
      dom.window.KodyBridge.readSeedScript(null) === null,
      'readSeedScript(null)=' + dom.window.KodyBridge.readSeedScript(null));
    var plus = dom.window.document.querySelector('.counter-step[data-delta="1"]');
    plus.click();
    setTimeout(function () {
      check('3. +1 step dispatches from 7, not from 0',
        fetchCalls.length === 1 && fetchCalls[0].indexOf('value=8') !== -1,
        'fetch=' + JSON.stringify(fetchCalls));
      resolveFetch({ ok: true, state: { count: 8 } });
      setTimeout(function () {
        check('4. server reply paints 8', num.textContent === '8', 'counter-num=' + num.textContent);
        console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED');
        process.exit(failures === 0 ? 0 : 1);
      }, 50);
    }, 50);
  }, 50);
});
