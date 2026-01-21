/* =========================================================
   custom.js – Custom Dashboard (Drag, Resize, Clone)
   Depends on:
   - table.js (enableAddToCustom)
   - chart.js (enableAddChartToCustom, ChartCore)
========================================================= */

(function () {

    /* ================= GLOBAL REGISTRY ================= */
    window.CustomPanelRegistry = window.CustomPanelRegistry || new Set();
  
    /* ===================================================
       DRAGGING (FREE MOVE)
    =================================================== */
    window.enableFreeMove = function (card) {
      let startX, startY, startLeft, startTop;
  
      card.style.position = "absolute";
  
      card.addEventListener("mousedown", e => {
        // ❌ ignore resize handle & remove button
        if (e.target.closest(".resize-handle, .remove-btn")) return;
  
        e.preventDefault();
        card.classList.add("dragging");
  
        const cardRect = card.getBoundingClientRect();
        const containerRect = card.parentElement.getBoundingClientRect();
  
        startX = e.clientX;
        startY = e.clientY;
        startLeft = cardRect.left - containerRect.left;
        startTop  = cardRect.top  - containerRect.top;
  
        function onMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
  
          let newLeft = startLeft + dx;
          let newTop  = startTop  + dy;
  
          // ✅ keep inside container
          newLeft = Math.max(0, Math.min(newLeft, containerRect.width - cardRect.width));
          newTop  = Math.max(0, Math.min(newTop,  containerRect.height - cardRect.height));
  
          card.style.left = newLeft + "px";
          card.style.top  = newTop  + "px";
        }
  
        function onUp() {
          card.classList.remove("dragging");
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
  
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    };
  
    /* ===================================================
       RESIZE
    =================================================== */
    window.enableResize = function (card, type = "table") {
      const handle = card.querySelector(".resize-handle");
      if (!handle) return;
  
      let startX, startY, startW, startH;
  
      handle.addEventListener("mousedown", e => {
        e.preventDefault();
        e.stopPropagation();
  
        const rect = card.getBoundingClientRect();
        const container = card.parentElement.getBoundingClientRect();
  
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
  
        function onMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
  
          let newW = startW + dx;
          let newH = startH + dy;
  
          // ✅ clamp inside container
          newW = Math.min(newW, container.right - rect.left);
          newH = Math.min(newH, container.bottom - rect.top);
  
          // minimum size
          newW = Math.max(180, newW);
          newH = Math.max(120, newH);
  
          card.style.width = newW + "px";
          card.style.height = newH + "px";
  
          // 🔄 resize chart if exists
          if (type === "chart" && window.Chart) {
            const canvas = card.querySelector("canvas");
            if (canvas) {
              Chart.getChart(canvas)?.resize();
            }
          }
        }
  
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
  
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    };
  
    /* ===================================================
       CUSTOM PAGE RENDER (called by main.js)
    =================================================== */
    window.renderCustomDashboard = function () {
      const page = document.getElementById("customPage");
      const container = document.getElementById("customContainer");
      if (!page || !container) return;
  
      page.classList.remove("hidden");
  
      // ensure container positioning
      container.style.position = "relative";
      container.style.minHeight = "600px";
    };
  
  })();
  