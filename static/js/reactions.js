// ==================== REACTIONS ====================
// Handle like / dislike toggling for posts and comments.

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
