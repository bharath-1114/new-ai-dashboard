/* =========================================================
   table.js – Tables + Custom Dashboard (FINAL CLEAN)
========================================================= */
function renderDashboard() {
  const root = document.getElementById("dashboardContainer");
  if (!root) {
    console.warn("dashboardContainer not found");
    return;
  }

  if (!Array.isArray(window.records) || window.records.length === 0) {
    console.warn("No records available");
    return;
  }

  root.innerHTML = "";

  // ✅ ALWAYS call via Table.*
  Table.renderNameAttendance?.("dashboardContainer");
  Table.renderSubjectMarksPerc?.("dashboardContainer");
  Table.renderResultStatsPanel?.("dashboardContainer");
  Table.renderGenderPanel?.("dashboardContainer");
  Table.highestMetricTables?.("dashboardContainer");
  Table.highestAttendanceOnly?.("dashboardContainer");
  Table.LowestMetricTables?.("dashboardContainer");
  Table.LowestAttendanceOnly?.("dashboardContainer");
}


(function () {

  /* ===============================
     GLOBAL REGISTRIES
  =============================== */
  window.CustomPanelRegistry = window.CustomPanelRegistry || new Set();
  window.SelectedPanelKeys   = window.SelectedPanelKeys || new Set();
  window.Table = window.Table || {};

  /* ===============================
     HELPERS
  =============================== */
  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[%()_\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseNumber(v) {
    if (v == null) return NaN;
    const n = String(v).replace(/,/g, "").replace("%", "");
    const f = parseFloat(n);
    return Number.isFinite(f) ? f : NaN;
  }

  function resolveRoot(targetId, clear = false) {
    const el = document.getElementById(targetId || "dashboardContainer");
    if (!el) return null;
    if (clear) el.innerHTML = "";
    return el;
  }

  /* ===============================
     COLUMN PICKER (SMART)
  =============================== */
  function pickColumnSmart(columns, keywords) {
    if (!Array.isArray(columns)) return null;

    const normCols = columns.map(c => normalize(c));

    let best = null;
    let bestScore = 0;

    keywords.forEach(k => {
      const nk = normalize(k);
      normCols.forEach((c, i) => {
        let score = 0;
        if (c === nk) score = 5;
        else if (c.includes(nk)) score = 2;
        if (score > bestScore) {
          bestScore = score;
          best = columns[i];
        }
      });
    });

    return bestScore >= 2 ? best : null;
  }

  /* ===============================
     PANEL KEY (FOR CUSTOM DASHBOARD)
  =============================== */
  function getPanelKey(panel) {
    const title = panel.querySelector("div");
    if (!title) return null;
    return title.textContent
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
  }
  window.getPanelKey = getPanelKey;

  /* ===============================
     SELECTION HANDLING
  =============================== */
  function updateSelection(panel, key, isMulti) {
    const root = document.getElementById("dashboardContainer");
    if (!root) return;

    if (!isMulti) {
      root.querySelectorAll(".panel.selected")
        .forEach(p => p.classList.remove("selected"));
      window.SelectedPanelKeys.clear();
    }

    if (panel.classList.contains("selected")) {
      panel.classList.remove("selected");
      window.SelectedPanelKeys.delete(key);
    } else {
      panel.classList.add("selected");
      window.SelectedPanelKeys.add(key);
    }
  }

  /* ===============================
     ADD PANEL TO CUSTOM DASHBOARD
  =============================== */
  window.enableAddToCustom = function (panel) {
    if (!panel || panel.dataset.customEnabled) return;

    panel.dataset.customEnabled = "true";
    panel.classList.add("clickable");

    panel.addEventListener("click", e => {
      e.stopPropagation();

      const customRoot = document.getElementById("customContainer");
      if (!customRoot) return;

      const key = getPanelKey(panel);
      if (!key) return;

      updateSelection(panel, key, e.ctrlKey || e.metaKey);

      if (window.CustomPanelRegistry.has(key)) return;
      window.CustomPanelRegistry.add(key);

      const clone = panel.cloneNode(true);
      clone.classList.remove("selected");
      clone.classList.add("custom-card");
      clone.dataset.panelKey = key;
      clone.style.width = "300px";
      clone.style.height = "220px";

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✖";
      removeBtn.onclick = ev => {
        ev.stopPropagation();
        clone.remove();
        window.CustomPanelRegistry.delete(key);
      };

      clone.prepend(removeBtn);

      const handle = document.createElement("div");
      handle.className = "resize-handle";
      clone.appendChild(handle);

      if (window.enableFreeMove) enableFreeMove(clone);
      if (window.enableResize) enableResize(clone);

      customRoot.appendChild(clone);
    });
  };

  /* ===============================
     SIMPLE TABLE RENDERER (ONE ONLY)
  =============================== */
  function renderSimpleTable(parent, rows, highlightCols = [], opts = {}) {
    if (!parent || !Array.isArray(rows) || !rows.length) return;

    const cols = Object.keys(rows[0]);
    const highlights = Array.isArray(highlightCols)
      ? highlightCols.map(c => c.toLowerCase())
      : [String(highlightCols).toLowerCase()];

    const table = document.createElement("table");
    table.className = "simple-table" + (opts.tableClass ? " " + opts.tableClass : "");

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    cols.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c;
      if (highlights.includes(c.toLowerCase())) th.classList.add("metric-highlight");
      trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach(r => {
      const tr = document.createElement("tr");
      cols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = r[c] ?? "";
        if (highlights.includes(c.toLowerCase())) td.classList.add("metric-highlight");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    parent.appendChild(table);
  }

  /* ===============================
     ATTENDANCE BUCKET BUILDER
  =============================== */
  function buildAttendanceBucketsWithRows(records, attCol) {
    const buckets = {
      "90–100%": [],
      "80–89%": [],
      "70–79%": [],
      "0–69%": []
    };

    let numericCount = 0;
    const totalRows = records.length;

    records.forEach((r, i) => {
      let v = parseNumber(r[attCol]);
      if (Number.isNaN(v)) return;

      if (v > 0 && v <= 1) v *= 100;
      numericCount++;

      const row = { "__rowIndex": i + 1, ...r };

      if (v >= 90) buckets["90–100%"].push(row);
      else if (v >= 80) buckets["80–89%"].push(row);
      else if (v >= 70) buckets["70–79%"].push(row);
      else buckets["0–69%"].push(row);
    });

    const summaryRows = Object.keys(buckets).map(label => ({
      Bucket: label,
      Count: buckets[label].length,
      Percent: numericCount
        ? ((buckets[label].length / numericCount) * 100).toFixed(2) + "%"
        : "0.00%"
    }));

    return { buckets, summaryRows, numericCount, totalRows };
  }
  // ===== TABLE SECTIONS =====
  function renderNameAttendance(targetId) {
    const rootEl = resolveRoot(targetId);
    if (!rootEl) return;
  
    // just use it
    const nameCol = window.Table.pickColumnSmart(columns, nameKeywords);
    const idCol   = window.Table.pickColumnSmart(columns, idKeywords);
    const attCol  = window.Table.pickColumnSmart(columns, attendanceKeywords);
 

    // ---------- PREVIEW PANEL ----------
    const previewPanel = document.createElement("div");
    previewPanel.className = "panel";
  
    const previewTitle = document.createElement("div");
    previewTitle.style.fontWeight = "700";
    previewTitle.style.marginBottom = "6px";
    previewTitle.textContent = "Name & Attendance (Preview)";
    previewPanel.appendChild(previewTitle);
  
    if (!attCol) {
      showNotDetected(panel, "Attendance column not found.");
      enableAddToCustom(panel);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);
      return;
    }
    
  
    const previewRows = records.slice(0, 20).map((r, i) => ({
      Row: i + 1,
      [idCol || "id"]: r[idCol] ?? "",
      [nameCol || "name"]: r[nameCol] ?? "",
      [attCol]: r[attCol] ?? ""
    }));
  
    renderSimpleTable(previewPanel, previewRows, attCol);
    enableAddToCustom(previewPanel);
    rootEl.appendChild(previewPanel);

    // ---------- SUMMARY PANEL ----------
    const { buckets, summaryRows, numericCount, totalRows } =
      buildAttendanceBucketsWithRows(records, attCol);
  
    const summaryPanel = document.createElement("div");
    summaryPanel.className = "panel";
  
    const summaryTitle = document.createElement("div");
    summaryTitle.style.fontWeight = "700";
    summaryTitle.style.marginBottom = "6px";
    summaryTitle.textContent =
      `Attendance Distribution (${numericCount} numeric / ${totalRows} rows)`;
    summaryPanel.appendChild(summaryTitle);
  
    renderSimpleTable(summaryPanel, summaryRows, ["Count", "Percent"]);
    enableAddToCustom(summaryPanel);
    rootEl.appendChild(summaryPanel);

  
    // ---------- BUCKET TABLES ----------
    const bucketsContainer = document.createElement("div");
    bucketsContainer.className = "bucket-grid";
    rootEl.appendChild(bucketsContainer);


    Object.entries(buckets).forEach(([label, rows]) => {
      const bucketPanel = document.createElement("div");
      bucketPanel.className = "panel";
    
      const bucketTitle = document.createElement("div");
      bucketTitle.style.fontWeight = "700";
      bucketTitle.style.marginBottom = "6px";
      bucketTitle.textContent = `${label} — ${rows.length} row(s)`;
      bucketPanel.appendChild(bucketTitle);
    
      if (!rows.length) {
        bucketPanel.appendChild(
          document.createTextNode("No rows in this bucket.")
        );
      } else {
        const rowsToShow = rows.map(r => ({
          Row: r.__rowIndex,
          [nameCol || "name"]: r[nameCol] ?? "",
          [attCol]: r[attCol] ?? ""
        }));
    
        renderSimpleTable(bucketPanel, rowsToShow, attCol);
      }
    
      // ✅ THIS LINE WAS MISSING
      enableAddToCustom(bucketPanel);
    
      bucketsContainer.appendChild(bucketPanel);
    });
    
    // ✅ expose once
    window.Table = window.Table || {};
    window.Table.renderNameAttendance = renderNameAttendance;

  }
// ==================================================================================================

// show the Subject, Mark & Percentage Table
function renderSubjectMarksPerc(targetId) {
  const dashboard = resolveRoot(targetId);
  if (!dashboard) return;

  const sub  = Table.pickColumnSmart(columns, subjectKeywords);
  const mcol = Table.pickColumnSmart(columns, marksKeywords);
  const pcol = Table.pickColumnSmart(columns, percentageKeywords);

  const detected = [];
  if (sub)  detected.push(sub);
  if (mcol) detected.push(mcol);
  if (pcol) detected.push(pcol);

  // ❌ NOTHING DETECTED → FULLY HIDE THIS SECTION
  if (detected.length === 0) {
    return; // 👈 this hides the table completely
  }

  // ✅ CREATE PANEL ONLY WHEN DETECTED
  const panel = document.createElement("div");
  panel.className = "panel";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  title.textContent = "Subject / Marks / Percentage";
  panel.appendChild(title);

  // detected info
  const detectedInfo = document.createElement("div");
  detectedInfo.className = "small";
  detectedInfo.style.marginBottom = "6px";
  detectedInfo.textContent = `Detected columns: ${detected.join(", ")}`;
  panel.appendChild(detectedInfo);

  // table rows
  const rows = records.slice(0, 20).map((r, idx) => {
    const obj = { Row: idx + 1 };
    detected.forEach(c => obj[c] = r[c] ?? "");
    return obj;
  });

  renderSimpleTable(panel, rows, detected[detected.length - 1]);

  enableAddToCustom(panel);
  dashboard.appendChild(panel);


  // chart
  if (window.Charting?.renderSubjectMarksChart && (pcol || mcol)) {
    Charting.renderSubjectMarksChart(panel, sub, pcol, mcol);
  }
}


// ==================================================================================================

/// show the Result Distribution Table
function renderResultStatsPanel(targetId) {
  const dashboard = resolveRoot(targetId);
  if (!dashboard) return;

  // ---------- FIND RESULT COLUMN ----------
  let colToUse = Table.pickColumnSmart(columns, resultKeywords);

  if (!colToUse) {
    colToUse = (Array.isArray(columns) ? columns.find(c => {
      for (let i = 0; i < Math.min(200, records.length); i++) {
        const v = records[i]?.[c];
        if (v == null) continue;
        const low = String(v).toLowerCase();
        if (
          passTokens.some(t => low.includes(t)) ||
          failTokens.some(t => low.includes(t))
        ) return true;
      }
      return false;
    }) : "") || "";
  }

  // ❌ NOTHING DETECTED → HIDE SECTION
  if (!colToUse) {
    return;
  }

  // ---------- PANEL ----------
  const panel = document.createElement("div");
  panel.className = "panel";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  title.textContent = "Result Summary";
  panel.appendChild(title);

  // ---------- COMPUTE STATS ----------
  const counts = new Map();
  let total = 0;

  records.forEach(r => {
    const key = r[colToUse] == null ? "" : String(r[colToUse]).trim();
    counts.set(key, (counts.get(key) || 0) + 1);
    total++;
  });

  const stats = Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      count,
      percent: total
        ? ((count / total) * 100).toFixed(2) + "%"
        : "0.00%"
    }))
    .sort((a, b) => b.count - a.count);

  // ---------- PASS / FAIL ----------
  let passCount = 0;
  let failCount = 0;

  for (const [val, cnt] of counts.entries()) {
    const low = val.toLowerCase();
    if (passTokens.some(t => low.includes(t))) passCount += cnt;
    else if (failTokens.some(t => low.includes(t))) failCount += cnt;
  }

  const passPct = total ? ((passCount / total) * 100).toFixed(2) + "%" : "0.00%";
  const failPct = total ? ((failCount / total) * 100).toFixed(2) + "%" : "0.00%";

  // ---------- SUMMARY BOXES ----------
  const summaryWrap = document.createElement("div");
  summaryWrap.style.display = "flex";
  summaryWrap.style.gap = "10px";
  summaryWrap.style.marginBottom = "8px";

  const b1 = document.createElement("div");
  b1.className = "stat-box";
  b1.textContent = `Rows: ${total}`;

  const b2 = document.createElement("div");
  b2.className = "stat-box";
  b2.textContent = `Pass: ${passCount} (${passPct})`;

  const b3 = document.createElement("div");
  b3.className = "stat-box";
  b3.textContent = `Fail: ${failCount} (${failPct})`;

  summaryWrap.appendChild(b1);
  summaryWrap.appendChild(b2);
  summaryWrap.appendChild(b3);
  panel.appendChild(summaryWrap);

  // ---------- TABLE ----------
  renderSimpleTable(panel, stats, "percent", {
    tableClass: "compact striped"
  });

  enableAddToCustom(panel);
  dashboard.appendChild(panel);


  // ---------- CHART ----------
  if (window.Charting?.renderResultCharts) {
    Charting.renderResultCharts(passCount, failCount, total);
  }
}

// ==================================================================================================

// show the Gender Distribution Table
  function renderGenderPanel(targetId) {
    const dashboard = resolveRoot(targetId);
    if (!dashboard) return;
  
    // ---------- FIND GENDER COLUMN ----------
    let colToUse = window.Table.pickColumnSmart(columns, genderKeywords);
  
    if (!colToUse) {
      for (const c of (Array.isArray(columns) ? columns : [])) {
        for (let i = 0; i < Math.min(200, records.length); i++) {
          const v = records[i]?.[c];
          if (v == null) continue;
          const low = String(v).toLowerCase();
          if (["male","female","m","f","man","woman"].some(tok => low.includes(tok))) {
            colToUse = c;
            break;
          }
        }
        if (colToUse) break;
      }
    }
  
    // ---------- PANEL ----------
    const panel = document.createElement("div");
    panel.className = "panel";
  
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.marginBottom = "6px";
    title.textContent = "Gender Distribution";
    panel.appendChild(title);
  
    // ---------- NO COLUMN ----------
    if (!colToUse) {
      const msg = document.createElement("div");
      msg.className = "small";
      msg.textContent = "No gender-like column detected.";
      panel.appendChild(msg);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);

      return;
    }
  
    // ---------- COUNT VALUES ----------
    const counts = new Map();
    let total = 0;
  
    records.forEach(r => {
      const key = r[colToUse] == null ? "" : String(r[colToUse]).trim();
      counts.set(key, (counts.get(key) || 0) + 1);
      total++;
    });
  
    // ---------- MALE / FEMALE / OTHER ----------
    let maleCount = 0;
    let femaleCount = 0;
    let otherCount = 0;
  
    const isMale   = /\b(male|man|boy|m)\b/i;
    const isFemale = /\b(female|woman|girl|f)\b/i;
    const ignore   = /^(|unknown|n\/a|null|undefined)$/i;
  
    for (const [val, cnt] of counts.entries()) {
      if (!val) continue;
  
      const v = val.toLowerCase();
      if (ignore.test(v)) continue;
  
      if (isFemale.test(v)) femaleCount += cnt;
      else if (isMale.test(v)) maleCount += cnt;
      else otherCount += cnt;
    }
  
    const validTotal = maleCount + femaleCount + otherCount;
  
    const malePct   = validTotal ? ((maleCount   / validTotal) * 100).toFixed(2) + "%" : "0.00%";
    const femalePct = validTotal ? ((femaleCount / validTotal) * 100).toFixed(2) + "%" : "0.00%";
    const otherPct  = validTotal ? ((otherCount  / validTotal) * 100).toFixed(2) + "%" : "0.00%";
  
    // ---------- SUMMARY BOXES ----------
    const summaryWrap = document.createElement("div");
    summaryWrap.style.display = "flex";
    summaryWrap.style.gap = "10px";
    summaryWrap.style.marginBottom = "8px";
  
    const g1 = document.createElement("div");
    g1.className = "stat-box";
    g1.textContent = `Valid Rows: ${validTotal}`;
  
    const g2 = document.createElement("div");
    g2.className = "stat-box";
    g2.textContent = `Male: ${maleCount} (${malePct})`;
  
    const g3 = document.createElement("div");
    g3.className = "stat-box";
    g3.textContent = `Female: ${femaleCount} (${femalePct})`;
  
    const g4 = document.createElement("div");
    g4.className = "stat-box";
    g4.textContent = `Other: ${otherCount} (${otherPct})`;
  
    summaryWrap.appendChild(g1);
    summaryWrap.appendChild(g2);
    summaryWrap.appendChild(g3);
    summaryWrap.appendChild(g4);
    panel.appendChild(summaryWrap);
  
    // ---------- TABLE ----------
    const statsForTable = Array.from(counts.entries()).map(([value, count]) => ({
      value,
      count,
      percent: total ? ((count / total) * 100).toFixed(2) + "%" : "0.00%"
    })).sort((a, b) => b.count - a.count);
  
    renderSimpleTable(panel, statsForTable, "percent", {
      tableClass: "compact striped"
    });
  
    enableAddToCustom(panel);
    dashboard.appendChild(panel);

  
    // ---------- CHART ----------
    if (window.Charting?.renderGenderCharts) {
      Charting.renderGenderCharts(maleCount, femaleCount, otherCount, validTotal);
    }
  }
