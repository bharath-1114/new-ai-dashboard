/* ================================
   DATA GUARD
================================ */
function hasUploadedData() {
  return localStorage.getItem("hasData") === "true";
}


function guardSectionAccess(sectionId) {
  if (!hasUploadedData() && sectionId !== "upload") {
    alert("Please upload a CSV file first.");
    location.hash = "upload";
    return false;
  }
  return true;
}

/* ================================
   SECTION SWITCHER
================================ */
function showSection(id) {
  if (!guardSectionAccess(id)) return;

  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );

  const target = document.getElementById(id);
  if (target) {
    target.classList.remove("hidden");
    localStorage.setItem("lastSection", id);
  }
}

/* ================================
   ROUTER
================================ */
function handleRoute() {
  const section =
    location.hash.replace("#", "") ||
    localStorage.getItem("lastSection") ||
    "upload";

  showSection(section);
}

window.addEventListener("load", handleRoute);
window.addEventListener("hashchange", handleRoute);

/* ================================
   NAVIGATION HELPERS
================================ */
function goUpload() {
  location.hash = "upload";
}

function goTablesPage() {
  location.hash = "table";
}

function goChartsPage() {
  location.hash = "charts";
}

