/* jsdom harness for the counter example bundle.
 *
 * Tests the definition exactly as stored in ../counter.bundle.json: the
 * bundle's step behaviour, its sync with the shell-rendered state field,
 * and the shell Reset form's in-place patch. These are behaviour tests,
 * not live tests: nothing here talks to Kody, the hosted OS, or the
 * local preview server. They fail on both pre-fix bundles (the
 * duplicate-set_count bundle and the Reset-ignoring bundle), so they
 * are the regression tests for those fixes.
 *
 * How to run (jsdom is the only dependency, installed ephemerally so
 * the repo stays free of a test runner and a node_modules tree):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node pkg/examples/tests/counter-tests.cjs
 *
 * Run from anywhere; the harness finds counter.bundle.json relative to
 * itself. If jsdom lives elsewhere, point JSDOM_PATH at its folder
 * (the folder containing jsdom's package.json), e.g.
 * JSDOM_PATH=/somewhere/node_modules/jsdom. A plain require('jsdom')
 * is tried first, so an agent that installed jsdom in the repo tree
 * needs no extra setup.
 *
 * The separate live check is `kody dev` (see docs/adding-an-app.md,
 * "Add to the local preview"): seed this definition through
 * pkg/scripts/registry.ts, start `kody dev --target mock`, open
 * /apps/counter, step it, then use Reset and
 * confirm the big number moves to 0 and the next +1 sends 1. This
 * harness simulates the shell side of that check (the exact
 * [data-field] markup renderAppSection renders, and the shell
 * client's span-only patch on a Reset submit) so the bundle logic
 * can be verified without a running server or an access code.
 *
 * fetch is mocked with manually-resolved promises so rapid clicks can
 * be made while a request is still in flight, exactly the case that
 * produced duplicate set_count calls with the same value.
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
        "then run: node pkg/examples/tests/counter-tests.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "counter.bundle.json");

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no script");
  return m[1];
}
function valueOf(url) {
  const m = /[?&]value=(-?\d+)/.exec(url);
  return m ? parseInt(m[1], 10) : null;
}
function makeDom(bundleHtml, initial) {
  const dom = new JSDOM(bundleHtml, {
    url: "https://hypercubed.kody.run/kody-os/apps/counter?k=TESTCODE",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const doc = dom.window.document;
  if (initial !== undefined) {
    doc.querySelector(".counter-num").textContent = String(initial);
  }
  // Mock fetch: record URLs, resolve manually via pending[].
  const calls = [];
  const pending = [];
  dom.window.fetch = function (url) {
    calls.push(url);
    return new Promise(function (resolve, reject) {
      pending.push({ url: url, resolve: resolve, reject: reject });
    });
  };
  dom.window.eval(extractScript(bundleHtml));
  if (dom.window.document.readyState === "loading") {
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  }
  return { dom: dom, calls: calls, pending: pending };
}
function shown(ctx) {
  return ctx.dom.window.document.querySelector(".counter-num").textContent;
}
function fieldShown(ctx) {
  var span = ctx.dom.window.document.querySelector('[data-field="count"] span');
  return span ? span.textContent : null;
}
/* Shell-page DOM: bundle plus the shell-rendered state field and Reset
 * form, inserted before the bundle script runs, as on a real app page. */