// ==================================================================================================

// Pickup on the Mark,Percentage and ttendance Table
  function columnsForMarksTable(metricCol) {
    const idCol = window.Table.pickColumnSmart(columns, idKeywords) || "";
    const nameCol = window.Table.pickColumnSmart(columns, nameKeywords) || "";
    const subjectCol = window.Table.pickColumnSmart(columns, subjectKeywords) || "";
  
    const optionalCols = [
      window.Table.pickColumnSmart(columns, classKeywords),
      window.Table.pickColumnSmart(columns, genderKeywords),
      window.Table.pickColumnSmart(columns, sectionKeywords),
      window.Table.pickColumnSmart(columns, resultKeywords)
    ].filter(Boolean);
  
    const cols = [];
    cols.push(idCol || "id");
    cols.push(nameCol || "name");
    cols.push(subjectCol || "subject");
    cols.push(metricCol);
    optionalCols.forEach(c => cols.push(c));
  
    return cols;
  }
  function columnsForPercentageTable(metricCol) {
    const idCol = window.Table.pickColumnSmart(columns, idKeywords) || "";
    const nameCol = window.Table.pickColumnSmart(columns, nameKeywords) || "";
    const PercentCol = window.Table.pickColumnSmart(columns, percentageKeywords) || "";
  
    const optionalCols = [
      window.Table.pickColumnSmart(columns, subjectKeywords),
      window.Table.pickColumnSmart(columns, classKeywords),
      window.Table.pickColumnSmart(columns, genderKeywords),
      window.Table.pickColumnSmart(columns, sectionKeywords),
      window.Table.pickColumnSmart(columns, resultKeywords)
    ].filter(Boolean);
  
    const cols = [];
    cols.push(idCol || "id");
    cols.push(nameCol || "name");
    cols.push(PercentCol || "subject");
    cols.push(metricCol);
    optionalCols.forEach(c => cols.push(c));
  
    return cols;
  }
  function columnsForAttendanceTable(attCol) {
    const idCol = window.Table.pickColumnSmart(columns, idKeywords) || "";
    const nameCol = window.Table.pickColumnSmart(columns, nameKeywords) || "";
    const optionalCols = [
    window.Table.pickColumnSmart(columns, classKeywords),
    window.Table.pickColumnSmart(columns, genderKeywords),
    window.Table.pickColumnSmart(columns, sectionKeywords),
    window.Table.pickColumnSmart(columns, resultKeywords)
    ].filter(Boolean);
    const cols = [];
    cols.push(idCol || "id");
    cols.push(nameCol || "name");
    cols.push(attCol);
    optionalCols.forEach(c=> cols.push(c));
    return cols;
    }

  function highestMetricTables(targetId) {
    const dashboard = resolveRoot(targetId);
    if (!dashboard) return;
  
    const marksCol = window.Table.pickColumnSmart(columns, marksKeywords);
    const percCol  = window.Table.pickColumnSmart(columns, percentageKeywords);
  
    // ---------- helper ----------
    function buildMetricBlock(metricName, col, rowsList, colsToShowFn, highlightColName) {
      const wrapper = document.createElement("div");
      wrapper.className = "panel metric-table";
      wrapper.dataset.metric = metricName.toLowerCase();
  
      const title = document.createElement("div");
      title.style.fontWeight = "700";
      title.style.marginBottom = "6px";
      title.textContent = `${metricName} — '${col}' (numeric rows: ${rowsList.length}) — top 6`;
      wrapper.appendChild(title);
  
      if (rowsList.length === 0) {
        const msg = document.createElement("div");
        msg.className = "small";
        msg.textContent = "No numeric values found for this column.";
        wrapper.appendChild(msg);
        dashboard.appendChild(wrapper);
        return;
      }
  
      const colsToShow = colsToShowFn(col);
      const rows = rowsList.slice(0, 6).map(x => {
        const obj = {};
        colsToShow.forEach(c => obj[c] = x.row[c]);
        return obj;
      });
  
      renderSimpleTable(wrapper, rows, highlightColName, {
        tableClass: "compact striped"
      });
  
      dashboard.appendChild(wrapper);
    }
  
    // ---------- MARKS ----------
    if (marksCol) {
      const numericRows = [];
      records.forEach((r, idx) => {
        const num = parseNumber(r[marksCol]);
        if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
      });
  
      numericRows.sort((a, b) => (b.num - a.num) || (a.idx - b.idx));
  
      buildMetricBlock(
        "Marks",
        marksCol,
        numericRows,
        columnsForMarksTable,
        marksCol
      );
  
      if (window.Charting?.renderHighestMetricChart) {
        Charting.renderHighestMetricChart("Marks", marksCol, numericRows);
      }
    }
  
    // ---------- PERCENTAGE ----------
    if (percCol) {
      const numericRows = [];
      records.forEach((r, idx) => {
        const num = parseNumber(r[percCol]);
        if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
      });
  
      numericRows.sort((a, b) => (b.num - a.num) || (a.idx - b.idx));
  
      buildMetricBlock(
        "Percentage",
        percCol,
        numericRows,
        columnsForPercentageTable,
        percCol
      );
  
      if (window.Charting?.renderHighestMetricChart) {
        Charting.renderHighestMetricChart("Percentage", percCol, numericRows);
      }
    }
  
    // ---------- FALLBACK ----------
    // if (!marksCol && !percCol) {
    //   const p = document.createElement("div");
    //   p.className = "panel";
  
    //   const msg = document.createElement("div");
    //   msg.className = "small";
    //   msg.textContent = "No Marks / Percentage columns detected for Top-6.";
    //   p.appendChild(msg);
  
    //   dashboard.appendChild(p);
    // }
  }
