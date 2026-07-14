// Integration test for the "Hide Metric" button: grouped cohort tables repeat
// the same metric name in a redundant "Metric" fixed column. The button should
// collapse that column (hide its cells + shrink the width vars) and restore it
// on a second click. Run: node test/metric-col.test.js
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

const METRIC = "Average of position on Update Basket - Exact Match";
const cohorts = [
  "Market_Search_LTR_V3 variant 2 (without_rules)",
  "Not In Market_Search_LTR_V3 control",
  "All User Profiles",
];

function metricCell(row) {
  return (
    '<div class="mp-table-cell body-cell first-column sticky-column segment-col first-segment-col mp-text-cell" ' +
    'elref="bodyCell" style="grid-row-start:' + row + ";grid-column-start:1;grid-row-end:" + (row + 1) +
    ';grid-column-end:2;"><div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<div title="' + METRIC + '" class="overflow-wrapper">' + METRIC + "</div></div></div></div>"
  );
}
function cohortCell(row, label) {
  return (
    '<div class="mp-table-cell body-cell last-sticky sticky-column last-segment-col segment-col mp-text-cell" ' +
    'elref="bodyCell" style="grid-row-start:' + row + ";grid-column-start:2;grid-row-end:" + (row + 1) +
    ';grid-column-end:3;"><div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<div class="mp-checkbox-wrapper" role="checkbox" aria-checked="false"></div>' +
    '<div title="' + label + '" class="overflow-wrapper">' + label + "</div></div></div></div>"
  );
}
function valueCell(row, val) {
  return (
    '<div class="mp-table-cell body-cell last-column mp-number-cell" ' +
    'style="grid-row-start:' + row + ";grid-column-start:1;grid-row-end:" + (row + 1) +
    ';grid-column-end:2;"><div class="overflow-wrapper">' + val + "</div></div>"
  );
}

// Header cells.
let fixed =
  '<div class="mp-table-cell title-cell segment-col first-segment-col first-column sticky-column" style="grid-row-start:1;grid-column-start:1;grid-row-end:2;grid-column-end:2;">' +
  '<div class="mp-table-title-wrapper"><div class="header-title-text cell-text"><span>Metric</span></div></div></div>' +
  '<div class="mp-table-cell title-cell segment-col last-sticky last-segment-col sticky-column" style="grid-row-start:1;grid-column-start:2;grid-row-end:2;grid-column-end:3;">' +
  '<div class="mp-table-title-wrapper"><div class="header-title-text cell-text"><span>Cohort</span></div></div></div>';
// A merged "segment-cell-block" for the metric column (col 1), like Mixpanel's.
fixed +=
  '<div class="segment-cell-block first-col" style="grid-row-start:2;grid-row-end:5;grid-column-start:1;grid-column-end:2;">' +
  '<div class="segment-cell-block-inner"><div class="overflow-wrapper">' + METRIC + "</div></div></div>";

let scroll =
  '<div class="mp-table-cell title-cell mp-number-cell last-column" style="grid-row-start:1;grid-column-start:1;grid-row-end:2;grid-column-end:2;">' +
  '<div class="header-title-text cell-text"><span>Value</span></div></div>';

cohorts.forEach(function (label, i) {
  const row = i + 2;
  fixed += metricCell(row) + cohortCell(row, label);
  scroll += valueCell(row, (7.5 - i).toFixed(2));
});

const html =
  "<!DOCTYPE html><html><body><div class='card-container'><div class='mp-data-table-container'>" +
  '<div class="mp-data-table has-segment-cell-blocks" ' +
  'style="--data-table-columns: 920px 253px; --fixed-columns-width: 920px; --table-width: 1175px;">' +
  '<div class="fixed-columns sticky-columns" style="--fixed-column-widths: 460px 460px;">' + fixed + "</div>" +
  '<div class="scrollable-columns" style="--data-column-widths: 253px;">' + scroll + "</div>" +
  "</div></div></div></body></html>";

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.eval(SCRIPT);
const doc = window.document;

function metricBtn() {
  return Array.prototype.slice
    .call(doc.querySelectorAll("button"))
    .filter(function (b) { return /metric/i.test(b.textContent); })[0];
}
function fixedCols() { return doc.querySelector(".fixed-columns"); }
function table() { return doc.querySelector(".mp-data-table"); }
function col1Cells() {
  return Array.prototype.slice
    .call(fixedCols().children)
    .filter(function (c) { return c.style && c.style.gridColumnStart === "1"; });
}
function cohortHeader() {
  return Array.prototype.slice
    .call(doc.querySelectorAll(".fixed-columns > .title-cell"))
    .filter(function (c) { return c.style.gridColumnStart === "2"; })[0];
}

(function () {
  assert(!!table(), "grouped cohort table found and scanned");

  const btn = metricBtn();
  assert(!!btn, '"Hide Metric" button present');
  assert(btn.style.display !== "none", "button visible when a Metric column exists");
  assert(/hide metric/i.test(btn.textContent), "button starts as 'Hide Metric'");

  // The Cohort column and its header must NOT be hidden.
  const cohortH = cohortHeader();

  // 1) Hide.
  btn.click();
  assert(table().getAttribute("data-mp-metric-col-hidden") === "1", "metric column marked hidden");
  assert(/show metric/i.test(btn.textContent), "button flips to 'Show Metric'");

  const c1 = col1Cells();
  assert(c1.length > 0, "found metric-column cells");
  assert(c1.every(function (c) { return c.style.display === "none"; }), "all metric-column cells hidden");
  assert(cohortH.style.display !== "none", "Cohort header stays visible");

  // Width vars collapsed by the metric width (460).
  assert(
    fixedCols().style.getPropertyValue("--fixed-column-widths").trim().indexOf("0px") === 0,
    "metric track collapsed to 0px: " + fixedCols().style.getPropertyValue("--fixed-column-widths")
  );
  assert(
    parseFloat(table().style.getPropertyValue("--fixed-columns-width")) === 460,
    "fixed-columns-width reduced 920 -> 460: " + table().style.getPropertyValue("--fixed-columns-width")
  );
  assert(
    parseFloat(table().style.getPropertyValue("--table-width")) === 715,
    "table-width reduced 1175 -> 715: " + table().style.getPropertyValue("--table-width")
  );
  assert(
    parseFloat(table().style.getPropertyValue("--data-table-columns")) === 460,
    "data-table-columns fixed portion reduced 920 -> 460: " + table().style.getPropertyValue("--data-table-columns")
  );

  // 2) Show again -> fully restored.
  btn.click();
  assert(table().getAttribute("data-mp-metric-col-hidden") !== "1", "metric column no longer hidden");
  assert(col1Cells().every(function (c) { return c.style.display !== "none"; }), "metric cells restored");
  assert(
    parseFloat(table().style.getPropertyValue("--fixed-columns-width")) === 920,
    "fixed-columns-width restored to 920"
  );
  assert(
    fixedCols().style.getPropertyValue("--fixed-column-widths").trim() === "460px 460px",
    "fixed-column-widths restored: " + fixedCols().style.getPropertyValue("--fixed-column-widths")
  );

  console.log(failures ? "\n" + failures + " assertion(s) failed" : "\nAll assertions passed");
  process.exit(failures ? 1 : 0);
})();
