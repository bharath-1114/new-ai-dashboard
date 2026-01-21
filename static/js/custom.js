let pageCount = 0;
let currentPageCanvas = null;
let activePage = null;

document.addEventListener("click", e => {
  const page = e.target.closest(".a4-page");
  if (!page) return;

  document.querySelectorAll(".a4-page").forEach(p => {
    p.classList.remove("active-print-page");
  });

  page.classList.add("active-print-page");
  activePage = page;
});


/* CREATE A4 PAGE */
function createA4Page() {
  pageCount++;

  const page = document.createElement("div");
  page.className = "a4-page";
  page.dataset.page = pageCount;

  const header = document.createElement("div");
  header.className = "a4-header";
  header.innerText = `Custom Dashboard – Page ${pageCount}`;

  const canvas = document.createElement("div");
  canvas.className = "a4-canvas";
  canvas.id = `a4Canvas-${pageCount}`;

  const footer = document.createElement("div");
  footer.className = "a4-footer";
  footer.innerText = `Page ${pageCount}`;

  page.appendChild(header);
  page.appendChild(canvas);
  page.appendChild(footer);

  document.getElementById("customContainer").appendChild(page);

  currentPageCanvas = canvas;
  return canvas;
}

/* INIT FIRST PAGE */
document.getElementById("addPageBtn").addEventListener("click", () => {
  createA4Page();
});


function addCardToCustom(card) {
  card.classList.add("custom-card");

  card.style.left = "10px";
  card.style.top = "10px";
  card.style.width = "300px";
  card.style.height = "200px";

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

function printAllPages() {
  // make sure all pages are visible
  document.querySelectorAll(".a4-page").forEach(p => {
    p.style.display = "block";
  });

  window.print();
}


function printCurrentPage() {
  document.querySelectorAll(".a4-page").forEach(p => {
    p.style.display = p === activePage ? "block" : "none";
  });

  window.print();

  // restore pages after print
  document.querySelectorAll(".a4-page").forEach(p => {
    p.style.display = "block";
  });
}


