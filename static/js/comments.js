// ==================== COMMENTS ====================
// Load, display, and submit comments for a post.

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
            const commentsDiv = document.createElement("div");
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
