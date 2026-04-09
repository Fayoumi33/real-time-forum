// ==================== ROUTER ====================
// Manages page visibility and browser URL (history API).

function showLogin() {
  document.getElementById("register-page").style.display = "none";
  document.getElementById("home-page").style.display = "none";
  document.getElementById("profile-page").style.display = "none";
  document.getElementById("error-page").style.display = "none";
  document.getElementById("login-page").style.display = "flex";
  clearLoginError();
  history.pushState({ page: "login" }, "", "/#login");
}

function showRegister() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "block";
  history.pushState({ page: "register" }, "", "/#register");
}

function showHome() {
  isGuest = false;
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "none";
  document.getElementById("home-page").style.display = "flex";
  document.getElementById("left-panel").style.display = "flex";
  history.pushState({ page: "home" }, "", "/");
  loadPosts();
  loadUsers();
  clearInterval(usersRefreshInterval);
  usersRefreshInterval = setInterval(loadUsers, 5000);
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    connectWebSocket();
  }
}

function showHomePage() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "none";
  document.getElementById("profile-page").style.display = "none";
  document.getElementById("home-page").style.display = "flex";

  document.getElementById("edit-profile-view").style.display = "none";
  document.getElementById("edit-post-view").style.display = "none";
  document.getElementById("profile-content").style.display = "flex";
  document.getElementById("create-post-form").style.display = "none";
  document.getElementById("posts-container").style.display = "block";
  document.getElementById("comments-sidebar").style.display = "none";

  currentCategory = "All";
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.toggle("active", item.textContent.trim() === "All");
  });

  const menu = document.getElementById("categories-menu");
  if (menu) menu.style.display = "none";

  window.scrollTo({ top: 0, behavior: "smooth" });
  history.pushState({ page: "home" }, "", "/");
  loadPosts();
}

function continueAsGuest() {
  isGuest = true;
  currentUserID = null;
  currentUSername = null;
  document.getElementById("login-page").style.display = "none";
  document.getElementById("home-page").style.display = "flex";
  document.getElementById("left-panel").style.display = "none";
  history.pushState({ page: "home" }, "", "/");
  loadPosts();
}

function showErrorPage(code, title, description) {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "none";
  document.getElementById("home-page").style.display = "none";
  document.getElementById("profile-page").style.display = "none";

  document.getElementById("error-code-text").textContent = code;
  document.getElementById("error-title-text").textContent = title;
  document.getElementById("error-desc-text").textContent = description;
  document.getElementById("error-page").style.display = "block";
  history.pushState({ page: "error" }, "", "/#error");
}

function goFromErrorPage() {
  document.getElementById("error-page").style.display = "none";
  fetch("/api/session/check", { credentials: "include" })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        currentUserID = data.userID;
        currentUSername = data.username;
        showHome();
      } else {
        showLogin();
      }
    })
    .catch(() => showLogin());
}

function handlePopState(e) {
  const page = e.state ? e.state.page : "home";
  switch (page) {
    case "profile":
      if (currentUserID) {
        document.getElementById("home-page").style.display = "none";
        document.getElementById("profile-page").style.display = "block";
        loadProfileData();
        switchTab("my-posts");
      } else {
        showLogin();
      }
      break;
    case "register":
      document.getElementById("login-page").style.display = "none";
      document.getElementById("register-page").style.display = "block";
      break;
    case "login":
      document.getElementById("register-page").style.display = "none";
      document.getElementById("home-page").style.display = "none";
      document.getElementById("profile-page").style.display = "none";
      document.getElementById("login-page").style.display = "flex";
      break;
    default:
      if (currentUserID || isGuest) {
        showHomePage();
      } else {
        showLogin();
      }
  }
}
