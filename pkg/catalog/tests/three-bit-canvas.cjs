/* jsdom harness for the three-bit-art canvas board.
 *
 * Tests the bundle exactly as stored in ../three-bit-art.bundle.json:
 * one canvas replaces the 16 by 16 div grid, one Mode button cycles
 * Color -> Motif + Color -> Bayer + Color -> Color, each mode draws
 * its tiles at an integer device-pixel scale (cell size a multiple
 * of 32, the least common multiple of the 16-pixel motif block and
 * the 32-pixel Bayer block, no gap, no grey between cells),
 * solid colors fill in Color mode, pointer hit-testing and
 * the keyboard cursor paint the intended cell, the gallery renders canvas
 * thumbnails and Load/Delete still work, palette swatches are canvases
 * built directly at a multiple-of-32 device size, old saved mode
 * 'pattern' migrates to 'motif-color', and a browser without
 * a 2D context gets the honest fallback.
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

  check(definition.catalogVersion >= 17, "definition carries catalogVersion 17 or later");
  check(window.tbState.data.length === 256, "state seeds a 256-cell drawing");
  check(window.tbCanvas && window.tbCtx, "canvas and 2D context acquired");
  check(!doc.querySelector("#tb-grid .tb-cell"), "no per-cell divs inside the board");
  check(window.tbCanvas.width % 32 === 0 && window.tbCanvas.height % 32 === 0, "backing store is a multiple of 32");
  check(window.tbCellDev >= 32 && window.tbCellDev % 32 === 0, "cell size is a multiple of 32 (" + window.tbCellDev + ")");
  check(window.tbGapDev === 0, "no gap inset inside a cell");
  check(window.tbCanvas.width === window.tbCellDev * 16, "backing store equals cell size times 16");
  check(doc.getElementById("tb-fail").style.display === "none", "fallback hidden when canvas works");
  check(doc.querySelectorAll(".tb-pal").length === 8, "eight palette swatches");
  check(doc.querySelector(".tb-pal").tagName === "CANVAS", "palette swatches are canvases, not scaled images");
  check(doc.querySelector(".tb-pal").width % 32 === 0, "palette device size is a multiple of 32 (" + doc.querySelector(".tb-pal").width + ")");
  check(window.tbPalCanvases && window.tbPalCanvases.length === 8, "one palette tile per value");
  check(window.TB_PATTERNS && window.TB_PATTERNS.length === 8, "eight pattern blocks");
  check(window.TB_PATTERNS[0].length === 16 && window.TB_PATTERNS[0][0].length === 16, "pattern blocks are 16 by 16");
  var dens = [], v, r, c, densTotal;
  for (v = 0; v < 8; v++) {
    densTotal = 0;
    for (r = 0; r < 16; r++) {
      for (c = 0; c < 16; c++) { densTotal += window.TB_PATTERNS[v][r][c]; }
    }
    dens.push(densTotal);
  }
  check(dens[0] === 256 && dens[7] === 0, "black and white stay solid");
  check(dens[4] === 240, "blue is 93.8% black");
  check(dens[1] === 192 && dens[5] === 192, "red and magenta are 75% black");
  check(dens[2] === 64 && dens[6] === 64 && dens[3] === 16, "green, cyan, and yellow counts match");
  function row(vv, rr) { return window.TB_PATTERNS[vv][rr].join(""); }
  function rep(s) { return s + s; }
  check(row(1, 0) === rep("11101110") && row(1, 1) === rep("01110111") && row(1, 2) === rep("10111011") && row(1, 3) === rep("11011101"), "red is down-right diagonal bands");
  check(row(2, 0) === rep("00000000") && row(2, 2) === rep("11111111") && row(2, 6) === rep("11111111") && row(2, 10) === rep("11111111"), "green is horizontal rules, shifted down to 2, 6, 10, 14");
  check(row(3, 0) === rep("00000000") && row(3, 2) === rep("00100010") && row(3, 6) === rep("00100010"), "yellow is a sparse dot lattice, shifted to 2, 6, 10, 14");
  check(row(4, 0) === rep("11111111") && row(4, 2) === rep("11011101") && row(4, 6) === rep("11011101"), "blue is black with sparse white dots, shifted to 2, 6, 10, 14");
  check(row(5, 0) === rep("11101110") && row(5, 1) === rep("11011101") && row(5, 2) === rep("10111011") && row(5, 3) === rep("01110111"), "magenta is down-left diagonal bands");
  check(row(6, 0) === rep("00100010") && row(6, 1) === rep("00100010"), "cyan is vertical rules, shifted right to 2, 6, 10, 14");
  var redDiag = true, magentaDiag = true, greenLines = true, cyanLines = true, yellowDots = true, blueDots = true;
  var greenRows = 0, cyanCols = 0, yellowCount = 0, blueWhite = 0;
  for (r = 0; r < 16; r++) {
    var allGreen = true;
    for (c = 0; c < 16; c++) {
      if (window.TB_PATTERNS[1][r][c] !== (((((c - r) % 4) + 4) % 4) !== 3 ? 1 : 0)) { redDiag = false; }
      if (window.TB_PATTERNS[5][r][c] !== (((c + r) % 4 !== 3) ? 1 : 0)) { magentaDiag = false; }
      if (window.TB_PATTERNS[2][r][c] !== ((r % 4 === 2) ? 1 : 0)) { greenLines = false; }
      if (window.TB_PATTERNS[6][r][c] !== ((c % 4 === 2) ? 1 : 0)) { cyanLines = false; }
      if (window.TB_PATTERNS[3][r][c] !== ((r % 4 === 2 && c % 4 === 2) ? 1 : 0)) { yellowDots = false; }
      if (window.TB_PATTERNS[4][r][c] !== ((r % 4 === 2 && c % 4 === 2) ? 0 : 1)) { blueDots = false; }
      if (window.TB_PATTERNS[2][r][c] !== 1) { allGreen = false; }
      if (window.TB_PATTERNS[3][r][c] === 1) { yellowCount++; }
      if (window.TB_PATTERNS[4][r][c] === 0) { blueWhite++; }
    }
    if (allGreen) { greenRows++; }
  }
  for (c = 0; c < 16; c++) {
    var allCyan = true;
    for (r = 0; r < 16; r++) { if (window.TB_PATTERNS[6][r][c] !== 1) { allCyan = false; } }
    if (allCyan) { cyanCols++; }
  }
  check(redDiag, "red diagonals match the formula");
  check(magentaDiag, "magenta diagonals match the formula");
  check(greenLines, "green lines match the formula");
  check(cyanLines, "cyan lines match the formula");
  check(yellowDots, "yellow dots match the formula");
  check(blueDots, "blue dots are the exact inverse of yellow");
  check(greenRows === 4, "green has 4 horizontal lines per block");
  check(cyanCols === 4, "cyan has 4 vertical lines per block");
  check(yellowCount === 16, "yellow has 16 black dots per block");
  check(blueWhite === 16, "blue has 16 white dots per block");

  // Modes, migration, and tile raster contract. Tiles are now
  // colour tiles, not black/white tiles, so the raster check reads
  // the last fill style per pixel, not just black vs white.
  check(window.TB_MODES && window.TB_MODES.join(",") === "color,motif-color,bayer-color", "three modes in cycle order");
  check(window.tbNormalizeMode("pattern") === "motif-color", "old pattern mode migrates to motif-color");
  check(window.tbNormalizeMode("bogus") === "color", "unknown mode falls back to color");
  check(window.tbNormalizeMode("bayer-color") === "bayer-color", "bayer-color normalizes to itself");
  check(window.tbState.mode === "color", "default mode is color, the first mode in the cycle");
  check(doc.getElementById("tb-mode") && doc.getElementById("tb-mode").textContent === "Color", "mode button labels the current mode");
  check(window.TB_BAYER && window.TB_BAYER.length === 32 && window.TB_BAYER[0].length === 32, "Bayer matrix is 32 by 32");
  (function () {
    var seen = {}, yy, xx, val;
    for (yy = 0; yy < 32; yy++) {
      for (xx = 0; xx < 32; xx++) { val = window.TB_BAYER[yy][xx]; seen[val] = true; }
    }
    check(Object.keys(seen).length === 1024, "Bayer matrix holds 0 through 1023 exactly once");
  })();
  check(window.TB_BAYER_PATTERNS && window.TB_BAYER_PATTERNS.length === 8, "eight Bayer blocks");
  check(window.TB_BAYER_PATTERNS[0].length === 32 && window.TB_BAYER_PATTERNS[0][0].length === 32, "Bayer blocks are 32 by 32");
  check(window.TB_BAYER_PATTERNS[0].flat().every(function (v) { return v === 1; }), "black Bayer block is solid");
  check(window.TB_BAYER_PATTERNS[7].flat().every(function (v) { return v === 0; }), "white Bayer block is empty");
  function tileStyleGrid(canvas) {
    var w = canvas.width, h = canvas.height, grid = [], i;
    for (i = 0; i < w * h; i++) { grid.push("#fff"); }
    calls.forEach(function (c) {
      if (c.canvas !== canvas || c.kind !== "fill") { return; }
      var yy, xx;
      for (yy = c.y; yy < c.y + c.h; yy++) {
        for (xx = c.x; xx < c.x + c.w; xx++) {
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) { grid[yy * w + xx] = c.style; }
        }
      }
    });
    return {
      w: w, h: h,
      at: function (x, y) { return grid[y * w + x]; },
      countStyle: function (s) { var n = 0, k; for (k = 0; k < grid.length; k++) { if (grid[k] === s) { n += 1; } } return n; },
    };
  }
  var tiles = window.tbTileCanvases;
  check(tiles && tiles.length === 8 && tiles.filter(Boolean).length === 8, "one offscreen block per value");
  var tileSize = window.tbCellDev;
  check(tileSize >= 32 && tileSize % 32 === 0 && tiles[2].width === tileSize && tiles[2].height === tileSize, "blocks rasterize at the full cell size (" + tileSize + " device px)");
  // Color mode: tiles are solid colour.
  var colorGrid = tileStyleGrid(tiles[1]);
  check(colorGrid.countStyle("#ff0000") === colorGrid.w * colorGrid.h, "red color tile is solid red");
  check(tileStyleGrid(tiles[2]).countStyle("#00ff00") === tiles[2].width * tiles[2].height, "green color tile is solid green");
  // Cycle to Motif + Color.
  doc.getElementById("tb-mode").click();
  check(window.tbState.mode === "motif-color", "mode button cycles color to motif-color");
  check(doc.getElementById("tb-mode").textContent === "Motif + Color", "mode button labels motif-color");
  check(window.tbTileMode === "motif-color", "tiles rebuild on mode change");
  var motifGreen = tileStyleGrid(window.tbTileCanvases[2]);
  var mgOk = true, myOk = true, mbOk = true, mrOk = true;
  var pp = tileSize / 16, yy, xx;
  for (yy = 0; yy < tileSize; yy++) {
    for (xx = 0; xx < tileSize; xx++) {
      var prow = Math.floor(yy / pp), pcol = Math.floor(xx / pp);
      var expectGreen = (prow % 4 === 2) ? "#000000" : "#00ff00";
      if (motifGreen.at(xx, yy) !== expectGreen) { mgOk = false; }
      var ydot = (prow % 4 === 2 && pcol % 4 === 2);
      var expectYellow = ydot ? "#000000" : "#ffff00";
      if (tileStyleGrid(window.tbTileCanvases[3]).at(xx, yy) !== expectYellow) { myOk = false; }
    }
  }
  check(mgOk, "green motif-color tile keeps lines at 2, 6, 10, 14 in colour");
  check(myOk, "yellow motif-color tile keeps dots at 2, 6, 10, 14 in colour");
  // Cycle to Bayer + Color.
  doc.getElementById("tb-mode").click();
  check(window.tbState.mode === "bayer-color", "mode button cycles motif-color to bayer-color");
  check(doc.getElementById("tb-mode").textContent === "Bayer + Color", "mode button labels bayer-color");
  var bayerRed = tileStyleGrid(window.tbTileCanvases[1]);
  var bayerGreen = tileStyleGrid(window.tbTileCanvases[2]);
  var redBlack = 0, greenBlack = 0, r, c;
  for (r = 0; r < 32; r++) {
    for (c = 0; c < 32; c++) {
      if (window.TB_BAYER_PATTERNS[1][r][c] === 1) { redBlack += 1; }
      if (window.TB_BAYER_PATTERNS[2][r][c] === 1) { greenBlack += 1; }
    }
  }
  var bpp = tileSize / 32;
  check(bayerRed.countStyle("#ff0000") === redBlack * bpp * bpp, "red Bayer tile colours exactly its black pixels");
  check(bayerRed.countStyle("#ffffff") === (1024 - redBlack) * bpp * bpp, "red Bayer tile keeps white minority pixels");
  check(bayerGreen.countStyle("#00ff00") === (1024 - greenBlack) * bpp * bpp, "green Bayer tile colours exactly its white pixels");
  check(bayerGreen.countStyle("#000000") === greenBlack * bpp * bpp, "green Bayer tile keeps black minority pixels");
  // Cycle back to Color, capturing call order: tile rebuild must
  // happen before the board draw, otherwise the board draws old
  // tiles, records the new mode as drawn, and stays one mode behind
  // the button and palette until the next paint — which looks like
  // a wrong set on the board, or a switch that only lands later.
  calls.length = 0;
  doc.getElementById("tb-mode").click();
  check(window.tbState.mode === "color", "mode button wraps bayer-color back to color");
  (function () {
    var tileFills = [], boardCalls = [], i, cc;
    for (i = 0; i < calls.length; i++) {
      cc = calls[i];
      if (cc.kind === "fill" && window.tbTileCanvases.indexOf(cc.canvas) >= 0) { tileFills.push(i); }
      if (cc.canvas === window.tbCanvas) { boardCalls.push(i); }
    }
    check(tileFills.length > 0 && boardCalls.length >= 256, "mode change rebuilds tiles and redraws the board (" + tileFills.length + " tile fills, " + boardCalls.length + " board calls)");
    if (tileFills.length > 0 && boardCalls.length > 0) {
      check(Math.max.apply(null, tileFills) < Math.min.apply(null, boardCalls), "tile rebuild happens before board draw on mode change");
    }
  })();
  check(doc.getElementById("tb-mode").textContent === "Color", "mode button labels color after wrap");

  calls.length = 0;
  window.tbDrawAll();
  const full = mainCalls(window, calls);
  const fills = full.filter(function (c) {
    return c.kind === "fill";
  });
  const images = full.filter(function (c) {
    return c.kind === "image";
  });
  check(fills.length >= 1, "draws a background fill (" + fills.length + ")");
  check(images.length >= 256 || fills.length >= 256, "board draws one tile or fill per cell (" + images.length + " images, " + fills.length + " fills)");
  check(!full.some(function (c) { return c.style === "#888"; }), "no grey gutter or background in the board");
  check(full.some(function (c) { return c.style === "#fff"; }), "board background is white, not grey");

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

  check(window.tbState.mode === "color", "mode is color after the wrap");
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
