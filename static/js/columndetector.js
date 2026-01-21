// static/columnDetector.js
(function (global) {

    function pickColumnSmart(columns, keywords) {
      if (!columns || !columns.length) return null;
  
      const lower = columns.map(c => String(c).toLowerCase());
  
      for (const k of keywords) {
        const i = lower.findIndex(c => c === k || c.includes(k));
        if (i !== -1) return columns[i];
      }
      return null;
    }
  
    function parseNumber(v) {
      if (v == null) return NaN;
      const n = String(v).replace(/,/g, "").replace("%", "");
      const f = parseFloat(n);
      return Number.isFinite(f) ? f : NaN;
    }
  
    // ✅ DO NOT overwrite Table
    global.Table = global.Table || {};
    global.Table.pickColumnSmart = pickColumnSmart;
    global.Table.parseNumber = parseNumber;
  
  })(window);
  