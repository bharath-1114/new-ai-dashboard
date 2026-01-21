/* ============================================================
   ChartCore – panel + lifecycle manager
============================================================ */
window.Charting = window.Charting || {};

window.CustomPanelRegistry = window.CustomPanelRegistry || new Set();
function getPanelKey(panel) {
  const title =
    panel.querySelector(".chart-title") ||
    panel.querySelector("div");

  if (!title) return null;

  return title.textContent
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}
window.enableAddChartToCustom = function (panel) {
  if (!panel || panel.dataset.customEnabled) return;

  panel.dataset.customEnabled = "true";
  panel.classList.add("clickable");

  panel.addEventListener("click", e => {
    e.stopPropagation();

    const customRoot = document.getElementById("customContainer");
    const chartRoot  = document.getElementById("pageCharts");
    if (!customRoot || !chartRoot) return;

    const key = getPanelKey(panel);
    if (!key) return;

    const alreadyAdded = window.CustomPanelRegistry.has(key);

    // ✅ single selection (chart page)
    chartRoot
      .querySelectorAll(".chartpanel.selected")
      .forEach(p => p.classList.remove("selected"));

    panel.classList.add("selected");

    // 🔒 prevent duplicates
    if (alreadyAdded) return;

    window.CustomPanelRegistry.add(key);

    // clone chart panel
    const clone = panel.cloneNode(true);
    clone.classList.remove("clickable", "selected");

    // 🔥 recreate canvas safely
    const oldCanvas = clone.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();

    const wrap = clone.querySelector(".chart-wrap");
    const newCanvas = document.createElement("canvas");
    wrap.appendChild(newCanvas);

    // ✅ create remove button ONLY for custom page
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✖";

    // attach inside title (per div)
    clone.querySelector(".chart-title").appendChild(removeBtn);

    // remove logic
    removeBtn.onclick = ev => {
      ev.stopPropagation();
      ChartCore.destroy(clone);
      clone.remove();
      window.CustomPanelRegistry.delete(key);
      panel.classList.remove("selected");
    };

    customRoot.appendChild(clone);
    // after cloning chart panel
    clone.setAttribute("draggable", "true");
    clone.classList.add("custom-card");
    clone.style.width = "300px";
    clone.style.height = "220px";
    
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    clone.appendChild(handle);
    
    enableFreeMove(clone);
    enableResize(clone, "chart");

    



    // ❗ re-render chart safely
    const chart = ChartCore.getCanvas(panel)
      ? Chart.getChart(ChartCore.getCanvas(panel))
      : null;

    if (chart) {
      ChartFactory.renderChart(clone, chart.config);
    }
  });
};


(function () {

  const chartMap = new WeakMap();

  function destroy(panel) {
    const chart = chartMap.get(panel);
    if (chart) {
      try { chart.destroy(); } catch (e) {}
      chartMap.delete(panel);
    }
  }

  function createPanel(parent, titleText) {
    const panel = document.createElement("div");
    panel.className = "chartpanel chart-card";

  
    panel.innerHTML = `
      <div class="chart-title">
        <span class="chart-title-text">${titleText}</span>
      </div>
      <div class="chart-meta small"></div>
      <div class="chart-wrap">
        <canvas></canvas>
      </div>
    `;
  
    parent.appendChild(panel);
  
    // ✅ selection + add-to-custom only
    window.enableAddChartToCustom?.(panel);
  
    return panel;
  }
  
  
  

  function getCanvas(panel) {
    return panel.querySelector("canvas");
  }

  function register(panel, chart) {
    chartMap.set(panel, chart);
  }

  window.ChartCore = {
    destroy,
    createPanel,
    getCanvas,
    register
  };

})();


/* ============================================================
   PATCHES – helpers (safe, global)
============================================================ */

// robust numeric parser
Table.parseNumber = function (v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;

  let s = v.trim();
  if (!s) return NaN;

  const isPercent = s.includes("%");
  s = s.replace(/%/g, "").replace(/,/g, "");

  let n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;

  if (!isPercent && n > 0 && n <= 1) n *= 100;
  return n;
};

// smart column picker
Table.pickColumnSmart = function (columns, keywords) {
  let best = null;
  let bestScore = 0;

  columns.forEach(col => {
    const low = col.toLowerCase();
    let score = 0;

    keywords.forEach(k => {
      if (low === k) score += 5;
      else if (low.includes(k)) score += 2;
    });

    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  });

  return bestScore >= 2 ? best : null;
};

