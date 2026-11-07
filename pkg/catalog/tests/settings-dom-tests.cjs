/* Node-stub DOM tests for the Settings bundle (daily-feed / generic-feed
 * pattern: no jsdom, a hand-rolled document stub).
 *
 * Loads the bundle script exactly as stored in ../settings/definition.json,
 * with a stub document (getElementById, querySelector for the .st root,
 * querySelectorAll for the forms), a stub window, and a stub fetch.
 * Checks the pure helpers, the read-route render (values, badges,
 * custom grid / custom mark notices), the form submit flows (desk,
 * name, title, icon, reset-all) through format=json with in-place
 * re-render and no navigation, the error path, and the native-submit
 * fallback when fetch rejects. Run with:
 * node pkg/catalog/tests/settings-dom-tests.cjs
 */
const fs = require('fs');
const path = require('path');

const DEFINITION_PATH = path.join(__dirname, '..', 'settings/definition.json');
const loadedBundle = require('./read-bundle.cjs').readBundleFiles(DEFINITION_PATH);
const definition = loadedBundle.definition;
const html = loadedBundle.files[definition.bundle.entry];
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('ok - ' + msg);
  } else {
    failures += 1;
    console.error('FAIL - ' + msg);
  }
}
function flush() { return new Promise(function (r) { setTimeout(r, 0); }); }
async function settle() { await flush(); await flush(); await flush(); }

const DEFAULTS = { name: 'kody-os', title: '', icon: '', background: 'desk', showHelp: true, showAbout: true };
const READ_FIXTURE = {
  ok: true,
  defaults: DEFAULTS,
  override: { background: 'paper' },
  effective: { name: 'kody-os', title: 'kody-os', icon: '', background: 'paper', showHelp: true, showAbout: true },
};
const GRID = [0, 1, 2, 3, 4, 5, 6, 7];
const SVG_ICON = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const GRID_FIXTURE = {
  ok: true,
  defaults: DEFAULTS,
  override: { background: { grid: GRID }, icon: SVG_ICON },
  effective: { name: 'kody-os', title: 'kody-os', icon: SVG_ICON, background: { grid: GRID }, showHelp: true, showAbout: true },
};

const IDS = ['st-status', 'st-panel', 'st-background-value', 'st-background-badge',
  'st-background-note', 'st-name-value', 'st-name-badge',
  'st-icon-value', 'st-icon-badge', 'st-icon-note',
  'st-name-input', 'st-icon-input', 'st-bg-desk', 'st-bg-paper',
  'st-showHelp-value', 'st-showHelp-badge', 'st-showAbout-value', 'st-showAbout-badge',
  'st-showHelp-toggle', 'st-showHelp-want', 'st-showAbout-toggle', 'st-showAbout-want'];

