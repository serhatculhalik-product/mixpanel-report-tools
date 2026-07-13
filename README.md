# Mixpanel Report Tools

A tiny Chrome extension (Manifest V3) for **Mixpanel** dashboards. It runs
automatically on Mixpanel pages and adds small action buttons to each report
card so you can:

- **Transpose wide tables** so long horizontal reports become vertical — while
  keeping Mixpanel's native look (fonts, colors, lift pills).
- **Copy any table as TSV** to the clipboard (paste straight into Google
  Sheets / Excel).
- **See a `% change` view on multi-metric cards** — compare every metric against
  a baseline (the A/B **control** group when present, otherwise the min or max
  value).

No data leaves your browser. The extension only runs on Mixpanel pages.

---

## Features

The extension adds small, non-destructive buttons to your Mixpanel report cards.
Nothing is sent anywhere and nothing is changed permanently — every action can be
undone with **`↺` Reset**, and reloading the page always restores Mixpanel's
original view.

### 1. Transpose wide tables
Long horizontal reports are hard to read and hard to paste into a spreadsheet.
A **`⇄ Transpose`** button is added to every data table (docked to the right of
the table's search row when there is one, otherwise next to the card's `...`
menu, otherwise just above the table). Clicking it flips **that specific table**
(rows ↔ columns) **in place**, so Mixpanel's native styling — fonts, colors,
lift pills — is preserved. On boards with several tables, each table gets its own
button so you only flip the one you want.

### 2. Copy any table as TSV
After transposing, the button becomes **`Copy TSV`**. One click copies the table
as tab-separated values, ready to paste straight into **Google Sheets or Excel**.

It copies the **whole** table (every row) and escapes cells starting with `=`,
`+`, or `@` so Sheets/Excel don't misread them as broken formulas.

### 3. `Change` column + sorting on `Value (Past)` tables
When a table has a **`Value (Past)`** comparison column, it gets three extra
buttons — **`% change(+)`**, **`% change(-)`**, and a standalone **`Copy TSV`** —
plus the **`↺` Reset** icon.

Pressing **`% change(+)`** or **`% change(-)`** shows a complete table with a new
**`Change`** column:

- **Adds a `Change` column** = `Value` − `Value (Past)` for each row, shown as a
  **bold highlight pill**: percentage-point delta for percentages (e.g.
  `-0.23pp`) or the raw net difference for plain numbers.
- **Color follows the direction you care about.** `(+)` = up is good (increases
  green), `(-)` = down is good (decreases green). Switching between `(+)` and
  `(-)` just recolors.

**Sort by change:** click the **`Change`** column header. Because all rows are
already collected, sorting is instant — first click sorts **high → low**, click
again for **low → high**. `Copy TSV` then copies the full table (with the
`Change` column) in the **current sort order**. `↺` Reset restores Mixpanel's
original table.

> The result is a fixed snapshot of the table (so the numbers stay put while you
> sort and copy). Use **`↺` Reset** whenever you want the live Mixpanel table back.

### 4. `% change` baseline on multi-metric cards
Cards that show several big numbers (KPI tiles, A/B variants, segment
breakdowns) get two buttons near the ellipsis menu that compare **all** metrics
in the card against a single baseline:

- **`% change(+)`** — uses the **smallest** value in the card as the baseline;
  every other metric's change is shown relative to it, with increases in green.
- **`% change(-)`** — uses the **largest** value as the baseline, with decreases
  in green (useful when *lower is better*, e.g. cost or drop-off).

Each metric keeps its number and adds a Mixpanel-style comparison underneath: the
relative `%` change, plus an `X compared to Y` note ending in the raw difference
as a **bold highlight pill** (green when favorable, red when not, grey at zero):

- Percentages → `61.79% compared to 61.66%` **`+0.13pp`** (percentage-point delta)
- Everything else → `8.11 compared to 7.78` **`+0.33`** (net difference)

