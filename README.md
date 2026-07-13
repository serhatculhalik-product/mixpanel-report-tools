# Mixpanel Report Tools

A tiny Chrome extension (Manifest V3) for **Mixpanel** dashboards. Click the
toolbar icon and it adds small action buttons to each report card so you can:

- **Transpose wide tables** so long horizontal reports become vertical — while
  keeping Mixpanel's native look (fonts, colors, lift pills).
- **Copy any table as TSV** to the clipboard (paste straight into Google
  Sheets / Excel).
- **See a `% change` view on multi-metric cards** — compare every metric against
  a baseline (the A/B **control** group when present, otherwise the min or max
  value).

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

**Control-group baseline:** if any metric's label contains the word **`control`**
(e.g. an A/B test's control segment), it is used as the baseline instead of the
min/max — so every variant is compared against control. In that case the
`(+)` / `(-)` buttons only decide which direction is shown as green.

Each metric shows the relative change plus the raw difference, e.g.:

- Percentages: `+0.66% ~+0.4pp` (relative % change and the percentage-point delta)
- Everything else: `+7.92% ~+0.57` (relative % change and the net difference)

A small note under each value spells out `X compared to Y`, mimicking Mixpanel's
native styling. Click the active button again to revert.

**Multi-row reports:** a card can contain several rows/segments (e.g. a 2×2
grid). The whole `MultiMetricChart` is targeted and **all metrics in the card are
compared as one group** — the baseline is the `control` metric if one exists,
otherwise the min (`+`) or max (`−`) of every value in the card, not per row.

### 3. Already-compared cards
Some Mixpanel cards already come compared natively — the value is a `%` change
with an "X compared to Y" note. The extension keeps Mixpanel's `%` value and
still shows the **`% change(+)` / `% change(-)`** buttons. When you press one it:

- appends the missing raw difference next to the value, from the two numbers
  shown — net difference for plain numbers (e.g. `~+0.33` from
  `8.11 compared to 7.78`) or the percentage-point delta for percentages
  (e.g. `~+0.13pp` from `61.79% compared to 61.66%`);
- recolors each value so the direction you care about is green — `(+)` means an
  increase is good, `(-)` means a decrease is good.

Press the active button again to restore Mixpanel's original value and color.

Legend text that doesn't fit on one line **wraps** instead of being truncated
with `…`.

---

## Installation

You **don't need to be a developer** to install this. Pick one of the two options
below — Option A is the easiest.

### Option A — Download from GitHub (recommended)

1. Open the repo page:
   [github.com/serhatculhalik-product/mixpanel-report-tools](https://github.com/serhatculhalik-product/mixpanel-report-tools)
2. Click the green **`Code`** button → **`Download ZIP`**.
3. **Unzip** the downloaded file. You'll get a folder like
   `mixpanel-report-tools-main`.
4. In Chrome, go to **`chrome://extensions`** (copy-paste it into the address bar).
5. Turn on **Developer mode** (toggle in the top-right corner).
6. Click **`Load unpacked`** and select the unzipped folder (the one that
   contains the `manifest.json` file).
7. The **Mixpanel Report Tools** icon appears in your toolbar — click the puzzle
   piece and pin it for quick access.

> Keep the unzipped folder on your computer. If you delete or move it, Chrome
> disables the extension.

### Option B — Clone with git (for developers)

```bash
git clone https://github.com/serhatculhalik-product/mixpanel-report-tools.git
```

Then follow steps 4–7 above and select the cloned folder.

## Usage

1. Open a Mixpanel report/board.
2. Click the extension icon in the toolbar.
3. Use the buttons that appear on each card:
   - **`⇄ Transpose`** → transpose the table, then **`Copy TSV`** to copy it.
   - **`% change(+)` / `% change(-)`** → show percentage change against the
     baseline (the `control` group if present, otherwise min/max).

> Tip: click the icon again after new tables/cards load — buttons are added only
> to cards that don't already have them.

---

## How it works (technical — optional)

You can safely skip this section; it's here for the curious and for developers.

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

## Roadmap

Planned or under consideration (order may change):

- [ ] Export **all tables on a board** at once into a single spreadsheet
- [ ] **Reorder / hide columns** before copying
- [ ] Remember the last-used view (transpose / % change) per report
- [ ] Optional **CSV** copy in addition to TSV
- [ ] A small popup to toggle each feature on/off

Have an idea? See **Feedback & contributing** below — no coding required.

## Feedback & contributing

This tool is built for **product managers and analysts**, so you don't need to
write code to help improve it. All feedback happens in **GitHub Discussions**:

- **Have a question, idea, bug, or feature request?** Start a discussion on the
  [Discussions page](https://github.com/serhatculhalik-product/mixpanel-report-tools/discussions):
  click **New discussion**, pick a category, describe what you expected vs. what
  happened, and add a screenshot if you can.
- **Want a new Mixpanel report type supported?** Open a discussion with a
  screenshot of the card and the comparison you'd like to see.
- **Developers:** contributions are welcome — fork the repo, create a branch, and
  open a pull request.

## License

[MIT](LICENSE)