function makeEl() {
  return {
    nodeType: 1, textContent: '', value: '', style: {}, handlers: {}, attrs: {},
    getAttribute: function (name) { return this.attrs[name] || null; },
    setAttribute: function (name, value) { this.attrs[name] = String(value); },
    removeAttribute: function (name) { delete this.attrs[name]; },
    parentNode: null,
    addEventListener: function (type, fn) { this.handlers[type] = fn; },
  };
}
function makeForm(action, elements) {
  var form = makeEl();
  var attrs = { action: action };
  form.elements = elements;
  form.submitted = false;
  form.submit = function () { form.submitted = true; };
  form.getAttribute = function (name) { return name === 'action' ? attrs.action : null; };
  form.setAttribute = function (name, value) { if (name === 'action') attrs.action = value; };
  var shadow = null;
  for (var i = 0; i < elements.length; i++) {
    if (elements[i].name === 'action') { shadow = elements[i]; break; }
  }
  Object.defineProperty(form, 'action', {
    configurable: true,
    get: function () { return shadow || attrs.action; },
    set: function (value) { attrs.action = value; },
  });
  return form;
}
function makeBrand() {
  var brand = makeEl();
  var mark = makeEl();
  mark.tagName = 'IMG';
  mark.attrs.src = '/_assets/favicon.png';
  mark.attrs['class'] = 'os-mark-img';
  var text = { nodeType: 3, data: 'kody-os' };
  brand.childNodes = [mark, text];
  brand.firstChild = mark;
  function sync() { brand.firstChild = brand.childNodes[0] || null; }
  brand.removeChild = function (kid) { var i = brand.childNodes.indexOf(kid); if (i !== -1) brand.childNodes.splice(i, 1); sync(); return kid; };
  brand.appendChild = function (kid) { brand.childNodes.push(kid); sync(); return kid; };
  brand.replaceChild = function (kid, old) { var i = brand.childNodes.indexOf(old); if (i !== -1) brand.childNodes[i] = kid; sync(); return old; };
  brand.insertBefore = function (kid, ref) { var i = brand.childNodes.indexOf(ref); if (i === -1) brand.childNodes.push(kid); else brand.childNodes.splice(i, 0, kid); sync(); return kid; };
  return brand;
}
function brandText(brand) {
  for (var i = 0; i < brand.childNodes.length; i++) {
    if (brand.childNodes[i].nodeType === 3) return brand.childNodes[i].data;
  }
  return null;
}
function brandMark(brand) {
  for (var i = 0; i < brand.childNodes.length; i++) {
    if (brand.childNodes[i].nodeType === 1) return brand.childNodes[i];
  }
  return null;
}
function parseForms(markup, byId) {
  var out = [];
  var formRe = /<form[\s\S]*?<\/form>/g;
  var fm;
  while ((fm = formRe.exec(markup)) !== null) {
    var fh = fm[0];
    var action = /action="([^"]*)"/.exec(fh)[1];
    var els = [];
    var inputRe = /<input[^>]*>/g;
    var im;
    while ((im = inputRe.exec(fh)) !== null) {
      var tag = im[0];
      var name = /name="([^"]*)"/.exec(tag);
      var value = /value="([^"]*)"/.exec(tag);
      var id = /id="([^"]*)"/.exec(tag);
      if (id && byId[id[1]]) {
        var el = byId[id[1]];
        el.name = name ? name[1] : '';
        el.value = value ? value[1] : '';
        els.push(el);
      } else {
        els.push({ name: name ? name[1] : '', value: value ? value[1] : '' });
      }
    }
    out.push(makeForm(action, els));
  }
  return out;
}

function runScenario(readFixture, useActionBase) {
  var byId = {};
  IDS.forEach(function (id) { byId[id] = makeEl(); });
  var wrapper = makeEl();
  wrapper.getAttribute = function (name) {
    if (name === 'data-action-base' && useActionBase) return '/kody-os/apps/settings';
    return null;
  };
  var root = makeEl();
  root.parentNode = wrapper;
  var forms = parseForms(html, byId);
  var bodyStub = makeEl();
  var brandStub = makeBrand();
  var iconLink = makeEl();
  iconLink.attrs.href = '/_assets/favicon.png';
  var menuLinks = [];
  var helpLink = makeEl(); helpLink.attrs.href = '/kody-os/help'; menuLinks.push(helpLink);
  var aboutLink = makeEl(); aboutLink.attrs.href = '/kody-os/about'; menuLinks.push(aboutLink);
  var appLink = makeEl(); appLink.attrs.href = '/kody-os/apps/counter'; menuLinks.push(appLink);
  var calls = [];
  var queue = [];
  function fetchStub(url, opts) {
    calls.push(url);
    var next = queue.length > 0 ? queue.shift() : readFixture;
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({ json: function () { return Promise.resolve(next); } });
  }
  var docStub = {
    title: 'Settings ' + '\u00b7' + ' kody-os',
    body: bodyStub,
    createTextNode: function (text) { return { nodeType: 3, data: String(text) }; },
    createElement: function (tag) { var el = makeEl(); el.tagName = String(tag).toUpperCase(); return el; },
    querySelector: function (sel) {
      if (sel === '.st') return root;
      if (sel === '.os-brand') return brandStub;
      if (sel === 'link[rel="icon"]') return iconLink;
      return null;
    },
    querySelectorAll: function (sel) { if (sel === '.st form') return forms; if (sel === 'a') return menuLinks; return []; },
    getElementById: function (id) { return byId[id] || null; },
  };
  global.document = docStub;
  global.window = { location: { pathname: '/kody-os/apps/settings' } };
  global.fetch = fetchStub;
  (0, eval)(script);
  return { byId: byId, forms: forms, calls: calls, queue: queue, menuLinks: menuLinks, doc: docStub, brand: brandStub };
}
function findForm(forms, name, value) {
  for (var i = 0; i < forms.length; i++) {
    var els = forms[i].elements;
    for (var j = 0; j < els.length; j++) {
      if (els[j].name === name && (value === undefined || els[j].value === value)) return forms[i];
    }
  }
  return null;
}

