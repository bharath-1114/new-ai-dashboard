(function () {
  let isUploading = false;

  window.records = [];
  window.columns = [];
  window.ChatbotMemory = [];

  function hasData() {
    return Array.isArray(window.records) && window.records.length > 0;
  }

  function hideAllPages() {
    document.querySelectorAll(".section.page")
      .forEach(p => p.classList.add("hidden"));
  }

  function onSectionChange() {
    if (isUploading) return;
    const hash = location.hash.replace("#", "") || "upload";

    hideAllPages();
    document.getElementById(hash)?.classList.remove("hidden");

    if (hash === "table") {
      const empty = document.querySelector("#table .empty-state");
      const pageTable = document.getElementById("pageTable");

      if (hasData()) {
        empty?.classList.add("hidden");
        pageTable?.classList.remove("hidden");
        Table.renderDashboard?.();
      } else {
        empty?.classList.remove("hidden");
        pageTable?.classList.add("hidden");
      }
    }

    if (hash === "fulltable") {
      document.getElementById("fulltable")?.classList.remove("hidden");
    
      if (window.FullTable && typeof FullTable.render === "function") {
        FullTable.render();
      } else {
        console.warn("FullTable module not loaded yet");
      }
      
    }
    
    

    if (hash === "charts") {
      const chartsPage = document.getElementById("charts");
      const pageCharts = document.getElementById("pageCharts");
      const emptyState = chartsPage.querySelector(".empty-state");

      chartsPage?.classList.remove("hidden");

      if (!window.records || !window.records.length) {
        // No data → show empty state
        emptyState?.classList.remove("hidden");
        pageCharts?.classList.add("hidden");
      } else {
        // Data exists → show charts
        emptyState?.classList.add("hidden");
        pageCharts?.classList.remove("hidden");

        requestAnimationFrame(() => {
          Charting.renderChartsPage();
        });
      }
    }

    
    

    if (hash === "custom") {
      document.getElementById("customPage")
        ?.classList.remove("hidden");

      requestAnimationFrame(() => {
        window.renderCustomDashboard?.();
      });
    }
  }

  window.afterUploadSuccess = function (json) {
    isUploading = true;
  
    window.records = json.data || [];
    window.columns = [...new Set(
      window.records.flatMap(r => Object.keys(r))
    )];
  
    localStorage.setItem("hasData", "true");
  
    if (typeof trainChatbot === "function") {
      trainChatbot();
    }
  
    // unlock after upload finishes
    setTimeout(() => {
      isUploading = false;
    }, 0);
  };
  

  document.querySelector("#chatbot .empty-state")
    ?.classList.add("hidden");

  window.addEventListener("hashchange", onSectionChange);
  document.addEventListener("DOMContentLoaded", onSectionChange);

})();
