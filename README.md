# Mixpanel Report Tools

A tiny Chrome extension (Manifest V3) for **Mixpanel** dashboards. With a single
click it:

- **Transposes wide tables** so long horizontal reports become vertical — while
  keeping Mixpanel's native look (fonts, colors, lift pills).
- **Copies any table as TSV** to the clipboard (paste straight into Google
  Sheets / Excel).
- **Adds a `% change` view to multi-metric cards** — compare every metric against
  a single min or max baseline.

No data leaves your browser. The extension only runs when you click its toolbar
icon.

---

## Features

### 1. Table transpose
For every data table on the page, a small **`⇄ Transpose`** button is added next
to the card's `...` (ellipsis) menu. If a card has no ellipsis menu, the button
is placed just above the table instead.

- Click **`⇄ Transpose`** to flip that specific table (rows ↔ columns).
- The button then turns into **`Copy TSV`** — click it to copy the table as
  tab-separated values.

### 2. `% change` on metric cards
Cards that show several big numbers get two buttons near the ellipsis menu:

- **`% change(+)`** — uses the **smallest** value in the card as the baseline and
  shows every other metric's change relative to it. Increases are green.
- **`% change(-)`** — uses the **largest** value in the card as the baseline.
  Decreases are green (useful when *lower is better*).

Each metric shows the relative change plus the raw difference, e.g.:

- Percentages: `+0.66% ~+0.4pp` (relative % change and the percentage-point delta)
- Everything else: `+7.92% ~+0.57` (relative % change and the net difference)

A small note under each value spells out `X compared to Y`, mimicking Mixpanel's
native styling. Click the active button again to revert.

**Multi-row reports:** a card can contain several rows/segments (e.g. a 2×2
grid). The whole `MultiMetricChart` is targeted and **all metrics in the card are
compared as one group** — the baseline is the min (`+`) or max (`−`) of every
value in the card, not per row.

Legend text that doesn't fit on one line **wraps** instead of being truncated
with `…`.

---

## Installation (load unpacked)

1. Clone the repository (or download it as a ZIP and unzip):
   ```bash
   git clone https://github.com/serhatculhalik-product/mixpanel-report-tools.git
   ```
2. Open **`chrome://extensions`** in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this project folder
   (the one containing `manifest.json`).
5. The **Mixpanel Report Tools** icon appears in your toolbar.

## Usage

1. Open a Mixpanel report/board.
2. Click the extension icon in the toolbar.
3. Use the buttons that appear on each card:
   - **`⇄ Transpose`** → transpose the table, then **`Copy TSV`** to copy it.
   - **`% change(+)` / `% change(-)`** → show percentage change against the
     min/max baseline.

> Tip: click the icon again after new tables/cards load — buttons are added only
> to cards that don't already have them.

---

## How it works

- `manifest.json` — MV3 config. Uses `scripting` + `activeTab` and
  `host_permissions: <all_urls>` so it works on any Mixpanel host.
- `background.js` — a service worker that, on toolbar click, injects
  `transpose.js` into **all frames** of the active tab (Mixpanel often renders
  tables inside cross-origin iframes, so `allFrames: true` is required).
- `transpose.js` — the content script. It traverses iframes and shadow DOM to
  find tables and metric cards, adds the buttons, rewrites CSS `grid-area` values
  to transpose in place, and computes the `% change` values.

## Notes & limitations

- Built against Mixpanel's current DOM (class names like `.mp-data-table`,
  `MultiMetricChart`). If Mixpanel changes its markup, selectors may need
  updating.
- Tables are transposed **in place** by rewriting the existing grid, so the
  native styling is preserved instead of being re-created.
- Everything runs locally in the page; nothing is sent to any server.

## License

[MIT](LICENSE)
