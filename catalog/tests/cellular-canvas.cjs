/* jsdom harness for the cellular-playground canvas board.
 *
 * Tests the bundle exactly as stored in ../cellular-playground/definition.json:
 * the board renders as one canvas (no per-cell DOM), a 20 by 14 grid draws
 * one rectangle per cell, pointer hit-testing and keyboard painting reach
 * the right cell, Step advances the automaton, and a browser without a 2D
 * context gets the honest fallback instead of a blank board.
 *
 * jsdom has no canvas implementation, so getContext is stubbed with a
 * recording context. That still exercises the bundle's own drawing and
 * coordinate math; it does not prove the device rasterizes pixels — the
 * Kindle check does that.
 *
 * How to run (jsdom is the only dependency, installed ephemerally):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node catalog/tests/cellular-canvas.cjs
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
        "then run: node catalog/tests/cellular-canvas.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "cellular-playground/definition.json");
const loadedBundle = require('./read-bundle.cjs').readBundleFiles(DEFINITION_PATH);
const definition = loadedBundle.definition;
const html = loadedBundle.files[definition.bundle.entry];

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log("ok - " + msg);
  } else {
    failures += 1;
    console.error("FAIL - " + msg);
  }
}

function makeContext() {
  const calls = [];
  const ctx = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    fillRect(x, y, w, h) {
      calls.push({ style: ctx.fillStyle, x, y, w, h });
    },
    strokeRect() {},
    clearRect() {},
  };
  return { ctx, calls };
}

async function load(hasCanvas) {
  const { ctx, calls } = makeContext();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.devicePixelRatio = 1;
      window.HTMLCanvasElement.prototype.getContext = function () {
        return hasCanvas ? ctx : null;
      };
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
        const w = parseFloat(this.style.width) || 520;
        const h = parseFloat(this.style.height) || 364;
        return { left: 0, top: 0, width: w, height: h, right: w, bottom: h };
      };
    },
  });
  const window = dom.window;
  if (window.document.readyState === "loading") {
    await new Promise(function (resolve) {
      window.document.addEventListener("DOMContentLoaded", resolve);
    });
  }
  return { dom, window, calls };
}

async function main() {
  const withCanvas = await load(true);
  const window = withCanvas.window;
  const doc = window.document;

  check(definition.catalogVersion >= 3, "definition carries catalogVersion 3 or later");
  check(window.CP_W === 20 && window.CP_H === 14, "board is 20 by 14");
  check(window.cpState.grid.length === 280, "state seeds a 280-cell grid");
  check(window.cpCanvas && window.cpCtx, "canvas and 2D context acquired");
  check(window.cpCanvas.width === window.cpCellDev * 20, "backing store is a whole number of cells");
  check(window.cpCanvas.width % 20 === 0 && window.cpCanvas.height % 14 === 0, "backing store divides evenly");
  check(window.cpCanvas.style.width === window.cpCellCss * 20 + "px", "CSS width is an integer pixel width");
  check(!doc.querySelector("#cp-board button"), "no per-cell buttons inside the board");
  check(doc.getElementById("cp-fail").style.display === "none", "fallback hidden when canvas works");

  const cellFills = withCanvas.calls.filter(function (c) {
    return c.w === window.cpCellDev && c.h === window.cpCellDev;
  });
  check(cellFills.length >= 280, "draws at least one rectangle per cell (" + cellFills.length + ")");

  window.cpPaint = 1;
  window.cpPaintCell(0);
  check(window.cpState.grid.charAt(0) === "1", "painting a cell sets it alive");
  check(doc.getElementById("cp-meta").textContent.indexOf("Live cells") !== -1, "meta line updates");

  const before = window.cpState.grid;
  const ev = new window.MouseEvent("mousedown", {
    clientX: 5 * window.cpCellCss + 1,
    clientY: 5 * window.cpCellCss + 1,
    button: 0,
    bubbles: true,
    cancelable: true,
  });
  window.cpCanvas.dispatchEvent(ev);
  check(window.cpState.grid !== before, "mousedown paints through the hit test");
  check(window.cpState.grid.charAt(5 * 20 + 5) === "1", "hit test maps to cell (5,5)");

  const gen = window.cpState.generation;
  doc.getElementById("cp-step").click();
  check(window.cpState.generation === gen + 1, "Step advances the generation");
  check(window.cpState.grid.length === 280, "grid stays 280 cells after stepping");

  window.cpFocused = true;
  window.cpCursor = 4;
  window.cpCanvas.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
  );
  check(window.cpCursor === 5, "ArrowRight moves the keyboard cursor");

  window.close();

  const noCanvas = await load(false);
  const fallbackDoc = noCanvas.window.document;
  check(fallbackDoc.getElementById("cp-fail").style.display === "", "fallback visible without a 2D context");
  check(fallbackDoc.getElementById("cp-board").style.display === "none", "canvas hidden without a 2D context");
  check(noCanvas.window.cpCtx === null, "no context stored without canvas support");
  noCanvas.window.close();

  if (failures > 0) {
    console.error(failures + " check(s) failed");
    process.exit(1);
  }
  console.log("all cellular canvas checks passed");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
