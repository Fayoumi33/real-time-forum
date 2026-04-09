let currentUserID = null;
let currentUSername = null;
let messageOffset = 0;
let isLoadingMessages = false;
let isGuest = false;

function showLogin() {
  document.getElementById("register-page").style.display = "none";
  document.getElementById("home-page").style.display = "none";
  document.getElementById("profile-page").style.display = "none";
  document.getElementById("error-page").style.display = "none";
  document.getElementById("login-page").style.display = "flex";
  clearLoginError();
  history.pushState({ page: "login" }, "", "/#login");
}

// ==================== GUEST MODE ====================

function continueAsGuest() {
  isGuest = true;
  currentUserID = null;
  currentUSername = null;
  document.getElementById("login-page").style.display = "none";
  document.getElementById("home-page").style.display = "block";
  document.getElementById("left-panel").style.display = "none";
  history.pushState({ page: "home" }, "", "/");
  loadPosts();
}

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

// ==================== LOGIN INLINE ERROR ====================

function showLoginError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message;
  el.style.display = "block";
}

function clearLoginError() {
  const el = document.getElementById("login-error");
  el.style.display = "none";
  el.textContent = "";
}

// ==================== ERROR PAGE ====================

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
  // Re-check session — error page may have shown before session check completed
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

// ==================== TOAST NOTIFICATIONS ====================

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 300);
  }, duration);
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

function showRegister() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "block";
  history.pushState({ page: "register" }, "", "/#register");
}

function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("register-username").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const age = document.getElementById("register-age").value;
  const gender = document.querySelector(`input[name="gender"]:checked`).value;
  const firstName = document.getElementById("register-firstName").value;
  const lastName = document.getElementById("register-lastName").value;

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

let ws = null;
let currentPostID = null;
let currentChatUserID = null;
let usersRefreshInterval = null;
let currentCategory = "All";

function showHome() {
  isGuest = false;
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "none";
  document.getElementById("home-page").style.display = "block";
  document.getElementById("left-panel").style.display = "flex";
  history.pushState({ page: "home" }, "", "/");
  loadPosts();
  loadUsers();
  usersRefreshInterval = setInterval(loadUsers, 10000);
  connectWebSocket();
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

// ==================== THROTTLE ====================

function throttle(fn, delay) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// ==================== DATE FORMAT ====================

function formatDate(dateStr) {
  if (!dateStr) return "";
  // SQLite stores as "YYYY-MM-DD HH:MM:SS", convert to ISO for reliable parsing
  const iso = dateStr.replace(" ", "T");
  const date = new Date(iso);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  // Handle browser back/forward navigation
  window.addEventListener("popstate", function (e) {
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
  });

  // On every page load/refresh, check if the session is still valid
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

  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("register-form").addEventListener("submit", handleRegister);

  const newPostForm = document.getElementById("new-post-form");
  if (newPostForm) newPostForm.addEventListener("submit", handleCreatePost);

  const addCommentForm = document.getElementById("add-comment-form");
  if (addCommentForm) addCommentForm.addEventListener("submit", handleAddComment);

  // Throttled scroll handler: load older messages when scrolled to top
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
});

// ==================== CATEGORIES DROPDOWN ====================

function toggleCategoriesDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById("categories-menu");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function filterByCategory(category) {
  currentCategory = category;
  document.getElementById("categories-menu").style.display = "none";
  // Update active item highlight
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.toggle("active", item.textContent.trim() === category);
  });
  // Close create-post form and comments sidebar, show posts list
  document.getElementById("create-post-form").style.display = "none";
  document.getElementById("posts-container").style.display = "block";
  document.getElementById("comments-sidebar").style.display = "none";
  loadPosts();
}

// Close dropdown when clicking outside
document.addEventListener("click", function (e) {
  if (!e.target.closest("#categories-dropdown")) {
    const menu = document.getElementById("categories-menu");
    if (menu) menu.style.display = "none";
  }
});

// ==================== POSTS ====================

