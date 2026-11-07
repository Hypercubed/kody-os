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
const definition = JSON.parse(fs.readFileSync(DEFINITION_PATH, 'utf8'));
const bytes = fs.readFileSync(DEFINITION_PATH);
const html = definition.bundle.files[definition.bundle.entry];
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
check(definition.catalogVersion === 2, 'catalogVersion is 2');
check(definition.icon === '\u2699', 'icon is the single glyph U+2699');
check(definition.category === 'utilities', 'category is utilities');
check(typeof definition.description === 'string' && definition.description.length > 0, 'description is present');
check(definition.capabilities && definition.capabilities.theme && definition.capabilities.theme.view === true && definition.capabilities.theme.set === true, 'capabilities.theme declares view and set');
check(definition.ui && definition.ui.title === 'Settings' && definition.ui.openAs === 'page', 'ui is a page titled Settings');
check(definition.stateSchema && definition.stateSchema.type === 'object' && Object.keys(definition.stateSchema.initial).length === 0 && Object.keys(definition.stateSchema.fields).length === 0, 'stateSchema is an empty object schema');
check(definition.actions && Object.keys(definition.actions).length === 0, 'actions is empty');
check(bytes.length < 256 * 1024, 'bundle file is under the 256 KiB cap (' + bytes.length + ' bytes)');
check(definition.bundle.entry === 'index.html' && Object.keys(definition.bundle.files).length === 1, 'bundle has the single index.html entry');

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
check(html.indexOf('http://') === -1 && html.indexOf('https://') === -1, 'no external links');
check(html.indexOf('<a ') === -1, 'no anchor links');
check(script.indexOf('data-action-base') !== -1, 'script resolves the app id from data-action-base');
check(script.indexOf('form.action') === -1, 'script never reads the shadowed form.action property');check(script.indexOf("credentials: 'same-origin'") !== -1 || script.indexOf('credentials: "same-origin"') !== -1, 'fetch uses the cookie session (same-origin credentials)');

const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
check(forms.length === 17, 'seventeen GET forms (got ' + forms.length + ')');
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
check(html.indexOf('<h3>Pages</h3>') !== -1, 'Pages section exists');
check(html.indexOf('name="showHelp" value="1"') !== -1 && html.indexOf('name="showHelp" value="0"') !== -1, 'Help Show / Hide controls exist');
check(html.indexOf('name="showAbout" value="1"') !== -1 && html.indexOf('name="showAbout" value="0"') !== -1, 'About Show / Hide controls exist');
check(html.indexOf('name="field" value="showHelp"') !== -1 && html.indexOf('name="field" value="showAbout"') !== -1, 'per-field page resets exist');
check(html.indexOf('st-showHelp-value') !== -1 && html.indexOf('st-showAbout-value') !== -1, 'page-state readouts exist');

if (failures > 0) {
  console.error(failures + ' settings check(s) failed');
  process.exit(1);
}
console.log('ALL SETTINGS CHECKS PASSED');
