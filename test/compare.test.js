// Integration test for automatic direction inference on natively-compared
// multi-metric cards. The absolute-difference pill should appear automatically
// (no button click) and mirror the color Mixpanel already applied to the
// relative % change. Run: node test/compare.test.js
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

// Mixpanel's own colors: red = bad move, green = good move, grey = neutral.
const RED = "rgb(229, 72, 77)";
const GREEN = "rgb(51, 178, 123)";
const GREY = "rgb(150, 150, 150)";

// Avg Position Update Basket: LOWER is better.
//   variant 2: 7.96 vs 7.67 -> +3.75% (up), Mixpanel colors it RED   -> diff +0.29 red
//   control:   7.67 vs 7.67 -> 0%      (flat), grey                  -> diff 0 neutral
//   variant1:  7.58 vs 7.67 -> -1.24% (down), Mixpanel colors GREEN  -> diff -0.09 green
function metric(label, valueText, color, compareText) {
  return (
    '<div data-sentry-component="MetricChart" class="_metric-container_x">' +
    '<div class="_segment-text_x">' + label + "</div>" +
    '<div class="_value_x" style="color: ' + color + ';">' + valueText + "</div>" +
    '<div class="_compare_x">' + compareText + "</div>" +
    "</div>"
  );
}

const html =
  "<!DOCTYPE html><html><body><div class='card-container'>" +
  '<div data-sentry-component="MultiMetricChart">' +
  metric("Market_Search_LTR_V3 variant 2 (without_rules)", "+3.75%", RED, "7.96 compared to 7.67") +
  metric("Market_Search_LTR_V3 control", "0%", GREY, "7.67 compared to 7.67") +
  metric("Market_Search_LTR_V3 variant1 (with_rules)", "-1.24%", GREEN, "7.58 compared to 7.67") +
  "</div></div></body></html>";

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.eval(SCRIPT);
const doc = window.document;

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function metrics() {
  return Array.prototype.slice.call(doc.querySelectorAll('[data-sentry-component="MetricChart"]'));
}
function pillIn(container) { return container.querySelector("[data-mp-cmp-extra]"); }
function valueColor(container) {
  return window.getComputedStyle(container.querySelector('[class*="_value_"]')).color;
}

(async function () {
  const card = doc.querySelector('[data-sentry-component="MultiMetricChart"]');
  assert(!!card, "multi-metric card found and scanned");

  // Direction buttons are still added (manual fallback stays available).
  const buttons = Array.prototype.slice
    .call(doc.querySelectorAll("button"))
    .filter(function (b) { return b.textContent === "\u2191" || b.textContent === "\u2193"; });
  assert(buttons.length >= 2, "up/down direction buttons present");

  // Give the initial scan a tick to auto-apply.
  await wait(20);

  // 1) Direction inferred automatically -> "max" (lower is better) with NO click.
  assert(card.getAttribute("data-mp-metric-mode") === "max", "direction auto-inferred as max (lower is better)");
  assert(card.getAttribute("data-mp-auto-done") === "1", "auto-apply marked done");

  const [v2, control, v1] = metrics();

  // 2) Every metric gets an absolute-difference pill automatically.
  assert(!!pillIn(v2) && !!pillIn(control) && !!pillIn(v1), "absolute-difference pill added to all metrics");

  // 3) Pills mirror Mixpanel's own value color exactly (consistent direction/color).
  assert(pillIn(v2).textContent === "+0.29", "variant 2 diff = +0.29: " + pillIn(v2).textContent);
  assert(pillIn(v2).style.color === valueColor(v2), "variant 2 pill matches its value color (red)");

  assert(pillIn(v1).textContent === "-0.09", "variant 1 diff = -0.09: " + pillIn(v1).textContent);
  assert(pillIn(v1).style.color === valueColor(v1), "variant 1 pill matches its value color (green)");

  // 4) The zero/no-change control stays neutral (not green/red).
  assert(pillIn(control).textContent === "0", "control diff = 0: " + pillIn(control).textContent);
  assert(pillIn(control).style.color === "inherit", "control pill is neutral (inherit)");

  // 5) Red pill really is reddish, green pill really is greenish (sanity).
  assert(/^rgb\(229/.test(pillIn(v2).style.color), "variant 2 pill color is red");
  assert(/^rgb\(51/.test(pillIn(v1).style.color), "variant 1 pill color is green");

  console.log(failures ? "\n" + failures + " assertion(s) failed" : "\nAll assertions passed");
  process.exit(failures ? 1 : 0);
})();
