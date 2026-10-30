// Multi-section isolation demo for the KodyBridge v1 store.
//
// Kept OUTSIDE pkg/ by design: it is development verification, not part of
// the published package, so it must not ride along in a Kody publish
// (the publish syncs pkg/ only).
//
// Run: node tests/isolation-demo.cjs
// jsdom resolution, in order: JSDOM_PATH env, /tmp/jsdom-test (the
// ephemeral install the Counter harness uses), or a resolvable jsdom.
// Exit code 0 = all checks passed, 1 = a check failed.
'use strict';
var fs = require('fs');
var path = require('path');
var JSDOM;
try {
  var jsdomPath = process.env.JSDOM_PATH || '/tmp/jsdom-test/node_modules/jsdom';
  JSDOM = require(jsdomPath).JSDOM;
} catch (err) {
  JSDOM = require('jsdom').JSDOM;
}

var failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) failures += 1;
}

var dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://x/kody-os/?k=TEST',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
var doc = dom.window.document;

function makeSection(id, count, actionBase) {
  var section = doc.createElement('section');
  section.setAttribute('data-app-id', id);
  var bundle = doc.createElement('div');
  bundle.className = 'bundle';
  bundle.setAttribute('data-action-base', actionBase);
  section.appendChild(bundle);
  var p = doc.createElement('p');
  p.setAttribute('data-field', 'count');
  var span = doc.createElement('span');
  span.textContent = String(count);
  p.appendChild(span);
  section.appendChild(p);
  var form = doc.createElement('form');
  form.className = 'app-action';
  var inp = doc.createElement('input');
  inp.setAttribute('name', 'action');
  inp.value = 'reset_count';
  form.appendChild(inp);
  section.appendChild(form);
  doc.body.appendChild(section);
  var seed = doc.createElement('script');
  seed.setAttribute('type', 'application/json');
  seed.setAttribute('data-kody-state-seed', '1');
  seed.setAttribute('data-app-id', id);
  seed.textContent = JSON.stringify({ count: count });
  doc.body.appendChild(seed);
  return { section: section, span: span, form: form };
}

var A = makeSection('counter-a', 5, '/apps/counter-a');
var B = makeSection('counter-b', 9, '/apps/counter-b');
dom.window.eval(fs.readFileSync(
  path.join(__dirname, '..', 'pkg', 'src', 'bridge', 'bridge.js'), 'utf8'));

function mockFetch() {
  var calls = [];
  var resolveNext = null;
  var fn = function (url) {
    calls.push(url);
    return new Promise(function (res) {
      resolveNext = function (data) {
        res({ json: function () { return Promise.resolve(data); } });
      };
    });
  };
  fn.calls = calls;
  fn.resolveNext = function (data) { if (resolveNext) resolveNext(data); };
  return fn;
}
var fetchA = mockFetch();
var fetchB = mockFetch();
var storeA = dom.window.KodyBridge.create(A.section, { fieldTypes: { count: 'integer' }, fetchFn: fetchA });
var storeB = dom.window.KodyBridge.create(B.section, { fieldTypes: { count: 'integer' }, fetchFn: fetchB });
storeA.startSpanObserver();
storeB.startSpanObserver();
var aSnaps = [];
var bSnaps = [];
storeA.subscribe(function (s) { aSnaps.push(s.desired.count); });
storeB.subscribe(function (s) { bSnaps.push(s.desired.count); });
storeA.subscribe(function () { throw new Error('boom in A subscriber'); });

check('1. seeds isolated', storeA.get('count') === 5 && storeB.get('count') === 9,
  'A=' + storeA.get('count') + ' B=' + storeB.get('count'));

storeA.dispatch('set_count', { value: 6 }, { count: 6 }, null);
check('2. step A only',
  storeA.get('count') === 6 && storeB.get('count') === 9 &&
  A.span.textContent === '6' && B.span.textContent === '9' &&
  fetchA.calls.length === 1 && fetchB.calls.length === 0 && bSnaps.length === 0,
  'A=' + storeA.get('count') + ' B=' + storeB.get('count') +
  ' fetchA=' + fetchA.calls.length + ' fetchB=' + fetchB.calls.length);

fetchA.resolveNext({ ok: true, state: { count: 6 } });
setTimeout(function () {
  check('3. throwing A subscriber did not stop good A subscriber or affect B',
    storeA.get('count') === 6 && storeB.get('count') === 9 && aSnaps.length === 2,
    'A snaps=' + JSON.stringify(aSnaps));
  storeA.setEphemeral('draft', 'a-only');
  check('4. ephemeral isolated',
    JSON.stringify(storeA.getState().ephemeral) === '{"draft":"a-only"}' &&
    JSON.stringify(storeB.getState().ephemeral) === '{}',
    'A=' + JSON.stringify(storeA.getState().ephemeral) +
    ' B=' + JSON.stringify(storeB.getState().ephemeral));
  A.span.textContent = '0';
  setTimeout(function () {
    check('5. span patch in A only',
      storeA.get('count') === 0 && storeB.get('count') === 9 && B.span.textContent === '9',
      'A=' + storeA.get('count') + ' B=' + storeB.get('count'));
    storeA.claimForm(A.form, 'reset_count', function () { return { value: 0 }; }, null);
    var evB = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    B.form.dispatchEvent(evB);
    check('6. submit on B form NOT claimed by A store',
      evB.defaultPrevented === false && storeB.get('count') === 9,
      'defaultPrevented=' + evB.defaultPrevented);
    var evA = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    A.form.dispatchEvent(evA);
    check('7. submit on A form claimed by A store',
      evA.defaultPrevented === true && storeA.get('count') === 0,
      'defaultPrevented=' + evA.defaultPrevented + ' A=' + storeA.get('count'));
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED');
    process.exit(failures === 0 ? 0 : 1);
  }, 50);
}, 50);
