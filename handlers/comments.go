package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type Comment struct {
	ID            int    `json:"id"`
	Content       string `json:"content"`
	CreatedAt     string `json:"created_at"`
	UserID        int    `json:"user_id"`
	PostID        int    `json:"post_id"`
	Username      string `json:"username"`
	LikesCount    int    `json:"likes_count"`
	DisLikesCount int    `json:"dislikes_count"`
	UserReaction  string `json:"user_reaction"`
}

type GetPostDetailsResponse struct {
	Success  bool      `json:"success"`
	Post     Post      `json:"post"`
	Comments []Comment `json:"comments"`
}

type CreateCommentRequest struct {
    PostID int `json:"post_id"`
    Content string `json:"content"`
}

func GetPostDetails(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-type", "application/json")
	if r.Method != http.MethodGet {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}
	postID := r.URL.Query().Get("id")
	postQuery := `SELECT p.id, p.title, p.content, p.created_at, p.user_id, u.username,
    COUNT(CASE WHEN pl.type = 'like' THEN 1 END) as likes_count,
    COUNT(CASE WHEN pl.type = 'dislike' THEN 1 END) as dislikes_count
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN post_likes pl ON p.id = pl.post_id
WHERE p.id = ?
GROUP BY p.id`
	var post Post
	err := db.QueryRow(postQuery, postID).Scan(&post.ID,
		&post.Title,
		&post.Content,
		&post.CreatedAt,
		&post.UserID,
		&post.Username,
		&post.LikesCount,
		&post.DislikesCount)
	if err != nil {
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "post not found"})
			return
		} else {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "internal server error"})
			return
		}
	}
	currentUserID, _ := GetUserFromSession(r, db)
	commentsQuery := `
		SELECT c.id, c.content, c.created_at, c.user_id, u.username,
			COUNT(CASE WHEN cl.type = 'like' THEN 1 END) as likes_count,
			COUNT(CASE WHEN cl.type = 'dislike' THEN 1 END) as dislikes_count,
			COALESCE((SELECT type FROM comment_likes WHERE comment_id = c.id AND user_id = ?), '') as user_reaction
		FROM comments c
		JOIN users u ON c.user_id = u.id
		LEFT JOIN comment_likes cl ON c.id = cl.comment_id
		WHERE c.post_id = ?
		GROUP BY c.id
		ORDER BY c.created_at ASC`
	var comments []Comment
	rows, err := db.Query(commentsQuery, currentUserID, postID)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "internal server error"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var comment Comment
		err := rows.Scan(&comment.ID, &comment.Content, &comment.CreatedAt,
			&comment.UserID, &comment.Username,
			&comment.LikesCount, &comment.DisLikesCount, &comment.UserReaction)
		if err != nil {
			continue
		}
		comments = append(comments, comment)
	}
	data := GetPostDetailsResponse{
		Success:  true,
		Post:     post,
		Comments: comments,
	}
	json.NewEncoder(w).Encode(data)
}

func AddComment(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	if r.Method != "POST" {
        json.NewEncoder(w).Encode(Response{Success: false,Message: "method not allowed"})
		return
	}

    var req CreateCommentRequest
    err := json.NewDecoder(r.Body).Decode(&req)

	if err != nil {
        json.NewEncoder(w).Encode(Response{Success: false , Message: "can not read data "})
		return
	}
	if req.Content == "" || req.PostID == 0{
        json.NewEncoder(w).Encode(Response{Success: false , Message: "all fields are required"})
        return 
    }

	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false,Message: "you have to register first"})
		return
	}

	_, err = db.Exec(`INSERT INTO comments(content, post_id, user_id, created_at) VALUES (?,?,?,datetime('now'))`,
		req.Content, req.PostID, userID)

	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false,Message: "internal server error"})
		return
	}

    json.NewEncoder(w).Encode(Response{
        Success: true,
        Message: "comment added successfully",
    })
}
