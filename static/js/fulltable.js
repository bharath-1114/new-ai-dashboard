/* =========================================================
   fulltable.js – Raw vs Cleaned Dataset Viewer
========================================================= */
(function () {

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isNumericString(v) {
    return typeof v === "string" && /^[\d.,%]+$/.test(v.trim());
  }

  function cleanDataset(records) {
    const cleaned = [];
    const changes = new Set();

    records.forEach((row, rIdx) => {
      const newRow = {};
      Object.entries(row).forEach(([k, v]) => {
        let cv = v;

        if (typeof v === "string") {
          const t = v.trim();

          if (isNumericString(t)) {
            const n = Table.parseNumber(t);
            if (!Number.isNaN(n)) {
              cv = n;
              if (t !== String(n)) changes.add(`${rIdx}:${k}`);
            } else {
              cv = t;
            }
          } else {
            cv = t;
            if (t !== v) changes.add(`${rIdx}:${k}`);
          }
        }

        newRow[k] = cv;
      });

      cleaned.push(newRow);
    });

    return { cleaned, changes };
  }

  function renderHighlightedTable(container, rows, changedCells) {
    container.innerHTML = "";

    if (!rows.length) return;

    const cols = Object.keys(rows[0]);
    const table = document.createElement("table");
    table.className = "simple-table";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      cols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = r[c] ?? "";

        if (changedCells.has(`${i}:${c}`)) {
          td.classList.add("cell-cleaned");
          td.title = "Cleaned value";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function render() {
    if (!Array.isArray(window.records) || !window.records.length) return;

    // toggle blocks
    document.querySelector("#fulltable .empty-state")?.classList.add("hidden");
    document.getElementById("rawTableBlock")?.classList.remove("hidden");
    document.getElementById("cleanTableBlock")?.classList.remove("hidden");

    // raw
    const rawTarget = document.getElementById("rawTable");
    rawTarget.innerHTML = "";
    Table.renderSimpleTable(rawTarget, window.records.slice(0, 500));

    // cleaned
    const { cleaned, changes } = cleanDataset(deepClone(window.records));
    renderHighlightedTable(
      document.getElementById("cleanTable"),
      cleaned.slice(0, 500),
      changes
    );
  }

  window.FullTable = { render };

})();
