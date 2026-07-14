// Integration test for the computed "Change" view (full, static, sortable).
// Run: node test/sort.test.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT = fs.readFileSync(path.join(__dirname, "..", "transpose.js"), "utf8");

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  ok - " + msg);
  } else {
    failures++;
    console.error("  FAIL - " + msg);
  }
}

// Minimal Mixpanel-style Value / Value(Past) grid table.
// Rows given in a non-sorted order so original != sorted:
//   C: 5,  5  ->  0
//   A: 10, 2  -> +8
//   D: 1,  10 -> -9
//   B: 20, 19 -> +1
// Original order: C,A,D,B.  Desc by change: A,B,C,D.  Asc: D,C,B,A.
function cellFixed(row, label) {
  return (
    '<div class="mp-table-cell body-cell first-column segment-col mp-text-cell" ' +
    'style="grid-row-start:' + row + ';grid-column-start:1;grid-row-end:' + (row + 1) + ';grid-column-end:2;">' +
    '<div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<div title="' + label + '" class="overflow-wrapper">' + label + "</div></div></div></div>"
  );
}
function cellScroll(row, col, val) {
  return (
    '<div class="mp-table-cell body-cell mp-number-cell" ' +
    'style="grid-row-start:' + row + ';grid-column-start:' + col + ";grid-row-end:" + (row + 1) +
    ";grid-column-end:" + (col + 1) + ';">' +
    '<div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<div title="' + val + '" class="overflow-wrapper">' + val + "</div></div></div></div>"
  );
}
function titleCell(col, label) {
  return (
    '<div class="mp-table-cell title-cell mp-number-cell" ' +
    'style="grid-row-start:1;grid-column-start:' + col + ";grid-row-end:2;grid-column-end:" + (col + 1) + ';">' +
    '<div class="mp-table-title-wrapper"><div class="sort-label value-sort">' +
    '<div class="header-title-text cell-text"><span elref="headerCellTitle">' + label + "</span></div>" +
    "</div></div></div>"
  );
}

const rows = [
  ["C", 5, 5],
  ["A", 10, 2],
  ["D", 1, 10],
  ["B", 20, 19],
];

let fixed =
  '<div class="mp-table-cell title-cell first-column" style="grid-row-start:1;grid-column-start:1;grid-row-end:2;grid-column-end:2;">' +
  '<div class="mp-table-title-wrapper"><div class="header-title-text cell-text"><span elref="headerCellTitle">Segment</span></div></div></div>';
let scroll = titleCell(1, "Value") + titleCell(2, "Value (Past)");
rows.forEach(function (r, i) {
  const row = i + 2;
  fixed += cellFixed(row, r[0]);
  scroll += cellScroll(row, 1, r[1]) + cellScroll(row, 2, r[2]);
});

const html =
  "<!DOCTYPE html><html><body><div class='card-container'><div class='mp-data-table-container'>" +
  '<div class="mp-data-table" style="--data-table-columns:200px 175px;--table-width:550px;">' +
  '<div class="fixed-columns" style="--fixed-column-widths:200px;">' + fixed + "</div>" +
  '<div class="scrollable-columns" style="--data-column-widths:repeat(2,175px);">' + scroll + "</div>" +
  "</div></div></div></body></html>";

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;

let clipboard = "";
Object.defineProperty(window.navigator, "clipboard", {
  configurable: true,
  value: { writeText: function (t) { clipboard = t; return Promise.resolve(); } },
});

window.eval(SCRIPT);
const doc = window.document;

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
  assert(!!table, "table found and scanned");

  const plus = byText("button", "\u2191")[0];
  const minus = byText("button", "\u2193")[0];
  assert(!!plus && !!minus, "% change icon buttons present");

  // 1) % change(+) collects the WHOLE list at once and shows the full static
  //    view in original order (no scroll dependency).
  plus.click();
  await wait(60);
  assert(!!view(), "computed view rendered on % change(+)");
  assert(table.getAttribute("data-mp-vp-mode") === "min", "mode=min");
  assert(!table.getAttribute("data-mp-vp-sort"), "no sort yet (original order)");
  assert(view().querySelectorAll("tbody tr").length === 4, "all 4 rows present (not just visible)");
  assert(labels().join(",") === "C,A,D,B", "original order preserved: " + labels().join(","));
  assert(table.__mpHidden && table.__mpHidden.style.display === "none", "original table hidden");

  // 2) Click the Change header -> desc (high -> low).
  let th = view().querySelector("thead th:last-child");
  th.click();
  await wait(20);
  assert(table.getAttribute("data-mp-vp-sort") === "desc", "first header click = desc");
  assert(labels().join(",") === "A,B,C,D", "desc order: " + labels().join(","));
  assert(/\u2193/.test(view().querySelector("thead th:last-child").textContent), "desc arrow shown");

  // 3) Click again -> asc (low -> high).
  view().querySelector("thead th:last-child").click();
  await wait(20);
  assert(table.getAttribute("data-mp-vp-sort") === "asc", "second header click = asc");
  assert(labels().join(",") === "D,C,B,A", "asc order: " + labels().join(","));

  // 4) Switch color direction with % change(-): keeps data + sort, no re-sweep.
  minus.click();
  await wait(20);
  assert(table.getAttribute("data-mp-vp-mode") === "max", "mode switched to max");
  assert(table.getAttribute("data-mp-vp-sort") === "asc", "sort preserved across mode switch");
  assert(labels().join(",") === "D,C,B,A", "order preserved across mode switch");

  // 5) Copy TSV follows the sort (asc), from the cache (no scrolling).
  const copyBtn = byText("button", "Copy TSV")[0];
  copyBtn.click();
  await wait(20);
  const lines = clipboard.split("\n");
  assert(lines[0].split("\t").pop() === "Change", "TSV header ends with Change");
  const tsvLabels = lines.slice(1).map(function (l) { return l.split("\t")[0]; });
  assert(tsvLabels.join(",") === "D,C,B,A", "TSV rows sorted asc: " + tsvLabels.join(","));

  // 6) Clicking the active mode again toggles the view off (original restored).
  minus.click();
  await wait(20);
  assert(!view(), "clicking active mode closes the view");
  assert(doc.querySelector(".mp-data-table-container").style.display !== "none", "original restored on toggle-off");

  // 7) Reopen + reset button restores original.
  plus.click();
  await wait(60);
  assert(!!view(), "reopened computed view");
  const resetBtn = byText("button", "\u21BA")[0];
  resetBtn.click();
  await wait(20);
  assert(!view(), "reset removes the computed view");
  assert(!table.getAttribute("data-mp-vp-mode"), "reset clears mode");
  assert(!table.getAttribute("data-mp-vp-sort"), "reset clears sort");
  assert(doc.querySelector(".mp-data-table-container").style.display !== "none", "original visible after reset");

  console.log(failures ? "\n" + failures + " assertion(s) failed" : "\nAll assertions passed");
  process.exit(failures ? 1 : 0);
})();
