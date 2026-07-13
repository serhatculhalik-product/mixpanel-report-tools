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

### 1. Transpose tables
A small **`⇄ Transpose`** button is added to every data table, next to the
card's `...` (ellipsis) menu — or just above the table if there's no menu.
Clicking it flips that specific table (rows ↔ columns) **in place**, so the
native styling (fonts, colors, lift pills) is preserved.

### 2. Copy as TSV
After transposing, the button turns into **`Copy TSV`**. One click copies the
table as tab-separated values, ready to paste straight into Google Sheets or
Excel.

### 3. `% change` baseline on metric cards
Cards that show several big numbers get two buttons near the ellipsis menu:

- **`% change(+)`** — uses the **smallest** value in the card as the baseline
  and shows every other metric's change relative to it. Increases are green.
- **`% change(-)`** — uses the **largest** value in the card as the baseline.
  Decreases are green (useful when *lower is better*).

The big value shows the relative `%` change; the note under it reads
`X compared to Y` followed by the raw difference as a **bold highlight pill**
(green when positive, red when negative), mimicking Mixpanel's native styling:

- Percentages → `61.79% compared to 61.66%` + `+0.13pp` (percentage-point delta)
- Everything else → `8.11 compared to 7.78` + `+0.33` (net difference)

### 4. Control-group baseline
If any metric's label contains the word **`control`** (e.g. an A/B test's control
segment), it is used as the baseline instead of the min/max — so every variant is
compared against control. In that case the `(+)` / `(-)` buttons only decide
which direction is shown as green.

### 5. Already-compared cards
Some Mixpanel cards already come compared natively (the value is a `%` change
with an "X compared to Y" note). The extension keeps Mixpanel's `%` value, and
when you press **`% change(+)` / `% change(-)`** it:

- adds the raw difference as a **bold highlight pill on the "X compared to Y"
  line** (the big `%` value is left as-is) — net difference for plain numbers
  (e.g. `8.11 compared to 7.78` + `+0.33`) or the percentage-point delta for
  percentages (e.g. `61.79% compared to 61.66%` + `+0.13pp`);
- recolors each value so the direction you care about is green — `(+)` means an
  increase is good, `(-)` means a decrease is good.

### 6. Reset to original
A **`↺` reset** icon sits next to the buttons on both tables and metric cards.
Click it to return the table or card to its **original view**, as if no button
had been pressed. (Clicking the active `% change` button again also reverts it.)

### 7. Legend text wrapping
Legend/segment text that doesn't fit on one line **wraps** instead of being
truncated with `…`.

---

## Installation

You **don't need to be a developer** to install this — just download and load it.

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

## Usage

1. Open a Mixpanel report/board.
2. Click the extension icon in the toolbar.
3. Use the buttons that appear on each card:
   - **`⇄ Transpose`** → transpose the table, then **`Copy TSV`** to copy it.
   - **`% change(+)` / `% change(-)`** → show percentage change against the
     baseline (the `control` group if present, otherwise min/max).

> Once activated on a page, the extension keeps watching it (light DOM and every
> shadow root): tables and cards that finish loading **after** you clicked get
> their buttons automatically — no matter how long you wait — so you don't need
> to click the icon again. It's event-driven (no polling), so it stays idle until
> new content actually appears.

---

## Roadmap & feedback

This tool is built for **product managers and analysts**, so you don't need to
write code to help shape it. All feedback happens in **GitHub Discussions**.

**On the roadmap** (order may change — vote or suggest in Discussions):

- [ ] Export **all tables on a board** at once into a single spreadsheet
- [ ] **Reorder / hide columns** before copying
- [ ] Remember the last-used view (transpose / % change) per report
- [ ] Optional **CSV** copy in addition to TSV
- [ ] A small popup to toggle each feature on/off

**Have a question, idea, bug, or want a new report type supported?** Start a
discussion on the
[Discussions page](https://github.com/serhatculhalik-product/mixpanel-report-tools/discussions):
click **New discussion**, pick a category, and describe what you expected vs.
what happened (a screenshot of the card helps a lot).

Developers are welcome too — fork the repo, create a branch, and open a pull
request.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE)
