// Proves the full-collect sweep gathers EVERY row of a virtualized table
// (Mixpanel keeps only a window of rows in the DOM). Simulates virtualization:
// a scroller re-renders a 10-row window based on scrollTop.
// Run: node test/sweep.test.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT = fs.readFileSync(path.join(__dirname, "..", "transpose.js"), "utf8");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ok - " + msg);
  else { failures++; console.error("  FAIL - " + msg); }
}

const N = 67; // data rows -> absolute row indices 2 .. N+1
const WINDOW = 10;
const ROW_PX = 10;

const dom = new JSDOM(
  "<!DOCTYPE html><html><body><div class='card-container'></div></body></html>",
  { runScripts: "outside-only", pretendToBeVisual: true }
);
const { window } = dom;
const doc = window.document;

let clipboard = "";
Object.defineProperty(window.navigator, "clipboard", {
  configurable: true,
  value: { writeText: function (t) { clipboard = t; return Promise.resolve(); } },
});

// Build the static skeleton.
const card = doc.querySelector(".card-container");
const containerHtml =
  "<div class='mp-data-table-container'>" +
  "<div class='scroller'>" +
  '<div class="mp-data-table" style="--data-table-columns:200px 175px;--table-width:550px;">' +
  '<div class="fixed-columns" style="--fixed-column-widths:200px;"></div>' +
  '<div class="scrollable-columns" style="--data-column-widths:repeat(2,175px);"></div>' +
  "</div></div></div>";
card.innerHTML = containerHtml;

const scroller = doc.querySelector(".scroller");
scroller.style.overflowY = "auto";
Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 100 });
Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: N * ROW_PX + 100 });

const fixed = doc.querySelector(".fixed-columns");
const scroll = doc.querySelector(".scrollable-columns");

function titleCell(col, label) {
  const d = doc.createElement("div");
  d.className = "mp-table-cell title-cell mp-number-cell";
  d.style.gridRowStart = "1";
  d.style.gridColumnStart = String(col);
  d.style.gridRowEnd = "2";
  d.style.gridColumnEnd = String(col + 1);
  d.innerHTML =
    '<div class="mp-table-title-wrapper"><div class="sort-label value-sort">' +
    '<div class="header-title-text cell-text"><span elref="headerCellTitle">' + label + "</span></div></div></div>";
  return d;
}
// Persistent header + a sticky segment block spanning ALL rows (this is what
// tells the collector how many rows exist, even while the body is virtualized).
const segTitle = doc.createElement("div");
segTitle.className = "mp-table-cell title-cell first-column";
segTitle.style.gridRowStart = "1";
segTitle.style.gridColumnStart = "1";
segTitle.style.gridRowEnd = "2";
segTitle.style.gridColumnEnd = "2";
segTitle.innerHTML =
  '<div class="mp-table-title-wrapper"><div class="header-title-text cell-text"><span elref="headerCellTitle">Segment</span></div></div>';
fixed.appendChild(segTitle);
const segBlock = doc.createElement("div");
segBlock.className = "segment-cell-block first-col";
segBlock.style.gridRowStart = "2";
segBlock.style.gridColumnStart = "1";
segBlock.style.gridRowEnd = String(N + 2); // exclusive -> last row index = N+1
segBlock.style.gridColumnEnd = "2";
fixed.appendChild(segBlock);
scroll.appendChild(titleCell(1, "Value"));
scroll.appendChild(titleCell(2, "Value (Past)"));

function bodyCell(row, col, val, isFixed) {
  const d = doc.createElement("div");
  d.className = "mp-table-cell body-cell" + (isFixed ? " first-column segment-col mp-text-cell" : " mp-number-cell");
  d.setAttribute("data-sim-row", String(row));
  d.style.gridRowStart = String(row);
  d.style.gridColumnStart = String(col);
  d.style.gridRowEnd = String(row + 1);
  d.style.gridColumnEnd = String(col + 1);
  d.innerHTML =
    '<div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<div title="' + val + '" class="overflow-wrapper">' + val + "</div></div></div>";
  return d;
}

// Virtualizer: render the WINDOW rows visible at the given scrollTop.
function render(scrollTop) {
  Array.prototype.slice.call(fixed.querySelectorAll(".body-cell")).forEach(function (n) { n.remove(); });
  Array.prototype.slice.call(scroll.querySelectorAll(".body-cell")).forEach(function (n) { n.remove(); });
  let first = 2 + Math.floor(scrollTop / ROW_PX);
  if (first > N + 1) first = N + 1;
  for (let r = first; r < first + WINDOW && r <= N + 1; r++) {
    const i = r; // Value = i, Past = 0 -> change = i (unique, increasing)
    fixed.appendChild(bodyCell(r, 1, "R" + i, true));
    scroll.appendChild(bodyCell(r, 1, String(i), false));
    scroll.appendChild(bodyCell(r, 2, "0", false));
  }
}

let _top = 0;
Object.defineProperty(scroller, "scrollTop", {
  configurable: true,
  get: function () { return _top; },
  set: function (v) {
    _top = Math.max(0, Math.min(N * ROW_PX, v));
    render(_top);
  },
});
render(0); // initial window

window.eval(SCRIPT);

function byText(tag, text) {
  return Array.prototype.slice
    .call(doc.querySelectorAll(tag))
    .filter(function (el) { return (el.textContent || "").indexOf(text) !== -1; });
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function view() { return doc.querySelector("[data-mp-computed-view]"); }
function labels() {
  return Array.prototype.slice
    .call(view().querySelectorAll("tbody tr"))
    .map(function (tr) { return tr.querySelector("td").textContent; });
}

(async function () {
  const table = doc.querySelector(".mp-data-table");
  assert(!!table, "virtualized table scanned");
  assert(scroll.querySelectorAll(".body-cell").length < N * 2, "only a window of rows is in the DOM initially");

  const plus = byText("button", "% change(+)")[0];
  assert(!!plus, "% change(+) present");
  plus.click();
  await wait(2500); // allow the sweep to walk the whole list

  assert(!!view(), "computed view rendered");
  const rowCount = view().querySelectorAll("tbody tr").length;
  assert(rowCount === N, "collected ALL " + N + " rows (got " + rowCount + ")");

  // Original order R2..R68.
  const expectedOriginal = [];
  for (let i = 2; i <= N + 1; i++) expectedOriginal.push("R" + i);
  assert(labels().join(",") === expectedOriginal.join(","), "original order across all rows");

  // Sort desc: change = i, so highest index first (R68 ... R2).
  view().querySelector("thead th:last-child").click();
  await wait(30);
  const desc = labels();
  assert(desc.length === N, "sorted view still has all " + N + " rows");
  assert(desc[0] === "R" + (N + 1) && desc[desc.length - 1] === "R2", "desc sort spans full list: " + desc[0] + " .. " + desc[desc.length - 1]);

  // Copy TSV -> all rows.
  byText("button", "Copy TSV")[0].click();
  await wait(30);
  const dataLines = clipboard.split("\n").slice(1);
  assert(dataLines.length === N, "TSV has all " + N + " data rows (got " + dataLines.length + ")");

  console.log(failures ? "\n" + failures + " assertion(s) failed" : "\nAll assertions passed");
  process.exit(failures ? 1 : 0);
})();