// ==========================================================================================================

// show the highest Attendance Table
  function highestAttendanceOnly(targetId) {
    const dashboard = resolveRoot(targetId);
    if (!dashboard) return;
  
    // ---------- PANEL ----------
    const panel = document.createElement("div");
    panel.className = "panel";
  
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.marginBottom = "6px";
    title.textContent = "highest Attendance";
    panel.appendChild(title);
  
    // ---------- GUARDS ----------
    if (!Array.isArray(records) || records.length === 0) {
      const note = document.createElement("div");
      note.className = "small";
      note.textContent = "Upload a file to see attendance Top-6.";
      panel.appendChild(note);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);

      return;
    }
  
    if (typeof window.Table.pickColumnSmart !== "function") {
      console.error("highestAttendanceOnly: window.Table.pickColumnSmart missing");
      panel.appendChild(document.createTextNode("Internal error."));
      enableAddToCustom(panel);
      dashboard.appendChild(panel);

      return;
    }
  
    // ---------- PICK COLUMN ----------
    const attCol = window.Table.pickColumnSmart(columns, attendanceKeywords);
    if (!attCol) {
      const m = document.createElement("div");
      m.className = "small";
      m.textContent = "Attendance column not detected.";
      panel.appendChild(m);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);

      return;
    }
  
    // ---------- PARSER ----------
    const parser = (typeof parseNumber === "function")
      ? parseNumber
      : v => {
          if (v == null) return NaN;
          const n = Number(String(v).replace(/,/g, "").replace("%", ""));
          return Number.isFinite(n) ? n : NaN;
        };
  
    // ---------- COLLECT ROWS ----------
    const numericRows = [];
    records.forEach((r, idx) => {
      const num = parser(r[attCol]);
      if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
    });
  
    numericRows.sort((a, b) => (b.num - a.num) || (a.idx - b.idx));
  
    if (numericRows.length === 0) {
      const msg = document.createElement("div");
      msg.className = "small";
      msg.textContent = "No numeric attendance values found.";
      panel.appendChild(msg);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);

      return;
    }
  
    // ---------- TOP-6 TABLE ----------
    const top6 = numericRows.slice(0, 6);
    const colsToShow = columnsForAttendanceTable(attCol);
  
    const tableRows = top6.map(o => {
      const obj = {};
      colsToShow.forEach(c => obj[c] = o.row[c]);
      return obj;
    });
  
    renderSimpleTable(panel, tableRows, attCol, {
      tableClass: "compact striped"
    });
  
    enableAddToCustom(panel);
    dashboard.appendChild(panel);

  
    // ---------- CHART ----------
    if (window.Charting?.renderHighestAttendanceChart) {
      Charting.renderHighestAttendanceChart(top6, attCol);
    }
  }
