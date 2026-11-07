/* Link Drop bundle tests (spec tasks 3.1-3.4).
 * Run with node from the repo root or the working dir:
 *   node pkg/catalog/tests/link-drop-tests.cjs
 * Loads the bundle script with document undefined, so DOM wiring
 * is skipped and the pure functions (ldParseEntry, ldEscape,
 * ldIsHttpUrl, ldFormatTime, ldBuildEntry, ldAppBase,
 * ldAbsoluteUrl, ldAppUrl, ldBookmarklet) are callable
 * directly. The bundle is found
 * next to this file, or one level up (catalog layout). */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (ok ? '' : ' -- ' + detail));
  if (!ok) { failures.push(name); }
}

function findBundle() {
  var candidates = [
    path.join(__dirname, 'link-drop/definition.json'),
    path.join(__dirname, '..', 'link-drop/definition.json'),
    path.join(__dirname, '..', 'pkg', 'catalog', 'link-drop/definition.json')
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) { return candidates[i]; }
  }
  return candidates[0];
}

var bundlePath = findBundle();
var def = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
check('definition id is link-drop', def.id === 'link-drop', def.id);
check('schemaVersion is 5', def.schemaVersion === 5, def.schemaVersion);
check('category is utilities', def.category === 'utilities', def.category);
check('state is links array only, maxItems 500, initial []',
  def.stateSchema && def.stateSchema.initial && Array.isArray(def.stateSchema.initial.links) &&
  def.stateSchema.fields && def.stateSchema.fields.links &&
  def.stateSchema.fields.links.type === 'array' &&
  def.stateSchema.fields.links.items === 'string' &&
  def.stateSchema.fields.links.maxItems === 500,
  JSON.stringify(def.stateSchema));
check('send action appends links from entry, cap 500, maxEntryBytes 2048',
  def.actions && def.actions.send && def.actions.send.args && def.actions.send.args.entry &&
  def.actions.send.effects && def.actions.send.effects[0].op === 'append' &&
  def.actions.send.effects[0].field === 'links' &&
  def.actions.send.effects[0].fromArg === 'entry' &&
  def.actions.send.effects[0].cap === 500 &&
  def.actions.send.effects[0].maxEntryBytes === 2048,
  JSON.stringify(def.actions && def.actions.send));
check('clear action sets links to []',
  def.actions && def.actions.clear && def.actions.clear.effects &&
  def.actions.clear.effects[0].op === 'set' &&
  def.actions.clear.effects[0].field === 'links' &&
  Array.isArray(def.actions.clear.effects[0].value) && def.actions.clear.effects[0].value.length === 0,
  JSON.stringify(def.actions && def.actions.clear));
check('ui hides state, page placement, no shell actions (bundle owns Clear All)',
  def.ui && def.ui.hideState === true && def.ui.placements &&
  def.ui.placements.indexOf('page') !== -1 &&
  (!def.ui.actions || def.ui.actions.length === 0),
  JSON.stringify(def.ui));
var html = def.bundle.files['index.html'];
check('bundle under 256 KiB', Buffer.byteLength(html, 'utf8') < 256 * 1024, Buffer.byteLength(html, 'utf8'));
check('install block names link-drop, no copy-code block, no Clipboard API',
  html.indexOf('link-drop') !== -1 && html.indexOf('Or copy this code') === -1 &&
  html.indexOf('ld-code') === -1 && html.indexOf('navigator.clipboard') === -1 && html.indexOf('>Copy<') === -1,
  'install block missing, copy block present, or clipboard use found');
check('session/new-tab paragraph removed entirely',
  html.indexOf('already be signed into kody-os') === -1 &&
  html.indexOf('does not return to the original page') === -1 &&
  html.indexOf('Locked page') === -1,
  'session/new-tab paragraph still present');
check('install block offers agent route, never says links appear below, has Clear All form',
  html.indexOf('ask your agent') !== -1 &&
  html.indexOf('appear below') === -1 && html.indexOf('Saved links appear') === -1 &&
  html.indexOf('id="ld-clear-form"') !== -1 && html.indexOf('>Clear All<') !== -1,
  'layout wording or clear form missing');
check('agent prompt is the copyable quoted form, per-item-delete note gone, no Two things prefix',
  html.indexOf('Add the link [link] to my kody-os "link-drop" app') !== -1 &&
  html.indexOf('per-item delete') === -1 && html.indexOf('Two things to know') === -1,
  'agent prompt or note removal wrong');

var scriptStart = html.indexOf('<script>');
var scriptEnd = html.indexOf('</script>', scriptStart);
var script = html.slice(scriptStart + '<script>'.length, scriptEnd);
check('widget: Clear All form and install block hidden, no unqualified widget rules',
  html.indexOf('section.widget #ld-clear-form') !== -1 &&
  html.indexOf('section.widget #ld-install') !== -1 &&
  html.indexOf('section.widget p') === -1 && html.indexOf('section.widget a') === -1 &&
  html.indexOf('section.widget div') === -1 && html.indexOf('section.widget button') === -1 &&
  html.indexOf('section.widget form') === -1,
  'widget hiding rules wrong');
check('ceiling: no ?. / ?? / replaceAll / .at( / backtick',
  script.indexOf('?.') === -1 && script.indexOf('??') === -1 &&
  script.indexOf('replaceAll') === -1 && script.indexOf('.at(') === -1 &&
  script.indexOf('`') === -1,
  'ceiling hit');

var ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(script, ctx);

var good = JSON.stringify({ t: '2026-11-04T18:10:30.000Z', title: 'Example page', url: 'https://example.com/page' });
var parsed = ctx.ldParseEntry(good);
check('parser reads JSON entry', parsed.ok === true && parsed.title === 'Example page' && parsed.url === 'https://example.com/page', JSON.stringify(parsed));
var extra = ctx.ldParseEntry(JSON.stringify({ t: '2026-11-04T00:00:00.000Z', title: 'T', url: 'https://example.com', sel: 'selected text', junk: 1 }));
check('parser ignores unknown keys', extra.ok === true && extra.url === 'https://example.com', JSON.stringify(extra));
var plain = ctx.ldParseEntry('just some text, not json');
check('non-JSON entry is plain fallback, no link', plain.ok === false && plain.text === 'just some text, not json', JSON.stringify(plain));
var noUrl = ctx.ldParseEntry(JSON.stringify({ title: 'No url here' }));
check('entry without url is plain fallback', noUrl.ok === false, JSON.stringify(noUrl));
check('escape renders markup as text',
  ctx.ldEscape('<script>alert("x")</script> & \'q\'') === '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;',
  ctx.ldEscape('<script>alert("x")</script>'));
check('http scheme allowlist',
  ctx.ldIsHttpUrl('https://example.com') === true &&
  ctx.ldIsHttpUrl('http://example.com') === true &&
  ctx.ldIsHttpUrl('javascript:alert(1)') === false &&
  ctx.ldIsHttpUrl('data:text/html,hi') === false &&
  ctx.ldIsHttpUrl('file:///etc/passwd') === false &&
  ctx.ldIsHttpUrl('') === false &&
  ctx.ldIsHttpUrl('https://exa mple.com') === false,
  'scheme check wrong');
check('formatTime valid ISO is non-empty, invalid returns raw',
  ctx.ldFormatTime('2026-11-04T18:10:30.000Z') !== '' && ctx.ldFormatTime('not-a-date') === 'not-a-date' && ctx.ldFormatTime('') === '',
  ctx.ldFormatTime('2026-11-04T18:10:30.000Z'));
var short = ctx.ldBuildEntry('Short title', 'https://example.com', '2026-11-04T00:00:00.000Z');
check('short entry unchanged', JSON.parse(short).title === 'Short title', short);
var longTitle = new Array(3001).join('x');
var built = ctx.ldBuildEntry(longTitle, 'https://example.com/a-very-long-article', '2026-11-04T00:00:00.000Z');
var builtParsed = JSON.parse(built);
check('long title truncated, URL intact, entry within 2048 bytes',
  Buffer.byteLength(built, 'utf8') <= 2048 && builtParsed.url === 'https://example.com/a-very-long-article' && builtParsed.title.length < longTitle.length,
  'bytes=' + Buffer.byteLength(built, 'utf8'));
var hugeUrl = 'https://example.com/' + new Array(2101).join('y');
var over = ctx.ldBuildEntry('Title', hugeUrl, '2026-11-04T00:00:00.000Z');
check('URL alone over cap leaves title empty and entry over cap (action must reject)',
  JSON.parse(over).title === '' && Buffer.byteLength(over, 'utf8') > 2048,
  'bytes=' + Buffer.byteLength(over, 'utf8'));
check('app base derived from pathname, fallback without /apps/',
  ctx.ldAppBase('/kody-os/apps/link-drop') === '/kody-os/apps/link-drop' &&
  ctx.ldAppBase('/kody-os/apps/daily-feed') === '/kody-os/apps/link-drop' &&
  ctx.ldAppBase('/something-else') === '/apps/link-drop',
  ctx.ldAppBase('/kody-os/apps/daily-feed'));
var mark = ctx.ldBookmarklet('https://example.com/kody-os/apps/link-drop');
check('bookmarklet opens absolute send URL in new tab, no hardcoded host',
  mark.indexOf('javascript:') === 0 && mark.indexOf('https://example.com/kody-os/apps/link-drop?action=send&entry=') !== -1 &&
  mark.indexOf("'_blank'") !== -1 && mark.indexOf('hypercubed') === -1,
  mark);
check('absolute URL derivation: origin plus path, trailing slash, already-absolute, no origin',
  ctx.ldAppUrl('https://example.com/', '/kody-os/apps/link-drop') === 'https://example.com/kody-os/apps/link-drop' &&
  ctx.ldAppUrl('https://example.com', '/other/apps/daily-feed') === 'https://example.com/other/apps/link-drop' &&
  ctx.ldAbsoluteUrl('https://already.example/apps/link-drop', { origin: 'https://other.example' }) === 'https://already.example/apps/link-drop' &&
  ctx.ldAbsoluteUrl('/kody-os/apps/link-drop', { origin: 'http://127.0.0.1:4302' }) === 'http://127.0.0.1:4302/kody-os/apps/link-drop' &&
  ctx.ldAbsoluteUrl('/kody-os/apps/link-drop', { protocol: 'https:', host: 'host.example' }) === 'https://host.example/kody-os/apps/link-drop' &&
  ctx.ldAbsoluteUrl('/kody-os/apps/link-drop', null) === '/kody-os/apps/link-drop',
  'absolute derivation wrong');

if (failures.length > 0) { console.log('FAILURES: ' + failures.length); process.exit(1); }
console.log('ALL LINK-DROP CHECKS PASSED');
