/* Node-stub DOM tests for the Settings bundle (daily-feed / generic-feed
 * pattern: no jsdom, a hand-rolled document stub).
 *
 * Loads the bundle script exactly as stored in ../settings/definition.json,
 * with a stub document (getElementById, querySelector for the .st root,
 * querySelectorAll for the forms), a stub window, and a stub fetch.
 * Checks the pure helpers, the read-route render (values, sources,
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

const IDS = ['st-status', 'st-panel', 'st-background-value', 'st-background-source',
  'st-background-note', 'st-name-value', 'st-name-source', 'st-title-value',
  'st-title-source', 'st-icon-value', 'st-icon-source', 'st-icon-note',
  'st-name-input', 'st-title-input', 'st-icon-input',
  'st-showHelp-value', 'st-showHelp-source', 'st-showAbout-value', 'st-showAbout-source'];

function makeEl() {
  return {
    textContent: '', value: '', style: {}, handlers: {},
    getAttribute: function () { return null; },
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
  var calls = [];
  var queue = [];
  function fetchStub(url, opts) {
    calls.push(url);
    var next = queue.length > 0 ? queue.shift() : readFixture;
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({ json: function () { return Promise.resolve(next); } });
  }
  global.document = {
    querySelector: function (sel) { return sel === '.st' ? root : null; },
    querySelectorAll: function (sel) { return sel === '.st form' ? forms : []; },
    getElementById: function (id) { return byId[id] || null; },
  };
  global.window = { location: { pathname: '/kody-os/apps/settings' } };
  global.fetch = fetchStub;
  (0, eval)(script);
  return { byId: byId, forms: forms, calls: calls, queue: queue };
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
  check(global.stSourceLabel('background', { background: 'paper' }) === 'override', 'overridden field is labelled override');
  check(global.stSourceLabel('name', {}) === 'file default', 'default field is labelled file default');
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
  check(s0.byId['st-background-source'].textContent === 'override', 'background source renders as override');
  check(s0.byId['st-name-value'].textContent === 'kody-os', 'name value renders');
  check(s0.byId['st-name-source'].textContent === 'file default', 'name source renders as file default');
  check(s0.byId['st-title-value'].textContent === 'kody-os', 'title value renders (name fallback)');
  check(s0.byId['st-icon-value'].textContent === 'stock mark', 'icon value renders as stock mark');
  check(s0.byId['st-showHelp-value'].textContent === 'shown', 'Help page state renders as shown');
  check(s0.byId['st-showHelp-source'].textContent === 'file default', 'Help page state source renders as file default');
  check(s0.byId['st-showAbout-value'].textContent === 'shown', 'About page state renders as shown');
  check(s0.byId['st-name-input'].value === 'kody-os', 'name input is prefilled with the effective name');
  check(s0.byId['st-title-input'].value === '', 'title input is blank with no title override');
  check(s0.byId['st-icon-input'].value === '', 'icon input is blank with no icon override');
  check(s0.byId['st-panel'].style.display === '', 'panel shows after a successful read');
  check(s0.byId['st-status'].textContent === '', 'status clears after a successful read');
  check(s0.byId['st-background-note'].style.display === 'none', 'grid notice hidden for desk/paper');
  check(s0.byId['st-icon-note'].style.display === 'none', 'mark notice hidden for stock/glyph');
  check(s0.forms.length === 17, 'seventeen forms wired (got ' + s0.forms.length + ')');
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
  deskForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  var deskUrl = s0.calls[callsBefore];
  check(deskUrl.indexOf('/kody-os/theme/settings?') === 0, 'desk submit goes to the theme route');
  check(deskUrl.indexOf('action=set') !== -1 && deskUrl.indexOf('background=desk') !== -1, 'desk submit carries action=set and background=desk');
  check(deskUrl.indexOf('format=json') !== -1, 'desk submit asks for format=json');
  check(deskUrl.indexOf('from=%2Fkody-os%2Fapps%2Fsettings') !== -1, 'desk submit carries from=current page');
  check(s0.calls.length > callsBefore + 1, 'desk submit re-reads the theme after saving');
  check(deskForm.submitted === false, 'desk submit does not navigate');

  // Name submit: the typed input value flows through.
  var nameForm = findForm(s0.forms, 'name', 'kody-os');
  check(nameForm !== null, 'name form found');
  s0.byId['st-name-input'].value = 'verify-name';
  callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'paper', name: 'verify-name' }, effective: { name: 'verify-name', title: 'verify-name', icon: '', background: 'paper' } });
  nameForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('name=verify-name') !== -1, 'name submit carries the typed name');
  check(nameForm.submitted === false, 'name submit does not navigate');

  // Title submit: blank clears, typed title flows through.
  var titleForm = findForm(s0.forms, 'title', '');
  check(titleForm !== null, 'title form found');
  s0.byId['st-title-input'].value = 'My Title';
  callsBefore = s0.calls.length;
  s0.queue.push({ ok: true, override: { background: 'paper', title: 'My Title' }, effective: { name: 'kody-os', title: 'My Title', icon: '', background: 'paper' } });
  titleForm.handlers.submit({ preventDefault: function () {} });
  await settle();
  check(s0.calls[callsBefore].indexOf('title=My+Title') !== -1, 'title submit carries the typed title');

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

  // Grid + SVG fixture: notices show, inputs stay blank.
  var s1 = runScenario(GRID_FIXTURE, true);
  await settle();
  check(s1.byId['st-background-value'].textContent === 'custom grid', 'grid background displays as custom grid');
  check(s1.byId['st-background-note'].style.display === '', 'grid notice shows for a custom grid');
  check(s1.byId['st-icon-value'].textContent === 'custom mark', 'svg icon displays as custom mark');
  check(s1.byId['st-icon-note'].style.display === '', 'mark notice shows for a custom mark');
  check(s1.byId['st-icon-input'].value === '', 'icon input stays blank for a custom mark');
  check(s1.byId['st-background-source'].textContent === 'override', 'grid source renders as override');

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
