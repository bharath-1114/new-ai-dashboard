/* =========================================================
   AUTH + NAVBAR (MERGED FILE)
   Depends on: app.js (router + showSection)
========================================================= */

/* ===============================
   AUTH STATE
================================ */
function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser"));
  } catch {
    return null;
  }
}

function applyAuthUI() {
  const authUser = getAuthUser();

  const userMenu = document.getElementById("userMenu");
  const emailText = document.getElementById("userEmailText");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");

  if (!userMenu) return;

  if (authUser) {
    userMenu.classList.remove("hidden");
    emailText && (emailText.textContent = authUser.email);
    loginBtn?.classList.add("hidden");
    signupBtn?.classList.add("hidden");
  } else {
    userMenu.classList.add("hidden");
    loginBtn?.classList.remove("hidden");
    signupBtn?.classList.remove("hidden");
  }
}

// ✅ KEEP THIS ONLY IN auth.js (after successful login/signup)
Object.keys(localStorage)
  .filter(k => k.startsWith("uploadCount_"))
  .forEach(k => localStorage.removeItem(k));


/* ===============================
   MOBILE MENU
================================ */
function closeMobileMenuIfOpen() {
  if (window.innerWidth > 950) return;

  document.querySelector(".nav-links")?.classList.add("mobile-hidden");
  document.querySelector(".user-menu")?.classList.add("mobile-hidden");
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".nav-item");
  const logoutBtn = document.getElementById("logoutBtn");
  const menuBtn = document.getElementById("menuToggle");
  const navLinks = document.querySelector(".nav-links");
  const userMenu = document.getElementById("userMenu");

  // 🔥 APPLY AUTH UI (MAIN FIX)
  applyAuthUI();

  /* -------- NAVIGATION -------- */
  navItems.forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;

      location.hash = section;
      closeMobileMenuIfOpen();
    });
  });

  /* -------- LOGOUT -------- */
  logoutBtn?.addEventListener("click", () => {
    // clear auth + upload state
    localStorage.removeItem("authUser");
    localStorage.removeItem("hasData");
  
    // optional: clear guest upload counters
    Object.keys(localStorage)
      .filter(k => k.startsWith("uploadCount_"))
      .forEach(k => localStorage.removeItem(k));
  
    // redirect to home page
    location.href = "/";
  });
  

  /* -------- MOBILE MENU -------- */
  if (menuBtn && navLinks && userMenu) {
    const isMobile = () => window.innerWidth <= 950;

    function applyMobileState() {
      if (isMobile()) {
        closeMobileMenuIfOpen();
      } else {
        navLinks.classList.remove("mobile-hidden");
        userMenu.classList.remove("mobile-hidden");
      }
    }

    applyMobileState();

    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      navLinks.classList.toggle("mobile-hidden");
      userMenu.classList.toggle("mobile-hidden");
    });

    window.addEventListener("resize", applyMobileState);
  }

  // 🔥 Re-apply auth UI after routing changes
  window.addEventListener("hashchange", applyAuthUI);

  // 🔥 Failsafe for direct page load
  setTimeout(applyAuthUI, 0);

  localStorage.removeItem("hasData");
});