// ==========================================================================================================

// Show the Lowest Marks, Percentages Tables
  function LowestMetricTables(targetId) {
    const dashboard = resolveRoot(targetId);
    if (!dashboard) return;
  
    const marksCol = window.Table.pickColumnSmart(columns, marksKeywords);
    const percCol  = window.Table.pickColumnSmart(columns, percentageKeywords);
  
    // ---------- helper ----------
    function buildMetricBlock(metricName, col, rowsList, colsToShowFn, highlightColName) {
      const panel = document.createElement("div");
      panel.className = "panel metric-table";
      panel.dataset.metric = metricName.toLowerCase();
  
      const title = document.createElement("div");
      title.style.fontWeight = "700";
      title.style.marginBottom = "6px";
      title.textContent = `${metricName} — '${col}' (numeric rows: ${rowsList.length}) — lowest`;
      panel.appendChild(title);
  
      if (rowsList.length === 0) {
        const msg = document.createElement("div");
        msg.className = "small";
        msg.textContent = "No numeric values found for this column.";
        panel.appendChild(msg);
        enableAddToCustom(panel);
        dashboard.appendChild(panel);
        return;
      }
  
      const colsToShow = colsToShowFn(col);
      const rows = rowsList.slice(0, 6).map(x => {
        const obj = {};
        colsToShow.forEach(c => obj[c] = x.row[c]);
        return obj;
      });
  
      renderSimpleTable(panel, rows, highlightColName, {
        tableClass: "compact striped"
      });
      
      enableAddToCustom(panel);
      dashboard.appendChild(panel);
    }
  
    // ---------- MARKS (LOWEST) ----------
    if (marksCol) {
      const numericRows = [];
      records.forEach((r, idx) => {
        const num = parseNumber(r[marksCol]);
        if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
      });
  
      numericRows.sort((a, b) => (a.num - b.num) || (a.idx - b.idx));
  
      buildMetricBlock(
        "Marks",
        marksCol,
        numericRows,
        columnsForMarksTable,
        marksCol
      );
  
      if (window.Charting?.renderLowestMetricChart) {
        Charting.renderLowestMetricChart("Marks", marksCol, numericRows);
      }
    }
  
    // ---------- PERCENTAGE (LOWEST) ----------
    if (percCol) {
      const numericRows = [];
      records.forEach((r, idx) => {
        const num = parseNumber(r[percCol]);
        if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
      });
  
      numericRows.sort((a, b) => (a.num - b.num) || (a.idx - b.idx));
  
      buildMetricBlock(
        "Percentage",
        percCol,
        numericRows,
        columnsForPercentageTable,
        percCol
      );
  
      if (window.Charting?.renderLowestMetricChart) {
        Charting.renderLowestMetricChart("Percentage", percCol, numericRows);
      }
    }
  
    // ---------- FALLBACK ----------
    // if (!marksCol && !percCol) {
    //   const p = document.createElement("div");
    //   p.className = "panel";
  
    //   const msg = document.createElement("div");
    //   msg.className = "small";
    //   msg.textContent = "No Marks / Percentage columns detected for Lowest-6.";
    //   p.appendChild(msg);
  
    //   dashboard.appendChild(p);
    // }
  }