async function main() {
  // Pure helpers (loaded by the scenario eval; no DOM needed to call them).
  var s0 = runScenario(READ_FIXTURE, true);
  await settle();
  check(typeof global.stAppIdFromBase === 'function', 'pure helpers load without a DOM');
  check(global.stAppIdFromBase('/kody-os/apps/settings') === 'settings', 'app id resolves from data-action-base');
  check(global.stAppIdFromBase('/apps/settings') === 'settings', 'app id resolves from a root mount');
  check(global.stAppIdFromBase('/kody-os/apps/') === '', 'missing id resolves to empty');
  check(global.stThemeBase('/kody-os/apps/settings') === '/kody-os/theme/settings', 'theme base keeps the mount prefix');
  check(global.stThemeBase('/apps/settings') === '/theme/settings', 'theme base works from a root mount');
  check(global.stIsGrid({ grid: GRID }) === true, 'grid background detected');
  check(global.stIsGrid('desk') === false, 'desk is not a grid');
  check(global.stIsGrid(null) === false, 'null is not a grid');
  check(global.stIsSvg(SVG_ICON) === true, 'svg icon detected');
  check(global.stIsSvg('\u2699') === false, 'glyph is not svg');
  check(global.stIsSvg('') === false, 'empty icon is not svg');
  check(global.stBadgeState('background', { background: 'paper' }) === 'changed', 'overridden field badges changed');
  check(global.stBadgeState('name', {}) === 'default', 'default field badges default');
  check(global.stDisplayValue('background', { background: { grid: GRID } }) === 'custom grid', 'grid displays as custom grid');
  check(global.stDisplayValue('background', { background: 'desk' }) === 'desk', 'desk displays as desk');
  check(global.stDisplayValue('icon', { icon: '' }) === 'stock mark', 'empty icon displays as stock mark');
  check(global.stDisplayValue('icon', { icon: SVG_ICON }) === 'custom mark', 'svg displays as custom mark');
  check(global.stDisplayValue('name', { name: 'kody-os' }) === 'kody-os', 'name displays as-is');
  check(global.stDisplayValue('showHelp', { showHelp: true }) === 'shown', 'shown flag displays as shown');
  check(global.stDisplayValue('showAbout', { showAbout: false }) === 'hidden', 'hidden flag displays as hidden');

  // Read-route render (paper fixture).
  check(s0.calls.length === 1 && s0.calls[0] === '/kody-os/theme/settings?format=json', 'load fetches the read route with format=json (got ' + s0.calls[0] + ')');
  check(s0.byId['st-background-value'].textContent === 'paper', 'background value renders');
  check(s0.byId['st-background-badge'].textContent === 'changed', 'background badge renders as changed');
  check(s0.byId['st-background-badge'].className.indexOf('st-badge-changed') !== -1, 'background badge is inverted when changed');
  check(s0.byId['st-name-value'].textContent === 'kody-os', 'name value renders');
  check(s0.byId['st-name-badge'].textContent === 'default', 'name badge renders as default');
  check(s0.byId['st-name-badge'].className.indexOf('st-badge-changed') === -1, 'name badge is plain when default');
  check(s0.byId['st-icon-value'].textContent === 'stock mark', 'icon value renders as stock mark');
  check(s0.byId['st-showHelp-value'].textContent === 'shown', 'Help page state renders as shown');
  check(s0.byId['st-showHelp-badge'].textContent === 'default', 'Help page state badge renders as default');
  check(s0.byId['st-showAbout-value'].textContent === 'shown', 'About page state renders as shown');
  check(s0.byId['st-name-input'].value === 'kody-os', 'name input is prefilled with the effective name');
  check(s0.doc.title === 'Settings ' + '\u00b7' + ' kody-os', 'chrome title renders from the effective title');
  check(brandText(s0.brand) === 'kody-os', 'menu brand shows the effective name');
  check(brandMark(s0.brand).tagName === 'IMG', 'stock mark renders as an image');
  check(s0.doc.body.attrs.style === 'background: #fff', 'paper background applies to the body inline');
  check(s0.byId['st-icon-input'].value === '', 'icon input is blank with no icon override');
  check(s0.byId['st-bg-paper'].className === 'os-btn--dark', 'paper segment is inverted when effective');
  check(s0.byId['st-bg-desk'].className === '', 'desk segment is plain when not effective');
  check(s0.byId['st-showHelp-toggle'].className === 'edit-toggle-btn', 'Help toggle is plain when shown');
  check(s0.byId['st-showHelp-want'].value === '0', 'Help toggle submits hide when shown');
  check(s0.byId['st-panel'].style.display === '', 'panel shows after a successful read');
  check(s0.byId['st-status'].textContent === '', 'status clears after a successful read');
  check(s0.byId['st-background-note'].style.display === 'none', 'grid notice hidden for desk/paper');
  check(s0.byId['st-icon-note'].style.display === 'none', 'mark notice hidden for stock/glyph');
  check(s0.forms.length === 12, 'twelve forms wired (got ' + s0.forms.length + ')');
  check(s0.forms[0].getAttribute('action') === '/kody-os/theme/settings', 'form action attribute is the derived theme route');
  // Regression: hidden inputs named 'action' shadow form.action in a real DOM,
  // so the submit handler must read the action attribute, not the property.
  check(typeof s0.forms[0].action !== 'string' && s0.forms[0].action.name === 'action', 'form.action is shadowed by the hidden input named action');
  check(s0.forms.every(function (f) { return !f.submitted; }), 'no navigation on load');

  // Desk submit: JSON round-trip, re-render, no navigation.
  var deskForm = findForm(s0.forms, 'background', 'desk');
  check(deskForm !== null, 'desk form found');
  var callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'desk' }, effective: { name: 'kody-os', title: 'kody-os', icon: '', background: 'desk' } });
  s0.queue.push({ ok: true, defaults: DEFAULTS, override: { background: 'desk' }, effective: { name: 'kody-os', title: 'kody-os', icon: '', background: 'desk' } });
  deskForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  var deskUrl = s0.calls[callsBefore];
  check(deskUrl.indexOf('/kody-os/theme/settings?') === 0, 'desk submit goes to the theme route');
  check(deskUrl.indexOf('action=set') !== -1 && deskUrl.indexOf('background=desk') !== -1, 'desk submit carries action=set and background=desk');
  check(deskUrl.indexOf('format=json') !== -1, 'desk submit asks for format=json');
  check(deskUrl.indexOf('from=%2Fkody-os%2Fapps%2Fsettings') !== -1, 'desk submit carries from=current page');
  check(s0.calls.length > callsBefore + 1, 'desk submit re-reads the theme after saving');
  check(deskForm.submitted === false, 'desk submit does not navigate');
  check(s0.doc.body.attrs.style === undefined, 'desk removes the body inline style with no refresh');

  // Name submit: the typed input value flows through.
  var nameForm = findForm(s0.forms, 'name', 'kody-os');
  check(nameForm !== null, 'name form found');
  s0.byId['st-name-input'].value = 'verify-name';
  callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'paper', name: 'verify-name' }, effective: { name: 'verify-name', title: 'verify-name', icon: '', background: 'paper' } });
  s0.queue.push({ ok: true, defaults: DEFAULTS, override: { background: 'paper', name: 'verify-name' }, effective: { name: 'verify-name', title: 'verify-name', icon: '', background: 'paper' } });
  nameForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('name=verify-name') !== -1, 'name submit carries the typed name');
  check(nameForm.submitted === false, 'name submit does not navigate');
  check(s0.doc.title === 'Settings ' + '\u00b7' + ' verify-name', 'save repaints the chrome title with no refresh');
  check(brandText(s0.brand) === 'verify-name', 'save repaints the menu brand with no refresh');

  // Pages submit: hiding About flows through action=set + showAbout=0.
  var hideAbout = findForm(s0.forms, 'showAbout', '0');
  check(hideAbout !== null, 'hide-About form found');
  callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'paper', showAbout: false }, effective: { name: 'kody-os', title: 'kody-os', icon: '', background: 'paper', showHelp: true, showAbout: false } });
  s0.queue.push({ ok: true, defaults: DEFAULTS, override: { background: 'paper', showAbout: false }, effective: { name: 'kody-os', title: 'kody-os', icon: '', background: 'paper', showHelp: true, showAbout: false } });
  hideAbout.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('action=set') !== -1 && s0.calls[callsBefore].indexOf('showAbout=0') !== -1, 'hide-About submit carries action=set and showAbout=0');
  check(s0.byId['st-showAbout-value'].textContent === 'hidden', 'hide-About re-render shows hidden');
  check(s0.menuLinks[1].style.display === 'none', 'hide-About hides the About menu link immediately');
  check(s0.menuLinks[0].style.display === '', 'hide-About leaves the Help menu link shown');
  check(s0.menuLinks[2].style.display !== 'none', 'hide-About leaves the app menu link shown');
  check(hideAbout.submitted === false, 'hide-About submit does not navigate');

  // Reset-all submit with an error result: status shows the error, no reload, no navigation.
  var resetAll = null;
  for (var i = 0; i < s0.forms.length; i++) {
    var hasAction = false, hasField = false;
    for (var j = 0; j < s0.forms[i].elements.length; j++) {
      if (s0.forms[i].elements[j].name === 'action') hasAction = true;
      if (s0.forms[i].elements[j].name === 'field') hasField = true;
    }
    if (hasAction && !hasField && s0.forms[i].elements[0].value === 'reset') resetAll = s0.forms[i];
  }
  check(resetAll !== null, 'reset-all form found');
  s0.queue.push({ ok: false, error: 'bad background' });
  callsBefore = s0.calls.length;
  resetAll.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('action=reset') !== -1, 'reset-all submit carries action=reset');
  check(s0.calls[callsBefore].indexOf('field=') === -1, 'reset-all submit carries no field');
  check(s0.byId['st-status'].textContent === 'bad background', 'error result shows the error text');
  check(s0.calls.length === callsBefore + 1, 'error result does not re-read');
  check(resetAll.submitted === false, 'error result does not navigate');

  // Fetch rejection: native submit fallback.
  s0.queue.push(new Error('offline'));
  deskForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(deskForm.submitted === true, 'fetch failure falls back to native form submit');

  // Glyph submit: the brand mark becomes the typed glyph with no refresh.
  var glyphForm = findForm(s0.forms, 'icon');
  check(glyphForm !== null, 'glyph form found');
  s0.byId['st-icon-input'].value = '\u2605';
  callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'desk', name: 'verify-name', icon: '\u2605' }, effective: { name: 'verify-name', title: 'verify-name', icon: '\u2605', background: 'desk' } });
  s0.queue.push({ ok: true, defaults: DEFAULTS, override: { background: 'desk', name: 'verify-name', icon: '\u2605' }, effective: { name: 'verify-name', title: 'verify-name', icon: '\u2605', background: 'desk' } });
  glyphForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('icon=%E2%98%85') !== -1, 'glyph submit carries the typed icon');
  var glyphMark = brandMark(s0.brand);
  check(glyphMark && glyphMark.tagName === 'SPAN' && glyphMark.textContent === '\u2605', 'glyph submit repaints the brand mark with no refresh');
  check(glyphForm.submitted === false, 'glyph submit does not navigate');

  // Grid + SVG fixture: notices show, inputs stay blank.
  var s1 = runScenario(GRID_FIXTURE, true);
  await settle();
  check(s1.byId['st-background-value'].textContent === 'custom grid', 'grid background displays as custom grid');
  check(s1.byId['st-background-note'].style.display === '', 'grid notice shows for a custom grid');
  check(s1.byId['st-icon-value'].textContent === 'custom mark', 'svg icon displays as custom mark');
  check(s1.byId['st-icon-note'].style.display === '', 'mark notice shows for a custom mark');
  check(s1.byId['st-icon-input'].value === '', 'icon input stays blank for a custom mark');
  check(s1.doc.body.attrs.style === undefined, 'grid background leaves the body inline style alone');
  check(s1.byId['st-background-badge'].textContent === 'changed', 'grid badge renders as changed');

  // Pathname fallback: no data-action-base on the page, id from the URL.
  var s2 = runScenario(READ_FIXTURE, false);
  await settle();
  check(s2.calls.length === 1 && s2.calls[0] === '/kody-os/theme/settings?format=json', 'pathname fallback still finds the theme route');

  if (failures > 0) {
    console.error(failures + ' settings DOM check(s) failed');
    process.exit(1);
  }
  console.log('ALL SETTINGS DOM CHECKS PASSED');
}

main().catch(function (err) {
  console.error('settings DOM tests crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