// visible skip panel
window.renderSkipPanel = function (parent, title, reason) {
  if (!parent) return;

  const panel = document.createElement("div");
  panel.className = "chartpanel chart-skip";

  panel.innerHTML = `
    <div class="chart-title">${title}</div>
    <div class="small" style="color:#b91c1c">
      ⚠ Skipped: ${reason}
    </div>
  `;

  parent.appendChild(panel);
};


/* ============================================================
   ChartFactory – safe chart creation
============================================================ */
(function () {

  function renderChart(panel, config) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not loaded");
      return;
    }

    ChartCore.destroy(panel);

    const canvas = ChartCore.getCanvas(panel);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, config);

    ChartCore.register(panel, chart);
  }

  window.ChartFactory = { renderChart };

})();


/* ============================================================
   Charting – Attendance Charts
============================================================ */
(function () {

  function renderAttendanceChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const attCol = Table.pickColumnSmart(columns, attendanceKeywords);


    if (!attCol) {
      renderSkipPanel(parent, "Attendance Charts", "Attendance column not detected");
      return;
    }

    const result = Table.buildAttendanceBucketsWithRows(records, attCol);
    if (!result || !result.buckets) {
      renderSkipPanel(parent, "Attendance Charts", "No numeric attendance data");
      return;
    }

    const buckets = result.buckets;
    const labels = Object.keys(buckets);
    const data   = Object.values(buckets).map(r => r.length);

    if (!labels.length) {
      renderSkipPanel(parent, "Attendance Charts", "No bucket data");
      return;
    }

    const barPanel = ChartCore.createPanel(parent, "Attendance Distribution (Bar)");
    barPanel.querySelector(".chart-meta").textContent =
      `Total rows: ${data.reduce((a,b)=>a+b,0)}`;

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: { labels, datasets: [{ data, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    const piePanel = ChartCore.createPanel(parent, "Attendance Distribution (Pie)");

    ChartFactory.renderChart(piePanel, {
      type: "pie",
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  window.Charting.renderAttendanceChartsAuto = renderAttendanceChartsAuto;


})();


/* ============================================================
   Charting – Gender Charts
============================================================ */
(function () {

  function renderGenderChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const genderCol = Table.pickColumnSmart(columns, genderKeywords);

    if (!genderCol) {
      renderSkipPanel(parent, "Gender Charts", "Gender column not detected");
      return;
    }

    let male = 0, female = 0, other = 0;

    records.forEach(r => {
      const v = String(r[genderCol] || "").toLowerCase();
      if (!v) return;
      if (v.startsWith("m")) male++;
      else if (v.startsWith("f")) female++;
      else other++;
    });

    if (!male && !female && !other) {
      renderSkipPanel(parent, "Gender Charts", "No gender data");
      return;
    }

    const labels = ["Male","Female","Other"];
    const data = [male,female,other];

    const barPanel = ChartCore.createPanel(parent, "Gender Distribution (Bar)");

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: { labels, datasets: [{ data, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    const piePanel = ChartCore.createPanel(parent, "Gender Distribution (Pie)");

    ChartFactory.renderChart(piePanel, {
      type: "pie",
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  window.Charting.renderGenderChartsAuto = renderGenderChartsAuto;


})();
(function () {

  function renderMarksChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const subjectCol = Table.pickColumnSmart(columns, subjectKeywords);

    const marksCol = Table.pickColumnSmart(columns, marksKeywords);

    if (!subjectCol || !marksCol) {
      // renderSkipPanel(parent,"Marks Charts","Subject or marks column not detected");
      return;
    }

    const map = new Map();

    records.forEach(r => {
      const subject = r[subjectCol];
      const v = Table.parseNumber(r[marksCol]);
      if (!subject || Number.isNaN(v)) return;

      if (!map.has(subject)) map.set(subject, []);
      map.get(subject).push(v);
    });

    if (!map.size) {
      renderSkipPanel(parent, "Marks Charts", "No numeric marks data");
      return;
    }

    const labels = [];
    const avgData = [];

    map.forEach((vals, subject) => {
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      labels.push(subject);
      avgData.push(+avg.toFixed(2));
    });

    /* ===== BAR ===== */
    const barPanel = ChartCore.createPanel(
      parent,
      "Average Marks by Subject (Bar)"
    );

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: {
        labels,
        datasets: [{ data: avgData, borderWidth: 1 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    /* ===== LINE ===== */
    const linePanel = ChartCore.createPanel(
      parent,
      "Average Marks by Subject (Line)"
    );

    ChartFactory.renderChart(linePanel, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: avgData,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  window.Charting.renderMarksChartsAuto = renderMarksChartsAuto;


})();
(function () {

  function renderResultChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const resultCol = Table.pickColumnSmart(columns, resultKeywords);

    if (!resultCol) {
      // renderSkipPanel(parent, "Result Charts", "Result/status column not detected");
      return;
    }

    let pass = 0, fail = 0, other = 0;

    records.forEach(r => {
      const v = String(r[resultCol] || "").toLowerCase();
      if (!v) return;

      if (v.includes("pass")) pass++;
      else if (v.includes("fail")) fail++;
      else other++;
    });

    if (!pass && !fail && !other) {
      renderSkipPanel(parent, "Result Charts", "No result values");
      return;
    }

    const labels = ["Pass","Fail","Other"];
    const data   = [pass, fail, other];

    const barPanel = ChartCore.createPanel(
      parent,
      "Result Summary (Bar)"
    );

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: { labels, datasets: [{ data, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    const donutPanel = ChartCore.createPanel(
      parent,
      "Pass vs Fail (Donut)"
    );

    ChartFactory.renderChart(donutPanel, {
      type: "doughnut",
      data: { labels: ["Pass","Fail"], datasets: [{ data: [pass, fail] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  window.Charting.renderResultChartsAuto = renderResultChartsAuto;


})();
(function () {

  function buildRankCharts(parent, titlePrefix, rows, maxValue) {
    const labels = rows.map(r => r.label);
    const data   = rows.map(r => r.value);

    const barPanel = ChartCore.createPanel(
      parent,
      `${titlePrefix} (Bar)`
    );

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: { labels, datasets: [{ data, borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ...(maxValue ? { max: maxValue } : {})
          }
        }
      }
    });

    const piePanel = ChartCore.createPanel(
      parent,
      `${titlePrefix} (Pie)`
    );

    ChartFactory.renderChart(piePanel, {
      type: "pie",
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  function renderTop6ChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const metricCol =
      window.Table.pickColumnSmart(columns, marksKeywords) ||
      window.Table.pickColumnSmart(columns, attendanceKeywords) ||
      window.Table.pickColumnSmart(columns, percentageKeywords);


    const nameCol = Table.pickColumnSmart(columns, nameKeywords);

    if (!metricCol) {
      renderSkipPanel(parent, "Top-6 Charts", "Metric column not detected");
      return;
    }

    const rows = [];

    records.forEach((r, i) => {
      const v = Table.parseNumber(r[metricCol]);
      if (Number.isNaN(v)) return;

      rows.push({
        label: nameCol ? r[nameCol] : `Row ${i+1}`,
        value: v
      });
    });

    if (!rows.length) {
      renderSkipPanel(parent, "Top-6 Charts", "No numeric values");
      return;
    }

    rows.sort((a,b)=>b.value-a.value);

    buildRankCharts(
      parent,
      `Top-6 ${metricCol}`,
      rows.slice(0,6),
      metricCol.toLowerCase().includes("att") ? 100 : null
    );
  }

  function renderLow6ChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const metricCol =
      window.Table.pickColumnSmart(columns, marksKeywords) ||
      window.Table.pickColumnSmart(columns, attendanceKeywords) ||
      window.Table.pickColumnSmart(columns, percentageKeywords);


    const nameCol = Table.pickColumnSmart(columns, nameKeywords);

    if (!metricCol) {
      renderSkipPanel(parent, "Lowest-6 Charts", "Metric column not detected");
      return;
    }

    const rows = [];

    records.forEach((r, i) => {
      const v = Table.parseNumber(r[metricCol]);
      if (Number.isNaN(v)) return;

      rows.push({
        label: nameCol ? r[nameCol] : `Row ${i+1}`,
        value: v
      });
    });

    if (!rows.length) {
      renderSkipPanel(parent, "Lowest-6 Charts", "No numeric values");
      return;
    }

    rows.sort((a,b)=>a.value-b.value);

    buildRankCharts(
      parent,
      `Lowest-6 ${metricCol}`,
      rows.slice(0,6),
      metricCol.toLowerCase().includes("att") ? 100 : null
    );
  }

  window.Charting.renderTop6ChartsAuto = renderTop6ChartsAuto;
  window.Charting.renderLow6ChartsAuto = renderLow6ChartsAuto;


})();
(function () {

  function collectAttendanceRows() {
    const attCol = Table.pickColumnSmart(columns, attendanceKeywords);

    if (!attCol) return null;

    const nameCol = Table.pickColumnSmart(columns, nameKeywords);

    const rows = [];

    records.forEach((r, i) => {
      let v = Table.parseNumber(r[attCol]);
      if (Number.isNaN(v)) return;

      // normalize 0–1 → %
      if (v > 0 && v <= 1) v *= 100;

      rows.push({
        label: nameCol ? (r[nameCol] || `Row ${i+1}`) : `Row ${i+1}`,
        value: +v.toFixed(2)
      });
    });

    return rows.length ? rows : null;
  }

  function renderAttendanceRank(parent, title, rows) {
    const labels = rows.map(r => r.label);
    const data   = rows.map(r => r.value);

    /* ===== BAR ===== */
    const barPanel = ChartCore.createPanel(parent, `${title} (Bar)`);

    ChartFactory.renderChart(barPanel, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Attendance %",
          data,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    /* ===== LINE ===== */
    const linePanel = ChartCore.createPanel(parent, `${title} (Line)`);

    ChartFactory.renderChart(linePanel, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Attendance %",
          data,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    /* ===== PIE ===== */
    const piePanel = ChartCore.createPanel(parent, `${title} (Pie)`);

    ChartFactory.renderChart(piePanel, {
      type: "pie",
      data: {
        labels,
        datasets: [{ data }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  function renderHighestAttendanceChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const rows = collectAttendanceRows();
    if (!rows) {
      renderSkipPanel(parent, "Top Attendance Charts", "Attendance column not found or no numeric data");
      return;
    }

    rows.sort((a, b) => b.value - a.value);
    const top6 = rows.slice(0, 6);

    if (!top6.length) {
      renderSkipPanel(parent, "Top Attendance Charts", "No attendance values");
      return;
    }

    renderAttendanceRank(parent, "Top-6 Attendance", top6);
  }

  function renderLowestAttendanceChartsAuto(parent) {
    if (!parent || !records || !columns) return;

    const rows = collectAttendanceRows();
    if (!rows) {
      renderSkipPanel(parent, "Lowest Attendance Charts", "Attendance column not found or no numeric data");
      return;
    }

    rows.sort((a, b) => a.value - b.value);
    const low6 = rows.slice(0, 6);

    if (!low6.length) {
      renderSkipPanel(parent, "Lowest Attendance Charts", "No attendance values");
      return;
    }

    renderAttendanceRank(parent, "Lowest-6 Attendance", low6);
  }

  window.Charting.renderHighestAttendanceChartsAuto = renderHighestAttendanceChartsAuto;
  window.Charting.renderLowestAttendanceChartsAuto = renderLowestAttendanceChartsAuto;


})();

Charting.renderChartsPage = function () {
  const pageCharts = document.getElementById("pageCharts");
  if (!pageCharts || !records.length) return;

  const grid = pageCharts.querySelector(".chart-grid");
  if (!grid) return;

  grid.innerHTML = "";   // clear only grid

  const tasks = [
    () => Charting.renderAttendanceChartsAuto(grid),
    () => Charting.renderGenderChartsAuto(grid),
    () => Charting.renderMarksChartsAuto(grid),
    () => Charting.renderResultChartsAuto(grid),
    () => Charting.renderTop6ChartsAuto(grid),
    () => Charting.renderLow6ChartsAuto(grid),
    () => Charting.renderHighestAttendanceChartsAuto(grid),
    () => Charting.renderLowestAttendanceChartsAuto(grid)
  ];

  function runNext() {
    const task = tasks.shift();
    if (!task) return;
    task();
    requestAnimationFrame(runNext);
  }

  requestAnimationFrame(runNext);
};
