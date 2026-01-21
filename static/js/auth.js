window.showSignup = function () {
  const login = document.getElementById("loginSection");
  const signup = document.getElementById("signupSection");
  if (!login || !signup) return;

  login.classList.add("hidden");
  signup.classList.remove("hidden");
};

window.showLogin = function () {
  const login = document.getElementById("loginSection");
  const signup = document.getElementById("signupSection");
  if (!login || !signup) return;

  signup.classList.add("hidden");
  login.classList.remove("hidden");
};

document.addEventListener("DOMContentLoaded", () => {
  /* ===============================
     AUTH PAGE MODE (LOGIN / SIGNUP)
  =============================== */
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (mode === "signup") showSignup();
  else showLogin();

  /* ===============================
     LOGIN FORM
  =============================== */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();

      localStorage.setItem(
        "authUser",
        JSON.stringify({
          email: document.getElementById("loginEmail").value,
          provider: "email"
        })
      );

      window.location.href = "dashboard.html";
    });
  }

  /* ===============================
     SIGNUP FORM
  =============================== */
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", e => {
      e.preventDefault();

      const pass = document.getElementById("signupPassword").value;
      const confirm = document.getElementById("signupConfirm").value;

      if (pass !== confirm) {
        alert("Passwords do not match");
        return;
      }

      localStorage.setItem(
        "authUser",
        JSON.stringify({
          email: document.getElementById("signupEmail").value,
          provider: "email"
        })
      );

      window.location.href = "dashboard.html";
    });
  }

  /* ===============================
     TOGGLE PASSWORD ICON
  =============================== */
  document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", () => {
      const input = icon.previousElementSibling;
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("bi-eye", "bi-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("bi-eye-slash", "bi-eye");
      }
    });
  });

  /* ===============================
     USER MENU (DASHBOARD)
  =============================== */
  const authUser = JSON.parse(localStorage.getItem("authUser"));
  const userMenu = document.getElementById("userMenu");
  const emailText = document.getElementById("userEmailText");
  const logoutBtn = document.getElementById("logoutBtn");

  if (authUser && userMenu && emailText) {
    userMenu.classList.remove("hidden");
    emailText.textContent = authUser.email;
  }

  logoutBtn?.addEventListener("click", () => {
    localStorage.clear();
    location.href = "index.html";
  });
});
