// Integration test for the "A/B Cohorts" button on cohort tables. Uses
// Mixpanel's real custom checkbox structure (a role="checkbox" component with
// aria-checked, NOT a native <input>). The button should check every row except
// those starting with "All" or "Not In", and uncheck those two kinds.
// Run: node test/cohort.test.js
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

// A cohort row cell mirroring the real Mixpanel markup the user shared: a custom
// <mp-checkbox> wrapping a role="checkbox" element with aria-checked, plus the
// label in an .overflow-wrapper.
function cohortCell(row, label, checked) {
  return (
    '<div class="mp-table-cell body-cell last-sticky sticky-column segment-col mp-text-cell has-multi-select" ' +
    'elref="bodyCell" style="grid-row-start:' + row + ";grid-column-start:2;grid-row-end:" + (row + 1) +
    ';grid-column-end:3;">' +
    '<div class="body-cell-wrapper"><div class="body-cell-content">' +
    '<mp-checkbox class="select-segment-checkbox"><div style="display:contents"><div style="display:contents">' +
    '<div class="mp-checkbox-wrapper" role="checkbox" aria-checked="' + (checked ? "true" : "false") +
    '" aria-disabled="false" data-sentry-component="Checkbox">' +
    '<div class="_mp-checkbox-icon_x"></div><div class="_mp-checkbox-label_x"></div>' +
    "</div></div></div></mp-checkbox>" +
    '<div title="' + label + '" class="overflow-wrapper">' + label + "</div>" +
    "</div></div></div>"
  );
}
function valueCell(row, val) {
  return (
    '<div class="mp-table-cell body-cell mp-number-cell" ' +
    'style="grid-row-start:' + row + ";grid-column-start:1;grid-row-end:" + (row + 1) +
    ';grid-column-end:2;"><div class="overflow-wrapper">' + val + "</div></div>"
  );
}

// Mirrors the screenshot: 7 cohorts, mixed initial states.
const cohorts = [
  ["Not In Market_Search_LTR_V3 control", false],
  ["Market_Search_LTR_V3 variant 2 (without_rules)", true],
  ["Not In Market_Search_LTR_V3 variant1 (with_rules)", false],
  ["All User Profiles", true],
  ["Market_Search_LTR_V3 variant1 (with_rules)", false],
  ["Not In Market_Search_LTR_V3 variant 2 (without_rules)", true],
  ["Market_Search_LTR_V3 control", false],
];

let fixed =
  '<div class="mp-table-cell title-cell first-column" style="grid-row-start:1;grid-column-start:2;grid-row-end:2;grid-column-end:3;">' +
  '<div class="header-title-text cell-text"><span>Cohort</span></div></div>';
let scroll =
  '<div class="mp-table-cell title-cell mp-number-cell" style="grid-row-start:1;grid-column-start:1;grid-row-end:2;grid-column-end:2;">' +
  '<div class="header-title-text cell-text"><span>Value</span></div></div>';
cohorts.forEach(function (c, i) {
  const row = i + 2;
  fixed += cohortCell(row, c[0], c[1]);
  scroll += valueCell(row, "0.42");
});

const html =
  "<!DOCTYPE html><html><body><div class='card-container'><div class='mp-data-table-container'>" +
  '<div class="mp-data-table" style="--data-table-columns:200px 175px;">' +
  '<div class="fixed-columns">' + fixed + "</div>" +
  '<div class="scrollable-columns">' + scroll + "</div>" +
  "</div></div></div></body></html>";

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.eval(SCRIPT);
const doc = window.document;

// Emulate Mixpanel's checkbox: toggle aria-checked on click (it does NOT react
// to a plain programmatic .click of an inner node in the same way a native input
// would — the extension must dispatch a real event, which bubbles to here).
Array.prototype.slice.call(doc.querySelectorAll('[role="checkbox"]')).forEach(function (cb) {
  cb.addEventListener("click", function () {
    const now = cb.getAttribute("aria-checked") === "true";
    cb.setAttribute("aria-checked", now ? "false" : "true");
  });
});

function boxes() {
  return Array.prototype.slice.call(doc.querySelectorAll('[role="checkbox"]'));
}
function labelOf(cb) {
  return (cb.closest(".mp-table-cell").querySelector(".overflow-wrapper").textContent || "").trim();
}
function isChecked(cb) { return cb.getAttribute("aria-checked") === "true"; }
function selectBtn() {
  return Array.prototype.slice
    .call(doc.querySelectorAll("button"))
    .filter(function (b) { return /a\/b cohorts/i.test(b.textContent); })[0];
}

(function () {
  const table = doc.querySelector(".mp-data-table");
  assert(!!table, "cohort table found and scanned");

  const btn = selectBtn();
  assert(!!btn, '"A/B Cohorts" button present on a cohort table');
  assert(btn.style.display !== "none", "button is visible when custom checkboxes exist");

  btn.click();

  let wrongExcluded = 0;
  let wrongWanted = 0;
  boxes().forEach(function (cb) {
    const label = labelOf(cb);
    const excluded = /^(all|not in)\b/i.test(label);
    if (excluded && isChecked(cb)) wrongExcluded++;
    if (!excluded && !isChecked(cb)) wrongWanted++;
  });

  assert(wrongExcluded === 0, "no 'All*' / 'Not In*' row stays checked");
  assert(wrongWanted === 0, "every other cohort row is checked");

  const byLabel = {};
  boxes().forEach(function (cb) { byLabel[labelOf(cb)] = cb; });
  assert(!isChecked(byLabel["All User Profiles"]), "'All User Profiles' unchecked");
  assert(!isChecked(byLabel["Not In Market_Search_LTR_V3 control"]), "'Not In ...' unchecked");
  assert(isChecked(byLabel["Market_Search_LTR_V3 control"]), "'... control' variant checked");
  assert(
    isChecked(byLabel["Market_Search_LTR_V3 variant 2 (without_rules)"]),
    "already-checked variant stays checked (no needless toggle)"
  );

  console.log(failures ? "\n" + failures + " assertion(s) failed" : "\nAll assertions passed");
  process.exit(failures ? 1 : 0);
})();
