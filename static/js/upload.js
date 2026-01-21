// ==================================================
// upload.js (FINAL – FIXED)
// ==================================================

// ---------------- ELEMENTS ----------------
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

const idleState = document.getElementById("idleState");
const loadingState = document.getElementById("loadingState");
const fileState = document.getElementById("fileState");

const fileNameEl = document.getElementById("fileName");
const fileSizeEl = document.getElementById("fileSize");

const removeBtn = document.getElementById("removeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const dataActions = document.getElementById("dataActions");
const dataSummary = document.getElementById("dataSummary");

// ---------------- DATA ----------------
let parsedData = [];
let currentFileName = "";

// ---------------- HELPERS ----------------
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

// ---------------- FILE HANDLER ----------------
async function handleFile(file) {
  const authUser = JSON.parse(localStorage.getItem("authUser"));

  // 🚫 must be logged in or guest
  if (!authUser) {
    location.href = "/auth.html?mode=login";
    return;
  }

  // 🚫 file validation
  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Please upload a CSV file");
    return;
  }

  const email = authUser.email || "guest";
  const isGuest = authUser.provider === "guest";

  const uploadKey = `uploadCount_${email}`;
  const uploadCount = Number(localStorage.getItem(uploadKey) || 0);

  // 🚫 block guest second upload (even after reload)
  if (isGuest && uploadCount >= 1) {
    openUpgradeModal?.();
    return;
  }

  // ---------------- UI: UPLOAD START ----------------
  window.isUploading = true;
  window.isFileUploaded = false;

  document.body.classList.add("has-file");
  hide(idleState);
  show(loadingState);

  // hide empty states everywhere
  // showSection("table");

  // ---------------- SEND TO BACKEND ----------------
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    headers: {
      "X-User-Email": email,
      "X-User-Provider": authUser.provider || "guest"
    },
    body: form
  });

  // ---------------- HANDLE SERVER RESPONSE ----------------
  if (!res.ok) {
    window.isUploading = false;
    hide(loadingState);
    show(idleState);

    if (res.status === 403) {
      openUpgradeModal?.();
      return;
    }

    const err = await res.json();
    alert(err.detail || "Upload failed");
    return;
  }

  const json = await res.json();


  // ---------------- SUCCESS ----------------
  parsedData = json.data || [];
  currentFileName = json.filename || file.name;

  // 🔒 LOCK upload count ONLY AFTER SUCCESS
  localStorage.setItem(uploadKey, uploadCount + 1);

  window.isUploading = false;
  window.isFileUploaded = true;
  localStorage.setItem("hasData", "true");

  hide(loadingState);
  show(fileState);
  show(dataActions);

  fileNameEl.textContent = currentFileName;
  fileSizeEl.textContent = (file.size / 1024).toFixed(1) + " KB";
  dataSummary.textContent = `${json.rows} rows`;

    // 🔗 CONNECT TO MAIN.JS
  window.afterUploadSuccess?.(json);
  // showSection("table");
}

// ---------------- EVENTS ----------------
dropZone.onclick = () => fileInput.click();

fileInput.onchange = e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
};

dropZone.ondragover = e => {
  e.preventDefault();
  dropZone.classList.add("active");
};

dropZone.ondragleave = () => dropZone.classList.remove("active");

dropZone.ondrop = e => {
  e.preventDefault();
  dropZone.classList.remove("active");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
};

// ---------------- REMOVE FILE ----------------
removeBtn.onclick = () => {
  const authUser = JSON.parse(localStorage.getItem("authUser"));
  const isGuest = authUser?.provider === "guest";

  window.isUploading = false;
  window.isFileUploaded = false;

  localStorage.removeItem("hasData");
  document.body.classList.remove("has-file");

  parsedData = [];
  currentFileName = "";

  hide(fileState);
  hide(dataActions);
  show(idleState);

  fileInput.value = "";

  // guest cannot upload again
  if (isGuest) {
    openUpgradeModal?.();
    return;
  }

  showSection("upload");
};

// ---------------- DOWNLOAD JSON ----------------
downloadBtn.onclick = () => {
  if (!parsedData.length) return;

  const blob = new Blob([JSON.stringify(parsedData, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName.replace(".csv", ".json");
  a.click();
};
