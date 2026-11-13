/* jsdom harness for the data-only App Store bundle.
 *
 * Tests the bundle exactly as stored in ../app-store/definition.json, with
 * a mocked management API (fetch stub): rows render from /manage/rows,
 * capabilities are disclosed in plain words, a modified-app update
 * shows the bundle's own confirmation UI and only applies on confirm,
 * and the no-JavaScript note is hidden once the script runs. The
 * self-update section above the list carries the App Store itself
 * (installed version, pinned snapshot tag, latest Store on the
 * discovery base, one update control, and Remove with the same
 * confirmation as a row, including on a gated row); the status line
 * shows the pinned tag instead of the main URL.
 * Not-installed rows offer Add; up-to-date rows offer Remove through the
 * confirmed management remove path; Update All appears only when a safe
 * (non-overwrite) update exists and updates only those rows.
 * A fourth jsdom covers the agent-prompt details: every row status maps
 * to one collapsed details element with a per-action summary and a
 * one-line prompt naming the operations file and the app's catalog
 * folder URL (absorb prompts for behind-modified, modified-current,
 * and absorbed-behind rows; no details on requirement rows; a
 * recipe-only not-installed row gains the Install details, while a
 * row without a folderUrl shows no details).
 * Row layout (store-row-layout): the store.css text is asserted for the
 * caret rules (native-marker suppression, ::before triangle, [open]
 * rotation), the stretch alignment rules, and the fixed-width rule.
 * jsdom does not lay out: pixel widths and caret rendering are NOT
 * asserted here - the mock visual check (tasks.md section 7) is the
 * rendering proof.
 *
 * Row details layout (store-row-details-layout): the badge sits below
 * the description and capabilities; the details element is the last
 * child of li.store-row, spanning the full row width under the controls;
 * the row has top and bottom padding. Asserted on DOM parentage and
 * stylesheet text, as above.
 *
 * Fixed row heights: the badge gains 0.2rem margin above it;
 * .store-main, .store-body, and .store-controls each span the row's
 * content height (min-height 4.85rem) and vertically center their
 * content; the row stretches its children. min-height, not height: a
 * two-line label or a long wrapped description can exceed 4.85rem, and
 * the row grows instead of clipping. Asserted on stylesheet text.
 *
 * How to run (jsdom is the only dependency, installed ephemerally):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node catalog/tests/app-store-tests.cjs
 *
 * If jsdom lives elsewhere, set JSDOM_PATH to its folder.
 */
const fs = require("fs");
const path = require("path");

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  const fallback = process.env.JSDOM_PATH || "/tmp/jsdom-test/node_modules/jsdom";
  try {
    ({ JSDOM } = require(fallback));
  } catch (e2) {
    console.error(
      "jsdom is required. Install it ephemerally:\n" +
        "  mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom\n" +
        "then run: node catalog/tests/app-store-tests.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "app-store/definition.json");
const loadedBundle = require('./read-bundle.cjs').readBundleFiles(DEFINITION_PATH);
const definition = loadedBundle.definition;
const html = loadedBundle.files[definition.bundle.entry];
const js = loadedBundle.files["store.js"];
const css = loadedBundle.files["store.css"];

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log("ok - " + msg);
  } else {
    failures += 1;
    console.error("FAIL - " + msg);
  }
}

