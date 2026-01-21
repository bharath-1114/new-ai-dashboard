// app.js
if (localStorage.getItem("hasData") === "true") {
  document.body.classList.add("has-file");
}


// ===== GLOBAL STATE =====
window.isFileUploaded = localStorage.getItem("hasData") === "true";
window.isUploading = false;


// ===== PAGE STATE HANDLER =====
function updatePageState(section) {
  if (!section || section.id === "upload") return;

  const emptyState = section.querySelector(".empty-state");
  const dashboard = section.querySelector(".dashboard");
  if (!emptyState || !dashboard) return;

  if (window.isUploading || window.isFileUploaded) {
    emptyState.classList.add("hidden");
    dashboard.classList.remove("hidden");
  } else {
    emptyState.classList.remove("hidden");
    dashboard.classList.add("hidden");
  }
}




// ===== SHOW SECTION =====
window.showSection = function (id) {
  document.querySelectorAll(".section").forEach(sec => {
    sec.classList.add("hidden");
  });

  const section = document.getElementById(id);
  if (!section) return;

  section.classList.remove("hidden");
  localStorage.setItem("lastSection", id);

  updatePageState(section);
};

// ===== ROUTER =====
function handleRoute() {
  const section =
    location.hash.replace("#", "") ||
    localStorage.getItem("lastSection") ||
    "upload";

  showSection(section);
}

// ===== NAV =====
document.querySelectorAll(".nav-item").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    location.hash = link.dataset.section;
  });
});

function openUpgradeModal() {
  document.getElementById("upgradeModal")?.classList.remove("hidden");
}

function closeUpgradeModal() {
  document.getElementById("upgradeModal")?.classList.add("hidden");
}

function goLogin() {
  window.location.href = "auth.html?mode=login";
}

function goSignup() {
  window.location.href = "auth.html?mode=signup";
}


// ===== INIT =====
document.addEventListener("DOMContentLoaded", handleRoute);
window.addEventListener("hashchange", handleRoute);
