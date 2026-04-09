// ==================== APP ENTRY POINT ====================
// Wires all modules together: session check, event listeners, init.

// Close categories dropdown when clicking outside
document.addEventListener("click", function (e) {
  if (!e.target.closest("#categories-dropdown")) {
    const menu = document.getElementById("categories-menu");
    if (menu) menu.style.display = "none";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // Show 404 for unknown URL paths (this SPA only lives at "/")
  if (window.location.pathname !== "/") {
    showErrorPage(
      "404",
      "Page Not Found",
      "Sorry, the page you are looking for doesn't exist or has been moved."
    );
    return;
  }

  // Clear login error when user starts typing
  document.getElementById("login-identifier").addEventListener("input", clearLoginError);
  document.getElementById("login-password").addEventListener("input", clearLoginError);

  // Browser back/forward navigation
  window.addEventListener("popstate", handlePopState);

  // Session check on every page load/refresh
  fetch("/api/session/check", { credentials: "include" })
    .then((r) => {
      if (!r.ok) throw new Error("not ok");
      return r.json();
    })
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

  // Form submissions
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);

  const newPostForm = document.getElementById("new-post-form");
  if (newPostForm) newPostForm.addEventListener("submit", handleCreatePost);

  const addCommentForm = document.getElementById("add-comment-form");
  if (addCommentForm) addCommentForm.addEventListener("submit", handleAddComment);

  // Throttled scroll: load older messages when scrolled to top
  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.addEventListener(
    "scroll",
    throttle(function () {
      if (this.scrollTop === 0 && !isLoadingMessages && currentChatUserID) {
        isLoadingMessages = true;
        messageOffset += 10;
        loadMessages(currentChatUserID, messageOffset);
      }
    }, 300)
  );

  // Send message on Enter key
  document.getElementById("message-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Typing indicator: broadcast typing state to the current chat partner
  document.getElementById("message-input").addEventListener("input", function () {
    if (!currentChatUserID) return;
    if (this.value.length > 0) {
      sendTypingEvent(true);
      // Reset the stop-typing timer on every keystroke
      clearTimeout(typingStopTimer);
      typingStopTimer = setTimeout(() => sendTypingEvent(false), 2000);
    } else {
      // Input cleared (e.g. user deleted everything)
      clearTimeout(typingStopTimer);
      sendTypingEvent(false);
    }
  });
});
