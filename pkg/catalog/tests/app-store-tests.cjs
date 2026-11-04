/* jsdom harness for the data-only App Store bundle.
 *
 * Tests the bundle exactly as stored in ../app-store.bundle.json, with
 * a mocked management API (fetch stub): rows render from /manage/rows,
 * capabilities are disclosed in plain words, a modified-app update
 * shows the bundle's own confirmation UI and only applies on confirm,
 * and the no-JavaScript note is hidden once the script runs.
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

const DEFINITION_PATH = path.join(__dirname, "..", "app-store.bundle.json");
const definition = JSON.parse(fs.readFileSync(DEFINITION_PATH, "utf8"));
const html = definition.bundle.files[definition.bundle.entry];
const js = definition.bundle.files["store.js"];

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
    { id: "app-store", label: "App Store", name: "App Store", icon: "⊞", description: "Store.", installed: true, inCatalog: true, status: "behind-modified", modified: true, pinned: false, hidden: false, homepage: false, capabilities: { manageApps: true, feedHosts: [], proxyHosts: [] } },
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
      return Promise.resolve({ json: function () { return Promise.resolve({ ok: false, error: "Confirmation required.", needsConfirmation: true, additions: ["manage other apps"] }); } });
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
  check(items.length === 2, "two rows render from mocked management API");
  check(items[0] && items[0].textContent.indexOf("Install") !== -1, "not-installed row offers Install");
  check(items[1] && items[1].textContent.indexOf("Update…") !== -1, "behind-modified row offers Update…");
  const firstChildren = Array.prototype.slice.call(items[0].children);
  const mainIndex = firstChildren.indexOf(items[0].querySelector(".store-main"));
  const bodyIndex = firstChildren.indexOf(items[0].querySelector(".store-body"));
  const controlsIndex = firstChildren.indexOf(items[0].querySelector(".store-controls"));
  check(mainIndex === 0, "row starts with the tile-sized icon/title block");
  check(bodyIndex !== -1 && controlsIndex !== -1 && bodyIndex < controlsIndex, "description fills the middle before the controls");
  const mainKids = Array.prototype.slice.call(items[0].querySelector(".store-main").children);
  check(mainKids[0].className === "store-icon" && mainKids[1].className === "store-label", "icon and title are stacked in the tile block");
  check(!items[0].querySelector(".store-badge"), "no Installed or Not installed label");
  check(items[1].querySelector(".store-badge").textContent.indexOf("update available") !== -1, "other status labels stay");
  check(doc.body.textContent.indexOf("Can manage other apps") !== -1, "manageApps is disclosed in plain words");
  check(doc.querySelector(".store-nojs").style.display === "none", "no-JavaScript note is hidden once the script runs");
  check(calls[0] === "/manage/rows?app=app-store", "first fetch is the management rows API");
  const updateBtn = items[1].querySelector("button");
  updateBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(doc.querySelector(".store-confirm").textContent.indexOf("Confirm update") !== -1, "modified update shows bundle confirmation, not an immediate apply");
  check(doc.querySelector(".store-confirm").textContent.indexOf("manage other apps") !== -1, "confirmation lists capability additions");
  const confirmBtn = doc.querySelectorAll(".store-confirm button")[0];
  confirmBtn.click();
  await new Promise(function (r) { setTimeout(r, 50); });
  check(calls.indexOf("/manage/update?app=app-store&id=app-store&confirmed=1") !== -1, "confirm submits the confirmed update");
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
