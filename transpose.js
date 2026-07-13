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

  function addTableControl(table) {
    var doc = table.ownerDocument;
    var host = getCard(table);
    if (!host) {
      var rn = table.getRootNode && table.getRootNode();
      host = (rn && rn.host && rn.host.parentElement) || table.parentElement;
    }
    var overflow = findOverflowMenu(host);

    var bar = doc.createElement("div");
    bar.style.cssText = "display:inline-flex;gap:6px;align-items:center;";
    var btn = mkButton(doc, "\u21C4 Transpose");
    var reset = mkIconButton(doc, "\u21BA", "Reset to original");
    reset.style.display = "none";
    bar.appendChild(btn);
    bar.appendChild(reset);
    placeControl(bar, host, overflow, table, 10);

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

    reset.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      resetTable(table);
      btn.textContent = "\u21C4 Transpose";
      btn.onclick = doTranspose;
      reset.style.display = "none";
      return false;
    };
  }

  // Restore a transposed table to its pre-transpose markup.
  function resetTable(table) {
    if (table.__mpOrigHTML == null) return;
    table.innerHTML = table.__mpOrigHTML;
    if (table.__mpOrigStyle) table.setAttribute("style", table.__mpOrigStyle);
    else table.removeAttribute("style");
    table.removeAttribute("data-mp-transposed");
    table.removeAttribute("data-mp-tsv");
  }

  function transposeTable(table) {
    try {
      // Already transposed (e.g. by a previous injection): reuse the cached TSV.
      if (table.getAttribute("data-mp-transposed") === "1") {
        return table.getAttribute("data-mp-tsv") || "";
      }

      // Snapshot the pristine markup once so Reset can restore the original view.
      if (table.__mpOrigHTML == null) {
        table.__mpOrigHTML = table.innerHTML;
        table.__mpOrigStyle = table.getAttribute("style") || "";
      }
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
        for (var tr = 0; tr < rows; tr++) row.push(textGrid[tr][tc]);
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

  // A colored, bold highlight pill for the raw difference: green when positive,
  // red when negative, neutral grey when zero.
  function diffChipHTML(text, sign) {
    var bg =
      sign > 0 ? "rgba(34,160,107,.20)" : sign < 0 ? "rgba(229,72,77,.20)" : "rgba(127,127,127,.18)";
    var fg = sign > 0 ? "#22a06b" : sign < 0 ? "#e5484d" : "inherit";
    return (
      '<span data-mp-cmp-extra="1" style="margin-left:6px;padding:1px 6px;border-radius:3px;' +
      "font-weight:700;font-variant-numeric:tabular-nums;background:" + bg + ";color:" + fg + ';">' +
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
    var bPlus = mkButton(doc, "% change(+)");
    var bMinus = mkButton(doc, "% change(-)");
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
      setActive(bPlus, bMinus, null);
      return false;
    };
    return true;
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
        diffChipHTML(extra, val - base);

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

  // ---------- Already-compared cards: add the raw difference on demand ----------
  // Some Mixpanel cards already come compared natively: the value is a % change
  // and there is an "X compared to Y" note. For those we keep Mixpanel's % value
  // and, when a % change button is pressed, just append the missing raw
  // difference (net diff for plain numbers, or the percentage-point delta for
  // percentages) and recolor per the chosen favorable direction.

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

      // Recolor Mixpanel's own value per the chosen favorable direction; keep
      // the value text itself untouched (remember original color for revert).
      if (!el.hasAttribute("data-mp-ocolor")) {
        el.setAttribute("data-mp-ocolor", el.style.color || "");
      }
      var change =
        b === 0 ? (diff === 0 ? 0 : diff > 0 ? 100 : -100) : (diff / Math.abs(b)) * 100;
      el.style.color = colorFor(change, mode);

      // Add the raw difference as a colored highlight on the compared-to line
      // (green if positive, red if negative, bold).
      note.insertAdjacentHTML(
        "beforeend",
        diffChipHTML(isPct ? fmtPP(diff) : fmtDiff(diff), diff)
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

    // Metric cards: treat the whole MultiMetricChart as one group (it may span rows).
    // Fall back to a single _bottom-row_ when there is no MultiMetricChart.
    var metricRoots = queryAllRoots(roots, '[data-sentry-component="MultiMetricChart"]');
    if (!metricRoots.length) {
      metricRoots = queryAllRoots(roots, '[class*="_bottom-row_"]');
    }
    var mAdded = 0;
    for (var r = 0; r < metricRoots.length; r++) {
      if (addMetricControl(metricRoots[r])) mAdded++;
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
