/* jsdom harness for the data-only App Store bundle.
 *
 * Tests the bundle exactly as stored in ../app-store/definition.json, with
 * a mocked management API (fetch stub): rows render from /manage/rows,
 * capabilities are disclosed in plain words, a modified-app update
 * shows the bundle's own confirmation UI and only applies on confirm,
 * and the no-JavaScript note is hidden once the script runs.
 * Not-installed rows offer Add; up-to-date rows offer Remove through the
 * confirmed management remove path; Update All appears only when a safe
 * (non-overwrite) update exists and updates only those rows.
 *
 * How to run (jsdom is the only dependency, installed ephemerally):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node pkg/catalog/tests/app-store-tests.cjs
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
        "then run: node pkg/catalog/tests/app-store-tests.cjs\n" +
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
  const rows = [
    { id: "counter", label: "Counter", name: "Counter", icon: "#", description: "A counter.", installed: false, inCatalog: true, status: "not-installed", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
    { id: "calculator", label: "Calculator", name: "Calculator", icon: "#", description: "Calculator.", installed: true, inCatalog: true, status: "behind-clean", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [] } },
    { id: "app-store", label: "App Store", name: "App Store", icon: "⊞", description: "Store.", installed: true, inCatalog: true, status: "behind-modified", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: true, feedHosts: [], proxyHosts: [] } },
    { id: "xkcd", label: "xkcd", name: "xkcd", icon: "#", description: "xkcd.", installed: true, inCatalog: true, status: "snapshot-less", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [], themeView: true, themeSet: false } },
    { id: "clock", label: "Clock", name: "Clock", icon: "#", description: "Clock.", installed: true, inCatalog: true, status: "up-to-date", modified: false, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: false, feedHosts: [], proxyHosts: [], themeView: true, themeSet: true } },
  ];
  const calls = [];
  const dom = new JSDOM(
    '<!doctype html><html><body><section class="app" data-app-id="app-store"><div class="bundle" data-action-base="/apps/app-store">' + html + "</div></section></body></html>",
    { url: "http://localhost/apps/app-store", runScripts: "outside-only" }
  );
  const win = dom.window;
  win.fetch = function (url) {
    calls.push(url);
    if (url.indexOf("/manage/rows") !== -1) {
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rows }); } });
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
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc = win.document;
  const items = doc.querySelectorAll(".store-row");
  function buttonLabels(row) {
    return Array.prototype.map.call(row.querySelectorAll("button"), function (b) { return b.textContent; });
  }
  check(items.length === 5, "five rows render from mocked management API");
  check(items[0] && buttonLabels(items[0]).join(",") === "Add", "not-installed row offers Add, not Install");
  check(items[1] && buttonLabels(items[1]).join(",") === "Update", "behind-clean row offers Update");
  check(items[2] && buttonLabels(items[2]).join(",") === "Overwrite", "behind-modified row offers Overwrite");
  check(items[3] && buttonLabels(items[3]).join(",") === "Overwrite", "snapshot-less row offers Overwrite");
  check(items[4] && buttonLabels(items[4]).join(",") === "Remove", "up-to-date row offers Remove");
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
  check(items[2].querySelector(".store-badge").textContent.indexOf("update available") !== -1, "other status labels stay");
  check(doc.body.textContent.indexOf("Can manage other apps") !== -1, "manageApps is disclosed in plain words");
  check(items[3].textContent.indexOf("Can view the shell theme.") !== -1, "theme view-only is disclosed in plain words");
  check(items[4].textContent.indexOf("Can view and change the shell theme.") !== -1, "theme view+set is disclosed in plain words");
  check(doc.querySelector(".store-nojs").style.display === "none", "no-JavaScript note is hidden once the script runs");
  check(calls[0] === "/manage/rows?app=app-store", "first fetch is the management rows API");
  const updateBtn = items[2].querySelector("button");
  updateBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc.querySelector(".store-dialog").textContent.indexOf("Confirm update") !== -1, "modified update shows bundle confirmation, not an immediate apply");
  check(doc.querySelector(".store-dialog").textContent.indexOf("manage other apps") !== -1, "confirmation lists capability additions");
  const confirmBtn = doc.querySelectorAll(".store-dialog button")[0];
  confirmBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls.indexOf("/manage/update?app=app-store&id=app-store&confirmed=1") !== -1, "confirm submits the confirmed update");
  const reloaded = doc.querySelectorAll(".store-row");
  const snapshotLessBtn = reloaded[3] && reloaded[3].querySelector("button");
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
  check(batchCalls.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=app-store") !== -1; }).length === 0, "Update All never calls update for the behind-modified app");
  check(batchCalls.filter(function (c) { return c.indexOf("/manage/update") !== -1 && c.indexOf("id=xkcd") !== -1; }).length === 0, "Update All never calls update for the snapshot-less app");
  check(batchCalls.filter(function (c) { return c.indexOf("confirmed=1") !== -1; }).length === 0, "Update All never sends a confirmed update");
  check(doc.querySelector(".store-status").textContent === "Updated 1 app.", "Update All reports what it updated");
  const removeBtn = doc.querySelectorAll(".store-row")[4].querySelector("button");
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
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, rows: rowsNoSafe }); } });
    }
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "unexpected" }); } });
  };
  win2.eval(js);
  await new Promise(function (r) { setTimeout(r, 50); });
  const doc2 = win2.document;
  check(doc2.querySelector(".store-update-all").hidden === true, "Update All is hidden when every out-of-date app needs Overwrite");
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
