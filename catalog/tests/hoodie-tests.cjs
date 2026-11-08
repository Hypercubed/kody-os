/* jsdom harness for the hoodie-weather bundle.
 *
 * Tests the definition exactly as stored in ../hoodie-weather/definition.json:
 * the classifier boundaries, next-hour slot selection, the apparent
 * temperature fallback, the three location layers (declared feed floor,
 * saved-place direct fetch with honest fallback, enhance-only geolocation),
 * the city-search write path, and the shell restore_default form through
 * the bridge. Nothing here talks to Kody, the hosted OS, or kody dev.
 *
 * How to run (jsdom is the only dependency, installed ephemerally):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node catalog/tests/hoodie-tests.cjs
 *
 * Run from anywhere; the harness finds the bundle relative to itself. If
 * jsdom lives elsewhere, point JSDOM_PATH at its folder (the folder
 * containing jsdom's package.json).
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
        "then run: node catalog/tests/hoodie-tests.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "hoodie-weather/definition.json");
const BRIDGE_PATH = path.join(__dirname, "..", "..", "pkg", "src", "bridge", "bridge.js");

const DEFAULT_SEED = { lat: 47606200, lon: -122332100, label: "Seattle, WA" };
const SAVED_SEED = { lat: 40712800, lon: -74006000, label: "New York, NY" };

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no script");
  return m[1];
}
function loadBridge(dom) {
  dom.window.eval(fs.readFileSync(BRIDGE_PATH, "utf8"));
  if (!dom.window.KodyBridge) throw new Error("bridge did not load");
}
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}
function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    text: function () { return Promise.resolve(JSON.stringify(data)); },
    json: function () { return Promise.resolve(data); },
  };
}
function weatherPayload(opts) {
  return {
    latitude: 47.6,
    longitude: -122.3,
    timezone: "UTC",
    current: {
      time: "2999-01-01T00:00",
      temperature_2m: opts.currentTemp !== undefined ? opts.currentTemp : opts.temp,
      apparent_temperature: opts.currentApparent !== undefined ? opts.currentApparent : opts.apparent,
      weather_code: opts.code || 0,
      wind_speed_10m: opts.wind !== undefined ? opts.wind : 5,
    },
    hourly: {
      time: opts.times || ["2999-01-01T01:00"],
      temperature_2m: opts.temps || [opts.temp],
      apparent_temperature: opts.apparents || [opts.apparent],
      precipitation_probability: opts.rains || [opts.rain],
      weather_code: opts.codes || [opts.code || 0],
      wind_speed_10m: opts.winds || [opts.wind !== undefined ? opts.wind : 5],
    },
  };
}
function nwsPointsPayload(forecastHourly, city, state) {
  return {
    properties: {
      forecastHourly: forecastHourly,
      relativeLocation: { properties: { city: city || "New York", state: state || "NY" } },
    },
  };
}
function addField(doc, section, name, value) {
  const p = doc.createElement("p");
  p.setAttribute("data-field", name);
  p.setAttribute("hidden", "");
  p.appendChild(doc.createTextNode(name + ": "));
  const span = doc.createElement("span");
  span.textContent = String(value);
  p.appendChild(span);
  section.appendChild(p);
  return p;
}
function addRestoreForm(doc, section) {
  const form = doc.createElement("form");
  form.setAttribute("class", "app-action");
  form.setAttribute("method", "GET");
  form.setAttribute("action", "/kody-os/apps/hoodie-weather");
  const action = doc.createElement("input");
  action.setAttribute("type", "hidden");
  action.setAttribute("name", "action");
  action.setAttribute("value", "restore_default");
  form.appendChild(action);
  const button = doc.createElement("button");
  button.setAttribute("type", "submit");
  button.textContent = "Restore default place";
  form.appendChild(button);
  section.appendChild(form);
  return form;
}

function makeDom(bundleHtml, options) {
  options = options || {};
  const seed = Object.assign({}, options.seed || DEFAULT_SEED);
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://hypercubed.kody.run/kody-os/apps/hoodie-weather?k=TESTCODE",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const doc = dom.window.document;

  const seedEl = doc.createElement("script");
  seedEl.setAttribute("type", "application/json");
  seedEl.setAttribute("data-kody-state-seed", "1");
  seedEl.setAttribute("data-app-id", "hoodie-weather");
  seedEl.textContent = JSON.stringify(seed);
  doc.body.appendChild(seedEl);

  const section = doc.createElement("section");
  section.setAttribute("data-app-id", "hoodie-weather");
  if (options.sectionClass) { section.setAttribute("class", options.sectionClass); }
  doc.body.appendChild(section);

  const bundle = doc.createElement("div");
  bundle.setAttribute("class", "bundle");
  bundle.setAttribute("data-bundle", "hoodie-weather");
  bundle.setAttribute("data-action-base", "/kody-os/apps/hoodie-weather");
  bundle.innerHTML = bundleHtml;
  section.appendChild(bundle);

  addField(doc, section, "lat", seed.lat);
  addField(doc, section, "lon", seed.lon);
  addField(doc, section, "label", seed.label);
  addField(doc, section, "nws", seed.nws === true);
  const form = addRestoreForm(doc, section);

  const calls = [];
  const pending = [];
  dom.window.fetch = function (url, opts) {
    calls.push({ url: String(url), opts: opts || {} });
    return new Promise(function (resolve, reject) {
      pending.push({ url: String(url), resolve: resolve, reject: reject });
    });
  };
  if (options.geolocation) {
    Object.defineProperty(dom.window.navigator, "geolocation", {
      configurable: true,
      value: options.geolocation,
    });
  }
  loadBridge(dom);
  dom.window.eval(extractScript(bundleHtml));
  if (doc.readyState === "loading") {
    doc.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  }
  return { dom: dom, doc: doc, section: section, bundle: bundle, form: form, calls: calls, pending: pending };
}

function textOf(ctx, id) {
  const el = ctx.doc.getElementById(id);
  return el ? el.textContent : null;
}
function shownVerdict(ctx) {
  const rows = ctx.doc.querySelectorAll(".hw-verdict");
  for (const row of rows) {
    if (!row.hidden) return row.getAttribute("data-verdict");
  }
  return null;
}
function shownLabel(ctx) {
  return textOf(ctx, "hw-label");
}
function isHidden(ctx, id) {
  const el = ctx.doc.getElementById(id);
  return !el || el.hidden;
}
async function resolveNext(ctx, data) {
  const p = ctx.pending.shift();
  if (!p) throw new Error("no pending fetch to resolve");
  p.resolve(jsonResponse(data));
  await sleep(15);
  return p;
}
async function rejectNext(ctx, message) {
  const p = ctx.pending.shift();
  if (!p) throw new Error("no pending fetch to reject");
  p.reject(new Error(message || "network down"));
  await sleep(15);
  return p;
}
async function waitForPending(ctx, predicate, ms) {
  const deadline = Date.now() + (ms || 1500);
  while (Date.now() < deadline) {
    const found = ctx.pending.find(predicate);
    if (found) return found;
    await sleep(5);
  }
  throw new Error("timed out waiting for pending fetch");
}
async function resolveMatching(ctx, predicate, data) {
  const p = await waitForPending(ctx, predicate);
  const index = ctx.pending.indexOf(p);
  if (index !== -1) ctx.pending.splice(index, 1);
  p.resolve(jsonResponse(data));
  await sleep(15);
  return p;
}
async function rejectMatching(ctx, predicate, message) {
  const p = await waitForPending(ctx, predicate);
  const index = ctx.pending.indexOf(p);
  if (index !== -1) ctx.pending.splice(index, 1);
  p.reject(new Error(message || "network down"));
  await sleep(15);
  return p;
}
function fieldShown(ctx, name) {
  const span = ctx.doc.querySelector('[data-field="' + name + '"] span');
  return span ? span.textContent : null;
}
function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ok - " + msg);
}
let failures = 0;
async function test(name, fn) {
  console.log("\n== " + name + " ==");
  try {
    await fn();
  } catch (e) {
    failures++;
    console.log("  FAIL: " + e.message);
  }
}

(async function () {
  const loadedBundle = require('./read-bundle.cjs').readBundleFiles(DEFINITION_PATH);
  const definition = loadedBundle.definition;
  const html = loadedBundle.files["index.html"];
  const script = extractScript(html);

  await test("DEFINITION: hosting shape and feed allowlist", async function () {
    assert(definition.id === "hoodie-weather", "id is hoodie-weather");
    assert(definition.schemaVersion === 5, "schemaVersion is 5, got " + definition.schemaVersion);
    assert(definition.bundle.entry === "index.html", "bundle entry is index.html");
    const bytes = Buffer.byteLength(html, "utf8");
    assert(bytes <= 256 * 1024, "bundle is under the 256 KiB cap (" + bytes + " bytes)");
    assert((html.match(/<style>/g) || []).length === 1, "exactly one inline <style>");
    const srcs = (html.match(/\ssrc\s*=\s*"([^"]*)"/g) || []).map(function (m) { return m.slice(m.indexOf('"') + 1, -1); });
    assert(srcs.every(function (u) { return u.indexOf("data:") === 0; }), "no external src references");
    assert(!/\shref\s*=/.test(html), "no external href references");
    assert(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), "no emoji");
    assert(Array.isArray(definition.capabilities.feeds) && definition.capabilities.feeds.length === 1, "exactly one declared feed");
    const feed = definition.capabilities.feeds[0];
    assert(feed.url.indexOf("https://") === 0, "feed is HTTPS");
    assert(feed.url.indexOf("latitude=47.6062") !== -1, "feed is pinned to the default place");
    assert(!/[<>]/.test(feed.url), "feed URL carries no user input");
    assert(feed.ttlSeconds >= 600 && feed.ttlSeconds <= 900, "feed TTL is 600-900 s (got " + feed.ttlSeconds + ")");
    assert(feed.maxBytes <= 131072, "feed maxBytes is at most 131072 (got " + feed.maxBytes + ")");
    const actions = definition.actions;
    assert(actions.set_location && actions.set_location.effects.every(function (e) { return e.op === "set"; }), "set_location uses set effects");
    assert(actions.set_location.args.lat.required && actions.set_location.args.lon.required && actions.set_location.args.label.required, "set_location requires lat/lon/label");
    assert(actions.restore_default && !actions.restore_default.args, "restore_default takes no args");
    assert(!definition.stateSchema.fields.nws, "no nws state field");
    assert(!actions.set_provider, "no set_provider action");
    assert(html.indexOf("hw-provider") === -1, "no forecast source toggle");
    assert(script.indexOf("api.weather.gov/points") !== -1, "NWS points is used to name a discovered place");
    assert(script.indexOf("forecastHourly") === -1 && script.indexOf("shortForecast") === -1, "no NWS hourly forecast path");
    assert(script.indexOf("relativeLocation") !== -1, "the NWS relative location is read");
    assert((html.match(/data:image\/png;base64,/g) || []).length === 4, "four repo images are inlined as data URIs");
    assert(html.indexOf("hw-verdict img") !== -1, "verdict images use the repo artwork");
    assert((definition.ui.actions || []).some(function (a) { return a.action === "restore_default"; }), "ui.actions renders restore_default");
    assert(definition.ui.hideState === true, "hideState keeps the raw place readout out of the way");
    assert(script.indexOf("KodyBridge") !== -1, "bundle uses the bridge");
    assert(script.indexOf("claimForm") !== -1, "bundle claims the restore_default form");
    assert(script.indexOf("startSpanObserver") !== -1, "bundle observes shell span patches");
    assert(script.indexOf("data-action-base") !== -1, "bundle resolves actions from data-action-base");
    assert(script.indexOf("MutationObserver") === -1, "bundle does not hand-roll span observation");
    assert(script.indexOf("setInterval") === -1, "bundle never polls");
    assert(script.indexOf("localStorage") === -1, "bundle does not use localStorage");
    ["?.", "??", "=>", "`"].forEach(function (bad) {
      assert(script.indexOf(bad) === -1, "bundle script has no forbidden syntax " + bad);
    });
    ["const", "let", "async", "await"].forEach(function (bad) {
      assert(!new RegExp("\\b" + bad + "\\b").test(script), "bundle script has no forbidden keyword " + bad);
    });
  });

  await test("Classifier boundary table (rain 30/31, apparent 50/51/64/65)", async function () {
    const cases = [
      { rain: 30, apparent: 50, expect: "jacket" },
      { rain: 31, apparent: 70, expect: "raincoat" },
      { rain: 30, apparent: 51, expect: "hoodie" },
      { rain: 30, apparent: 64, expect: "hoodie" },
      { rain: 30, apparent: 65, expect: "tshirt" },
    ];
    for (const c of cases) {
      const ctx = makeDom(html);
      await resolveNext(ctx, weatherPayload({ temp: c.apparent, apparent: c.apparent, rain: c.rain }));
      assert(shownVerdict(ctx) === c.expect, "rain " + c.rain + "%, apparent " + c.apparent + "F -> " + c.expect + " (got " + shownVerdict(ctx) + ")");
      assert(textOf(ctx, "hw-temp") === Math.round(c.apparent) + "\u00B0F", "temperature reads " + Math.round(c.apparent) + "F");
    }
  });

  await test("Next-hour slot: first hourly time at or after now wins", async function () {
    const ctx = makeDom(html);
    await resolveNext(ctx, weatherPayload({
      temp: 10,
      apparent: 10,
      rain: 90,
      times: ["2000-01-01T00:00", "2999-01-01T00:00"],
      temps: [10, 70],
      apparents: [10, 70],
      rains: [90, 0],
      codes: [61, 0],
    }));
    assert(shownVerdict(ctx) === "tshirt", "future slot selected regardless of the past slot (got " + shownVerdict(ctx) + ")");
    assert(textOf(ctx, "hw-temp") === "70\u00B0F", "temperature comes from the future slot");
  });

  await test("Apparent temperature falls back to wind chill", async function () {
    const ctx = makeDom(html);
    await resolveNext(ctx, weatherPayload({ temp: 40, apparent: null, rain: 0, wind: 20 }));
    assert(shownVerdict(ctx) === "jacket", "wind chill from 40F/20mph lands in the jacket band (got " + shownVerdict(ctx) + ")");
  });

  await test("Saved place: direct fetch, saved label, no feed call", async function () {
    const ctx = makeDom(html, { seed: SAVED_SEED });
    assert(ctx.calls.length === 1 && ctx.calls[0].url.indexOf("api.open-meteo.com/v1/forecast") !== -1, "first call is the direct weather fetch");
    assert(ctx.calls[0].url.indexOf("latitude=40.7128") !== -1 && ctx.calls[0].url.indexOf("longitude=-74.0060") !== -1, "direct fetch uses the saved coordinates");
    assert(ctx.calls[0].url.indexOf("/feed/hoodie-weather/") === -1, "no feed call for a saved place");
    await resolveNext(ctx, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "New York, NY", "label is the saved place");
    assert(shownVerdict(ctx) === "tshirt", "saved-place verdict rendered");
    assert(isHidden(ctx, "hw-notice"), "no unreachable notice when the direct fetch works");
  });

  await test("Saved place unreachable: default feed under the default label plus a notice", async function () {
    const ctx = makeDom(html, { seed: SAVED_SEED });
    await rejectNext(ctx, "blocked");
    await waitForPending(ctx, function (p) { return p.url.indexOf("/feed/hoodie-weather/default") !== -1; });
    await resolveMatching(ctx, function (p) { return p.url.indexOf("/feed/hoodie-weather/default") !== -1; }, weatherPayload({ temp: 40, apparent: 40, rain: 0 }));
    assert(shownLabel(ctx) === "Seattle, WA", "label names the data actually shown (got " + shownLabel(ctx) + ")");
    assert(shownVerdict(ctx) === "jacket", "default verdict rendered");
    assert(!isHidden(ctx, "hw-notice"), "notice is visible");
    assert(textOf(ctx, "hw-notice").indexOf("New York, NY") !== -1, "notice names the unreachable saved place");
    assert(!isHidden(ctx, "hw-retry"), "Retry is offered");

    const retry = ctx.doc.getElementById("hw-retry");
    retry.dispatchEvent(new ctx.dom.window.Event("click", { bubbles: true }));
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.open-meteo.com/v1/forecast") !== -1; }, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "New York, NY", "Retry recovers the saved place");
    assert(shownVerdict(ctx) === "tshirt", "recovered saved-place verdict");
    assert(isHidden(ctx, "hw-notice"), "notice clears after Retry succeeds");
  });

  await test("Everything fails: no verdict, error with Retry", async function () {
    const ctx = makeDom(html, { seed: SAVED_SEED });
    await rejectNext(ctx, "blocked");
    await rejectNext(ctx, "blocked");
    assert(shownVerdict(ctx) === null, "no verdict icon presented as current");
    assert(!isHidden(ctx, "hw-error"), "error state visible");
    assert(!isHidden(ctx, "hw-retry"), "Retry offered");
  });

  await test("Default feed failure: error with Retry", async function () {
    const ctx = makeDom(html);
    await rejectNext(ctx, "502");
    assert(shownVerdict(ctx) === null, "no verdict");
    assert(!isHidden(ctx, "hw-error"), "error state visible");
    assert(textOf(ctx, "hw-error").indexOf("default forecast") !== -1, "error names the default forecast");
    assert(!isHidden(ctx, "hw-retry"), "Retry offered");
  });

  await test("Restore default form: claimed, sends restore_default, repaints from state", async function () {
    const ctx = makeDom(html, { seed: SAVED_SEED });
    await resolveNext(ctx, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "New York, NY", "starts on the saved place");

    const cancelled = ctx.form.dispatchEvent(new ctx.dom.window.Event("submit", { bubbles: true, cancelable: true }));
    assert(cancelled === false, "capture-phase claim cancels the native submit");
    const actionCall = await waitForPending(ctx, function (p) { return p.url.indexOf("action=restore_default") !== -1; });
    assert(actionCall.url.indexOf("lat=") === -1, "restore_default carries no location args: " + actionCall.url);
    assert(actionCall.url.indexOf("k=") === -1, "no credential leaks into the action URL: " + actionCall.url);
    await resolveMatching(ctx, function (p) { return p.url.indexOf("action=restore_default") !== -1; }, {
      ok: true,
      state: { lat: DEFAULT_SEED.lat, lon: DEFAULT_SEED.lon, label: DEFAULT_SEED.label, nws: false },
    });
    await sleep(60);
    await resolveMatching(ctx, function (p) { return p.url.indexOf("/feed/hoodie-weather/default") !== -1; }, weatherPayload({ temp: 40, apparent: 40, rain: 0 }));
    assert(shownLabel(ctx) === "Seattle, WA", "bundle repainted the default place without navigation");
    assert(shownVerdict(ctx) === "jacket", "default-place verdict after restore");
    assert(fieldShown(ctx, "lat") === String(DEFAULT_SEED.lat), "shell lat span follows the restore");
    assert(fieldShown(ctx, "label") === DEFAULT_SEED.label, "shell label span follows the restore");
  });

  await test("City search: debounced geocode, selection persists microdegrees and refetches", async function () {
    const ctx = makeDom(html);
    await resolveNext(ctx, weatherPayload({ temp: 40, apparent: 40, rain: 0 }));
    ctx.doc.getElementById("hw-search-toggle").dispatchEvent(new ctx.dom.window.Event("click", { bubbles: true }));
    assert(!isHidden(ctx, "hw-search"), "search panel opens");
    const input = ctx.doc.getElementById("hw-query");
    input.value = "Portland";
    input.dispatchEvent(new ctx.dom.window.Event("input", { bubbles: true }));
    await sleep(350);
    const geoCall = await waitForPending(ctx, function (p) { return p.url.indexOf("geocoding-api.open-meteo.com") !== -1; });
    assert(geoCall.url.indexOf("name=Portland") !== -1, "geocoding query is the typed text");
    assert(geoCall.url.indexOf("/feed/") === -1, "geocoding never rides a declared feed");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("geocoding-api.open-meteo.com") !== -1; }, {
      results: [{ name: "Portland", admin1: "Oregon", country: "United States", latitude: 45.5152, longitude: -122.6784 }],
    });
    await sleep(20);
    const result = ctx.doc.querySelector("#hw-results button");
    assert(result && result.textContent.indexOf("Portland") !== -1, "search result rendered");
    result.dispatchEvent(new ctx.dom.window.Event("click", { bubbles: true }));
    const saveCall = await waitForPending(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; });
    assert(saveCall.url.indexOf("lat=45515200") !== -1, "latitude saved as integer microdegrees: " + saveCall.url);
    assert(saveCall.url.indexOf("lon=-122678400") !== -1, "longitude saved as integer microdegrees");
    assert(saveCall.url.indexOf("label=Portland%2C%20Oregon%2C%20United%20States") !== -1, "label saved");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; }, {
      ok: true,
      state: { lat: 45515200, lon: -122678400, label: "Portland, Oregon, United States", nws: false },
    });
    await sleep(70);
    await resolveMatching(ctx, function (p) { return p.url.indexOf("latitude=45.5152") !== -1; }, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "Portland, Oregon, United States", "selected place label shown");
    assert(shownVerdict(ctx) === "tshirt", "weather refetched for the selected place");
  });

  await test("Geolocation: attempted once when nothing is saved, persists and wins the race", async function () {
    let calls = 0;
    const geo = {
      getCurrentPosition: function (onSuccess) {
        calls += 1;
        onSuccess({ coords: { latitude: 45.5152, longitude: -122.6784 } });
      },
    };
    const ctx = makeDom(html, { geolocation: geo });
    assert(calls === 1, "geolocation attempted once at init");
    assert(ctx.calls[0].url.indexOf("/feed/hoodie-weather/default") !== -1, "default feed still starts first (no render block)");
    const saveCall = await waitForPending(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; });
    assert(saveCall.url.indexOf("label=Current%20location") !== -1, "discovered place labeled Current location");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; }, {
      ok: true,
      state: { lat: 45515200, lon: -122678400, label: "Current location", nws: false },
    });
    await sleep(70);
    await resolveMatching(ctx, function (p) { return p.url.indexOf("latitude=45.5152") !== -1; }, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "Current location", "discovered place rendered");
    assert(shownVerdict(ctx) === "tshirt", "direct weather for the discovered place");
    // Let the earlier default feed response land late: it must not overwrite.
    await resolveMatching(ctx, function (p) { return p.url.indexOf("/feed/hoodie-weather/default") !== -1; }, weatherPayload({ temp: 10, apparent: 10, rain: 90 }));
    assert(shownLabel(ctx) === "Current location", "stale default response cannot overwrite the discovered place");
    assert(shownVerdict(ctx) === "tshirt", "stale default verdict ignored");
    ctx.doc.getElementById("hw-refresh").dispatchEvent(new ctx.dom.window.Event("click", { bubbles: true }));
    assert(calls === 1, "Refresh does not re-prompt geolocation");
  });

  await test("Geolocation denial: silent fallback, no notice or error", async function () {
    let calls = 0;
    const geo = {
      getCurrentPosition: function (_ok, onError) {
        calls += 1;
        onError({ code: 1 });
      },
    };
    const ctx = makeDom(html, { geolocation: geo });
    assert(calls === 1, "geolocation attempted once");
    await resolveNext(ctx, weatherPayload({ temp: 40, apparent: 40, rain: 0 }));
    assert(shownLabel(ctx) === "Seattle, WA", "default place stays");
    assert(shownVerdict(ctx) === "jacket", "default verdict rendered");
    assert(isHidden(ctx, "hw-notice"), "no discovery error notice");
    assert(isHidden(ctx, "hw-error"), "no discovery error state");
  });

  await test("NWS names a discovered place without changing the forecast", async function () {
    const seed = { lat: 39974625, lon: -105148302, label: "Current location" };
    const ctx = makeDom(html, { seed: seed });
    assert(ctx.calls.length === 2, "weather and naming start together");
    assert(ctx.calls[0].url.indexOf("api.open-meteo.com/v1/forecast") !== -1, "forecast is Open-Meteo");
    assert(ctx.calls[1].url.indexOf("api.weather.gov/points/39.9746,-105.1483") !== -1, "points uses the same coordinates");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.open-meteo.com/v1/forecast") !== -1; }, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "Current location", "weather paints before naming resolves");
    assert(shownVerdict(ctx) === "tshirt", "Open-Meteo verdict");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.weather.gov/points/") !== -1; }, nwsPointsPayload("https://api.weather.gov/gridpoints/BOU/58,73/forecast/hourly", "Louisville", "CO"));
    const save = await waitForPending(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; });
    assert(save.url.indexOf("lat=39974625") !== -1 && save.url.indexOf("lon=-105148302") !== -1, "same coordinates persisted");
    assert(save.url.indexOf("label=Louisville%2C%20CO") !== -1, "NWS name becomes the label: " + save.url);
    await resolveMatching(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; }, {
      ok: true,
      state: { lat: seed.lat, lon: seed.lon, label: "Louisville, CO" },
    });
    assert(shownLabel(ctx) === "Louisville, CO", "label shows the NWS place");
    assert(textOf(ctx, "hw-cond") === "Clear", "forecast still rendered");
    assert(ctx.calls.filter(function (c) { return c.url.indexOf("api.open-meteo.com") !== -1; }).length === 1, "no extra weather fetch for the label");
    assert(ctx.calls.every(function (c) { return c.url.indexOf("gridpoints/") === -1; }), "forecastHourly is never fetched");
  });

  await test("NWS naming wins even when it resolves before the forecast", async function () {
    const seed = { lat: 39974625, lon: -105148302, label: "Current location" };
    const ctx = makeDom(html, { seed: seed });
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.weather.gov/points/") !== -1; }, nwsPointsPayload("https://api.weather.gov/gridpoints/BOU/58,73/forecast/hourly", "Louisville", "CO"));
    await resolveMatching(ctx, function (p) { return p.url.indexOf("action=set_location") !== -1; }, {
      ok: true,
      state: { lat: seed.lat, lon: seed.lon, label: "Louisville, CO" },
    });
    assert(shownLabel(ctx) === "Louisville, CO", "label updates before weather resolves");
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.open-meteo.com/v1/forecast") !== -1; }, weatherPayload({ temp: 70, apparent: 70, rain: 0 }));
    assert(shownLabel(ctx) === "Louisville, CO", "later weather paint keeps the NWS name");
    assert(shownVerdict(ctx) === "tshirt", "weather still renders");
  });

  await test("NWS naming never runs for a named or default place", async function () {
    const named = makeDom(html, { seed: SAVED_SEED });
    assert(named.calls.length === 1, "named place makes one request");
    assert(named.calls[0].url.indexOf("api.open-meteo.com/v1/forecast") !== -1, "named place is weather-only");
    const def = makeDom(html);
    assert(def.calls.length === 1, "default place makes one request");
    assert(def.calls[0].url.indexOf("/feed/hoodie-weather/default") !== -1, "default place is feed-only");
  });

  await test("NWS naming failure is silent and keeps the GPS label", async function () {
    const ctx = makeDom(html, { seed: { lat: 39974625, lon: -105148302, label: "Current location" } });
    await resolveMatching(ctx, function (p) { return p.url.indexOf("api.open-meteo.com/v1/forecast") !== -1; }, weatherPayload({ temp: 40, apparent: 40, rain: 0 }));
    await rejectMatching(ctx, function (p) { return p.url.indexOf("api.weather.gov/points/") !== -1; }, "points down");
    assert(shownLabel(ctx) === "Current location", "generic label stays");
    assert(shownVerdict(ctx) === "jacket", "weather is unaffected");
    assert(isHidden(ctx, "hw-notice"), "naming failure is not a weather notice");
    assert(isHidden(ctx, "hw-error"), "naming failure is not an error");
    assert(ctx.calls.every(function (c) { return c.url.indexOf("action=set_location") === -1; }), "no label write on failure");
  });

    await test("Widget CSS hides buttons and note, qualified selectors only", async function () {
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    assert(styleMatch, "no style block");
    const css = styleMatch[1];
    assert(css.indexOf("section.widget .hw-btn") !== -1, "widget rule for buttons missing");
    assert(css.indexOf("section.widget .hw-note") !== -1, "widget rule for note missing");
    assert(css.indexOf('section.widget[data-app-id="hoodie-weather"] .app-body') !== -1, "widget centering rule missing");
    assert(css.indexOf("justify-content: center") !== -1, "widget centering justify missing");
    assert(css.indexOf("min-height: 8rem") !== -1, "widget centering min-height missing");
    assert(css.indexOf("section.widget .app-body") === -1, "unqualified widget app-body rule leaks");
    assert(css.indexOf("section.widget p") === -1, "unqualified widget p rule leaks");
    assert(css.indexOf("section.widget a") === -1, "unqualified widget a rule leaks");
    assert(css.indexOf("section.widget button") === -1, "unqualified widget button rule leaks");
    assert(css.indexOf("section.widget div") === -1, "unqualified widget div rule leaks");
  });

  await test("Widget hides restore form, page shows it", async function () {
    const widget = makeDom(html, { sectionClass: "widget" });
    assert(widget.form.style.display === "none", "restore form not hidden in widget");
    const page = makeDom(html, { sectionClass: "app" });
    assert(page.form.style.display !== "none", "restore form hidden on page");
  });

console.log(failures === 0 ? "\nALL TESTS PASSED" : "\n" + failures + " TEST(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})();