async function main() {
  check(definition.capabilities && definition.capabilities.manageApps === true, "store bundle declares manageApps");
  // Row layout (store-row-layout): caret, top pinning, fixed button width
  // — asserted on the stylesheet text. jsdom does not lay out, so no pixel
  // widths or caret rendering are asserted here; the mock visual check
  // (tasks.md section 7) is the rendering proof.
  function rule(selector) {
    var at = css.indexOf(selector + " {");
    if (at === -1) return "";
    return css.slice(at, css.indexOf("}", at) + 1);
  }
  check(rule(".store-details summary").indexOf("list-style: none") !== -1, "summary suppresses the native marker with list-style: none");
  check(rule(".store-details summary::-webkit-details-marker").indexOf("display: none") !== -1, "summary hides the webkit details marker");
  var caret = rule(".store-details summary::before");
  check(caret.indexOf('content: ""') !== -1 && caret.indexOf("flex-shrink: 0") !== -1 && caret.indexOf("margin-right: 0.5rem") !== -1 && caret.indexOf("solid transparent") !== -1 && caret.indexOf("solid currentColor") !== -1 && caret.indexOf("transition: transform 0.15s") !== -1, "summary has a ::before border-triangle caret");
  check(rule(".store-details[open] > summary::before").indexOf("transform: rotate(90deg)") !== -1, "open details rotates the caret 90deg");
  check(rule(".store-details summary").indexOf("min-height") === -1, "summary carries no min-height");
  check(rule(".store-details summary").indexOf("font-size: 0.875rem") !== -1, "summary uses the reduced font size");
  check(rule(".store-row").indexOf("align-items: stretch") !== -1, "store row stretches children to the line height");
  var mainRule = rule(".store-main");
  check(mainRule.indexOf("align-self: stretch") !== -1 && mainRule.indexOf("justify-content: center") !== -1, "store main stretches and centers its content");
  check(rule(".store-body").indexOf("align-self: stretch") !== -1, "store body stretches to the line height");
  check(rule(".store-controls").indexOf("align-self: stretch") !== -1, "store controls stretch to the line height");
  var buttonRule = rule(".store-controls button");
  check(buttonRule.indexOf("box-sizing: border-box") !== -1 && buttonRule.indexOf("width: calc(12ch + 2rem + 2px)") !== -1 && buttonRule.indexOf("white-space: nowrap") !== -1, "row buttons share one fixed width");
  check(rule(".store-dialog-panel button").indexOf("margin: 4px 4px 4px 0") !== -1, "dialog buttons keep their sizing");
  check(rule(".store-update-all").indexOf("margin: 0 0 12px 0") !== -1, "Update All keeps its sizing");
  check(rule(".store-self").indexOf("border") === -1, "self-update section carries no box border");
  check(rule(".store-self button").indexOf("float: right") !== -1, "self-update button floats right");
  check(css.indexOf("url(") === -1, "caret uses no image");
  check(js.indexOf("summary::before") === -1, "no JavaScript draws the caret");
  const rows = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/4.2.0/catalog/counter" },
    { id: "calculator", label: "Calculator", name: "Calculator", icon: "#", description: "Calculator.", installed: true, inCatalog: true, status: "behind-clean", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
    { id: "app-store", label: "App Store", name: "App Store", icon: "⊞", description: "Store.", installed: true, inCatalog: true, status: "behind-modified", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: true, feedHosts: [], proxyHosts: [] } },
    { id: "xkcd", label: "xkcd", name: "xkcd", icon: "#", description: "xkcd.", installed: true, inCatalog: true, status: "snapshot-less", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [], themeView: true, themeSet: false } },
    { id: "clock", label: "Clock", name: "Clock", icon: "#", description: "Clock.", installed: true, inCatalog: true, status: "up-to-date", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [], themeView: true, themeSet: true } },
  ];
  const storeSelfMain = { installedCatalogVersion: 27, pinnedLabel: '4.2.0', discoveryRef: 'main', discoveryLabel: null, runningVersion: '4.2.1', latestCatalogVersion: 29, needsNewerShell: false, hasUpdate: true };
  const storeSelfUpToDate = { installedCatalogVersion: 27, pinnedLabel: '4.2.0', discoveryRef: 'main', discoveryLabel: null, runningVersion: '4.2.1', latestCatalogVersion: 27, needsNewerShell: false, hasUpdate: false };
  const calls = [];
  const dom = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win = dom.window;
  win.fetch = function (url) {
    calls.push(url);
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rows, catalogRelease: '4.2.0', storeSelf: storeSelfMain }); } });
    }
    if (url.indexOf("/manage/update") !== -1 && url.indexOf("confirmed=1") === -1) {
      if (url.indexOf("id=calculator") !== -1) {
        return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, id: "calculator" }); } });
      }
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "Confirmation required.", needsConfirmation: true, additions: ["manage other apps"] }); } });
    }
    if (url.indexOf("/manage/remove") !== -1 && url.indexOf("confirmed=1") === -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "Confirmation required.", needsConfirmation: true, additions: [] }); } });
    }
    if (url.indexOf("confirmed=1") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, id: "app-store" }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win.eval(js);
  check(win.document.querySelector(".store-status").textContent === "Loading apps…", "loading text is generic until rows arrive");
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc = win.document;
  const items = doc.querySelectorAll(".store-row");
  function buttonLabels(row) {
    return Array.prototype.map.call(row.querySelectorAll("button"), function (b) { return b.textContent; });
  }
  check(items.length === 4, "four rows render; a stale App Store row in the payload is filtered out");
  var rowLabels = Array.prototype.map.call(doc.querySelectorAll(".store-row .store-label"), function (el) { return el.textContent; });
  check(rowLabels.indexOf("App Store") === -1, "no rendered row is the App Store");
  check(items[0] && buttonLabels(items[0]).join(",") === "Add", "not-installed row offers Add, not Install");
  check(items[1] && buttonLabels(items[1]).join(",") === "Update", "behind-clean row offers Update");
  check(items[2] && buttonLabels(items[2]).join(",") === "Overwrite", "snapshot-less row offers Overwrite");
  check(items[3] && buttonLabels(items[3]).join(",") === "Remove", "up-to-date row offers Remove");
    check(!doc.querySelector(".store-update-all").hidden, "Update All is shown when a safe update exists");
  const firstChildren = Array.prototype.slice.call(items[0].children);
  const mainIndex = firstChildren.indexOf(items[0].querySelector(".store-main"));
  const bodyIndex = firstChildren.indexOf(items[0].querySelector(".store-body"));
  const controlsIndex = firstChildren.indexOf(items[0].querySelector(".store-controls"));
  check(mainIndex === 0, "row starts with the tile-sized icon/title block");
  check(bodyIndex !== -1 && controlsIndex !== -1 && bodyIndex < controlsIndex, "description fills the middle before the controls");
  const mainKids = Array.prototype.slice.call(items[0].querySelector(".store-main").children);
  check(mainKids[0].className === "store-icon" && mainKids[1].className === "store-label", "icon and title are stacked in the tile block");
  check(!items[0].querySelector(".store-badge"), "no Installed or Not installed label");
  check(items[1].querySelector(".store-badge").textContent.indexOf("Update available") !== -1, "other status labels stay");
    check(items[2].textContent.indexOf("Can view the shell theme.") !== -1, "theme view-only is disclosed in plain words");
  check(items[3].textContent.indexOf("Can view and change the shell theme.") !== -1, "theme view+set is disclosed in plain words");
  check(doc.querySelector(".store-nojs").style.display === "none", "no-JavaScript note is hidden once the script runs");
  check(calls[0] === "/manage/rows?app=app-store", "first fetch is the management rows API");
  var selfSection = doc.querySelector(".store-self");
  check(selfSection && selfSection.hidden === false, "self-update section renders");
  var wrapKids = Array.prototype.slice.call(doc.querySelector(".store-wrap").children);
  check(wrapKids.indexOf(selfSection) !== -1 && wrapKids.indexOf(selfSection) < wrapKids.indexOf(doc.querySelector(".store-list")), "self-update section sits above the apps list");
  check(selfSection.textContent.indexOf("App Catalog v27") !== -1, "section shows the installed Store version");
  check(selfSection.textContent.indexOf("Catalog snapshot 4.2.0") !== -1, "section shows the pinned snapshot tag");
  check(selfSection.textContent.indexOf("shell v4.2.1") !== -1, "section shows the running shell version");
  check(selfSection.textContent.indexOf("Latest App Catalog v29") !== -1, "section shows the latest Store on the discovery base");
  check(selfSection.textContent.indexOf("from main") !== -1, "section names the discovery base for the Store update");
  check(selfSection.textContent.indexOf("Catalog source: https://github.com/Hypercubed/kody-os/tree/4.2.0/catalog") !== -1, "section shows the catalog source URL");
  check(selfSection.querySelector('a[href="https://github.com/Hypercubed/kody-os/tree/4.2.0/catalog"]') !== null, "catalog source URL is a link");
  check(buttonLabels(selfSection).join(",") === "Update", "section offers one Update control");
  check(doc.querySelector(".store-status").textContent === "Catalog 4.2.0", "status line shows the pinned tag, not the main URL");
  check(doc.querySelector(".store-status").textContent.indexOf("raw.githubusercontent") === -1, "status line shows no main URL");
  check(doc.querySelector(".store-status").textContent.indexOf("resolved") === -1 && doc.querySelector(".store-status").textContent.indexOf("stale") === -1, "status line claims no resolved or stale snapshot");
  const updateBtn = selfSection.querySelector("button");
  updateBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc.querySelector(".store-dialog").textContent.indexOf("Confirm update") !== -1, "Store self-update shows bundle confirmation, not an immediate apply");
  check(doc.querySelector(".store-dialog").textContent.indexOf("manage other apps") !== -1, "confirmation lists capability additions");
  const confirmBtn = doc.querySelectorAll(".store-dialog button")[0];
  confirmBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls.indexOf("/manage/update?app=app-store&id=app-store&confirmed=1") !== -1, "confirm submits the confirmed Store update");
  const reloaded = doc.querySelectorAll(".store-row");
  const snapshotLessBtn = reloaded[2] && reloaded[2].querySelector("button");
  snapshotLessBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc.querySelector(".store-dialog").textContent.indexOf("Confirm update") !== -1, "snapshot-less Overwrite shows the same confirmation");
  const cancelBtn = doc.querySelectorAll(".store-dialog button")[1];
  cancelBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  const callsBeforeUpdateAll = calls.length;
  const updateAllBtn = doc.querySelector(".store-update-all button");
  updateAllBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  const batchCalls = calls.slice(callsBeforeUpdateAll);
  check(batchCalls.indexOf("/manage/update?app=app-store&id=calculator") !== -1, "Update All updates the behind-clean app without confirmation");
  check(batchCalls.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=app-store") !== -1; }).length === 0, "Update All never calls update for the App Store itself");
  check(batchCalls.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=xkcd") !== -1; }).length === 0, "Update All never calls update for the snapshot-less app");
  check(batchCalls.filter(function (c) { return c.indexOf("confirmed=1") !== -1; }).length === 0, "Update All never sends a confirmed update");
  check(doc.querySelector(".store-status").textContent.indexOf("Updated 1 app.") === 0, "Update All reports what it updated");
  const removeBtn = doc.querySelectorAll(".store-row")[3].querySelector("button");
  removeBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc.querySelector(".store-dialog").textContent.indexOf("Confirm remove") !== -1, "up-to-date Remove shows a remove confirmation, not an immediate apply");
  const removeConfirmBtn = doc.querySelectorAll(".store-dialog button")[0];
  removeConfirmBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls.indexOf("/manage/remove?app=app-store&id=clock&confirmed=1") !== -1, "confirm submits the confirmed remove");
  const rowsNoSafe = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
    { id: "app-store", label: "App Store", name: "App Store", icon: "⊞", description: "Store.", installed: true, inCatalog: true, status: "behind-modified", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: true, feedHosts: [], proxyHosts: [] } },
    { id: "xkcd", label: "xkcd", name: "xkcd", icon: "#", description: "xkcd.", installed: true, inCatalog: true, status: "snapshot-less", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
  ];
  const dom2 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win2 = dom2.window;
  win2.fetch = function (url) {
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsNoSafe, storeSelf: storeSelfUpToDate }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win2.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc2 = win2.document;
  check(doc2.querySelector(".store-update-all").hidden === true, "Update All is hidden when every out-of-date app needs Overwrite");
  var selfSection2 = doc2.querySelector(".store-self");
  check(selfSection2 && selfSection2.hidden === false, "up-to-date self-update section renders");
  check(doc2.querySelectorAll(".store-row").length === 2, "stale App Store row is filtered from the no-safe list");
  check(buttonLabels(selfSection2).join(",") === "Remove", "up-to-date section offers Remove only");
  check(selfSection2.textContent.indexOf("Latest App Catalog v27") !== -1, "up-to-date section shows the latest Store matches the installed one");
  // Busy button: Add disables with "Adding…" while its install runs,
  // a second click fires no second request, and a failed install
  // re-enables it with its original label and shows the error.
  const rowsBusy = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
  ];
  const dom3 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win3 = dom3.window;
  let installCalls = 0;
  let installResolve = null;
  win3.fetch = function (url) {
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsBusy }); } });
    }
    if (url.indexOf("/manage/install") !== -1) {
      installCalls += 1;
      return new Promise(function (resolve) {
        installResolve = function (payload) {
          resolve({ json: function () { return Promise.resolve(payload); } });
        };
      });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win3.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc3 = win3.document;
  const addBtn = doc3.querySelector(".store-row button");
  check(addBtn && addBtn.textContent === "Add", "busy test starts with an Add button");
  addBtn.click();
  check(addBtn.disabled === true, "Add button is disabled while its install runs");
  check(addBtn.textContent === "Adding…", "Add button reads Adding… while its install runs");
  addBtn.click();
  check(installCalls === 1, "a second click while disabled fires no second install request");
  installResolve({ ok: false, error: "Install failed." });
  await new Promise(function (r) { setTimeout(r, 50); });
  check(addBtn.disabled === false, "Add button is re-enabled after a failed install");
  check(addBtn.textContent === "Add", "Add button label is restored after a failed install");
  check(doc3.querySelector(".store-status").textContent === "Install failed.", "failed install shows its error in the status line");
  // Agent-prompt details (store-row-agent-prompts): every row status
  // maps to one collapsed <details class="store-details"> holding a
  // <summary> naming the action and a <code> with the prompt, set via
  // textContent; requirement rows get no details element, and a row
  // without a folderUrl shows no Install details; a recipe-only
  // not-installed row gains the Install details; absorbed rows get
  // Remove, absorbed-behind rows get Overwrite plus the Absorb prompt.
  const rowsPrompts = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installMode: "json", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
    { id: "calculator", label: "Calculator", name: "Calculator", icon: "#", description: "Calculator.", installMode: "json", installed: true, inCatalog: true, status: "behind-clean", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/calculator" },
    { id: "app-store", label: "App Store", name: "App Store", icon: "⊞", description: "Store.", installMode: "json", installed: true, inCatalog: true, status: "behind-modified", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: true, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/app-store" },
    { id: "tictactoe", label: "Tic Tac Toe", name: "Tic Tac Toe", icon: "#", description: "Tic Tac Toe.", installMode: "json", installed: true, inCatalog: true, status: "modified-current", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [], themeView: true }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/tictactoe" },
    { id: "xkcd", label: "xkcd", name: "xkcd", icon: "#", description: "xkcd.", installMode: "json", installed: true, inCatalog: true, status: "modified-ahead", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/xkcd" },
    { id: "settings", label: "Settings", name: "Settings", icon: "#", description: "Settings.", installMode: "json", installed: true, inCatalog: true, status: "snapshot-less", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/settings" },
    { id: "clock", label: "Clock", name: "Clock", icon: "#", description: "Clock.", installMode: "json", installed: true, inCatalog: true, status: "up-to-date", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/clock" },
    { id: "streaks", label: "Streaks", name: "Streaks", icon: "#", description: "Streaks.", installMode: "json", installed: true, inCatalog: true, status: "absorbed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/streaks" },
    { id: "pushup", label: "Pushup Tracker", name: "Pushup Tracker", icon: "#", description: "Pushups.", installMode: "json", installed: true, inCatalog: true, status: "absorbed-behind", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/pushup" },
    { id: "future-app", label: "Future App", name: "Future App", icon: "#", description: "Needs a newer shell.", installMode: "json", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, needsNewerShell: true, minPackageVersion: "9.9.9", shellVersion: "4.2.1" },
    { id: "schema-app", label: "Schema App", name: "Schema App", icon: "#", description: "Needs a newer schema.", installMode: "json", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, needsNewerSchema: true, schemaVersion: 3, schemaFloor: 5 },
    { id: "daily-feed", label: "Daily Feed", name: "Daily Feed", icon: "#", description: "Daily feed.", installMode: "recipe-only", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/daily-feed" },
    { id: "recipe-app", label: "Recipe App", name: "Recipe App", icon: "#", description: "Recipe app.", installMode: "json", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/recipe-app" },
  ];
  const dom4 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win4 = dom4.window;
  const calls4 = [];
  win4.fetch = function (url) {
    calls4.push(url);
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsPrompts }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win4.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc4 = win4.document;
  const items4 = doc4.querySelectorAll(".store-row");
  function detailsOf(rowEl) { return rowEl.querySelector(".store-details"); }
  function promptCode(rowEl) { var d = detailsOf(rowEl); return d ? d.querySelector("code") : null; }
  function summaryOf(rowEl) { var d = detailsOf(rowEl); return d ? d.querySelector("summary") : null; }
  check(items4.length === 12, "twelve prompt-fixture rows render");
  check(doc4.querySelector(".store-self").hidden === true, "no self-update section without storeSelf data");
  var rowLabels4 = Array.prototype.map.call(doc4.querySelectorAll(".store-row .store-label"), function (el) { return el.textContent; });
  check(rowLabels4.indexOf("App Store") === -1, "no rendered row is the App Store");
  check(items4[0] && buttonLabels(items4[0]).join(",") === "Add", "not-installed json row keeps Add");
  check(!detailsOf(items4[0]), "not-installed row without a folderUrl shows no Install details");
  // items4[0] carries no folderUrl, so it shows no details; items4[11]
  // carries one and shows the Install one-liner.
  check(summaryOf(items4[11]) && summaryOf(items4[11]).textContent === "Install with an agent", "recipe row shows Install details");
  check(promptCode(items4[11]) && promptCode(items4[11]).textContent === "Read package:kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/recipe-app", "install prompt is the one-liner with the folder URL");
  check(promptCode(items4[11]) && promptCode(items4[11]).textContent.indexOf("install_from_catalog") === -1, "install one-liner names no MCP call");
  check(promptCode(items4[11]) && promptCode(items4[11]).textContent.indexOf("(") === -1, "install one-liner names no label or id outside the folder URL");
  check(detailsOf(items4[11]).open === false && !detailsOf(items4[11]).hasAttribute("open"), "install details is collapsed by default");
  check(items4[1] && buttonLabels(items4[1]).join(",") === "Update", "behind-clean row keeps Update");

  check(summaryOf(items4[1]) && summaryOf(items4[1]).textContent === "Update with an agent", "behind-clean row shows Update details");
  check(promptCode(items4[1]) && promptCode(items4[1]).textContent === "Read package:kody-os#OPERATIONS.md, then update this app to the latest catalog version: https://github.com/Hypercubed/kody-os/tree/main/catalog/calculator", "update prompt is the one-liner with the folder URL");
  check(items4[2] && buttonLabels(items4[2]).join(",") === "Restore", "modified-current row keeps Restore");
  check(summaryOf(items4[2]) && summaryOf(items4[2]).textContent === "Absorb with an agent", "modified-current row shows Absorb details");
  check(promptCode(items4[2]) && promptCode(items4[2]).textContent === "Read package:kody-os#OPERATIONS.md, then absorb the catalog changes into this app, keeping my local customizations: https://github.com/Hypercubed/kody-os/tree/main/catalog/tictactoe", "modified-current prompt is the absorb one-liner");
  check(promptCode(items4[2]) && promptCode(items4[2]).textContent.indexOf("absorb_from_catalog") === -1, "absorb one-liner names no MCP call");
  check(items4[3] && buttonLabels(items4[3]).join(",") === "Restore", "modified-ahead row keeps Restore");

  check(summaryOf(items4[3]) && summaryOf(items4[3]).textContent === "Restore with an agent", "modified-ahead row shows Restore details");
  check(promptCode(items4[3]) && promptCode(items4[3]).textContent === "Read package:kody-os#OPERATIONS.md, then restore this app to the catalog copy: https://github.com/Hypercubed/kody-os/tree/main/catalog/xkcd", "restore prompt is the one-liner with the folder URL");
  check(items4[4] && buttonLabels(items4[4]).join(",") === "Overwrite", "snapshot-less row keeps Overwrite");
  check(summaryOf(items4[4]) && summaryOf(items4[4]).textContent === "Overwrite with an agent", "snapshot-less row shows Overwrite details");
  check(promptCode(items4[4]) && promptCode(items4[4]).textContent === "Read package:kody-os#OPERATIONS.md, then overwrite this app with the catalog copy: https://github.com/Hypercubed/kody-os/tree/main/catalog/settings", "overwrite prompt is the one-liner with the folder URL");
  check(items4[5] && buttonLabels(items4[5]).join(",") === "Remove", "up-to-date row keeps Remove");
  check(summaryOf(items4[5]) && summaryOf(items4[5]).textContent === "Remove with an agent", "up-to-date row shows Remove details");
  check(promptCode(items4[5]) && promptCode(items4[5]).textContent === "Read package:kody-os#OPERATIONS.md, then remove this app: clock", "remove prompt names the app id, not the folder URL");
  check(items4[6] && buttonLabels(items4[6]).join(",") === "Remove", "absorbed row offers Remove only");
  check(items4[6].querySelector(".store-badge") && items4[6].querySelector(".store-badge").textContent === "Absorbed", "absorbed row badges Absorbed");
  check(summaryOf(items4[6]) && summaryOf(items4[6]).textContent === "Remove with an agent", "absorbed row shows Remove details, not Absorb details");
  check(promptCode(items4[6]) && promptCode(items4[6]).textContent === "Read package:kody-os#OPERATIONS.md, then remove this app: streaks", "absorbed prompt is the remove one-liner with the app id");

  check(items4[7] && buttonLabels(items4[7]).join(",") === "Overwrite", "absorbed-behind row offers confirmed Overwrite");
  check(items4[7].querySelector(".store-badge") && items4[7].querySelector(".store-badge").textContent === "Absorbed \u00b7 update available", "absorbed-behind row badges Absorbed \u00b7 update available");
  check(summaryOf(items4[7]) && summaryOf(items4[7]).textContent === "Absorb with an agent", "absorbed-behind row shows Absorb details again");
  check(promptCode(items4[7]) && promptCode(items4[7]).textContent === "Read package:kody-os#OPERATIONS.md, then absorb the catalog changes into this app, keeping my local customizations: https://github.com/Hypercubed/kody-os/tree/main/catalog/pushup", "absorbed-behind prompt is the absorb one-liner");
  check(!detailsOf(items4[8]), "needsNewerShell row shows no details element");
  check(!detailsOf(items4[9]), "needsNewerSchema row shows no details element");
  check(detailsOf(items4[10]) && summaryOf(items4[10]).textContent === "Install with an agent", "not-installed recipe-only row now shows Install details");
  check(promptCode(items4[10]) && promptCode(items4[10]).textContent === "Read package:kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/daily-feed", "recipe-only install prompt is the one-liner with the folder URL");
  check(items4[10].textContent.indexOf("Ask an agent to install via its recipe.") !== -1, "not-installed recipe-only row keeps its recipe prompt");
  check(doc4.querySelectorAll(".store-details button").length === 0, "no copy button inside any details element");
  check(js.indexOf("navigator.clipboard") === -1, "bundle uses no Clipboard API for the prompt");
  const updateAllBtn4 = doc4.querySelector(".store-update-all button");
  check(updateAllBtn4 && !doc4.querySelector(".store-update-all").hidden, "Update All is shown when a behind-clean row exists");
  updateAllBtn4.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls4.indexOf("/manage/update?app=app-store&id=calculator") !== -1, "Update All updates the behind-clean app");
  check(calls4.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=streaks") !== -1; }).length === 0, "Update All never calls update for the absorbed app");
  check(calls4.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=pushup") !== -1; }).length === 0, "Update All never calls update for the absorbed-behind app");
  // Row details layout (store-row-details-layout): the badge sits below
  // the description and capabilities inside .store-body; the details
  // element is the last child of li.store-row, spanning the full row
  // width under the controls; the row has top and bottom padding. The
  // caret rules are asserted above; jsdom does not lay out, so the
  // wrapped line is asserted on DOM parentage and stylesheet text.
  var bodyKids2 = Array.prototype.slice.call(items4[2].querySelector('.store-body').children);
  function classIndex(kids, cls) {
    for (var k = 0; k < kids.length; k++) { if (kids[k].className === cls) { return k; } }
    return -1;
  }
  check(classIndex(bodyKids2, 'store-desc') !== -1 && classIndex(bodyKids2, 'store-caps') !== -1 && classIndex(bodyKids2, 'store-badge') !== -1, 'behind-modified body has description, capabilities, and badge');
  check(classIndex(bodyKids2, 'store-desc') < classIndex(bodyKids2, 'store-caps') && classIndex(bodyKids2, 'store-caps') < classIndex(bodyKids2, 'store-badge'), 'badge sits after the capabilities inside the body');
  check(!items4[2].querySelector('.store-body .store-details'), 'details is no longer inside the body');
  check(detailsOf(items4[2]) && detailsOf(items4[2]).parentNode === items4[2], 'details parent is the row, not the body');
  check(detailsOf(items4[2]) && items4[2].lastChild === detailsOf(items4[2]), 'details is the last child of the row');
  check(detailsOf(items4[11]) && detailsOf(items4[11]).parentNode === items4[11] && items4[11].lastChild === detailsOf(items4[11]), 'folder-url row details is also the last child of its row');
  check(rule('.store-row').indexOf('padding: 0.7rem 0.7rem') !== -1, 'row has top and bottom padding');
  check(rule('.store-row').indexOf('min-height: 6.5rem') !== -1, 'row keeps its 6.5rem minimum height');
  check(rule('.store-details').indexOf('flex: 0 0 100%') !== -1, 'details spans the full row width');
  check(rule('.store-details summary::before').indexOf('solid currentColor') !== -1, 'caret triangle is still present');
  check(items4[5] && !items4[5].querySelector('.store-badge'), 'up-to-date row has no badge');
  // Fixed row heights: badge margin above, and .store-main, .store-body,
  // .store-controls each spanning the row content height (6.5rem row
  // minus 1.4rem padding minus 0.25rem border = 4.85rem) with their
  // content vertically centered. min-height, not height, so a two-line
  // label or a long description grows the row instead of clipping.
  check(rule('.store-badge').indexOf('margin: 0.2rem 0 0.2rem 0') !== -1, 'badge has 0.2rem margin above and below');
  check(rule('.store-main').indexOf('min-height: 4.85rem') !== -1, 'store main spans the row content height');
  check(rule('.store-body').indexOf('min-height: 4.85rem') !== -1, 'store body spans the row content height');
  check(rule('.store-controls').indexOf('min-height: 4.85rem') !== -1, 'store controls span the row content height');
  check(rule('.store-main').indexOf('box-sizing: border-box') !== -1, 'store main keeps its padding inside its height');
  var bodyRule = rule('.store-body');
  check(bodyRule.indexOf('display: flex') !== -1 && bodyRule.indexOf('flex-direction: column') !== -1 && bodyRule.indexOf('justify-content: center') !== -1, 'store body stacks and vertically centers its text');
  check(rule('.store-controls').indexOf('align-items: center') !== -1, 'store controls vertically center the button');
  // Agent prompt text matches the Help page agent text (.gate-hint):
  // dashed outline, monospace font, normal weight. The padding insets
  // the text from the dashed border, as .gate-hint does.
  var agentCode = rule('.store-details code');
  check(agentCode.indexOf('border: 1px dashed #000') !== -1, 'agent code has the help dashed outline');
  check(agentCode.indexOf("font-family: 'Courier New', Courier, monospace") !== -1, 'agent code uses the help monospace font');
  check(agentCode.indexOf('font-weight: normal') !== -1, 'agent code uses normal weight, like the help');
  check(agentCode.indexOf('padding: 0.7rem 0.8rem') !== -1, 'agent code insets its text from the dashed border');
  check(agentCode.indexOf('display: block') !== -1 && agentCode.indexOf('white-space: pre-wrap') !== -1, 'agent code keeps its block pre-wrap layout');

  // Self-update section, gated (compatible-catalog Phase 1): when the
  // latest Store needs a newer shell, the section shows the
  // requirement instead of an update control, and keeps Remove with
  // the same confirmation as a row.
  const rowsGated = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
  ];
  const storeSelfGated = { installedCatalogVersion: 27, pinnedLabel: '4.2.0', discoveryRef: 'main', discoveryLabel: null, runningVersion: '4.2.1', latestCatalogVersion: 29, latestMinPackageVersion: '9.9.9', needsNewerShell: true, hasUpdate: false };
  const calls5 = [];
  const dom5 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win5 = dom5.window;
  win5.fetch = function (url) {
    calls5.push(url);
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsGated, storeSelf: storeSelfGated }); } });
    }
    if (url.indexOf("/manage/remove") !== -1 && url.indexOf("confirmed=1") === -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "Confirmation required.", needsConfirmation: true, additions: [] }); } });
    }
    if (url.indexOf("confirmed=1") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, id: "app-store" }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win5.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc5 = win5.document;
  const selfSection5 = doc5.querySelector(".store-self");
  check(selfSection5 && selfSection5.hidden === false, "gated section renders");
  check(selfSection5.textContent.indexOf("Requires shell v9.9.9 (running v4.2.1).") !== -1, "gated section shows the requirement instead of an update");
  check(buttonLabels(selfSection5).join(",") === "Remove", "gated section keeps Remove, not Update");
  const gatedRemoveBtn = selfSection5.querySelector("button");
  gatedRemoveBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc5.querySelector(".store-dialog").textContent.indexOf("Confirm remove") !== -1, "gated Remove shows a remove confirmation, not an immediate apply");
  const gatedConfirmBtn = doc5.querySelectorAll(".store-dialog button")[0];
  gatedConfirmBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls5.indexOf("/manage/remove?app=app-store&id=app-store&confirmed=1") !== -1, "confirm submits the confirmed Store remove");
  // Full package reference (agent-prompt-pattern): on a Kody host the
  // prompts use @owner/leaf (owner from the host subdomain, leaf from
  // the mount); on localhost the bare leaf is the fallback (see the
  // earlier prompt checks, which use package:kody-os).
  const rowsKodyHost = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installMode: "json", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/counter" },
    { id: "clock", label: "Clock", name: "Clock", icon: "#", description: "Clock.", installMode: "json", installed: true, inCatalog: true, status: "up-to-date", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] }, folderUrl: "https://github.com/Hypercubed/kody-os/tree/main/catalog/clock" },
  ];
  const dom6 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/kody-os/apps/app-store">' + html + "</div></section></body></html>",
    { url: "https://hypercubed.kody.run/kody-os/apps/app-store", runScripts: "outside-only" }
  );
  const win6 = dom6.window;
  win6.fetch = function (url) {
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsKodyHost }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win6.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc6 = win6.document;
  const items6 = doc6.querySelectorAll(".store-row");
  check(promptCode(items6[0]) && promptCode(items6[0]).textContent === "Read package:@hypercubed/kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/counter", "Kody-host install prompt uses the full @owner/leaf reference");
  check(promptCode(items6[1]) && promptCode(items6[1]).textContent === "Read package:@hypercubed/kody-os#OPERATIONS.md, then remove this app: clock", "Kody-host remove prompt uses the full @owner/leaf reference");
  // dom7: the shell stamps data-package-ref on the bundle container.
  // On localhost the host derivation would give the bare leaf, so a
  // full @owner/leaf prompt here proves the shell-provided ref wins.
  const dom7 = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store" data-package-ref="@hypercubed/kody-os">' + html + "</div></section></body></html>",
    { url: "http://localhost:4302/apps/app-store", runScripts: "outside-only" }
  );
  const win7 = dom7.window;
  win7.fetch = function (url) {
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsKodyHost }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win7.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc7 = win7.document;
  const items7 = doc7.querySelectorAll(".store-row");
  check(promptCode(items7[0]) && promptCode(items7[0]).textContent === "Read package:@hypercubed/kody-os#OPERATIONS.md, then install this app: https://github.com/Hypercubed/kody-os/tree/main/catalog/counter", "shell-provided data-package-ref wins over the localhost host derivation");
  check(promptCode(items7[1]) && promptCode(items7[1]).textContent === "Read package:@hypercubed/kody-os#OPERATIONS.md, then remove this app: clock", "shell-provided ref is used by the remove prompt too");
  if (failures > 0) {
    console.error("\n" + failures + " check(s) FAILED");
    process.exit(1);
  }
  console.log("\nALL APP STORE BUNDLE CHECKS PASSED");
}

main().catch(function (err) {
  console.error("FAIL - harness threw: " + err.message);
  process.exit(1);
});