// ==========================================================================================================

// Show the Lowest Attendance Table
  function LowestAttendanceOnly(targetId) {
    const dashboard = resolveRoot(targetId);
    if (!dashboard) return;
  
    // ---------- PANEL ----------
    const panel = document.createElement("div");
    panel.className = "panel";
  
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.marginBottom = "6px";
    title.textContent = "Lowest-6 Attendance";
    panel.appendChild(title);
  
    // ---------- GUARDS ----------
    if (!Array.isArray(records) || records.length === 0) {
      const note = document.createElement("div");
      note.className = "small";
      note.textContent = "Upload a file to see attendance Lowest-6.";
      panel.appendChild(note);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);
      return;
    }
  
    // ---------- PICK COLUMN ----------
    const attCol = window.Table.pickColumnSmart(columns, attendanceKeywords);
    if (!attCol) {
      const m = document.createElement("div");
      m.className = "small";
      m.textContent = "Attendance column not detected.";
      panel.appendChild(m);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);
      return;
    }
  
    // ---------- COLLECT NUMERIC ROWS ----------
    const numericRows = [];
    records.forEach((r, idx) => {
      const num = parseNumber(r[attCol]);
      if (!Number.isNaN(num)) numericRows.push({ row: r, num, idx });
    });
  
    numericRows.sort((a, b) => (a.num - b.num) || (a.idx - b.idx));
  
    if (numericRows.length === 0) {
      const msg = document.createElement("div");
      msg.className = "small";
      msg.textContent = "No numeric attendance values found.";
      panel.appendChild(msg);
      enableAddToCustom(panel);
      dashboard.appendChild(panel);
      return;
    }
  
    // ---------- LOWEST Attendance TABLE ----------
    const lowest6 = numericRows.slice(0, 6);
    const colsToShow = columnsForAttendanceTable(attCol);
  
    const tableRows = lowest6.map(o => {
      const obj = {};
      colsToShow.forEach(c => obj[c] = o.row[c]);
      return obj;
    });
  
    renderSimpleTable(panel, tableRows, attCol, {
      tableClass: "compact striped"
    });
  
    enableAddToCustom(panel);
    dashboard.appendChild(panel);
  
    // ---------- CHART ----------
    if (window.Charting?.renderLowestAttendanceChart) {
      Charting.renderLowestAttendanceChart(lowest6, attCol);
    }
  }
