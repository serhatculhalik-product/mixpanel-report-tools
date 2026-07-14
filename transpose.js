(function () {
  // Injected into every frame. Handles two kinds of Mixpanel cards:
  //  1) Grid tables (.mp-data-table)          -> "Transpose" button
  //  2) Multi-metric cards (MultiMetricChart) -> "% change(+)" / "% change(-)" buttons

  // ---------- Shared helpers ----------

  // Collect all elements matching the selector, traversing shadow DOM too.
  function deepQueryAll(root, selector, out) {
    if (!root || !root.querySelectorAll) return out;
    var found = root.querySelectorAll(selector);
    for (var i = 0; i < found.length; i++) {
      if (out.indexOf(found[i]) === -1) out.push(found[i]);
    }
    var all = root.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      if (all[j].shadowRoot) deepQueryAll(all[j].shadowRoot, selector, out);
    }
    return out;
  }

  // Find the card container, crossing shadow DOM boundaries.
  function getCard(el) {
    var n = el;
    while (n) {
      if (
        n.nodeType === 1 &&
        n.classList &&
        (n.classList.contains("card-container") || n.classList.contains("card-root"))
      ) {
        return n;
      }
      if (n.nodeType === 11 && n.host) n = n.host;
      else if (n.parentNode) n = n.parentNode;
      else if (n.getRootNode && n.getRootNode().host) n = n.getRootNode().host;
      else n = null;
    }
    return null;
  }

  // Find the card's "..." (vertical ellipsis) menu; null if none.
  function findOverflowMenu(card) {
    if (!card || !card.querySelector) return null;
    var ov = card.querySelector(".card-overflow");
    if (ov) return ov;
    var icon = card.querySelector('svg-icon[icon="ellipsis"]');
    if (icon) return icon.closest(".card-action-item") || icon.parentElement;
    return null;
  }

  // Place a control to the left of the ellipsis (absolute) or above the target (block).
  function placeControl(node, host, overflow, fallbackBeforeEl, topDefault) {
    var win = (host && host.ownerDocument && host.ownerDocument.defaultView) || window;
    if (overflow && host) {
      try {
        if (win.getComputedStyle(host).position === "static") host.style.position = "relative";
      } catch (e) {}
      node.style.position = "absolute";
      node.style.zIndex = "99999";
      node.style.top = topDefault + "px";
      node.style.right = "48px";
      try {
        var hr = host.getBoundingClientRect();
        var or = overflow.getBoundingClientRect();
        if (or.width > 0 && hr.width > 0) {
          node.style.right = Math.max(8, Math.round(hr.right - or.left) + 6) + "px";
          node.style.top = Math.max(6, Math.round(or.top - hr.top)) + "px";
        }
      } catch (e) {}
      host.appendChild(node);
    } else {
      node.style.position = "relative";
      node.style.zIndex = "99999";
      if (fallbackBeforeEl && fallbackBeforeEl.parentNode) {
        fallbackBeforeEl.parentNode.insertBefore(node, fallbackBeforeEl);
      } else if (host) {
        host.appendChild(node);
      }
    }
  }

  function mkButton(doc, label) {
    var b = doc.createElement("button");
    b.type = "button"; // avoid implicit form submit inside Mixpanel forms
    b.textContent = label;
    b.style.cssText =
      "padding:3px 8px;font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;" +
      "color:#fff;background:#7856ff;border:none;border-radius:5px;cursor:pointer;" +
      "box-shadow:0 1px 3px rgba(0,0,0,.25);opacity:.9;white-space:nowrap;";
    b.addEventListener("mouseenter", function () { b.style.opacity = "1"; });
    b.addEventListener("mouseleave", function () { b.style.opacity = "0.9"; });
    return b;
  }

  // A small square icon button (e.g. the reset glyph).
  function mkIconButton(doc, glyph, title) {
    var b = mkButton(doc, glyph);
    b.title = title;
    b.setAttribute("aria-label", title);
    b.style.padding = "3px 7px";
    b.style.fontSize = "13px";
    b.style.lineHeight = "1";
    return b;
  }

  // ---------- Feature 1: Table transpose ----------

  // Find the ".pre-table-section" (search box row) that sits above this table,
  // crossing shadow boundaries. Returns null if the table has none.
  function findPreTableSection(table) {
    var n = table;
    for (var hops = 0; n && hops < 8; hops++) {
      if (n.querySelectorAll) {
        var pres = n.querySelectorAll(".pre-table-section");
        if (pres.length) return pres[0];
      }
      if (n.parentElement) n = n.parentElement;
      else if (n.getRootNode && n.getRootNode() && n.getRootNode().host) n = n.getRootNode().host;
      else n = n.parentNode;
    }
    return null;
  }

  // Dock the control bar at the far right of the pre-table section.
  function placeInPreSection(bar, pre) {
    pre.style.display = "flex";
    pre.style.alignItems = "center";
    pre.style.flexWrap = "wrap";
    pre.style.gap = pre.style.gap || "8px";
    bar.style.position = "static";
    bar.style.marginLeft = "auto";
    bar.style.zIndex = "99999";
    pre.appendChild(bar);
  }

  function addTableControl(table) {
    var doc = table.ownerDocument;
    var host = getCard(table);
    if (!host) {
      var rn = table.getRootNode && table.getRootNode();
      host = (rn && rn.host && rn.host.parentElement) || table.parentElement;
    }
    var overflow = findOverflowMenu(host);

    var bar = doc.createElement("div");
    bar.style.cssText = "display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;";
    var btn = mkButton(doc, "\u21C4 Transpose");
    bar.appendChild(btn);

    // Cohort tables (rows with checkboxes) get a one-click "select the real
    // segments" button: everything except "All*" and "Not In*". Hidden until the
    // table actually has cohort checkboxes (they can render a beat later).
    var bSel = mkButton(doc, "\u2611 A/B Cohorts");
    bSel.title =
      "Select all cohorts except those starting with \u201cAll\u201d or \u201cNot In\u201d";
    bSel.style.display = hasCohortCheckboxes(table) ? "" : "none";
    bar.appendChild(bSel);
    table.__mpSelBtn = bSel;

    // Tables with a "Value (Past)" column also get a per-row "Change" column.
    var vp = hasValuePast(table);
    var bPlus, bMinus, bCopy;
    if (vp) {
      bPlus = mkIconButton(doc, "\u2191", "% change \u00b7 higher is better (increases shown green)");
      bMinus = mkIconButton(doc, "\u2193", "% change \u00b7 lower is better (decreases shown green)");
      bCopy = mkButton(doc, "Copy TSV");
      bar.appendChild(bPlus);
      bar.appendChild(bMinus);
      bar.appendChild(bCopy);
    }

    var reset = mkIconButton(doc, "\u21BA", "Reset to original");
    // A "Value (Past)" table can be changed without transposing, so its reset is
    // always available; a plain table only needs reset once transposed.
    reset.style.display = vp ? "" : "none";
    bar.appendChild(reset);

    // Prefer docking to the far right of the pre-table search row when present;
    // otherwise fall back to the ellipsis menu / above the table.
    var pre = findPreTableSection(table);
    if (pre) placeInPreSection(bar, pre);
    else placeControl(bar, host, overflow, table, 10);

    function doTranspose(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var tsv = transposeTable(table);
      if (tsv == null) { btn.textContent = "Error"; return false; }
      btn.textContent = "Copy TSV";
      reset.style.display = "";
      btn.onclick = function (e2) {
        e2.preventDefault();
        e2.stopPropagation();
        copyTSV(doc, tsv, btn);
        return false;
      };
      return false;
    }

    btn.onclick = doTranspose;

    bSel.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      var n = selectCohortVariants(table);
      var prev = bSel.textContent;
      bSel.textContent = n ? "Selected \u2713" : "No change";
      setTimeout(function () { bSel.textContent = prev; }, 1400);
      return false;
    };

    if (vp) {
      bPlus.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        openComputedView(table, "min", bPlus, bMinus);
        return false;
      };
      bMinus.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        openComputedView(table, "max", bPlus, bMinus);
        return false;
      };
      bCopy.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        collectAndCopyTSV(table, bCopy, doc);
        return false;
      };
    }

    reset.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      resetTable(table);
      btn.textContent = "\u21C4 Transpose";
      btn.onclick = doTranspose;
      if (vp) setActive(bPlus, bMinus, null);
      reset.style.display = vp ? "" : "none";
      return false;
    };
  }

  // Snapshot the pristine markup once so Reset can restore the original view,
  // whether the change came from transposing or from the "Change" column.
  function snapshotTable(table) {
    if (table.__mpOrigHTML == null) {
      table.__mpOrigHTML = table.innerHTML;
      table.__mpOrigStyle = table.getAttribute("style") || "";
    }
  }

  // Restore a table (transposed and/or with a computed view) to its original view.
  function resetTable(table) {
    // Tear down any static computed/sorted view and unhide the original table.
    closeComputedView(table);
    // Transpose is destructive (it moves nodes and drops wrappers), so the only
    // way to undo it is to restore the pre-transpose markup snapshot.
    if (table.getAttribute("data-mp-transposed") === "1" && table.__mpOrigHTML != null) {
      table.innerHTML = table.__mpOrigHTML;
      if (table.__mpOrigStyle) table.setAttribute("style", table.__mpOrigStyle);
      else table.removeAttribute("style");
    }
    table.removeAttribute("data-mp-transposed");
    table.removeAttribute("data-mp-tsv");
  }

  // Spreadsheets (Google Sheets / Excel) treat a cell starting with = + @ as a
  // formula, so values like "+1.2pp" paste as a broken formula. Prefixing with an
  // apostrophe forces text; Sheets/Excel hide the apostrophe on paste.
  function tsvGuard(s) {
    return s && /^[=+@]/.test(s) ? "'" + s : s;
  }

  function transposeTable(table) {
    try {
      // Already transposed (e.g. by a previous injection): reuse the cached TSV.
      if (table.getAttribute("data-mp-transposed") === "1") {
        return table.getAttribute("data-mp-tsv") || "";
      }

      // Snapshot the pristine markup once so Reset can restore the original view.
      snapshotTable(table);
      var cells = [];
      var maxR = 0, maxC = 0;
      function place(el, off) {
        var ga = el.style.gridArea;
        if (!ga) return;
        var p = ga.split("/");
        var r = parseInt(p[0], 10) - 1;
        var c = parseInt(p[1], 10) - 1 + off;
        cells.push({ r: r, c: c, el: el });
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
      var fixed = table.querySelectorAll(
        ":scope > .fixed-columns > .mp-table-cell, :scope > .fixed-columns > .multimetric-footer-cell"
      );
      for (var i = 0; i < fixed.length; i++) place(fixed[i], 0);
      var scroll = table.querySelectorAll(
        ":scope > .scrollable-columns > .mp-table-cell, :scope > .scrollable-columns > .multimetric-footer-cell"
      );
      for (var j = 0; j < scroll.length; j++) place(scroll[j], 1);
      if (!cells.length) return null;

      var rows = maxR + 1, cols = maxC + 1;

      var textGrid = [];
      for (var a = 0; a < rows; a++) textGrid.push(new Array(cols).fill(""));
      for (var g = 0; g < cells.length; g++) {
        textGrid[cells[g].r][cells[g].c] = (cells[g].el.innerText || "").replace(/\s+/g, " ").trim();
      }
      var lines = [];
      for (var tc = 0; tc < cols; tc++) {
        var row = [];
        for (var tr = 0; tr < rows; tr++) row.push(tsvGuard(textGrid[tr][tc]));
        lines.push(row.join("\t"));
      }
      var tsv = lines.join("\n");

      for (var k = 0; k < cells.length; k++) {
        var el = cells[k].el;
        var prefix = el.querySelector(".header-title-prefix");
        if (prefix) prefix.insertAdjacentText("afterend", " ");
        var nr = cells[k].c + 1, nc = cells[k].r + 1;
        el.style.gridArea = nr + " / " + nc + " / " + (nr + 1) + " / " + (nc + 1);
        el.style.position = "static";
        table.appendChild(el);
      }
      var junk = table.querySelectorAll(
        ":scope > .fixed-columns, :scope > .scrollable-columns, :scope > .column-resize-handle"
      );
      for (var q = 0; q < junk.length; q++) junk[q].remove();

      table.style.display = "grid";
      table.style.setProperty("--data-table-columns", "none");
      table.style.gridTemplateColumns =
        "minmax(240px, max-content) repeat(" + (rows - 1) + ", minmax(110px, 1fr))";
      table.style.gridTemplateRows = "repeat(" + cols + ", auto)";
      table.style.width = "max-content";
      table.style.maxWidth = "100%";
      table.setAttribute("data-mp-transposed", "1");
      table.setAttribute("data-mp-tsv", tsv);
      return tsv;
    } catch (e) {
      console.error("Mixpanel Transposer transpose error:", e);
      return null;
    }
  }

  function copyTSV(doc, tsv, btn) {
    function ok() {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = "Copy TSV"; }, 1500);
    }
    function fallback() {
      var ta = doc.createElement("textarea");
      ta.value = tsv;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      doc.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { doc.execCommand("copy"); ok(); } catch (e) { btn.textContent = "Error"; }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(ok).catch(fallback);
    } else {
      fallback();
    }
  }

  // ---------- Feature 1b: "Change" column for Value / Value (Past) tables ----------

  function findScrollable(table) {
    return table.querySelector(":scope > .scrollable-columns");
  }

  // True when the table has a "Value (Past)" comparison column.
  function hasValuePast(table) {
    var sc = findScrollable(table);
    if (!sc) return false;
    var titles = sc.querySelectorAll(":scope > .mp-table-cell.title-cell");
    for (var i = 0; i < titles.length; i++) {
      if (/\(past\)/i.test((titles[i].textContent || ""))) return true;
    }
    return false;
  }

  // ----- Cohort selection: check every row except "All*" / "Not In*" -----

  // Cohort rows we never want auto-selected: the "All User Profiles" total and
  // any "Not In ..." inverse segment.
  function isExcludedCohort(txt) {
    return /^\s*(all|not\s+in)\b/i.test(txt || "");
  }

  // The toggle control inside a cell: a native checkbox, or a custom one
  // (role="checkbox" / [aria-checked]). Returns null when the cell has none.
  function cellCheckControl(cell) {
    var input = cell.querySelector('input[type="checkbox"]');
    if (input) return { el: input, native: true };
    var role = cell.querySelector('[role="checkbox"], [aria-checked]');
    if (role) return { el: role, native: false };
    return null;
  }

  function ctrlChecked(ctrl) {
    return ctrl.native
      ? !!ctrl.el.checked
      : (ctrl.el.getAttribute("aria-checked") || "").toLowerCase() === "true";
  }

  // Toggle a control the way a real user would. Native inputs flip on a plain
  // .click(); Mixpanel's custom role="checkbox" component often only reacts to a
  // full pointer/mouse sequence, so we dispatch that instead.
  function toggleControl(ctrl) {
    if (ctrl.native) { ctrl.el.click(); return; }
    var el = ctrl.el;
    var doc = el.ownerDocument;
    var win = (doc && doc.defaultView) || window;
    var types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      var isPointer = type.indexOf("pointer") === 0;
      var ev = null;
      try {
        var Ctor = isPointer && win.PointerEvent ? win.PointerEvent : win.MouseEvent;
        ev = new Ctor(type, { bubbles: true, cancelable: true, view: win });
      } catch (e) {
        try { ev = doc.createEvent("MouseEvents"); ev.initEvent(type, true, true); }
        catch (e2) { ev = null; }
      }
      if (ev) el.dispatchEvent(ev);
    }
  }

  // The label for a cohort row: this cell's own text, or (if the checkbox sits in
  // a cell of its own) the text of another cell on the same grid row.
  function rowLabel(table, cell) {
    var t = cellText(cell);
    if (t) return t;
    var rs = cell.style && cell.style.gridRowStart;
    if (!rs) return "";
    var cells = deepQueryAll(table, ".mp-table-cell", []);
    for (var i = 0; i < cells.length; i++) {
      if (cells[i] === cell) continue;
      if ((cells[i].style && cells[i].style.gridRowStart) !== rs) continue;
      var lt = cellText(cells[i]);
      if (lt) return lt;
    }
    return "";
  }

  // Every selectable cohort row {ctrl, label}. Skips header/title cells (so the
  // "select all" toggle is never touched) and rows with no readable label.
  function cohortRows(table) {
    var cells = deepQueryAll(table, ".mp-table-cell", []);
    var rows = [];
    var seen = [];
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.classList && cell.classList.contains("title-cell")) continue; // header
      if (cell.style && cell.style.gridRowStart === "1") continue; // header row
      var ctrl = cellCheckControl(cell);
      if (!ctrl) continue;
      if (seen.indexOf(ctrl.el) !== -1) continue;
      var label = rowLabel(table, cell);
      if (!label) continue;
      seen.push(ctrl.el);
      rows.push({ ctrl: ctrl, label: label });
    }
    return rows;
  }

  function hasCohortCheckboxes(table) {
    return cohortRows(table).length > 0;
  }

  // Select every cohort row except those starting with "All" or "Not In", and
  // deselect those two kinds. Clicks the control (not just .checked=) so React's
  // handlers run and Mixpanel updates the chart.
  function selectCohortVariants(table) {
    var rows = cohortRows(table);
    var changed = 0;
    for (var i = 0; i < rows.length; i++) {
      var want = !isExcludedCohort(rows[i].label);
      if (ctrlChecked(rows[i].ctrl) !== want) {
        try { toggleControl(rows[i].ctrl); changed++; } catch (e) {}
      }
    }
    return changed;
  }

  // Read the meaningful text of a table cell (header title / value), skipping
  // menus and checkboxes.
  function cellText(el) {
    var h = el.querySelector(".header-title-text");
    if (h) return (h.innerText || h.textContent || "").replace(/\s+/g, " ").trim();
    var ow = el.querySelector(".overflow-wrapper");
    if (ow) return (ow.innerText || ow.textContent || "").replace(/\s+/g, " ").trim();
    return (el.innerText || "").replace(/\s+/g, " ").trim();
  }

  // A highlighted pill for the change cell: green/red by the favorable direction
  // (min baseline -> increase is good; max baseline -> decrease is good).
  function changeChipHTML(text, diff, mode) {
    var fav = diff === 0 || !isFinite(diff) ? 0 : (mode === "max" ? diff < 0 : diff > 0) ? 1 : -1;
    var bg =
      fav > 0 ? "rgba(34,160,107,.20)" : fav < 0 ? "rgba(229,72,77,.20)" : "rgba(127,127,127,.18)";
    var fg = fav > 0 ? "#22a06b" : fav < 0 ? "#e5484d" : "inherit";
    return (
      '<span style="padding:1px 6px;border-radius:3px;font-weight:700;' +
      "font-variant-numeric:tabular-nums;background:" + bg + ";color:" + fg + ';">' +
      escapeHtml(text) + "</span>"
    );
  }

  // ----- Copy TSV for the whole (virtualized) table -----

  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  // Nearest vertically-scrollable ancestor (Mixpanel virtualizes long tables in
  // a scroll container), crossing shadow boundaries.
  function getScrollContainer(el) {
    var win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    var n = el.parentElement || el.parentNode;
    while (n && n.nodeType === 1) {
      try {
        var oy = win.getComputedStyle(n).overflowY;
        if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 4) return n;
      } catch (e) {}
      if (n.parentElement) n = n.parentElement;
      else if (n.getRootNode && n.getRootNode().host) n = n.getRootNode().host;
      else n = n.parentNode;
      if (n && n.nodeType === 11) n = n.host;
    }
    return null;
  }

  // Merge the currently-rendered rows into the table's row cache (keyed by the
  // absolute grid row/column index, so scrolling fills in the full dataset).
  function accumulateRows(table, cache) {
    var fixed = table.querySelector(":scope > .fixed-columns");
    var fixedCols = 0;
    if (fixed) {
      var fc = fixed.querySelectorAll(":scope > .mp-table-cell");
      for (var i = 0; i < fc.length; i++) {
        var cc = parseInt(fc[i].style.gridColumnStart, 10);
        if (isFinite(cc) && cc > fixedCols) fixedCols = cc;
      }
    }
    function store(el, off) {
      if (el.getAttribute("data-mp-vp-cell") === "1" || el.getAttribute("data-mp-vp-header") === "1") return;
      var r = parseInt(el.style.gridRowStart, 10);
      var c = parseInt(el.style.gridColumnStart, 10) + off;
      if (!isFinite(r) || !isFinite(c)) return;
      cache.rows[r] = cache.rows[r] || {};
      cache.rows[r][c] = cellText(el);
      if (c > cache.cols) cache.cols = c;
    }
    if (fixed) {
      var fcells = fixed.querySelectorAll(":scope > .mp-table-cell");
      for (var a = 0; a < fcells.length; a++) store(fcells[a], 0);
    }
    var sc = findScrollable(table);
    if (sc) {
      var scells = sc.querySelectorAll(":scope > .mp-table-cell");
      for (var b = 0; b < scells.length; b++) store(scells[b], fixedCols);
    }
  }

  // Locate the current/past value columns (combined indices) from the header row.
  function valuePastCols(cache) {
    var header = cache.rows[1] || {};
    var pastC = null;
    for (var c = 1; c <= cache.cols; c++) if (/\(past\)/i.test(header[c] || "")) pastC = c;
    return { pastC: pastC, curC: pastC != null ? pastC - 1 : null };
  }

  // Change for a data row: {num, text} = current Value - Value (Past).
  function rowChange(row, curC, pastC) {
    var curTxt = row[curC], pastTxt = row[pastC];
    if (curTxt == null || pastTxt == null) return { num: NaN, text: "" };
    var isPct = /%/.test(curTxt) || /%/.test(pastTxt);
    var d = parseNum(curTxt) - parseNum(pastTxt);
    return { num: d, text: isFinite(d) ? (isPct ? fmtPP(d) : fmtDiff(d)) : "" };
  }

  // Sortable value for a data row on the active sort column. `sortCol` is either
  // "change" (current - past) or a numeric grid-column index (that column's value).
  function rowSortNum(row, curC, pastC, sortCol) {
    if (sortCol == null || sortCol === "change") return rowChange(row, curC, pastC).num;
    return parseNum(row[+sortCol]);
  }

  // Data row keys (>=2) optionally sorted by the active column; header (1)
  // handled separately. `sortCol` selects which column to sort by ("change" or a
  // numeric column index); defaults to "change".
  function orderedRowKeys(cache, curC, pastC, sortDir, sortCol) {
    var keys = Object.keys(cache.rows).map(Number).filter(function (k) { return k >= 2; });
    var byChange = sortCol == null || sortCol === "change";
    if (!sortDir || (byChange && (curC == null || pastC == null))) {
      return keys.sort(function (x, y) { return x - y; });
    }
    keys.sort(function (x, y) {
      var a = rowSortNum(cache.rows[x], curC, pastC, sortCol);
      var b = rowSortNum(cache.rows[y], curC, pastC, sortCol);
      var af = isFinite(a), bf = isFinite(b);
      if (!af && !bf) return x - y;
      if (!af) return 1;
      if (!bf) return -1;
      return sortDir === "asc" ? a - b : b - a;
    });
    return keys;
  }

  function tsvFromCache(table, cache, sortDir, sortCol) {
    var cols = cache.cols;
    var mode = table.getAttribute("data-mp-vp-mode");
    var vp = valuePastCols(cache);
    var addChange = mode && vp.pastC != null && vp.curC != null;
    var dataKeys = orderedRowKeys(cache, vp.curC, vp.pastC, sortDir, sortCol);

    var lines = [];
    // Header first.
    if (cache.rows[1]) {
      var h = [];
      for (var hc = 1; hc <= cols; hc++) h.push(tsvGuard(cache.rows[1][hc] != null ? cache.rows[1][hc] : ""));
      if (addChange) h.push("Change");
      lines.push(h.join("\t"));
    }
    for (var i = 0; i < dataKeys.length; i++) {
      var row = cache.rows[dataKeys[i]];
      var arr = [];
      for (var cc = 1; cc <= cols; cc++) arr.push(tsvGuard(row[cc] != null ? row[cc] : ""));
      if (addChange) arr.push(tsvGuard(rowChange(row, vp.curC, vp.pastC).text));
      lines.push(arr.join("\t"));
    }
    return lines.join("\n");
  }

  // The last row index Mixpanel lays out for this table. Sticky/segment blocks
  // span the full grid (grid-row-end covers every row) even while the body is
  // virtualized, so the largest grid-row-end tells us how many rows exist.
  function expectedLastRow(table) {
    var max = 0;
    var groups = [table.querySelector(":scope > .fixed-columns"), findScrollable(table)];
    for (var g = 0; g < groups.length; g++) {
      var el = groups[g];
      if (!el) continue;
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) {
        var re = parseInt(kids[i].style.gridRowEnd, 10);
        if (isFinite(re) && re > max) max = re;
      }
    }
    return max > 0 ? max - 1 : 0; // grid-row-end is exclusive
  }

  // The currently-rendered body cell with the highest row index (deepest row).
  function lastRenderedRow(table) {
    var best = null, bestR = -1;
    var groups = [findScrollable(table), table.querySelector(":scope > .fixed-columns")];
    for (var g = 0; g < groups.length; g++) {
      var el = groups[g];
      if (!el) continue;
      var cells = el.querySelectorAll(":scope > .mp-table-cell.body-cell");
      for (var i = 0; i < cells.length; i++) {
        var rs = parseInt(cells[i].style.gridRowStart, 10);
        if (isFinite(rs) && rs > bestR) { bestR = rs; best = cells[i]; }
      }
    }
    return best;
  }

  function maxCachedRow(cache) {
    var mx = 0;
    for (var k in cache.rows) { var n = +k; if (n > mx) mx = n; }
    return mx;
  }

  // Collect EVERY row of a virtualized table. Mixpanel only keeps the on-screen
  // rows in the DOM, so we drive the virtualizer by scrolling the last rendered
  // row into view (works regardless of which/where the scroll container is),
  // accumulating as we go, until we reach the known last row (from the grid) or
  // no new rows appear. Scroll positions are restored afterwards.
  function sweepCollect(table) {
    return new Promise(function (resolve) {
      var cache = { cols: 0, rows: {} };
      accumulateRows(table, cache);

      var win = (table.ownerDocument && table.ownerDocument.defaultView) || window;
      var scroller = getScrollContainer(table);
      var prevScroll = scroller ? scroller.scrollTop : null;
      var prevWinY = win.scrollY || 0;
      var target = expectedLastRow(table);

      (async function () {
        try {
          var stale = 0, lastMax = maxCachedRow(cache), guard = 0;
          while (guard++ < 4000) {
            if (target > 1 && maxCachedRow(cache) >= target) break;

            var last = lastRenderedRow(table);
            if (!last) break;
            try { last.scrollIntoView({ block: "end", inline: "nearest" }); }
            catch (e) { try { last.scrollIntoView(); } catch (e2) {} }
            // Also nudge the detected scroller in case scrollIntoView is a no-op
            // (e.g. the row is already at the container edge).
            if (scroller) {
              var step = Math.max(80, Math.floor(scroller.clientHeight * 0.6));
              scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + step);
            }
            await sleep(110);
            accumulateRows(table, cache);

            var mx = maxCachedRow(cache);
            if (mx <= lastMax) { if (++stale >= 4) break; }
            else { stale = 0; lastMax = mx; }
          }
        } catch (e) {
          console.error("Mixpanel Transposer collect error:", e);
        }
        if (scroller && prevScroll != null) scroller.scrollTop = prevScroll;
        try { win.scrollTo(0, prevWinY); } catch (e) {}
        resolve(cache);
      })();
    });
  }

  // Copy the FULL table (all virtualized rows). Sorted to match the on-screen
  // sorted view when one is active.
  function collectAndCopyTSV(table, btn, doc) {
    // If the computed view is open we already have the full dataset cached, so
    // copy straight from it (in the current sort order) — no re-sweep needed.
    if (table.__mpSortCache) {
      copyTSV(
        doc,
        tsvFromCache(
          table,
          table.__mpSortCache,
          table.getAttribute("data-mp-vp-sort"),
          table.getAttribute("data-mp-vp-sortcol")
        ),
        btn
      );
      return;
    }
    var label = btn.textContent;
    btn.textContent = "Copying\u2026";
    sweepCollect(table).then(function (cache) {
      btn.textContent = label;
      copyTSV(
        doc,
        tsvFromCache(
          table,
          cache,
          table.getAttribute("data-mp-vp-sort"),
          table.getAttribute("data-mp-vp-sortcol")
        ),
        btn
      );
    });
  }

  // ----- Computed "Change" view: collect the whole list once, render it all -----
  //
  // Mixpanel virtualizes long tables (only the visible rows exist in the DOM), so
  // computing the Change column on the live grid meant recomputing on every
  // scroll — fragile, and it interfered with sorting/copying. Instead we sweep
  // the whole table ONCE when % change is pressed, then render a complete, static
  // table with the Change column. Sorting and Copy TSV then work off that cached
  // dataset with no further scrolling. Reset restores Mixpanel's original table.

  // Entry point from the % change(+/-) buttons. `mode` sets the favorable color
  // direction (min -> up is good, max -> down is good).
  function openComputedView(table, mode, bPlus, bMinus) {
    if (table.getAttribute("data-mp-vp-sorting") === "1") return;

    // Clicking the already-active mode toggles the view off.
    if (table.__mpSortCache && table.getAttribute("data-mp-vp-mode") === mode) {
      closeComputedView(table);
      setActive(bPlus, bMinus, null);
      return;
    }
    // View already open: just switch the color direction, keep data + sort.
    if (table.__mpSortCache) {
      table.setAttribute("data-mp-vp-mode", mode);
      renderComputedView(table);
      setActive(bPlus, bMinus, mode);
      return;
    }

    // First open: collect every row in one pass, then render (original order).
    table.setAttribute("data-mp-vp-sorting", "1");
    var pending = mkBusy(bPlus, bMinus, mode);
    sweepCollect(table).then(function (cache) {
      table.removeAttribute("data-mp-vp-sorting");
      pending();
      if (!cache.cols || !cache.rows[1]) return;
      table.__mpSortCache = cache;
      table.setAttribute("data-mp-vp-mode", mode);
      table.removeAttribute("data-mp-vp-sort"); // original order until a header is clicked
      table.removeAttribute("data-mp-vp-sortcol");
      renderComputedView(table);
      setActive(bPlus, bMinus, mode);
    });
  }

  // Show a brief busy label on the pressed button while the sweep runs.
  function mkBusy(bPlus, bMinus, mode) {
    var btn = mode === "max" ? bMinus : bPlus;
    if (!btn) return function () {};
    var prev = btn.textContent;
    btn.textContent = "Collecting\u2026";
    return function () { btn.textContent = prev; };
  }

  // Clicking a sortable header (Change / Value / Value (Past)) sorts the cached
  // dataset by that column. Clicking a new column starts high->low; clicking the
  // active column again flips to low->high, then back. No re-sweep — everything
  // is already collected.
  function toggleSort(table, sortCol) {
    if (!table.__mpSortCache) return;
    sortCol = sortCol || "change";
    var curCol = table.getAttribute("data-mp-vp-sortcol") || "change";
    var cur = table.getAttribute("data-mp-vp-sort");
    if (curCol !== sortCol || !cur) {
      table.setAttribute("data-mp-vp-sort", "desc");
    } else {
      table.setAttribute("data-mp-vp-sort", cur === "desc" ? "asc" : "desc");
    }
    table.setAttribute("data-mp-vp-sortcol", sortCol);
    renderComputedView(table);
  }

  // (Re)build the static table from the cache using the current mode + sort, and
  // swap it in for Mixpanel's live table (hidden, restored on reset).
  function renderComputedView(table) {
    var cache = table.__mpSortCache;
    if (!cache) return;
    var node = buildComputedTable(
      table,
      cache,
      table.getAttribute("data-mp-vp-mode") || "min",
      table.getAttribute("data-mp-vp-sort") || null,
      table.getAttribute("data-mp-vp-sortcol") || "change"
    );
    if (!node) return;
    if (table.__mpSortedView && table.__mpSortedView.parentNode) table.__mpSortedView.remove();
    var container =
      (table.closest && table.closest(".mp-data-table-container")) || table.parentElement || table;
    if (!table.__mpHidden) {
      table.__mpHidden = container;
      container.style.display = "none";
    }
    container.parentNode.insertBefore(node, container.nextSibling);
    table.__mpSortedView = node;
  }

  function closeComputedView(table) {
    if (table.__mpSortedView && table.__mpSortedView.parentNode) table.__mpSortedView.remove();
    table.__mpSortedView = null;
    table.__mpSortCache = null;
    if (table.__mpHidden) {
      table.__mpHidden.style.display = "";
      table.__mpHidden = null;
    }
    table.removeAttribute("data-mp-vp-mode");
    table.removeAttribute("data-mp-vp-sort");
    table.removeAttribute("data-mp-vp-sortcol");
    table.removeAttribute("data-mp-vp-sorting");
  }

  // Arrow suffix for a sortable header: the active column shows its direction
  // (↑/↓), the rest show a neutral ↕ hint.
  function sortArrow(colId, sortCol, sortDir) {
    if (sortDir && colId === (sortCol || "change")) {
      return sortDir === "asc" ? " \u2191" : " \u2193";
    }
    return " \u2195";
  }

  // A clean, dark, static table built from the collected cache. `sortDir` null =
  // original row order; "desc"/"asc" = sorted by `sortCol` ("change" or a numeric
  // column index for Value / Value (Past)).
  function buildComputedTable(table, cache, mode, sortDir, sortCol) {
    var doc = table.ownerDocument;
    var cols = cache.cols;
    if (!cols || !cache.rows[1]) return null;
    sortCol = sortCol || "change";
    var vp = valuePastCols(cache);
    var dataKeys = orderedRowKeys(cache, vp.curC, vp.pastC, sortDir, sortCol);

    var wrap = doc.createElement("div");
    wrap.setAttribute("data-mp-computed-view", "1");
    wrap.style.cssText =
      "max-height:520px;overflow:auto;border:1px solid rgba(127,127,127,.25);" +
      "border-radius:8px;margin:8px 0;font:500 13px -apple-system,Segoe UI,Roboto,sans-serif;";

    var tbl = doc.createElement("table");
    tbl.style.cssText = "border-collapse:collapse;width:100%;color:inherit;";

    var thead = doc.createElement("thead");
    var htr = doc.createElement("tr");
    function th(label, clickable, alignRight) {
      var c = doc.createElement("th");
      c.textContent = label;
      c.style.cssText =
        "position:sticky;top:0;background:#20232a;color:#e8eaed;text-align:" +
        (alignRight ? "right" : "left") + ";padding:8px 12px;white-space:nowrap;" +
        "border-bottom:1px solid rgba(127,127,127,.3);font-weight:600;" +
        (clickable ? "cursor:pointer;user-select:none;" : "");
      return c;
    }
    // Bind a header cell to sort by `colId` (a numeric column index or "change").
    function makeSortable(cell, colId) {
      cell.title = "Sort by this column (click to flip direction)";
      cell.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSort(table, colId);
        return false;
      };
    }
    for (var c = 1; c <= cols; c++) {
      var isNumCol = c === vp.curC || c === vp.pastC;
      var baseLabel = cache.rows[1][c] != null ? cache.rows[1][c] : "";
      if (isNumCol) {
        // Value / Value (Past) columns are sortable, just like Change.
        var vth = th(baseLabel + sortArrow(String(c), sortCol, sortDir), true, true);
        makeSortable(vth, String(c));
        htr.appendChild(vth);
      } else {
        htr.appendChild(th(baseLabel, false, false));
      }
    }
    var changeTh = th("Change" + sortArrow("change", sortCol, sortDir), true, true);
    makeSortable(changeTh, "change");
    htr.appendChild(changeTh);
    thead.appendChild(htr);
    tbl.appendChild(thead);

    var tbody = doc.createElement("tbody");
    for (var i = 0; i < dataKeys.length; i++) {
      var row = cache.rows[dataKeys[i]];
      var tr = doc.createElement("tr");
      tr.style.cssText = "border-bottom:1px solid rgba(127,127,127,.12);";
      for (var cc = 1; cc <= cols; cc++) {
        var td = doc.createElement("td");
        var right = cc === vp.curC || cc === vp.pastC;
        td.style.cssText =
          "padding:6px 12px;white-space:nowrap;text-align:" + (right ? "right" : "left") +
          ";font-variant-numeric:tabular-nums;";
        td.textContent = row[cc] != null ? row[cc] : "";
        tr.appendChild(td);
      }
      var ch = rowChange(row, vp.curC, vp.pastC);
      var ctd = doc.createElement("td");
      ctd.style.cssText = "padding:6px 12px;text-align:right;white-space:nowrap;";
      ctd.innerHTML = ch.text ? changeChipHTML(ch.text, ch.num, mode) : "";
      tr.appendChild(ctd);
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    return wrap;
  }

  // ---------- Feature 2: % change on metric cards ----------

  function parseNum(txt) {
    if (txt == null) return NaN;
    var s = ("" + txt).trim();
    var mult = 1;
    var m = s.match(/([kmb])\s*$/i);
    if (m) {
      var u = m[1].toLowerCase();
      mult = u === "k" ? 1e3 : u === "m" ? 1e6 : 1e9;
    }
    s = s.replace(/[^0-9.\-]/g, "");
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n * mult;
  }

  function fmtPct(x) {
    if (!isFinite(x)) return "\u2014";
    var v = Math.round(x * 100) / 100;
    var str = v.toFixed(2);
    if (str.indexOf(".") >= 0) str = str.replace(/\.?0+$/, "");
    return (v > 0 ? "+" : "") + str + "%";
  }

  function fmtPP(x) {
    if (!isFinite(x)) return "\u2014";
    var v = Math.round(x * 100) / 100;
    var str = v.toFixed(2);
    if (str.indexOf(".") >= 0) str = str.replace(/\.?0+$/, "");
    return (v > 0 ? "+" : "") + str + "pp";
  }

  function fmtDiff(x) {
    if (!isFinite(x)) return "\u2014";
    var v = Math.round(x * 100) / 100;
    var str = v.toFixed(2);
    if (str.indexOf(".") >= 0) str = str.replace(/\.?0+$/, "");
    return (v > 0 ? "+" : "") + str;
  }

  function colorFor(x, mode) {
    if (x === 0 || !isFinite(x)) return "#8a8f98";
    // The chosen "good" direction is green:
    //  min baseline ("% change(+)") -> an increase is good
    //  max baseline ("% change(-)") -> a decrease is good
    var favorable = mode === "max" ? x < 0 : x > 0;
    return favorable ? "#22a06b" : "#e5484d";
  }

  function escapeHtml(s) {
    return ("" + s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function chip(s) {
    return (
      '<span style="background:rgba(127,127,127,.18);padding:1px 6px;border-radius:3px;' +
      'font-variant-numeric:tabular-nums;">' + escapeHtml(s == null ? "" : s) + "</span>"
    );
  }

  // A colored, bold highlight pill for the raw difference. Colored by the chosen
  // favorable direction (same rule as the main value), so the pill always matches
  // the headline value's color: green = favorable, red = unfavorable, grey = zero.
  function diffChipHTML(text, diff, mode) {
    var fav = diff === 0 || !isFinite(diff) ? 0 : (mode === "max" ? diff < 0 : diff > 0) ? 1 : -1;
    var bg =
      fav > 0 ? "rgba(34,160,107,.20)" : fav < 0 ? "rgba(229,72,77,.20)" : "rgba(127,127,127,.18)";
    var fg = fav > 0 ? "#22a06b" : fav < 0 ? "#e5484d" : "inherit";
    return (
      '<span data-mp-cmp-extra="1" style="margin-left:6px;padding:1px 6px;border-radius:3px;' +
      "font-weight:700;font-variant-numeric:tabular-nums;background:" + bg + ";color:" + fg + ';">' +
      escapeHtml(text) + "</span>"
    );
  }

  // Parse a CSS color ("rgb(...)", "rgba(...)", "#rgb", "#rrggbb") to {r,g,b}.
  function parseColor(str) {
    if (!str) return null;
    var m = ("" + str).match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(",");
      var r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
      if (isFinite(r) && isFinite(g) && isFinite(b)) {
        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
      }
    }
    var h6 = ("" + str).match(/^#?([0-9a-f]{6})$/i);
    if (h6) {
      var n = parseInt(h6[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var h3 = ("" + str).match(/^#?([0-9a-f]{3})$/i);
    if (h3) {
      var s = h3[1];
      return {
        r: parseInt(s[0] + s[0], 16),
        g: parseInt(s[1] + s[1], 16),
        b: parseInt(s[2] + s[2], 16),
      };
    }
    return null;
  }

  // Classify a color as favorable (green, +1), unfavorable (red, -1), or neutral
  // (0). Used to read the directionality Mixpanel already baked into a value's
  // color. Threshold keeps greys/whites (equal channels) neutral.
  function favorFromColor(rgb) {
    if (!rgb) return 0;
    if (rgb.g - rgb.r > 20 && rgb.g - rgb.b > -10) return 1;
    if (rgb.r - rgb.g > 20 && rgb.r - rgb.b > -10) return -1;
    return 0;
  }

  // Read the meaningful (green/red) color of a value element. Mixpanel sometimes
  // colors an inner span rather than the value node itself, so if the element's
  // own computed color is neutral we scan descendants for the first favorable/
  // unfavorable color.
  function readValueColor(el, win) {
    var c = "";
    try { c = win.getComputedStyle(el).color; } catch (e) {}
    if (favorFromColor(parseColor(c))) return c;
    var kids = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (var i = 0; i < kids.length; i++) {
      var cc = "";
      try { cc = win.getComputedStyle(kids[i]).color; } catch (e) {}
      if (favorFromColor(parseColor(cc))) return cc;
    }
    return c;
  }

  // Difference pill colored to EXACTLY match a given CSS color (with a translucent
  // background of the same hue). Used when we mirror Mixpanel's own value color.
  function diffChipFromColor(text, cssColor) {
    var rgb = parseColor(cssColor);
    var bg = rgb
      ? "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",.20)"
      : "rgba(127,127,127,.18)";
    return (
      '<span data-mp-cmp-extra="1" style="margin-left:6px;padding:1px 6px;border-radius:3px;' +
      "font-weight:700;font-variant-numeric:tabular-nums;background:" + bg + ";color:" +
      (cssColor || "inherit") + ';">' +
      escapeHtml(text) + "</span>"
    );
  }

  // Wrap legend/segment text to the next line instead of truncating it.
  function relaxWrap(el) {
    if (!el || !el.style) return;
    el.style.setProperty("white-space", "normal", "important");
    el.style.setProperty("overflow", "visible", "important");
    el.style.setProperty("text-overflow", "clip", "important");
    el.style.setProperty("max-width", "100%", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("word-break", "break-word", "important");
  }

  function relaxLegend(tnode) {
    relaxWrap(tnode);
    var n = tnode.parentElement,
      hops = 0;
    while (n && hops < 6) {
      var cls = (n.getAttribute && n.getAttribute("class")) || "";
      if (
        /_legend-segment_|_legend-line_|_legend-container_|_chart-theme-table_|_segment-name-container_|_segment-text_/.test(
          cls
        )
      ) {
        relaxWrap(n);
        if (n.classList && n.classList.contains("truncated")) n.classList.remove("truncated");
      }
      n = n.parentElement;
      hops++;
    }
  }

  // Read a metric's legend/segment label (e.g. "Market_Search_LTR_V3 control").
  function metricLabel(container) {
    var seg = container.querySelector('[class*="_segment-text_"]');
    if (seg) {
      var t = (seg.textContent || "").trim();
      if (t) return t;
    }
    var titled = container.querySelector("[title]");
    if (titled) return (titled.getAttribute("title") || "").trim();
    return "";
  }

  function collectMetrics(scope) {
    var out = [];
    var ms = scope.querySelectorAll('[data-sentry-component="MetricChart"]');
    if (!ms.length) ms = scope.querySelectorAll('[class*="_metric-container_"]');
    for (var i = 0; i < ms.length; i++) {
      var v = ms[i].querySelector('[class*="_value_"]');
      if (v) out.push({ container: ms[i], valueEl: v, label: metricLabel(ms[i]) });
    }
    return out;
  }

  function addMetricControl(row) {
    if (row.getAttribute("data-mp-metric-ctrl") === "1") return false;
    var metrics = collectMetrics(row);
    if (metrics.length < 2) return false; // need at least 2 metrics

    // Are there at least 2 parseable numbers?
    var okCount = 0;
    for (var i = 0; i < metrics.length; i++) {
      if (isFinite(parseNum(metrics[i].valueEl.textContent))) okCount++;
    }
    if (okCount < 2) return false;

    row.setAttribute("data-mp-metric-ctrl", "1");

    var doc = row.ownerDocument;
    var host = getCard(row) || row;
    var overflow = findOverflowMenu(host);

    var bar = doc.createElement("div");
    bar.style.cssText = "display:inline-flex;gap:6px;align-items:center;";
    var bPlus = mkIconButton(doc, "\u2191", "% change \u00b7 higher is better (increases shown green)");
    var bMinus = mkIconButton(doc, "\u2193", "% change \u00b7 lower is better (decreases shown green)");
    var bReset = mkIconButton(doc, "\u21BA", "Reset to original");
    bar.appendChild(bPlus);
    bar.appendChild(bMinus);
    bar.appendChild(bReset);

    placeControl(bar, host, overflow, row, 10);
    if (!overflow) bar.style.margin = "8px 0 0 8px";

    bPlus.onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleMode(row, "min", bPlus, bMinus); return false; };
    bMinus.onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggleMode(row, "max", bPlus, bMinus); return false; };
    bReset.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      revertMetrics(row);
      row.removeAttribute("data-mp-metric-mode");
      // Don't let the automatic inference re-apply after an explicit reset.
      row.setAttribute("data-mp-auto-done", "1");
      setActive(bPlus, bMinus, null);
      return false;
    };
    // Keep the direction buttons reachable so the automatic pass can reflect the
    // inferred direction in their active state.
    row.__mpDirBtns = { plus: bPlus, minus: bMinus };
    return true;
  }

  // Infer whether higher or lower is better for a natively-compared card from the
  // color Mixpanel already applied to its relative % change value. Returns "min"
  // (up is good), "max" (down is good), or null when it can't be determined.
  function inferModeFromCard(scope) {
    var win = (scope.ownerDocument && scope.ownerDocument.defaultView) || window;
    var metrics = collectMetrics(scope);
    for (var i = 0; i < metrics.length; i++) {
      var note = findComparisonNote(metrics[i].container);
      if (!note) continue;
      var favor = favorFromColor(parseColor(readValueColor(metrics[i].valueEl, win)));
      if (!favor) continue; // this metric is neutral/uncolored; try the next one
      var m = (note.textContent || "").match(
        /([-\d.,]+\s*%?)\s*compared to\s*([-\d.,]+\s*%?)/i
      );
      if (!m) continue;
      var a = parseNum(m[1]), b = parseNum(m[2]);
      if (!isFinite(a) || !isFinite(b) || a === b) continue;
      // The value moved up (a>b) or down; Mixpanel colored it good (favor>0) or
      // bad. From that, "up is good" iff an up-move is the one colored good.
      var upIsGood = a > b ? favor > 0 : favor < 0;
      return upIsGood ? "min" : "max";
    }
    return null;
  }

  // For a controlled card that already has a native "compared to" comparison,
  // show the absolute difference automatically using the inferred direction —
  // once. Skips cards the user has already configured or reset, and cards where
  // the direction can't be inferred (those keep the manual buttons).
  function autoApplyDirection(row) {
    if (row.getAttribute("data-mp-auto-done") === "1") return;
    if (row.getAttribute("data-mp-metric-ctrl") !== "1") return;
    if (row.getAttribute("data-mp-metric-mode")) {
      row.setAttribute("data-mp-auto-done", "1"); // user already chose a direction
      return;
    }
    if (!hasNativeComparison(row)) return; // no color to infer from -> manual only
    var mode = inferModeFromCard(row);
    if (!mode) return; // values may still be loading; retry on a later scan
    renderCompared(row, mode);
    row.setAttribute("data-mp-metric-mode", mode);
    row.setAttribute("data-mp-auto-done", "1");
    if (row.__mpDirBtns) setActive(row.__mpDirBtns.plus, row.__mpDirBtns.minus, mode);
  }

  function setActive(bPlus, bMinus, mode) {
    var pairs = [[bPlus, "min"], [bMinus, "max"]];
    for (var i = 0; i < pairs.length; i++) {
      var on = pairs[i][1] === mode;
      pairs[i][0].style.outline = on ? "2px solid #fff" : "none";
      pairs[i][0].style.background = on ? "#5b3fd6" : "#7856ff";
    }
  }

  function toggleMode(row, mode, bPlus, bMinus) {
    var cur = row.getAttribute("data-mp-metric-mode");
    if (cur === mode) {
      revertMetrics(row);
      row.removeAttribute("data-mp-metric-mode");
      // Turning it off is an explicit choice; don't let auto-apply bring it back.
      row.setAttribute("data-mp-auto-done", "1");
      setActive(bPlus, bMinus, null);
      return;
    }
    if (hasNativeComparison(row)) renderCompared(row, mode);
    else renderMetrics(row, mode);
    row.setAttribute("data-mp-metric-mode", mode);
    setActive(bPlus, bMinus, mode);
  }

  function renderMetrics(scope, mode) {
    var doc = scope.ownerDocument;
    var metrics = collectMetrics(scope);
    if (metrics.length < 2) return;

    // Store originals + read the numbers
    for (var i = 0; i < metrics.length; i++) {
      var v = metrics[i].valueEl;
      if (!v.hasAttribute("data-mp-orig")) {
        v.setAttribute("data-mp-orig", v.innerHTML);
        v.setAttribute("data-mp-otext", (v.textContent || "").trim());
        v.setAttribute("data-mp-num", parseNum(v.textContent));
      }
    }

    // ALL metrics in the card are one group: baseline is the min/max of them all
    renderChunk(doc, metrics, mode);
  }

  function renderChunk(doc, chunk, mode) {
    var nums = [];
    for (var i = 0; i < chunk.length; i++) {
      var n = parseFloat(chunk[i].valueEl.getAttribute("data-mp-num"));
      if (isFinite(n)) nums.push(n);
    }
    if (nums.length < 1) return;

    // Baseline: prefer a metric whose label contains "control" (e.g. the A/B
    // control group). If there is none, fall back to the min ("+") or max ("-").
    var base = null;
    var baseText = "";
    for (var c = 0; c < chunk.length; c++) {
      var cn = parseFloat(chunk[c].valueEl.getAttribute("data-mp-num"));
      if (isFinite(cn) && /control/i.test(chunk[c].label || "")) {
        base = cn;
        baseText = chunk[c].valueEl.getAttribute("data-mp-otext");
        break;
      }
    }
    if (base === null) {
      base = mode === "min" ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
      for (var b = 0; b < chunk.length; b++) {
        if (parseFloat(chunk[b].valueEl.getAttribute("data-mp-num")) === base) {
          baseText = chunk[b].valueEl.getAttribute("data-mp-otext");
          break;
        }
      }
    }

    for (var k = 0; k < chunk.length; k++) {
      var mt = chunk[k];
      var el = mt.valueEl;
      var val = parseFloat(el.getAttribute("data-mp-num"));
      if (!isFinite(val)) continue;

      var change = base === 0 ? 0 : ((val - base) / Math.abs(base)) * 100;
      var isPct = /%/.test(el.getAttribute("data-mp-otext") || "");
      var extra = isPct ? fmtPP(val - base) : fmtDiff(val - base);
      // Big value shows only the % change; the raw difference goes in
      // parentheses on the "X compared to Y" line below.
      el.innerHTML = escapeHtml(fmtPct(change));
      el.style.color = colorFor(change, mode);

      var old = mt.container.querySelector("[data-mp-change-note]");
      if (old) old.remove();

      var note = doc.createElement("div");
      note.setAttribute("data-mp-change-note", "1");
      note.style.cssText =
        "margin-top:4px;font:500 12px -apple-system,Segoe UI,Roboto,sans-serif;" +
        "color:#9aa0a6;text-align:center;";
      note.innerHTML =
        chip(el.getAttribute("data-mp-otext")) +
        " compared to " +
        chip(baseText) +
        diffChipHTML(extra, val - base, mode);

      var mainVal = mt.container.querySelector('[data-sentry-component="renderMainValue"]') || el.parentElement;
      if (mainVal && mainVal.parentNode) mainVal.parentNode.insertBefore(note, mainVal.nextSibling);
    }
  }

  function revertMetrics(scope) {
    var metrics = collectMetrics(scope);
    for (var i = 0; i < metrics.length; i++) {
      var el = metrics[i].valueEl;
      if (el.hasAttribute("data-mp-orig")) {
        el.innerHTML = el.getAttribute("data-mp-orig"); // non-compared path
      }
      if (el.hasAttribute("data-mp-ocolor")) {
        el.style.color = el.getAttribute("data-mp-ocolor");
      } else if (el.hasAttribute("data-mp-orig")) {
        el.style.color = "";
      }
      // Remove the "(diff)" we appended to the native compared-to line.
      var note = findComparisonNote(metrics[i].container);
      if (note) {
        var ex = note.querySelectorAll("[data-mp-cmp-extra]");
        for (var j = 0; j < ex.length; j++) ex[j].remove();
      }
    }
    // Remove our own recompute notes (non-compared % change path).
    var own = scope.querySelectorAll("[data-mp-change-note]");
    for (var k = 0; k < own.length; k++) own[k].remove();
  }

  // ---------- Already-compared cards: add the raw difference automatically ------
  // Some Mixpanel cards already come compared natively: the value is a % change
  // and there is an "X compared to Y" note, which Mixpanel colors green/red by
  // whether the move is good or bad. For those we keep Mixpanel's % value and just
  // append the missing raw difference (net diff for plain numbers, or the
  // percentage-point delta for percentages), colored to EXACTLY match the color
  // Mixpanel already applied to the relative % change — so the absolute and
  // relative changes always agree without the user picking a direction.

  // Find the tightest element whose text reads "... compared to ..." (native,
  // i.e. not one of our own [data-mp-change-note] notes).
  function findComparisonNote(container) {
    var els = deepQueryAll(container, "*", []);
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.hasAttribute && e.hasAttribute("data-mp-change-note")) continue;
      if (e.closest && e.closest("[data-mp-change-note]")) continue;
      if (!/compared to/i.test(e.textContent || "")) continue;
      var childHit = false;
      for (var j = 0; j < e.children.length; j++) {
        if (/compared to/i.test(e.children[j].textContent || "")) { childHit = true; break; }
      }
      if (!childHit) return e;
    }
    return null;
  }

  function hasNativeComparison(scope) {
    var metrics = collectMetrics(scope);
    for (var i = 0; i < metrics.length; i++) {
      if (findComparisonNote(metrics[i].container)) return true;
    }
    return false;
  }

  function renderCompared(scope, mode) {
    var win = (scope.ownerDocument && scope.ownerDocument.defaultView) || window;
    var metrics = collectMetrics(scope);
    for (var i = 0; i < metrics.length; i++) {
      var mt = metrics[i];
      var el = mt.valueEl;
      var note = findComparisonNote(mt.container);
      if (!note) continue;

      // Drop any "(diff)" we added before, then read the two shown numbers.
      var prev = note.querySelector("[data-mp-cmp-extra]");
      if (prev) prev.remove();

      var m = (note.textContent || "").match(
        /([-\d.,]+\s*%?)\s*compared to\s*([-\d.,]+\s*%?)/i
      );
      if (!m) continue;
      var a = parseNum(m[1]);
      var b = parseNum(m[2]);
      if (!isFinite(a) || !isFinite(b)) continue;
      var isPct = /%/.test(m[1]) || /%/.test(m[2]);
      var diff = a - b;
      var text = isPct ? fmtPP(diff) : fmtDiff(diff);

      // Prefer the directionality Mixpanel already baked into the relative %
      // change color: mirror that exact color onto the absolute-difference pill,
      // so both always agree with no manual up/down selection. Fall back to the
      // chosen favorable direction only when Mixpanel left the value uncolored
      // (e.g. a zero/no-change metric, or an unrecognizable theme color).
      var valColor = readValueColor(el, win);
      var favor = diff === 0 ? 0 : favorFromColor(parseColor(valColor));

      note.insertAdjacentHTML(
        "beforeend",
        favor ? diffChipFromColor(text, valColor) : diffChipHTML(text, diff, mode)
      );
    }
  }

  // ---------- Main flow ----------

  // Collect the document plus every (nested) shadow root in one pass, so a scan
  // can query them all without repeating the tree walk per selector.
  function collectRoots() {
    var roots = [document];
    var i = 0;
    while (i < roots.length) {
      var all = roots[i++].querySelectorAll("*");
      for (var k = 0; k < all.length; k++) {
        if (all[k].shadowRoot) roots.push(all[k].shadowRoot);
      }
    }
    return roots;
  }

  function queryAllRoots(roots, selector) {
    var out = [];
    for (var i = 0; i < roots.length; i++) {
      var found = roots[i].querySelectorAll(selector);
      for (var j = 0; j < found.length; j++) out.push(found[j]);
    }
    return out;
  }

  // Idempotent scan: safe to call many times. Buttons/state are guarded by
  // data-attributes, so only newly loaded tables/cards get processed.
  function scan() {
    var roots = collectRoots();

    var tables = queryAllRoots(roots, ".mp-data-table");
    var tAdded = 0;
    for (var t = 0; t < tables.length; t++) {
      var tb = tables[t];
      if (tb.getAttribute("data-mp-ctrl") === "1") continue;
      tb.setAttribute("data-mp-ctrl", "1");
      addTableControl(tb);
      tAdded++;
    }
    // Reveal / hide the "A/B Cohorts" button as cohort checkboxes appear or
    // go away (they can render after the table's own controls were added).
    for (var tv = 0; tv < tables.length; tv++) {
      var sb = tables[tv].__mpSelBtn;
      if (sb) sb.style.display = hasCohortCheckboxes(tables[tv]) ? "" : "none";
    }

    // Metric cards: treat the whole MultiMetricChart as one group (it may span rows).
    // Fall back to a single _bottom-row_ when there is no MultiMetricChart.
    var metricRoots = queryAllRoots(roots, '[data-sentry-component="MultiMetricChart"]');
    if (!metricRoots.length) {
      metricRoots = queryAllRoots(roots, '[class*="_bottom-row_"]');
    }
    var mAdded = 0;
    for (var r = 0; r < metricRoots.length; r++) {
      if (addMetricControl(metricRoots[r])) mAdded++;
      // Natively-compared cards get the absolute difference automatically, with
      // the direction/color inferred from Mixpanel's own comparison coloring.
      autoApplyDirection(metricRoots[r]);
    }

    // Wrap legend text (drop to the next line instead of truncating)
    var segTexts = queryAllRoots(roots, '[class*="_segment-text_"]');
    for (var st = 0; st < segTexts.length; st++) {
      if (segTexts[st].getAttribute("data-mp-wrapped") === "1") continue;
      segTexts[st].setAttribute("data-mp-wrapped", "1");
      relaxLegend(segTexts[st]);
    }

    if (tAdded || mAdded) {
      console.log(
        "Mixpanel Transposer: added buttons to " + tAdded + " table(s) and " + mAdded + " metric card(s)."
      );
    }
    return roots;
  }

  // Once activated, keep watching (light DOM + every shadow root) so tables and
  // cards that finish loading later get their buttons automatically, no matter
  // how long the user waits. Event-driven with a debounce; no periodic polling,
  // and we only listen for childList changes (node add/remove) to stay quiet
  // during chart animations, which mostly mutate attributes.
  if (!window.__mpTransposerWatching) {
    window.__mpTransposerWatching = true;

    var observedRoots = new WeakSet();
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        watchRoots(scan());
      }, 300);
    });

    function watchRoots(roots) {
      for (var i = 0; i < roots.length; i++) {
        var r = roots[i];
        if (observedRoots.has(r)) continue;
        observedRoots.add(r);
        try {
          observer.observe(r === document ? document.documentElement : r, {
            childList: true,
            subtree: true,
          });
        } catch (e) {}
      }
    }

    watchRoots(scan());
  } else {
    // Re-clicked while already watching: just run an immediate extra scan.
    scan();
  }
})();
