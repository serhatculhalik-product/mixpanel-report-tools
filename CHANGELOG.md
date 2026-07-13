# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-13

First public release. A Chrome extension (Manifest V3) that makes Mixpanel
reports easier to read and compare.

### Added
- **Table transpose** — a `⇄ Transpose` button on each data table flips rows and
  columns in place while preserving Mixpanel's native styling (fonts, colors,
  lift pills).
- **Copy TSV** — after transposing, copy the table as tab-separated values for
  Google Sheets / Excel (with a clipboard fallback).
- **`% change` on metric cards** — `% change(+)` / `% change(-)` buttons compare
  every metric in a card against a single baseline and recolor each value so the
  direction you care about is green (`(+)` = increase is good, `(-)` = decrease
  is good).
- **Control-group baseline** — if a metric's label contains `control`, it is used
  as the baseline (e.g. for A/B tests); otherwise the min (`+`) or max (`-`)
  value is used.
- **Already-compared cards** — for cards Mixpanel already compares natively, the
  `%` value is kept and only the missing raw difference is added on press.
- **Raw difference highlight** — the net difference (numbers) or percentage-point
  delta (percentages) is shown on the `X compared to Y` line as a bold highlight
  pill: green when positive, red when negative.
- **Auto-detect late-loading widgets** — once activated, the extension watches the
  page (light DOM and shadow DOM) and adds buttons to tables/cards that finish
  loading afterwards, with no time limit and no polling.
- **Legend wrapping** — long segment/legend names wrap instead of being truncated
  with `…`.

### Notes
- Everything runs locally in the page; no data leaves the browser.
- Built against Mixpanel's current DOM; selectors may need updating if Mixpanel
  changes its markup.

[1.0.0]: https://github.com/serhatculhalik-product/mixpanel-report-tools/releases/tag/v1.0.0
