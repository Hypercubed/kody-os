/* jsdom harness for the three-bit-art canvas board.
 *
 * Tests the bundle exactly as stored in ../three-bit-art.bundle.json:
 * one canvas replaces the 16 by 16 div grid, pattern mode draws a dither
 * tile per cell, color mode fills solid colors, pointer hit-testing and
 * the keyboard cursor paint the intended cell, the gallery renders canvas
 * thumbnails and Load/Delete still work, palette swatches keep their SVG
 * previews, and a browser without a 2D context gets the honest fallback.
 *
 * jsdom has no canvas implementation, so getContext is stubbed with a
 * recording context (one per canvas). That exercises the bundle's own
 * tile generation, coordinate math, and drawing calls; it does not prove
 * the device rasterizes pixels — the Kindle check does that.
 *
 * How to run (jsdom is the only dependency, installed ephemerally):
 *
 *   mkdir -p /tmp/jsdom-test && cd /tmp/jsdom-test && npm init -y && npm install jsdom
 *   node pkg/catalog/tests/three-bit-canvas.cjs
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
        "then run: node pkg/catalog/tests/three-bit-canvas.cjs\n" +
        "Or set JSDOM_PATH to the folder containing jsdom's package.json."
    );
    process.exit(2);
  }
}

const DEFINITION_PATH = path.join(__dirname, "..", "three-bit-art.bundle.json");
const definition = JSON.parse(fs.readFileSync(DEFINITION_PATH, "utf8"));
const html = definition.bundle.files[definition.bundle.entry];

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log("ok - " + msg);
  } else {
    failures += 1;
    console.error("FAIL - " + msg);
  }
}

async function load(hasCanvas) {
  const calls = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.devicePixelRatio = 1;
      window.HTMLCanvasElement.prototype.getContext = function () {
        if (!hasCanvas) return null;
        const canvas = this;
        const ctx = {
          fillStyle: "#000",
          strokeStyle: "#000",
          lineWidth: 1,
          fillRect(x, y, w, h) {
            calls.push({ canvas, kind: "fill", style: ctx.fillStyle, x, y, w, h });
          },
          drawImage(img, x, y) {
            calls.push({ canvas, kind: "image", x, y, w: img.width, h: img.height });
          },
          strokeRect() {},
          clearRect() {},
        };
        return ctx;
      };
      window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
        const w = parseFloat(this.style.width) || 512;
        const h = parseFloat(this.style.height) || 512;
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
  return { window, calls };
}

function mainCalls(window, calls) {
  return calls.filter(function (c) {
    return c.canvas === window.tbCanvas;
  });
}

async function main() {
  const withCanvas = await load(true);
  const window = withCanvas.window;
  const calls = withCanvas.calls;
  const doc = window.document;

  check(definition.catalogVersion >= 3, "definition carries catalogVersion 3 or later");
  check(window.tbState.data.length === 256, "state seeds a 256-cell drawing");
  check(window.tbCanvas && window.tbCtx, "canvas and 2D context acquired");
  check(!doc.querySelector("#tb-grid .tb-cell"), "no per-cell divs inside the board");
  check(window.tbCanvas.width % 16 === 0 && window.tbCanvas.height % 16 === 0, "backing store divides into 16 cells");
  check(window.tbCellDev >= 8, "cell size is usable (" + window.tbCellDev + ")");
  check(doc.getElementById("tb-fail").style.display === "none", "fallback hidden when canvas works");
  check(doc.querySelectorAll(".tb-pal").length === 8, "eight palette swatches");
  check(
    doc.querySelector(".tb-pal").style.backgroundImage.indexOf("data:image/svg+xml") !== -1,
    "palette keeps SVG previews"
  );

  calls.length = 0;
  window.tbDrawAll();
  const full = mainCalls(window, calls);
  const fills = full.filter(function (c) {
    return c.kind === "fill";
  });
  const images = full.filter(function (c) {
    return c.kind === "image";
  });
  check(fills.length >= 257, "draws background plus one rect per cell (" + fills.length + ")");
  check(images.length >= 256, "pattern mode draws one dither tile per cell (" + images.length + ")");
  check(full.some(function (c) { return c.style === "#888"; }), "board gutter/background is drawn");

  window.tbColor = 1;
  window.tbPaint(0);
  check(window.tbState.data.charAt(0) === "1", "painting a cell stores the selected pattern");
  window.tbPaint(5 * 16 + 5);
  check(window.tbState.data.charAt(5 * 16 + 5) === "1", "direct paint hits the intended cell");

  const before = window.tbState.data;
  window.tbCanvas.dispatchEvent(
    new window.MouseEvent("mousedown", {
      clientX: 7 * window.tbCellCss + 1,
      clientY: 7 * window.tbCellCss + 1,
      button: 0,
      bubbles: true,
      cancelable: true,
    })
  );
  check(window.tbState.data !== before, "mousedown paints through the hit test");
  check(window.tbState.data.charAt(7 * 16 + 7) === "1", "hit test maps to cell (7,7)");

  window.tbFocused = true;
  window.tbCursor = 4;
  window.tbCanvas.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  check(window.tbCursor === 5, "ArrowRight moves the keyboard cursor");
  window.tbColor = 0;
  window.tbCanvas.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  check(window.tbState.data.charAt(5) === "0", "Space paints the cursor cell");

  doc.querySelector('[data-mode="color"]').click();
  check(window.tbState.mode === "color", "mode toggle switches to color");
  calls.length = 0;
  window.tbDrawAll();
  check(
    mainCalls(window, calls).some(function (c) { return c.style === "#000000"; }),
    "color mode fills solid colors"
  );

  doc.getElementById("tb-clear").click();
  check(window.tbState.data === new Array(257).join("7"), "clear resets all cells to white");
  window.tbColor = 2;
  window.tbPaint(0);
  doc.getElementById("tb-save").click();
  check(window.tbState.gallery.length === 256, "save stores the drawing");
  const thumb = doc.querySelector(".tb-thumb");
  check(thumb && thumb.tagName === "CANVAS", "gallery thumbnail is a canvas");
  doc.getElementById("tb-clear").click();
  check(window.tbState.data.charAt(0) === "7", "clear after save empties the board");
  const buttons = doc.querySelectorAll(".tb-item .tb-btn");
  buttons[0].click();
  check(window.tbState.data.charAt(0) === "2", "gallery Load restores the drawing");
  doc.querySelectorAll(".tb-item .tb-btn")[1].click();
  check(window.tbState.gallery === "", "gallery Delete removes the item");

  window.close();

  const noCanvas = await load(false);
  const fallbackDoc = noCanvas.window.document;
  check(fallbackDoc.getElementById("tb-fail").style.display === "", "fallback visible without a 2D context");
  check(fallbackDoc.getElementById("tb-grid").style.display === "none", "canvas hidden without a 2D context");
  check(noCanvas.window.tbCtx === null, "no context stored without canvas support");
  noCanvas.window.close();

  if (failures > 0) {
    console.error(failures + " check(s) failed");
    process.exit(1);
  }
  console.log("all 3-bit art canvas checks passed");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
