/* Node tests for the Settings bundle (no DOM needed).
 *
 * Checks the definition exactly as stored in ../settings/definition.json:
 * shape, icon, capabilities, stateless schema, size cap, one inline
 * style, plain GET forms with relative theme actions, the ES2019
 * ceiling on the bundle script, and no state-seed, clipboard, or
 * act() use. Run with: node pkg/catalog/tests/settings-tests.cjs
 */
const fs = require('fs');
const path = require('path');

const DEFINITION_PATH = path.join(__dirname, '..', 'settings/definition.json');
const loadedBundle = require('./read-bundle.cjs').readBundleFiles(DEFINITION_PATH);
const definition = loadedBundle.definition;
const bytes = fs.readFileSync(DEFINITION_PATH);
const html = loadedBundle.files[definition.bundle.entry];
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
const markup = html.slice(0, html.indexOf('<script>'));

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log('ok - ' + msg);
  } else {
    failures += 1;
    console.error('FAIL - ' + msg);
  }
}

check(definition.id === 'settings', 'id is settings');
check(definition.name === 'Settings' && definition.label === 'Settings', 'name and label are Settings');
check(definition.schemaVersion === 5, 'schemaVersion is 5');
check(definition.catalogVersion === 4, 'catalogVersion is 4');
check(definition.icon === '\u2699', 'icon is the single glyph U+2699');
check(definition.category === 'utilities', 'category is utilities');
check(typeof definition.description === 'string' && definition.description.length > 0, 'description is present');
check(definition.capabilities && definition.capabilities.theme && definition.capabilities.theme.view === true && definition.capabilities.theme.set === true, 'capabilities.theme declares view and set');
check(definition.ui && definition.ui.title === 'Settings' && definition.ui.openAs === 'page' && definition.ui.menuBar === true, 'ui is a page titled Settings with menuBar true');
check(definition.stateSchema && definition.stateSchema.type === 'object' && Object.keys(definition.stateSchema.initial).length === 0 && Object.keys(definition.stateSchema.fields).length === 0, 'stateSchema is an empty object schema');
check(definition.actions && Object.keys(definition.actions).length === 0, 'actions is empty');
check(bytes.length < 256 * 1024, 'bundle file is under the 256 KiB cap (' + bytes.length + ' bytes)');
check(definition.bundle.entry === 'index.html' && Object.keys(loadedBundle.files).length === 1, 'bundle has the single index.html entry');

check((html.match(/<style>/g) || []).length === 1, 'exactly one inline style block');
check((html.match(/<script>/g) || []).length === 1, 'exactly one inline script block');
check(script.indexOf('?.') === -1, 'script has no optional chaining');
check(script.indexOf('??') === -1, 'script has no nullish coalescing');
check(script.indexOf('replaceAll') === -1, 'script has no replaceAll');
check(script.indexOf('.at(') === -1, 'script has no .at(');
check(script.indexOf('`') === -1, 'script has no template literals');
check(script.indexOf('kody-state-seed') === -1, 'script never queries the state seed');
check(script.indexOf('navigator.clipboard') === -1, 'script has no clipboard use');
check(script.indexOf('localStorage') === -1, 'script has no localStorage use');
const scriptNoComments = script.replace(/\/\*[\s\S]*?\*\//g, '');
check(scriptNoComments.indexOf('act(') === -1, 'script has no act() calls');
check(script.indexOf('?action=') === -1, 'script builds no act() URLs');
check(script.indexOf('?k=') === -1, 'script renders no ?k=');
check(html.indexOf('?k=') === -1, 'bundle renders no ?k= anywhere');
check(html.toLowerCase().indexOf('method="post"') === -1, 'no POST forms');
const htmlNoNs = html.replace(/xmlns="[^"]*"/g, '');
check(htmlNoNs.indexOf('http://') === -1 && htmlNoNs.indexOf('https://') === -1, 'no external links (xmlns namespaces excluded)');
check(html.indexOf('<a ') === -1, 'no anchor links');
check(script.indexOf('data-action-base') !== -1, 'script resolves the app id from data-action-base');
check(script.indexOf('form.action') === -1, 'script never reads the shadowed form.action property');check(script.indexOf("credentials: 'same-origin'") !== -1 || script.indexOf('credentials: "same-origin"') !== -1, 'fetch uses the cookie session (same-origin credentials)');

const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
check(forms.length === 13, 'thirteen GET forms (got ' + forms.length + ')');
let formsOk = true;
for (const form of forms) {
  if (form.indexOf('method="get"') === -1) formsOk = false;
  if (form.indexOf('action="../theme/settings"') === -1) formsOk = false;
}
check(formsOk, 'every form is a GET to the relative theme action ../theme/settings');
check(markup.indexOf('/apps/') === -1, 'static markup hardcodes no app id or app path');
check(html.indexOf('st-background-note') !== -1, 'custom-grid notice element exists');
check(html.indexOf('st-icon-note') !== -1, 'custom-mark notice element exists');
check(html.indexOf('Reset all to file defaults') !== -1, 'reset-all control exists');
check(html.indexOf('Stock mark') !== -1, 'stock-mark control exists');
check(html.indexOf('os-section-title">Pages') !== -1, 'Pages section has the shared black-bar title');
check(html.indexOf('name="showHelp"') !== -1 && html.indexOf('name="showAbout"') !== -1, 'Help / About toggle controls exist');
check(html.indexOf('edit-toggle-btn') !== -1, 'toggles reuse the Apps Edit toggle button');
check(html.indexOf('st-showHelp-want') !== -1 && html.indexOf('st-showAbout-want') !== -1, 'toggles carry a flippable want value');
check(html.indexOf('st-badge') !== -1 && html.indexOf('st-badge-changed') !== -1, 'default/changed badges exist');
check(html.indexOf('st-quiet') !== -1, 'resets are quiet text links');
check(markup.indexOf('st-title') === -1 && markup.indexOf('>Title<') === -1, 'no Title field anywhere');
check(html.indexOf('name="field" value="showHelp"') !== -1 && html.indexOf('name="field" value="showAbout"') !== -1, 'per-field page resets exist');
check(html.indexOf('os-section-title') !== -1 && html.indexOf('<h3>') === -1, 'sections use the shared black-bar title, no bare h3s');
check(html.indexOf('st-showHelp-value') !== -1 && html.indexOf('st-showAbout-value') !== -1, 'page-state readouts exist');
check(script.indexOf('stMenuLink') !== -1, 'script updates the menu-bar link after a toggle');
check(html.indexOf('st-segmented') !== -1, 'Background keeps its segmented control');

if (failures > 0) {
  console.error(failures + ' settings check(s) failed');
  process.exit(1);
}
console.log('ALL SETTINGS CHECKS PASSED');