function loadPosts() {
  const url =
    currentCategory && currentCategory !== "All"
      ? `/api/posts?category=${encodeURIComponent(currentCategory)}`
      : "/api/posts";

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const container = document.getElementById("posts-container");
        container.innerHTML = "";
        data.posts.forEach((post) => {
          const postDiv = document.createElement("div");
          postDiv.className = "post-card";
          const badges = (post.categories || [])
            .map((cat) => `<span class="category-badge">${cat}</span>`)
            .join("");
          postDiv.innerHTML = `
            <div class="post-header">
              <h2>${post.title}</h2>
              <div class="post-categories">${badges}</div>
            </div>
            <p>${post.content}</p>
            <p class="post-author">By: ${post.username}</p>
            <div class="post-stats">
              <button class="react-btn like-btn ${post.user_reaction === 'like' ? 'active-like' : ''}"
                onclick="reactToPost(${post.id}, 'like', this)">
                👍 <span class="count">${post.likes_count}</span>
              </button>
              <button class="react-btn dislike-btn ${post.user_reaction === 'dislike' ? 'active-dislike' : ''}"
                onclick="reactToPost(${post.id}, 'dislike', this)">
                👎 <span class="count">${post.dislikes_count}</span>
              </button>
              <button class="react-btn comments-btn" onclick="showComments(${post.id})">
                💬 <span class="count">${post.comments_count}</span> Comments
              </button>
            </div>
          `;
          container.appendChild(postDiv);
        });
      }
    })
    .catch(() => showToast("Failed to load posts", "error"));
}

function showCreatePostForm() {
  if (!requireAuth()) return;
  document.getElementById("posts-container").style.display = "none";
  document.getElementById("create-post-form").style.display = "block";
}

function hideCreatePostForm() {
  document.getElementById("create-post-form").style.display = "none";
  document.getElementById("posts-container").style.display = "block";
  document.getElementById("new-post-form").reset();
}

function handleCreatePost(event) {
  event.preventDefault();
  if (!requireAuth()) return;
  const title = document.getElementById("post-title").value;
  const content = document.getElementById("post-content").value;
  const checkboxes = document.querySelectorAll('input[name="category"]:checked');
  const categories = Array.from(checkboxes).map((cb) => cb.value);

  if (categories.length === 0) {
    showToast("Please choose at least one category", "warning");
    return;
  }

  fetch("/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, content, categories }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showToast("Post created successfully!", "success");
        hideCreatePostForm();
        loadPosts();
      } else {
        showToast(data.message || "Error creating post", "error");
      }
    })
    .catch(() => showToast("Error creating post", "error"));
}

