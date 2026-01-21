function showSection(id) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );

  const target = document.getElementById(id);
  if (target) {
    target.classList.remove("hidden");
    localStorage.setItem("lastSection", id);
  }
}

function handleRoute() {
  const section =
    location.hash.replace("#", "") ||
    localStorage.getItem("lastSection") ||
    "upload";

  showSection(section);
}

window.addEventListener("load", handleRoute);
window.addEventListener("hashchange", handleRoute);

function goUpload() {
  location.hash = "upload";
}

function goTablesPage() {
  location.hash = "table";
}

function goChartsPage() {
  location.hash = "charts";
}
