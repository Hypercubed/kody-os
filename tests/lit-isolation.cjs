// Lit isolation demo for shell-islands (task 1.5): the vendored Lit
// provision on a multi-section page.
//
// Kept OUTSIDE pkg/ by design: development verification, not part of
// the published package (the publish syncs pkg/ only).
//
// Demonstrates, before any app ports to the surface:
//   1. The vendored Lit file loads once and exposes window.KodyLit
//      with the expected exports (LitElement, html, css, render,
//      nothing, svg).
//   2. Two sections sharing a top-level name do not collide: each
//      section's element instance holds its own state.
//   3. Two apps cannot collide on a custom-element tag: the shell
//      defines the tag once; both sections render from the single
//      definition with no redefinition throw.
//   4. One section's failure does not break its neighbors: an
//      element that throws during render leaves the other section
//      rendering and updating.
//
// Run: node tests/lit-isolation.cjs
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

var dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://x/kody-os/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
var win = dom.window;
var doc = win.document;

// 1. Load the vendored Lit file once (the shell loads it once per page).
var litJs = fs.readFileSync(path.join(__dirname, '..', 'pkg', 'public', 'lit.js'), 'utf8');
win.eval(litJs);
var KodyLit = win.KodyLit;
check('1. vendored Lit loads once, window.KodyLit set',
  !!KodyLit && typeof KodyLit.LitElement === 'function' && typeof KodyLit.html === 'function' &&
  typeof KodyLit.css === 'function' && typeof KodyLit.render === 'function' &&
  typeof KodyLit.nothing !== 'undefined' && typeof KodyLit.svg === 'function',
  'exports=' + (KodyLit ? Object.keys(KodyLit).sort().join(',') : 'none'));

// The shell defines the shared element once (light-DOM only). App
// bundles use the tag and never define it. This test element stands
// in for an os-* element; the real os-* library lands in task 2.
var defineSrc = [
  'var LitElement = window.KodyLit.LitElement;',
  'var html = window.KodyLit.html;',
  'class OsProbe extends LitElement {',
  '  static get properties() { return { value: { type: Number } }; }',
  '  createRenderRoot() { return this; }',
  '  constructor() { super(); this.value = 0; }',
  '  render() {',
  '    if (this.value < 0) { throw new Error("negative value"); }',
  '    return html`<p class="os-probe-value">${this.value}</p>`;',
  '  }',
  '}',
  'window.customElements.define("os-probe", OsProbe);'
].join('\n');
win.eval(defineSrc);
check('2. shared element defined once by the shell (light-DOM)',
  !!win.customElements.get('os-probe'),
  'os-probe registered');

function makeSection(id, value) {
  var section = doc.createElement('section');
  section.setAttribute('data-app-id', id);
  var el = doc.createElement('os-probe');
  el.setAttribute('value', String(value));
  section.appendChild(el);
  doc.body.appendChild(section);
  return { section: section, el: el };
}

var A = makeSection('app-a', 5);
var B = makeSection('app-b', 9);

// LitElement updates are microtask-async; wait for both to render.
setTimeout(function () {
  var aText = A.el.querySelector('.os-probe-value');
  var bText = B.el.querySelector('.os-probe-value');
  check('3. two sections share the tag, both render from the single definition',
    !!aText && aText.textContent === '5' && !!bText && bText.textContent === '9',
    'A=' + (aText ? aText.textContent : 'none') + ' B=' + (bText ? bText.textContent : 'none'));

  // 4. No top-level name collision: each instance holds its own state.
  // Setting A does not change B.
  A.el.value = 6;
  return A.el.updateComplete.then(function () {
    var aText2 = A.el.querySelector('.os-probe-value');
    var bText2 = B.el.querySelector('.os-probe-value');
    check('4. instances hold independent state (no top-level name collision)',
      !!aText2 && aText2.textContent === '6' && !!bText2 && bText2.textContent === '9',
      'A=' + (aText2 ? aText2.textContent : 'none') + ' B=' + (bText2 ? bText2.textContent : 'none'));

    // 5. A redefinition throw is the browser's guard, not a collision:
    // defining the same tag twice throws, so the shell defining it once
    // is what keeps two apps from colliding.
    var redefined = false;
    try {
      win.eval('window.customElements.define("os-probe", class extends window.KodyLit.LitElement { render() { return window.KodyLit.html``; } });');
    } catch (err) {
      redefined = true;
    }
    check('5. redefining the same tag throws (shell defines once, apps never define)',
      redefined === true,
      'second define threw=' + redefined);

    // 6. One section's failure does not break its neighbor: make A throw
    // during render, then confirm B still updates.
    A.el.value = -1;
    return A.el.updateComplete.then(function () {
      // A threw; its render did not complete. B must still update.
      B.el.value = 10;
      return B.el.updateComplete.then(function () {
        var bText3 = B.el.querySelector('.os-probe-value');
        check('6. A throwing during render does not break B',
          !!bText3 && bText3.textContent === '10',
          'B=' + (bText3 ? bText3.textContent : 'none'));
        console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED');
        process.exit(failures === 0 ? 0 : 1);
      });
    }).catch(function () {
      // updateComplete rejects when the render throws; that is the
      // contained failure. B must still update.
      B.el.value = 10;
      return B.el.updateComplete.then(function () {
        var bText3 = B.el.querySelector('.os-probe-value');
        check('6. A throwing during render does not break B',
          !!bText3 && bText3.textContent === '10',
          'B=' + (bText3 ? bText3.textContent : 'none') + ' (A updateComplete rejected, contained)');
        console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED');
        process.exit(failures === 0 ? 0 : 1);
      });
    });
  });
}, 50);
