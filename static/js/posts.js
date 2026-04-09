// ==================== POSTS ====================
// Load, display, create posts and handle the categories dropdown.

function toggleCategoriesDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById("categories-menu");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function filterByCategory(category) {
  currentCategory = category;
  document.getElementById("categories-menu").style.display = "none";
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.toggle("active", item.textContent.trim() === category);
  });
  document.getElementById("create-post-form").style.display = "none";
  document.getElementById("posts-container").style.display = "block";
  document.getElementById("comments-sidebar").style.display = "none";
  loadPosts();
}

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
