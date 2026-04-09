// ==================== AUTHENTICATION ====================
// Handles login, registration, logout, guest mode, and auth guards.

function requireAuth() {
  if (isGuest || !currentUserID) {
    showAuthModal();
    return false;
  }
  return true;
}

function showAuthModal() {
  document.getElementById("auth-modal").style.display = "flex";
}

function hideAuthModal() {
  document.getElementById("auth-modal").style.display = "none";
}

function showLoginError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message;
  el.style.display = "block";
}

function clearLoginError() {
  const el = document.getElementById("login-error");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

function handleLogin(event) {
  event.preventDefault();
  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;

  if (!identifier || !password) {
    showLoginError("Please fill in all fields");
    return;
  }

  clearLoginError();
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        currentUserID = data.userID;
        currentUSername = data.username;
        clearLoginError();
        showHome();
      } else {
        showLoginError(data.message || "Invalid email or password");
      }
    })
    .catch(() => showLoginError("Connection error — check your internet"));
}

function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const age = document.getElementById("register-age").value;
  const genderEl = document.querySelector(`input[name="gender"]:checked`);
  const firstName = document.getElementById("register-firstName").value.trim();
  const lastName = document.getElementById("register-lastName").value.trim();

  // Validate email format (issue 2)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  // Validate age is a number (issue 3)
  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    showToast("Age must be a number between 1 and 120", "error");
    return;
  }

  if (!genderEl) {
    showToast("Please select a gender", "error");
    return;
  }
  const gender = genderEl.value;

  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, age, gender, firstName, lastName }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showToast("Registration successful! Please log in.", "success");
        showLogin();
      } else {
        showToast(data.message || "Registration failed", "error");
      }
    })
    .catch(() => showToast("Connection error — check your internet", "error"));
}

function logout() {
  if (isGuest) {
    isGuest = false;
    document.getElementById("home-page").style.display = "none";
    document.getElementById("left-panel").style.display = "flex";
    showLogin();
    return;
  }
  fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then(() => {
      if (usersRefreshInterval) clearInterval(usersRefreshInterval);
      if (ws) ws.close();
      isGuest = false;
      currentUserID = null;
      currentUSername = null;
      currentChatUserID = null;
      document.getElementById("home-page").style.display = "none";
      document.getElementById("left-panel").style.display = "flex";
      showLogin();
    })
    .catch(() => showToast("Error logging out", "error"));
}
