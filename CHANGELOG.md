# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-07-14

### Added
- **"A/B Cohorts" button on cohort tables** — a one-click button next to
  `⇄ Transpose` that checks every cohort row except those starting with `All` or
  `Not In` (and unchecks those two kinds), leaving just the real variants/segments.
  It clicks the actual checkboxes so Mixpanel updates the chart. The button only
  appears on tables that have cohort checkboxes.
- **"Hide Metric" button** — collapses the redundant `Metric` column that grouped
  cohort tables repeat on every row (toggle back with `Show Metric`). Only shown
  on tables that have a `Metric` column.

## [1.2.0] - 2026-07-14

### Added
- **Sortable `Value` and `Value (Past)` columns** — in the computed `Change` view,
  the `Value` and `Value (Past)` column headers are now clickable and sort just like
  `Change` (first click high→low, click again low→high; switching columns restarts
  at high→low). The active column shows a `↑`/`↓` arrow, others a neutral `↕`, and
  `Copy TSV` follows the active sort.
- **Automatic direction on already-compared cards** — for multi-metric cards that
  already have a native "X compared to Y" comparison, the absolute-difference pill
  now appears **automatically** with the direction and color inferred from the color
  Mixpanel already applied to the relative `%` change. The pill mirrors Mixpanel's
  exact color, so the absolute and relative changes always agree, and users no
  longer need to pick `↑` / `↓` manually.

### Changed
- On already-compared cards the extension no longer recolors Mixpanel's headline
  `%`; it keeps Mixpanel's own color and matches the difference pill to it. The
  `↑` / `↓` buttons remain a manual fallback where the direction can't be inferred,
  and an explicit reset / toggle-off is respected (auto-apply won't re-trigger).

## [1.1.0] - 2026-07-13

### Added
- **Runs automatically** — the tools now load on Mixpanel pages (all frames) as
  soon as the page is ready, so buttons appear without clicking the toolbar icon.
  Clicking the icon still works as a manual re-scan / fallback for unusual frames.
- **Sortable `Change` column on `Value (Past)` tables** — `% change(+/-)` collects
  the entire table in one pass and shows a complete, static table with a `Change`
  column; click the column header to sort (high→low, then low→high), and `Copy TSV`
  follows the sort order.

### Changed
- **Compact `% change` buttons** — the `% change(+)` / `% change(-)` text buttons
  are now small `↑` / `↓` icon buttons that set which direction counts as good
  (higher vs lower is better) for both percentages and plain numbers; hover for a
  tooltip.
- **Full-table Copy TSV** — copying gathers every row of long (virtualized) tables,
  not just the ones currently on screen, and escapes cells starting with `= + @`.
- Replaced the fragile scroll-time Change-column syncing with a single upfront
  collection, fixing cases where only the initially visible rows were computed.

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

[1.1.0]: https://github.com/serhatculhalik-product/mixpanel-report-tools/releases/tag/v1.1.0
[1.0.0]: https://github.com/serhatculhalik-product/mixpanel-report-tools/releases/tag/v1.0.0
