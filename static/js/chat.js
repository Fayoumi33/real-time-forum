// ==================== CHAT ====================
// WebSocket connection, users sidebar, and private messaging.

// ── WebSocket ──────────────────────────────────────────────

function connectWebSocket() {
  // Bug fix 2: don't hardcode localhost:8080 — use current host
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${window.location.host}/ws`);
  ws.onopen = () => console.log("WebSocket connected");
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleIncomingMessage(message);
  };
  ws.onclose = () => setTimeout(connectWebSocket, 3000);
  ws.onerror = (error) => console.log("WebSocket error:", error);
}

// ── Users List ─────────────────────────────────────────────

function loadUsers() {
  fetch("/api/users")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) return;
      const container = document.getElementById("all-users");

      // Issue 6: check if the user we're chatting with just went offline
      if (currentChatUserID) {
        const chatUser = data.users.find((u) => u.id === currentChatUserID);
        if (chatUser && !chatUser.online) {
          showToast(`${chatUser.username} went offline`, "info");
          closeChat();
        }
      }

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

        // Issue 5: restore unread badge if this user has unread messages
        if (unreadUsers.has(user.id)) {
          const badge = document.createElement("span");
          badge.className = "unread-badge";
          badge.textContent = "●";
          div.appendChild(badge);
        }

        container.appendChild(div);
      });
    });
}

// ── Chat Window ────────────────────────────────────────────

function openChat(userID, username) {
  clearUnreadBadge(userID);
  currentChatUserID = userID;
  messageOffset = 0;
  isLoadingMessages = false;

  document.getElementById("chat-with-name").textContent = username;
  document.getElementById("messages-container").innerHTML = "";
  document.getElementById("left-panel").classList.add("chat-active");
  document.getElementById("chat-view").style.display = "flex";

  document.querySelectorAll(".user-item").forEach((el) => {
    el.classList.toggle("user-active", parseInt(el.dataset.userId) === userID);
  });

  loadMessages(userID, 0);
}

function closeChat() {
  // Stop outgoing typing signal before leaving
  clearTimeout(typingStopTimer);
  sendTypingEvent(false);
  hideTypingIndicator();
  currentChatUserID = null;
  document.getElementById("chat-view").style.display = "none";
  document.getElementById("left-panel").classList.remove("chat-active");
  document.querySelectorAll(".user-item").forEach((el) =>
    el.classList.remove("user-active")
  );
}

function backToForum() {
  closeChat();
}

// ── Messages ───────────────────────────────────────────────

function loadMessages(userID, offset = 0) {
  fetch(`/api/messages?userID=${userID}&offset=${offset}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) return;
      const container = document.getElementById("messages-container");

      // Issue 10: only clear on first load, not on pagination scroll
      if (offset === 0) container.innerHTML = "";

      if (data.messages && data.messages.length > 0) {
        const scrollHeightBefore = container.scrollHeight;

        data.messages.forEach((msg) => {
          const div = document.createElement("div");
          const isMyMessage = msg.sender_id === currentUserID;
          div.className = `message-item ${isMyMessage ? "my-message" : "their-message"}`;
          // Issue 4: preserve newlines with white-space: pre-wrap (set in CSS)
          div.innerHTML = `
            <div class="message-author">${msg.sender_username}</div>
            <div class="message-content">${msg.content}</div>
            <div class="message-time">${formatDate(msg.created_at)}</div>
          `;
          container.prepend(div);
        });

        if (offset === 0) {
          container.scrollTop = container.scrollHeight;
        } else {
          // Issue 10: restore scroll position so older messages appear above without jumping
          container.scrollTop = container.scrollHeight - scrollHeightBefore;
        }
      }

      isLoadingMessages = false;
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
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showToast("Connection lost. Please wait…", "error");
    return;
  }

  ws.send(JSON.stringify({
    type: "private_message",
    from: String(currentUserID),
    fromUsername: currentUSername,
    to: String(currentChatUserID),
    content: content,
  }));
  // Stop typing signal now that the message is sent
  clearTimeout(typingStopTimer);
  sendTypingEvent(false);
  input.value = "";

  const container = document.getElementById("messages-container");
  const div = document.createElement("div");
  div.className = "message-item my-message";
  div.innerHTML = `
    <div class="message-author">${currentUSername}</div>
    <div class="message-content">${content}</div>
    <div class="message-time">${new Date().toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  loadUsers();
}

// ── Typing Indicator ───────────────────────────────────

// Timer that clears our own outgoing "typing" signal after inactivity
let typingStopTimer = null;

// Timers that clear incoming typing indicators (keyed by sender ID)
const typingHideTimers = {};

function sendTypingEvent(isTyping) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentChatUserID) return;
  ws.send(JSON.stringify({
    type: "typing",
    from: String(currentUserID),
    fromUsername: currentUSername,
    to: String(currentChatUserID),
    content: isTyping ? "true" : "false",
  }));
}

function showTypingIndicator(username) {
  const el = document.getElementById("typing-indicator");
  if (!el) return;
  el.innerHTML = `
    <span>${username} is typing</span>
    <span class="typing-dots">
      <span></span><span></span><span></span>
    </span>`;
}

function hideTypingIndicator() {
  const el = document.getElementById("typing-indicator");
  if (el) el.innerHTML = "";
}

function handleIncomingMessage(message) {
  // Issue 7: handle real-time online/offline status from backend broadcast
  if (message.type === "user_online" || message.type === "user_offline") {
    loadUsers();
    return;
  }

  // Handle typing events — only show indicator for the currently open chat
  if (message.type === "typing") {
    if (String(currentChatUserID) === message.from) {
      const senderID = message.from;
      if (message.content === "true") {
        showTypingIndicator(message.fromUsername || "Someone");
        // Auto-hide after 3 s in case the stop event is missed
        clearTimeout(typingHideTimers[senderID]);
        typingHideTimers[senderID] = setTimeout(hideTypingIndicator, 3000);
      } else {
        clearTimeout(typingHideTimers[senderID]);
        hideTypingIndicator();
      }
    }
    return;
  }

  if (String(currentChatUserID) === message.from) {
    // Message from the currently open chat — display it and clear any typing indicator
    hideTypingIndicator();
    const container = document.getElementById("messages-container");
    const div = document.createElement("div");
    div.className = "message-item their-message";
    div.innerHTML = `
      <div class="message-author">${message.fromUsername || message.from}</div>
      <div class="message-content">${message.content}</div>
      <div class="message-time">${new Date().toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  } else {
    // Issue 5: message from a different user — mark as unread even if chat is closed
    markUnread(parseInt(message.from));
  }

  loadUsers();
}

// ── Unread Badges ──────────────────────────────────────────

function markUnread(senderID) {
  // Issue 5: store in Set so badge survives loadUsers() rebuilds
  unreadUsers.add(senderID);
  document.querySelectorAll(".user-item").forEach((item) => {
    if (parseInt(item.dataset.userId) === senderID) {
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
  // Issue 5: remove from Set so badge doesn't come back after loadUsers()
  unreadUsers.delete(userID);
  document.querySelectorAll(".user-item").forEach((item) => {
    if (parseInt(item.dataset.userId) === userID) {
      const badge = item.querySelector(".unread-badge");
      if (badge) badge.remove();
    }
  });
}
