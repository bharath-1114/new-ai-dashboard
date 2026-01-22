let pageCount = 0;
let activePage = null;

/* ======================
   CREATE A4 PAGE
====================== */
function createA4Page() {
  const page = document.createElement("div");
  page.className = "a4-page";

  const header = document.createElement("div");
  header.className = "a4-header";

  const canvas = document.createElement("div");
  canvas.className = "a4-canvas";

  const footer = document.createElement("div");
  footer.className = "a4-footer";

  page.appendChild(header);
  page.appendChild(canvas);
  page.appendChild(footer);

  document.getElementById("customContainer").appendChild(page);

  // 🔑 FIX: set active canvas
  currentPageCanvas = canvas;

  updatePageNumbers();
  setActivePage(page);

  return canvas;
}


/* ======================
   ACTIVE PAGE
====================== */
function setActivePage(page) {
  document.querySelectorAll(".a4-page").forEach(p =>
    p.classList.remove("active-print-page")
  );
  page.classList.add("active-print-page");
  activePage = page;
}

/* Click page to activate */
document.addEventListener("click", e => {
  const page = e.target.closest(".a4-page");
  if (page) setActivePage(page);
});

/* ======================
   ADD PAGE BUTTON
====================== */
document.getElementById("addPageBtn").addEventListener("click", () => {
  createA4Page();
});

/* ======================
   DELETE ACTIVE PAGE
====================== */
document.getElementById("deletePageBtn").addEventListener("click", () => {
  const pages = document.querySelectorAll(".a4-page");

  if (pages.length === 1) {
    alert("At least one page must exist.");
    return;
  }

  if (activePage) {
    activePage.remove();
    activePage = null;
  } else {
    pages[pages.length - 1].remove();
  }

  updatePageNumbers();

  const remainingPages = document.querySelectorAll(".a4-page");
  if (remainingPages.length) {
    setActivePage(remainingPages[remainingPages.length - 1]);
  }
});

/* ======================
   PAGE NUMBERS
====================== */
function updatePageNumbers() {
  const pages = document.querySelectorAll(".a4-page");

  pages.forEach((page, index) => {
    page.querySelector(".a4-header").textContent =
      `Custom Dashboard – Page ${index + 1}`;
    page.querySelector(".a4-footer").textContent =
      `Page ${index + 1}`;
  });

  pageCount = pages.length;
}

/* ======================
   PRINT
====================== */
function printPages() {
  prepareChartsForPrint();

  // allow browser to repaint tables & charts
  setTimeout(() => {
    window.print();
  }, 300);
}


/* ======================
   INIT
====================== */
document.addEventListener("DOMContentLoaded", () => {
  createA4Page(); // always start with one page
});



function addCardToCustom(card) {
  card.classList.add("custom-card");

  // screen layout
  card.style.position = "absolute";
  card.style.left = "10px";
  card.style.top = "10px";
  card.style.width = "300px";
  card.style.height = "200px";

  if (!currentPageCanvas) {
    createA4Page();
  }

  currentPageCanvas.appendChild(card);

  enableFreeMove(card);
  enableResize(card);

  checkOverflow(card);
}

function checkOverflow(card) {
  const rect = card.getBoundingClientRect();
  const canvasRect = currentPageCanvas.getBoundingClientRect();

  if (rect.bottom > canvasRect.bottom) {
    // Move to next page
    const nextCanvas = createA4Page();

    card.style.top = "10px";
    card.style.left = "10px";

    nextCanvas.appendChild(card);
    currentPageCanvas = nextCanvas;
  }
}

function enableFreeMove(card) {
  let startX, startY, startLeft, startTop;

  card.addEventListener("mousedown", e => {
    if (e.target.closest(".resize-handle")) return;

    e.preventDefault();
    card.classList.add("dragging");

    const rect = card.getBoundingClientRect();
    const parent = card.parentElement.getBoundingClientRect();

    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left - parent.left;
    startTop = rect.top - parent.top;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      card.style.left = startLeft + dx + "px";
      card.style.top = startTop + dy + "px";
    }

    function onUp() {
      card.classList.remove("dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function enableResize(card) {
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  card.appendChild(handle);

  let startX, startY, startW, startH;

  handle.addEventListener("mousedown", e => {
    e.stopPropagation();
    e.preventDefault();

    startX = e.clientX;
    startY = e.clientY;
    startW = card.offsetWidth;
    startH = card.offsetHeight;

    function onMove(ev) {
      card.style.width = startW + (ev.clientX - startX) + "px";
      card.style.height = startH + (ev.clientY - startY) + "px";
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function prepareChartsForPrint() {
  if (!window.Chart) return;

  Object.values(Chart.instances).forEach(chart => {
    chart.resize();
    chart.update("none");
  });
}

window.addEventListener("beforeprint", prepareChartsForPrint);




