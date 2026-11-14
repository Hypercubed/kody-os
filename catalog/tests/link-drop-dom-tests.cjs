/* Link Drop DOM wiring test (shell-islands port, jsdom).
 * Run with node:
 *   node catalog/tests/link-drop-dom-tests.cjs
 * Loads the bundle exactly as stored in ../link-drop/definition.json,
 * in a jsdom page with the bridge and the vendored Lit loaded, the
 * links seeded from a JSON seed script, and the bundle script run.
 * Proves: empty list shows the install block with a bookmarklet
 * targeting the page's own base; a two-entry list renders
 * most-recent-first with an http anchor and a date suffix; a
 * javascript: entry has no anchor; a non-JSON entry renders as
 * text; and a non-empty list moves the install block below the
 * list. Rendering is through the provided lit-html (window.KodyLit),
 * so assertions read the live DOM (textContent / querySelector),
 * not an innerHTML string — lit-html marks dynamic parts with
 * comment nodes, so innerHTML string matching would be brittle.
 * jsdom is the only dependency (see catalog/tests/counter-tests.cjs
 * for the install note). */
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
        "then run: node catalog/tests/link-drop-dom-tests.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "link-drop", "definition.json");
const BRIDGE_PATH = path.join(__dirname, "..", "..", "pkg", "src", "bridge", "bridge.js");
const LIT_PATH = path.join(__dirname, "..", "..", "pkg", "public", "lit.js");

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no script");
  return m[1];
}

function runWithLinks(links) {
  const loaded = require("./read-bundle.cjs").readBundleFiles(DEFINITION_PATH);
  const bundleHtml = loaded.files["index.html"];
  const dom = new JSDOM(bundleHtml, {
    url: "http://127.0.0.1:4302/kody-os/apps/link-drop",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const doc = dom.window.document;
  // Mirror a real app page: the bundle lives inside a section[data-app-id].
  const section = doc.createElement("section");
  section.setAttribute("data-app-id", "link-drop");
  const ld = doc.querySelector(".ld");
  if (ld) {
    section.appendChild(ld);
    doc.body.appendChild(section);
  } else {
    doc.body.appendChild(section);
  }
  // Seed the links, as the shell renders before the bundle.
  const seed = doc.createElement("script");
  seed.setAttribute("type", "application/json");
  seed.setAttribute("data-kody-state-seed", "1");
  seed.setAttribute("data-app-id", "link-drop");
  seed.textContent = JSON.stringify({ links: links });
  doc.body.insertBefore(seed, doc.body.firstChild);
  // Mock fetch (the bundle itself makes no fetches, but the bridge may).
  dom.window.fetch = function () {
    return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, state: { links: links } }); } });
  };
  dom.window.eval(fs.readFileSync(BRIDGE_PATH, "utf8"));
  if (!dom.window.KodyBridge) throw new Error("bridge did not load");
  dom.window.eval(fs.readFileSync(LIT_PATH, "utf8"));
  if (!dom.window.KodyLit) throw new Error("vendored Lit did not load (window.KodyLit missing)");
  dom.window.eval(extractScript(bundleHtml));
  if (dom.window.document.readyState === "loading") {
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  }
  return { dom: dom, doc: doc };
}

function el(ctx, id) {
  return ctx.doc.getElementById(id);
}
function listItems(ctx) {
  return Array.prototype.slice.call(ctx.doc.querySelectorAll("#ld-list .ld-item"));
}

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + " " + name + (ok ? "" : " -- " + detail));
  if (!ok) { failures++; }
}

var empty = runWithLinks([]);
check("empty: list hidden, install shown, bookmarklet absolute, clear form absolute",
  el(empty, "ld-list").style.display === "none" &&
  el(empty, "ld-install").style.display === "" &&
  el(empty, "ld-bookmarklet").getAttribute("href") &&
  el(empty, "ld-bookmarklet").getAttribute("href").indexOf("http://127.0.0.1:4302/kody-os/apps/link-drop?action=send&entry=") !== -1 &&
  el(empty, "ld-clear-form").getAttribute("action") === "http://127.0.0.1:4302/kody-os/apps/link-drop?action=clear",
  JSON.stringify({ list: el(empty, "ld-list").style.display, href: el(empty, "ld-bookmarklet").getAttribute("href"), clear: el(empty, "ld-clear-form").getAttribute("action") }));

var two = runWithLinks([
  JSON.stringify({ t: "2026-11-03T10:00:00.000Z", title: "Oldest", url: "https://example.com/old" }),
  JSON.stringify({ t: "2026-11-04T10:00:00.000Z", title: "Newest", url: "https://example.com/new" })
]);
var twoItems = listItems(two);
var twoFirst = twoItems[0] ? twoItems[0].textContent : "";
var twoSecond = twoItems[1] ? twoItems[1].textContent : "";
var twoAnchor = two.doc.querySelector('#ld-list a[href="https://example.com/new"]');
check("two entries render most-recent-first, one line name - date, no url/time divs",
  el(two, "ld-list").style.display === "" &&
  twoItems.length === 2 &&
  twoFirst.indexOf("Newest") !== -1 && twoSecond.indexOf("Oldest") !== -1 &&
  twoFirst.indexOf("Oldest") === -1 && twoSecond.indexOf("Newest") === -1 &&
  twoAnchor && twoAnchor.textContent === "Newest" &&
  twoFirst.indexOf(" - ") !== -1 &&
  two.doc.querySelector("#ld-list .ld-url") === null && two.doc.querySelector("#ld-list .ld-time") === null,
  JSON.stringify({ items: twoItems.map(function (i) { return i.textContent; }), anchor: twoAnchor ? twoAnchor.textContent : null }));

var bad = runWithLinks([
  JSON.stringify({ t: "2026-11-04T10:00:00.000Z", title: "Evil", url: "javascript:alert(1)" }),
  "plain text entry, not json"
]);
var badItems = listItems(bad);
var badText = badItems.map(function (i) { return i.textContent; }).join(" | ");
check("javascript: entry has no anchor, plain entry renders as text",
  bad.doc.querySelector('#ld-list a[href^="javascript:"]') === null &&
  badText.indexOf("Evil") !== -1 &&
  badText.indexOf("plain text entry, not json") !== -1,
  badText);
check("non-empty list moves install block below list",
  (function () {
    var install = el(bad, "ld-install");
    var parent = install.parentNode;
    return parent && parent.lastElementChild === install;
  })(),
  "install is not the last child of its parent");

if (failures > 0) { console.log("FAILURES: " + failures); process.exit(1); }
console.log("ALL LINK-DROP DOM CHECKS PASSED");