// ==========================================================================================================
function renderSimpleTable(parent, rows, options = {}) {
  const highlightEmpty = options.highlightEmpty === true;

  const table = document.createElement("table");
  table.className = "simple-table";

  const cols = Object.keys(rows[0]);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  cols.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(r => {
    const tr = document.createElement("tr");

    cols.forEach(c => {
      const td = document.createElement("td");
      const v = r[c];

      const isEmpty =
        v === null ||
        v === undefined ||
        v === "" ||
        String(v).toLowerCase() === "nan";

      if (highlightEmpty && isEmpty) {
        td.classList.add("td-empty");
        td.textContent = "NaN";
      } else {
        td.textContent = v ?? "";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  parent.appendChild(table);
}

  /* ===============================
     EXPORT (SAFE – NO OVERWRITE)
  =============================== */
  window.Table = window.Table || {};

Object.assign(window.Table, {
  // utils
  normalize,
  parseNumber,
  pickColumnSmart,
  renderSimpleTable,
  buildAttendanceBucketsWithRows,

  // main entry point (🔥 REQUIRED)
  renderDashboard,

  // table sections
  renderNameAttendance,
  renderSubjectMarksPerc,
  renderResultStatsPanel,
  renderGenderPanel,
  highestMetricTables,
  highestAttendanceOnly,
  LowestMetricTables,
  LowestAttendanceOnly,

  // helpers
  columnsForMarksTable,
  // columnsForAttendanceTable
});


})();
