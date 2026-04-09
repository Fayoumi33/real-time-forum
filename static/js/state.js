// ==================== GLOBAL STATE ====================
// Single source of truth for all shared application state.

let currentUserID = null;
let currentUSername = null;
let isGuest = false;

let ws = null;
let usersRefreshInterval = null;

let currentPostID = null;
let currentChatUserID = null;
let messageOffset = 0;
let isLoadingMessages = false;

let currentCategory = "All";
let currentTab = "my-posts";

// Tracks which user IDs have unread messages (persists across loadUsers rebuilds)
let unreadUsers = new Set();
