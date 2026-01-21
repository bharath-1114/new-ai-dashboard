// static/chatbot.train.js
(function () {

    window.ChatbotKnowledge = {};
  
    function parseNumber(val) {
      if (val == null) return NaN;
      const n = String(val).replace(/,/g, "").replace("%", "");
      const f = parseFloat(n);
      return Number.isFinite(f) ? f : NaN;
    }
  
    function detectNumericColumns(records, columns) {
      const numeric = [];
  
      columns.forEach(col => {
        let count = 0;
        let valid = 0;
  
        for (let i = 0; i < Math.min(20, records.length); i++) {
          const v = parseNumber(records[i][col]);
          if (!isNaN(v)) valid++;
          count++;
        }
  
        if (valid >= Math.max(3, count * 0.6)) {
          numeric.push(col);
        }
      });
  
      return numeric;
    }
  
    window.trainChatbot = function () {
  
      // ✅ FIXED GUARD
      if (!Array.isArray(window.records) || !window.records.length) return;
  
      const records = window.records;
      const columns = window.columns || [];
  
      // -------------------------------
      // Numeric / categorical detection
      // -------------------------------
      const numericCols = detectNumericColumns(records, columns);
      const categoricalCols = columns.filter(c => !numericCols.includes(c));
  
      // -------------------------------
      // Attendance insights (optional)
      // -------------------------------
      let avgAttendance = null;
      let lowAttendanceCount = null;
  
      if (window.Table?.pickColumnSmart) {
        const attCol = Table.pickColumnSmart(
          columns,
          window.attendanceKeywords || []
        );
  
        if (attCol) {
          const vals = records
            .map(r => parseNumber(r[attCol]))
            .filter(v => !isNaN(v));
  
          if (vals.length) {
            avgAttendance =
              (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
            lowAttendanceCount = vals.filter(v => v < 75).length;
          }
        }
      }
  
      // -------------------------------
      // Score / percentage / numeric avg
      // -------------------------------
      let avgScore = null;
  
      let scoreCol = null;
      if (window.Table?.pickColumnSmart) {
        scoreCol = Table.pickColumnSmart(
          columns,
          window.percentageKeywords || []
        );
      }
  
      // fallback → first numeric column
      if (!scoreCol && numericCols.length) {
        scoreCol = numericCols[0];
      }
  
      if (scoreCol) {
        const vals = records
          .map(r => parseNumber(r[scoreCol]))
          .filter(v => !isNaN(v));
  
        if (vals.length) {
          avgScore =
            (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        }
      }
  
      // -------------------------------
      // STORE UNIVERSAL KNOWLEDGE
      // -------------------------------
      window.ChatbotKnowledge = {
        rows: records.length,
        columns,
        numericCols,
        categoricalCols,
  
        avgAttendance,
        lowAttendanceCount,
        avgScore
      };
  
      console.log("🤖 Chatbot trained (dataset-agnostic)");
      console.table(window.ChatbotKnowledge);
    };
  
  })();
  