### 5. Control-group baseline (A/B tests)
If any metric's label contains the word **`control`** (e.g. an experiment's
control segment), that metric is automatically used as the baseline instead of
the min/max — so every variant is compared against control. The `(+)` / `(-)`
buttons then only decide which direction is shown as green.

### 6. Already-compared cards
Some Mixpanel cards arrive already compared (the big value is itself a `%` change
with an "X compared to Y" note). Here the extension **keeps Mixpanel's own `%`**
and, when you press **`% change(+)` / `% change(-)`**, it:

- adds the raw difference as a **highlight pill on the "X compared to Y" line**
  (leaving the headline `%` untouched) — net difference for numbers
  (`8.11 compared to 7.78` **`+0.33`**) or the percentage-point delta for
  percentages (`61.79% compared to 61.66%` **`+0.13pp`**);
- recolors each value for your chosen direction — `(+)` = up is good, `(-)` =
  down is good.

### 7. Reset to original
A **`↺` Reset** icon sits next to the buttons on both tables and metric cards.
Click it to return that table or card to its **original view**, exactly as if no
button had been pressed. (Clicking the currently active `% change` button again
also reverts it.)

### 8. Legend text wrapping
Legend / segment labels that don't fit on one line **wrap** onto the next line
instead of being cut off with `…`, so you can read full names.

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

**Getting started:**

1. Open a Mixpanel report or board.
2. Buttons appear on each card automatically — no need to click anything. The
   extension also adds buttons to cards that finish loading later.

> If a card ever loads without buttons (rare, e.g. an unusual embedded frame),
> click the **Mixpanel Report Tools** toolbar icon to re-scan the page.

The exact buttons depend on the card. Below is what to do for each type.

### Transpose and copy a table
1. Find the table's **`⇄ Transpose`** button (to the right of the search row,
   next to the `...` menu, or just above the table).
2. Click it to flip rows ↔ columns in place. The button changes to **`Copy TSV`**.
3. Click **`Copy TSV`** to copy the whole table, then paste into Google Sheets or
   Excel.
4. Click **`↺`** to return to the original layout.

> You don't have to transpose to copy — see below for tables that expose a
> standalone `Copy TSV` button.

### Add a `Change` column and sort it (`Value (Past)` tables)
Use this when a table has a **`Value`** and a **`Value (Past)`** column and you
want the per-row difference.

1. Click **`% change(+)`** (up is good) or **`% change(-)`** (down is good). The
   extension collects **every** row in one pass and shows a full, static table
   with a new **`Change`** column (the difference per row, color-coded).
   - The pressed button briefly shows **`Collecting…`** while it gathers a large
     table — this is normal.
2. Switch between **`(+)`** and **`(-)`** any time to flip which direction is
   green — it just recolors, instantly.
3. Click the **`Change`** column header to **sort**: first click **high → low**,
   click again **low → high**.
4. Click **`Copy TSV`** to copy the complete table (including `Change`) in the
   current sort order.
5. Click **`↺`** to restore Mixpanel's original table.

### Compare metrics on a multi-metric card (`% change`)
Use this on cards that show several big numbers side by side.

1. Click **`% change(+)`** to compare every metric against the **smallest** value
   (increases green), or **`% change(-)`** to compare against the **largest**
   value (decreases green).
2. Read each metric's relative `%` change and the `X compared to Y` note, which
   ends in the raw difference as a colored pill — `+0.33` for numbers,
   `+0.13pp` for percentages.
3. Special cases handled automatically:
   - **Control group:** if a metric is labelled **`control`**, it becomes the
     baseline; `(+)` / `(-)` then only flip which direction is green.
   - **Already-compared cards:** Mixpanel's own headline `%` stays as-is;
     pressing a button just adds the raw-difference pill on the comparison line
     and recolors for your chosen direction.
4. Click **`↺`** (or the active `% change` button again) to revert.

### Reset anything
Every table and card with buttons also has a **`↺` Reset** icon. Click it to
return that card to its original view, as if you'd pressed nothing. Reloading the
page also resets everything.

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