function showComments(postID) {
  currentPostID = postID;
  fetch(`/api/posts?id=${postID}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const commentsList = document.getElementById("comments-list");
        commentsList.innerHTML = "";

        if (data.comments && data.comments.length > 0) {
          data.comments.forEach((comment) => {
            let commentsDiv = document.createElement("div");
            commentsDiv.className = "comment-item";
            commentsDiv.innerHTML = `
              <div class="comment-author">${comment.username}</div>
              <div class="comment-content">${comment.content}</div>
              <div class="comment-stats">
                <button class="react-btn like-btn ${comment.user_reaction === 'like' ? 'active-like' : ''}"
                  onclick="reactToComment(${comment.id}, 'like', this)">
                  👍 <span class="count">${comment.likes_count}</span>
                </button>
                <button class="react-btn dislike-btn ${comment.user_reaction === 'dislike' ? 'active-dislike' : ''}"
                  onclick="reactToComment(${comment.id}, 'dislike', this)">
                  👎 <span class="count">${comment.dislikes_count}</span>
                </button>
              </div>
            `;
            commentsList.appendChild(commentsDiv);
          });
        } else {
          commentsList.innerHTML =
            '<p style="color: rgba(255,255,255,0.5);">No comments yet. Be the first!</p>';
        }

        document.getElementById("comments-sidebar").style.display = "block";
      }
    })
    .catch(() => showToast("Failed to load comments", "error"));
}

function hideComments() {
  document.getElementById("comments-sidebar").style.display = "none";
}

function handleAddComment(event) {
  event.preventDefault();
  if (!requireAuth()) return;
  const content = document.getElementById("comment-content").value;
  if (!content.trim()) {
    showToast("Please write something", "warning");
    return;
  }
  fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: currentPostID, content }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("comment-content").value = "";
        showComments(currentPostID);
      } else {
        showToast(data.message || "Failed to add comment", "error");
      }
    })
    .catch(() => showToast("Failed to add comment", "error"));
}

// ==================== REACTIONS ====================

function reactToPost(postID, type, btn) {
  if (!requireAuth()) return;
  fetch("/api/likes/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postID, type }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) return;
      // Find sibling buttons inside the same post-stats div
      const statsDiv = btn.closest(".post-stats");
      const likeBtn = statsDiv.querySelector(".like-btn");
      const dislikeBtn = statsDiv.querySelector(".dislike-btn");

      likeBtn.querySelector(".count").textContent = data.likes;
      dislikeBtn.querySelector(".count").textContent = data.dislikes;

      likeBtn.classList.toggle("active-like", data.user_reaction === "like");
      dislikeBtn.classList.toggle("active-dislike", data.user_reaction === "dislike");
    });
}

function reactToComment(commentID, type, btn) {
  if (!requireAuth()) return;
  fetch("/api/likes/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment_id: commentID, type }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) return;
      const statsDiv = btn.closest(".comment-stats");
      const likeBtn = statsDiv.querySelector(".like-btn");
      const dislikeBtn = statsDiv.querySelector(".dislike-btn");

      likeBtn.querySelector(".count").textContent = data.likes;
      dislikeBtn.querySelector(".count").textContent = data.dislikes;

      likeBtn.classList.toggle("active-like", data.user_reaction === "like");
      dislikeBtn.classList.toggle("active-dislike", data.user_reaction === "dislike");
    });
}

// ==================== WEBSOCKET ====================

function connectWebSocket() {
  ws = new WebSocket("ws://localhost:8080/ws");
  ws.onopen = () => console.log("WebSocket connected");
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleIncomingMessage(message);
  };
  ws.onclose = () => setTimeout(connectWebSocket, 3000);
  ws.onerror = (error) => console.log("WebSocket error:", error);
}

// ==================== USERS LIST ====================

function loadUsers() {
  fetch("/api/users")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const container = document.getElementById("all-users");
        // Remember which user is currently active
        container.innerHTML = "";
        data.users.forEach((user) => {
          if (user.id === currentUserID) return;
          const div = document.createElement("div");
          div.dataset.userId = user.id;
          div.dataset.username = user.username;

          const isActive = user.id === currentChatUserID;
          const statusDot = user.online
            ? `<span class="user-dot-online">&#9679;</span>`
            : `<span class="user-dot-offline">&#9679;</span>`;

          div.className = `user-item${isActive ? " user-active" : ""}${!user.online ? " user-offline" : ""}`;

          if (user.online) {
            div.onclick = () => openChat(user.id, user.username);
          } else {
            div.onclick = () => showToast(`${user.username} is offline`, "info");
          }

          div.innerHTML = `${statusDot}<span class="user-name">${user.username}</span>`;

          container.appendChild(div);
        });
      }
    });
}

// ==================== CHAT ====================

function openChat(userID, username) {
  // Clear unread badge for this user
  clearUnreadBadge(userID);

  currentChatUserID = userID;
  messageOffset = 0;
  isLoadingMessages = false;

  document.getElementById("chat-with-name").textContent = username;
  document.getElementById("messages-container").innerHTML = "";

  // Show chat section below users (users stay visible)
  document.getElementById("left-panel").classList.add("chat-active");
  document.getElementById("chat-view").style.display = "flex";

  // Highlight active user
  document.querySelectorAll(".user-item").forEach((el) => {
    el.classList.toggle("user-active", parseInt(el.dataset.userId) === userID);
  });

  loadMessages(userID, 0);
}

function closeChat() {
  currentChatUserID = null;
  document.getElementById("chat-view").style.display = "none";
  document.getElementById("left-panel").classList.remove("chat-active");
  // Remove active highlight
  document.querySelectorAll(".user-item").forEach((el) =>
    el.classList.remove("user-active")
  );
}

// Keep backward compat if anything references backToForum
function backToForum() {
  closeChat();
}