function makeShellDom(bundleHtml, serverState) {
  const dom = new JSDOM(bundleHtml, {
    url: "https://hypercubed.kody.run/kody-os/apps/counter?k=TESTCODE",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const doc = dom.window.document;
  const field = doc.createElement("p");
  field.setAttribute("data-field", "count");
  field.setAttribute("hidden", "");
  const span = doc.createElement("span");
  span.textContent = String(serverState);
  field.appendChild(doc.createTextNode("count: "));
  field.appendChild(span);
  doc.body.appendChild(field);
  const form = doc.createElement("form");
  form.setAttribute("class", "app-action");
  form.setAttribute("method", "GET");
  // As renderAppSection renders it: action URL plus hidden action/k inputs.
  form.setAttribute("action", "/apps/counter");
  const actionInput = doc.createElement("input");
  actionInput.setAttribute("type", "hidden");
  actionInput.setAttribute("name", "action");
  actionInput.setAttribute("value", "reset_count");
  form.appendChild(actionInput);
  const keyInput = doc.createElement("input");
  keyInput.setAttribute("type", "hidden");
  keyInput.setAttribute("name", "k");
  keyInput.setAttribute("value", "TESTCODE");
  form.appendChild(keyInput);
  const btn = doc.createElement("button");
  btn.setAttribute("type", "submit");
  btn.textContent = "Reset count";
  form.appendChild(btn);
  doc.body.appendChild(form);
  const calls = [];
  const pending = [];
  dom.window.fetch = function (url) {
    calls.push(url);
    return new Promise(function (resolve, reject) {
      pending.push({ url: url, resolve: resolve, reject: reject });
    });
  };
  dom.window.eval(extractScript(bundleHtml));
  if (dom.window.document.readyState === "loading") {
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  }
  return { dom: dom, calls: calls, pending: pending };
}
/* Shell-page DOM with submit capture disabled: drop only capture-phase
 * submit listeners on the document, so the bundle's document-level
 * capture claim never runs. This is the fallback path for an engine
 * that does not deliver submit capture: the shell client's fetch (or,
 * here, the simulated span patch) must still be sequenced. The wrapper
 * is installed after the bundle script is evaluated but before the
 * DOMContentLoaded dispatch that runs initCounter, so init's own
 * listener registration is what gets dropped. */
function makeShellDomNoCapture(bundleHtml, serverState) {
  const dom = new JSDOM(bundleHtml, {
    url: "https://hypercubed.kody.run/kody-os/apps/counter?k=TESTCODE",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const doc = dom.window.document;
  const field = doc.createElement("p");
  field.setAttribute("data-field", "count");
  field.setAttribute("hidden", "");
  const span = doc.createElement("span");
  span.textContent = String(serverState);
  field.appendChild(doc.createTextNode("count: "));
  field.appendChild(span);
  doc.body.appendChild(field);
  const form = doc.createElement("form");
  form.setAttribute("class", "app-action");
  form.setAttribute("method", "GET");
  form.setAttribute("action", "/apps/counter");
  const actionInput = doc.createElement("input");
  actionInput.setAttribute("type", "hidden");
  actionInput.setAttribute("name", "action");
  actionInput.setAttribute("value", "reset_count");
  form.appendChild(actionInput);
  const btn = doc.createElement("button");
  btn.setAttribute("type", "submit");
  btn.textContent = "Reset count";
  form.appendChild(btn);
  doc.body.appendChild(form);
  const calls = [];
  const pending = [];
  dom.window.fetch = function (url) {
    calls.push(url);
    return new Promise(function (resolve, reject) {
      pending.push({ url: url, resolve: resolve, reject: reject });
    });
  };
  dom.window.eval(extractScript(bundleHtml));
  const origAdd = doc.addEventListener.bind(doc);
  doc.addEventListener = function (type, fn, opts) {
    if (type === "submit" && opts === true) { return; }
    return origAdd(type, fn, opts);
  };
  if (dom.window.document.readyState === "loading") {
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  }
  return { dom: dom, calls: calls, pending: pending };
}
function submitReset(ctx) {
  const form = ctx.dom.window.document.querySelector("form.app-action");
  return form.dispatchEvent(new ctx.dom.window.Event("submit", { bubbles: true, cancelable: true }));
}
function addExtraForm(ctx, actionValue, formAction) {
  const doc = ctx.dom.window.document;
  const form = doc.createElement("form");
  form.setAttribute("class", "app-action");
  form.setAttribute("method", "GET");
  form.setAttribute("action", formAction);
  const input = doc.createElement("input");
  input.setAttribute("type", "hidden");
  input.setAttribute("name", "action");
  input.setAttribute("value", actionValue);
  form.appendChild(input);
  doc.body.appendChild(form);
  return form;
}
/* Simulate the shell client's fast-path patch after a Reset submit:
 * it sets only the [data-field] span text, in place, with no reload
 * and no notification to the bundle. MutationObserver delivery is
 * async, so callers await after this. */
async function shellReset(ctx, value) {
  const span = ctx.dom.window.document.querySelector('[data-field="count"] span');
  span.textContent = String(value);
  await sleep(20);
}
function click(ctx, delta) {
  const btn = ctx.dom.window.document.querySelector(
    '.counter-step[data-delta="' + delta + '"]'
  );
  btn.dispatchEvent(new ctx.dom.window.Event("click", { bubbles: true }));
}
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}
// Resolve one pending fetch as the server setting count to the requested
// value, unless override is given (external change while in flight).
async function resolveNext(ctx, override) {
  const p = ctx.pending.shift();
  if (!p) throw new Error("no pending fetch to resolve");
  const server = override !== undefined ? override : valueOf(p.url);
  p.resolve({ json: function () { return Promise.resolve({ ok: true, state: { count: server } }); } });
  await sleep(10);
  return p;
}
function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ok - " + msg);
}
let failures = 0;
async function test(name, fn) {
  console.log("\n== " + name + " ==");
  try { await fn(); } catch (e) { failures++; console.log("  FAIL: " + e.message); }
}

(async function () {
  const definition = JSON.parse(fs.readFileSync(DEFINITION_PATH, "utf8"));
  const newHtml = definition.bundle.files["index.html"];

  await test("DEFINITION: counter shape the bundle tests assume", async function () {
    assert(definition.id === "counter", "id is counter");
    assert(definition.schemaVersion === 4, "schemaVersion is 4, got " + definition.schemaVersion);
    assert(
      Array.isArray(definition.actions.set_count.effects) && definition.actions.set_count.effects[0].op === "set" &&
      Array.isArray(definition.actions.reset_count.effects) && definition.actions.reset_count.effects[0].op === "set",
      "actions use effects arrays with a set op"
    );
    assert(definition.bundle.entry === "index.html", "bundle entry is index.html");
    const bytes = Buffer.byteLength(newHtml, "utf8");
    assert(bytes <= 256 * 1024, "bundle is under the 256 KiB cap (" + bytes + " bytes)");
    assert(definition.actions.set_count && definition.actions.reset_count, "actions are set_count + reset_count");
    assert(
      (definition.ui.actions || []).some(function (a) { return a.action === "reset_count"; }),
      "ui.actions renders the shell Reset button"
    );
    const js = extractScript(newHtml);
    assert(js.indexOf("DOMContentLoaded") !== -1, "bundle waits for DOMContentLoaded");
    assert(js.indexOf("MutationObserver") !== -1, "bundle observes the shell field for shell-form changes");
    assert(js.indexOf("onSubmitCapture") !== -1, "bundle claims the Reset submit in the capture phase");
    assert(js.indexOf("resetOpSeq") !== -1, "bundle sequences Reset submits against steps");
    ["?.", "??", "=>", "`"].forEach(function (bad) {
      assert(js.indexOf(bad) === -1, "bundle script has no forbidden syntax " + bad);
    });
    ["const", "let", "async", "await"].forEach(function (bad) {
      assert(!new RegExp("\\b" + bad + "\\b").test(js), "bundle script has no forbidden keyword " + bad);
    });
  });

  await test("5 rapid +1 clicks send 2 calls (1, then 5), paint 5 immediately", async function () {
    const ctx = makeDom(newHtml, 0);
    click(ctx, 1); click(ctx, 1); click(ctx, 1); click(ctx, 1); click(ctx, 1);
    assert(ctx.calls.length === 1, "1 call while in flight, got " + ctx.calls.length);
    assert(valueOf(ctx.calls[0]) === 1, "first call is value=1");
    assert(shown(ctx) === "5", "optimistic paint is 5, got " + shown(ctx));
    await resolveNext(ctx);
    assert(ctx.calls.length === 2, "1 follow-up call after first resolves, got " + ctx.calls.length);
    assert(valueOf(ctx.calls[1]) === 5, "follow-up is value=5");
    assert(shown(ctx) === "5", "painted stays 5");
    await resolveNext(ctx);
    assert(ctx.calls.length === 2, "no third call");
    assert(shown(ctx) === "5", "final paint 5");
  });

  await test("-1 at 0 sends nothing; +1/-1 after a confirmed click reconciles", async function () {
    const ctx = makeDom(newHtml, 0);
    click(ctx, -1); click(ctx, -1); click(ctx, -1);
    assert(ctx.calls.length === 0, "no calls at the 0 clamp, got " + ctx.calls.length);
    assert(shown(ctx) === "0", "painted 0");
    click(ctx, 1);
    assert(ctx.calls.length === 1 && valueOf(ctx.calls[0]) === 1, "one call value=1");
    click(ctx, -1);
    assert(shown(ctx) === "0", "optimistic paint back to 0");
    await resolveNext(ctx);
    assert(ctx.calls.length === 2 && valueOf(ctx.calls[1]) === 0, "follow-up reconciles to 0");
    await resolveNext(ctx);
    assert(ctx.calls.length === 2, "settled");
  });

  await test("Slow clicks (one per round-trip) send each distinct value", async function () {
    const ctx = makeDom(newHtml, 0);
    click(ctx, 1); await resolveNext(ctx);
    click(ctx, 1); await resolveNext(ctx);
    click(ctx, -1); await resolveNext(ctx);
    assert(ctx.calls.map(valueOf).join(",") === "1,2,1", "calls are 1,2,1: " + ctx.calls.map(valueOf).join(","));
    assert(shown(ctx) === "1", "final paint 1");
  });

  await test("Server divergence rebases pending deltas instead of overwriting them", async function () {
    const ctx = makeDom(newHtml, 0);
    click(ctx, 1);
    click(ctx, 1); click(ctx, 1); // desired 3, in flight value 1
    await resolveNext(ctx, 2); // server says 2: someone else added 1
    assert(shown(ctx) === "4", "desired rebased to 2 + (3-1) = 4, got " + shown(ctx));
    assert(ctx.calls.length === 2 && valueOf(ctx.calls[1]) === 4, "follow-up is value=4");
    await resolveNext(ctx);
    assert(shown(ctx) === "4", "final paint 4");
  });

  await test("Fetch rejection does not wedge the counter (next click sends again)", async function () {
    const ctx = makeDom(newHtml, 0);
    click(ctx, 1);
    const p = ctx.pending.shift();
    p.reject(new Error("network down"));
    await sleep(10);
    // jsdom cannot navigate; in a real browser the fallback navigation
    // would run here. The assertion that matters in jsdom is that the
    // counter is not stuck in-flight: a new click sends a fresh call.
    click(ctx, 1);
    assert(ctx.calls.length === 2, "second click sends a fresh call after rejection, got " + ctx.calls.length);
    assert(valueOf(ctx.calls[1]) === 2, "fresh call counts the optimistic first click too (desired 1 + 1 = 2), got " + valueOf(ctx.calls[1]));
  });

  await test("Starting from a non-zero count, and k= is preserved", async function () {
    const ctx = makeDom(newHtml, 7);
    click(ctx, 1);
    assert(ctx.calls.length === 1 && valueOf(ctx.calls[0]) === 8, "value=8 from initial 7");
    assert(ctx.calls[0].indexOf("k=TESTCODE") !== -1, "k param preserved: " + ctx.calls[0]);
    assert(ctx.calls[0].indexOf("format=json") !== -1, "format=json preserved");
    await resolveNext(ctx);
    assert(shown(ctx) === "8", "final paint 8");
  });

  await test("Init reads the shell field, and stepping keeps the field in sync", async function () {
    const ctx = makeShellDom(newHtml, 9);
    assert(shown(ctx) === "9", "display starts at server state 9, got " + shown(ctx));
    assert(fieldShown(ctx) === "9", "field stays 9");
    click(ctx, 1);
    assert(valueOf(ctx.calls[0]) === 10, "first +1 sends 10, got " + valueOf(ctx.calls[0]));
    assert(shown(ctx) === "10", "optimistic paint is 10");
    assert(fieldShown(ctx) === "10", "bundle paint updates the shell field to 10, got " + fieldShown(ctx));
    await sleep(20);
    assert(shown(ctx) === "10", "own paint does not trigger a spurious adoption");
    assert(ctx.calls.length === 1, "no extra call from the observer, got " + ctx.calls.length);
    await resolveNext(ctx);
    assert(shown(ctx) === "10" && fieldShown(ctx) === "10", "settled at 10 in both places");
  });

  await test("Shell Reset patch resets display and internal count; next +1 sends 1", async function () {
    const ctx = makeShellDom(newHtml, 9);
    click(ctx, 1); await resolveNext(ctx);
    assert(shown(ctx) === "10", "settled at 10 before Reset");
    const callsBefore = ctx.calls.length;
    await shellReset(ctx, 0);
    assert(shown(ctx) === "0", "display follows the Reset patch to 0, got " + shown(ctx));
    assert(fieldShown(ctx) === "0", "field stays 0");
    assert(ctx.calls.length === callsBefore, "Reset itself sends no bundle fetch, got " + ctx.calls.length);
    click(ctx, 1);
    assert(valueOf(ctx.calls[ctx.calls.length - 1]) === 1, "next +1 sends 1 from the reset value, got " + valueOf(ctx.calls[ctx.calls.length - 1]));
    await resolveNext(ctx);
    assert(shown(ctx) === "1", "settled at 1");
  });

  await test("Reset while a set_count is in flight wins; stale response re-sends 0", async function () {
    const ctx = makeShellDom(newHtml, 9);
    click(ctx, 1);
    assert(valueOf(ctx.calls[0]) === 10, "in-flight call is 10");
    await shellReset(ctx, 0);
    assert(shown(ctx) === "0", "display follows Reset while in flight, got " + shown(ctx));
    await resolveNext(ctx); // stale pre-Reset response: server says 10
    assert(shown(ctx) === "0", "stale response does not repaint the old count, got " + shown(ctx));
    assert(ctx.calls.length === 2 && valueOf(ctx.calls[1]) === 0, "follow-up re-asserts the reset value 0, got " + ctx.calls.map(valueOf).join(","));
    await resolveNext(ctx);
    assert(ctx.calls.length === 2 && shown(ctx) === "0", "settled at 0 with no further calls");
  });

  await test("Reset submit paints 0 instantly and owns the submit through the bundle queue", async function () {
    const ctx = makeShellDom(newHtml, 5);
    assert(shown(ctx) === "5", "display starts at 5, got " + shown(ctx));
    const cancelled = submitReset(ctx);
    assert(cancelled === false, "submit is cancelled by the capture claim, got " + cancelled);
    assert(shown(ctx) === "0", "display is 0 before any fetch resolves, got " + shown(ctx));
    assert(ctx.calls.length === 1, "one bundle call, got " + ctx.calls.length);
    assert(valueOf(ctx.calls[0]) === 0, "call is value=0, got " + ctx.calls[0]);
    assert(ctx.calls[0].indexOf("action=set_count") !== -1, "call is set_count, not reset_count: " + ctx.calls[0]);
    await resolveNext(ctx);
    assert(shown(ctx) === "0" && fieldShown(ctx) === "0", "settled at 0 in both places");
  });

  await test("Reset then +1 while the Reset fetch is in flight keeps the +1", async function () {
    const ctx = makeShellDom(newHtml, 5);
    submitReset(ctx);
    assert(shown(ctx) === "0", "Reset paints 0 at once, got " + shown(ctx));
    click(ctx, 1);
    assert(shown(ctx) === "1", "step after Reset, got " + shown(ctx));
    assert(ctx.calls.length === 1, "step coalesced while the Reset fetch is in flight, got " + ctx.calls.length);
    await resolveNext(ctx);
    assert(shown(ctx) === "1", "step survives the Reset fetch returning, got " + shown(ctx));
    assert(ctx.calls.length === 2 && valueOf(ctx.calls[1]) === 1, "follow-up is value=1, got " + ctx.calls.map(valueOf).join(","));
    await resolveNext(ctx);
    assert(shown(ctx) === "1", "settled at 1");
  });

  await test("+1 in flight, then Reset, stale response does not flash the old value", async function () {
    const ctx = makeShellDom(newHtml, 5);
    click(ctx, 1);
    assert(shown(ctx) === "6", "step paints 6, got " + shown(ctx));
    submitReset(ctx);
    assert(shown(ctx) === "0", "Reset paints 0 at once even with a step in flight, got " + shown(ctx));
    await resolveNext(ctx);
    assert(shown(ctx) === "0", "stale pre-Reset response does not flash 6, got " + shown(ctx));
    assert(ctx.calls.length === 2 && valueOf(ctx.calls[1]) === 0, "follow-up re-asserts 0, got " + ctx.calls.map(valueOf).join(","));
    await resolveNext(ctx);
    assert(shown(ctx) === "0", "settled at 0");
  });

  await test("Fallback when capture does not deliver: late shell patch cannot lose a step", async function () {
    const ctx = makeShellDomNoCapture(newHtml, 5);
    const cancelled = submitReset(ctx);
    assert(cancelled === true, "bundle does not claim the submit when capture is unavailable, got " + cancelled);
    assert(shown(ctx) === "0", "form-level listener still paints 0 at submit time, got " + shown(ctx));
    assert(ctx.calls.length === 0, "no bundle fetch: the shell fetch owns the server call, got " + ctx.calls.length);
    click(ctx, 1);
    assert(shown(ctx) === "1", "step after Reset, got " + shown(ctx));
    await shellReset(ctx, 0);
    assert(shown(ctx) === "1", "late shell patch cannot lose the step, got " + shown(ctx));
    assert(fieldShown(ctx) === "1", "field is painted back to the desired value, got " + fieldShown(ctx));
    assert(ctx.calls.length === 1 && valueOf(ctx.calls[0]) === 1, "only the step fetch, value=1, got " + ctx.calls.map(valueOf).join(","));
    await resolveNext(ctx);
    assert(shown(ctx) === "1", "settled at 1");
  });

  await test("A non-Reset form is not claimed by the bundle", async function () {
    const ctx = makeShellDom(newHtml, 5);
    const other = addExtraForm(ctx, "set_count", "/apps/counter");
    const cancelled = other.dispatchEvent(new ctx.dom.window.Event("submit", { bubbles: true, cancelable: true }));
    assert(cancelled === true, "unclaimed form submit is not cancelled, got " + cancelled);
    assert(shown(ctx) === "5", "display unchanged, got " + shown(ctx));
    assert(ctx.calls.length === 0, "no bundle call for a non-Reset form, got " + ctx.calls.length);
    submitReset(ctx);
    assert(shown(ctx) === "0", "Reset still paints 0 afterwards, got " + shown(ctx));
  });

  await test("Fresh page after a Reset (server state 0) starts at 0", async function () {
    const ctx = makeShellDom(newHtml, 0);
    assert(shown(ctx) === "0", "display 0");
    assert(fieldShown(ctx) === "0", "field 0");
    click(ctx, -1);
    assert(ctx.calls.length === 0, "no call at the 0 clamp");
  });

  console.log(failures === 0 ? "\nALL TESTS PASSED" : "\n" + failures + " TEST(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})();
