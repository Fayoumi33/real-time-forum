// ==================== PROFILE ====================
// View profile, edit profile info, and edit/save posts from profile.

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