function loadMessages(userID, offset = 0) {
  fetch(`/api/messages?userID=${userID}&offset=${offset}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const container = document.getElementById("messages-container");

        if (offset === 0) {
          container.innerHTML = "";
        }

        if (data.messages && data.messages.length > 0) {
          // Save scroll height before inserting (for scroll position restore on pagination)
          const scrollHeightBefore = container.scrollHeight;

          // Backend returns messages DESC (newest first).
          // Prepending each message in order puts oldest at top, newest at bottom.
          data.messages.forEach((msg) => {
            const div = document.createElement("div");
            const isMyMessage = msg.sender_id === currentUserID;
            div.className = `message-item ${isMyMessage ? "my-message" : "their-message"}`;
            div.innerHTML = `
              <div class="message-author">${msg.sender_username}</div>
              <div class="message-content">${msg.content}</div>
              <div class="message-time">${formatDate(msg.created_at)}</div>
            `;
            container.prepend(div);
          });

          if (offset === 0) {
            // Initial load: scroll to bottom to show newest messages
            container.scrollTop = container.scrollHeight;
          } else {
            // Pagination: restore scroll position so viewport doesn't jump
            container.scrollTop = container.scrollHeight - scrollHeightBefore;
          }
        }

        isLoadingMessages = false;
      }
    })
    .catch(() => {
      isLoadingMessages = false;
    });
}

function sendMessage() {
  if (!requireAuth()) return;
  const input = document.getElementById("message-input");
  const content = input.value.trim();
  if (!content || !currentChatUserID) return;

  const message = {
    type: "private_message",
    from: String(currentUserID),
    fromUsername: currentUSername,
    to: String(currentChatUserID),
    content: content,
  };
  ws.send(JSON.stringify(message));
  input.value = "";

  const container = document.getElementById("messages-container");
  const div = document.createElement("div");
  div.className = "message-item my-message";
  div.innerHTML = `
    <div class="message-author">${currentUSername}</div>
    <div class="message-content">${content}</div>
    <div class="message-time">${new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Refresh users list so order updates (current chat moves to top)
  loadUsers();
}

function handleIncomingMessage(message) {
  if (String(currentChatUserID) === message.from) {
    // Message is from the currently open chat — display it
    const container = document.getElementById("messages-container");
    const div = document.createElement("div");
    div.className = "message-item their-message";
    div.innerHTML = `
      <div class="message-author">${message.fromUsername || message.from}</div>
      <div class="message-content">${message.content}</div>
      <div class="message-time">${new Date().toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  } else {
    // Message from a different user — show unread badge
    markUnread(message.from);
  }

  // Refresh users list so order updates (sender moves to top)
  loadUsers();
}

function markUnread(senderID) {
  document.querySelectorAll(".user-item").forEach((item) => {
    if (String(item.dataset.userId) === String(senderID)) {
      if (!item.querySelector(".unread-badge")) {
        const badge = document.createElement("span");
        badge.className = "unread-badge";
        badge.textContent = "●";
        item.appendChild(badge);
      }
    }
  });
}

function clearUnreadBadge(userID) {
  document.querySelectorAll(".user-item").forEach((item) => {
    if (parseInt(item.dataset.userId) === userID) {
      const badge = item.querySelector(".unread-badge");
      if (badge) badge.remove();
    }
  });
}

// ==================== PROFILE PAGE ====================

let currentTab = "my-posts";

function showHomePage() {
  // Hide every page that is not home
  document.getElementById("login-page").style.display = "none";
  document.getElementById("register-page").style.display = "none";
  document.getElementById("profile-page").style.display = "none";

  // Show the home page
  document.getElementById("home-page").style.display = "block";

  // Reset profile's internal sub-views so they're clean next visit
  document.getElementById("edit-profile-view").style.display = "none";
  document.getElementById("edit-post-view").style.display = "none";
  document.getElementById("profile-content").style.display = "flex";

  // Close the create-post form and show the posts list
  document.getElementById("create-post-form").style.display = "none";
  document.getElementById("posts-container").style.display = "block";

  // Close comments sidebar
  document.getElementById("comments-sidebar").style.display = "none";

  // Reset category filter to "All"
  currentCategory = "All";
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.toggle("active", item.textContent.trim() === "All");
  });

  // Close categories dropdown if open
  const menu = document.getElementById("categories-menu");
  if (menu) menu.style.display = "none";

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  history.pushState({ page: "home" }, "", "/");
  loadPosts();
}

function showProfile() {
  if (!requireAuth()) return;
  document.getElementById("home-page").style.display = "none";
  document.getElementById("profile-page").style.display = "block";
  history.pushState({ page: "profile" }, "", "/#profile");
  loadProfileData();
  switchTab("my-posts");
}

function loadProfileData() {
  fetch("/api/profile")
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("profile-username").textContent = data.username;
        document.getElementById("profile-email").textContent = data.email;
        document.getElementById("edit-username").value = data.username;
        document.getElementById("edit-email").value = data.email;
      }
    });
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById("tab-my-posts").classList.toggle("active", tab === "my-posts");
  document.getElementById("tab-liked-posts").classList.toggle("active", tab === "liked-posts");
  const url = tab === "my-posts" ? "/api/profile/posts" : "/api/profile/liked";
  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const container = document.getElementById("profile-posts-container");
      container.innerHTML = "";
      if (!data.success || !data.posts || data.posts.length === 0) {
        container.innerHTML =
          '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:30px;">No posts yet.</p>';
        return;
      }
      data.posts.forEach((post) => {
        const div = document.createElement("div");
        div.className = "profile-post-card";
        const isMyPost = tab === "my-posts";
        div.innerHTML = `
          <h2>${post.title}</h2>
          <p class="post-by">By: ${post.username}</p>
          <p class="post-body">${post.content}</p>
          <div class="profile-post-stats">
            <span>👍 ${post.likes_count}</span>
            <span>👎 ${post.dislikes_count}</span>
            <span>💬 ${post.comments_count} Comments</span>
          </div>
          ${isMyPost ? `<button class="profile-edit-post-btn" onclick="editPost(${post.id})">✏ Edit</button>` : ""}
        `;
        container.appendChild(div);
      });
    });
}

function showEditProfile() {
  document.getElementById("profile-content").style.display = "none";
  document.getElementById("edit-profile-view").style.display = "flex";
  document.getElementById("edit-current-password").value = "";
  document.getElementById("edit-new-password").value = "";
  document.getElementById("edit-confirm-password").value = "";
}

function cancelEditProfile() {
  document.getElementById("edit-profile-view").style.display = "none";
  document.getElementById("profile-content").style.display = "flex";
}

function saveProfile() {
  const username = document.getElementById("edit-username").value.trim();
  const email = document.getElementById("edit-email").value.trim();
  const currentPassword = document.getElementById("edit-current-password").value;
  const newPassword = document.getElementById("edit-new-password").value;
  const confirmPassword = document.getElementById("edit-confirm-password").value;

  if (!username || !email) {
    showToast("Username and email are required", "warning");
    return;
  }
  if (newPassword && newPassword !== confirmPassword) {
    showToast("New passwords do not match", "warning");
    return;
  }
  if (newPassword && !currentPassword) {
    showToast("Enter your current password to change it", "warning");
    return;
  }

  fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, currentPassword, password: newPassword }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("profile-username").textContent = username;
        document.getElementById("profile-email").textContent = email;
        showToast("Profile updated successfully!", "success");
        cancelEditProfile();
      } else {
        showToast(data.message || "Failed to update profile", "error");
      }
    })
    .catch(() => showToast("Failed to update profile", "error"));
}

function editPost(postID) {
  fetch(`/api/posts?id=${postID}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) return;
      const post = data.post;
      document.getElementById("edit-post-id").value = post.id;
      document.getElementById("edit-post-title-input").value = post.title;
      document.getElementById("edit-post-content-input").value = post.content;
      document.querySelectorAll('input[name="edit-category"]').forEach((cb) => (cb.checked = false));
      document.getElementById("profile-content").style.display = "none";
      document.getElementById("edit-post-view").style.display = "block";
    });
}

function cancelPostEdit() {
  document.getElementById("edit-post-view").style.display = "none";
  document.getElementById("profile-content").style.display = "flex";
}

function savePostEdit() {
  const id = parseInt(document.getElementById("edit-post-id").value);
  const title = document.getElementById("edit-post-title-input").value.trim();
  const content = document.getElementById("edit-post-content-input").value.trim();
  const checkboxes = document.querySelectorAll('input[name="edit-category"]:checked');
  const categories = Array.from(checkboxes).map((cb) => cb.value);

  if (!title || !content) {
    showToast("Title and content are required", "warning");
    return;
  }
  if (categories.length === 0) {
    showToast("Select at least one category", "warning");
    return;
  }

  fetch("/api/posts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title, content, categories }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showToast("Post updated successfully!", "success");
        cancelPostEdit();
        switchTab("my-posts");
      } else {
        showToast(data.message || "Failed to update post", "error");
      }
    })
    .catch(() => showToast("Failed to update post", "error"));
}

function showProfileCreatePost() {
  showHomePage();
  showCreatePostForm();
}
