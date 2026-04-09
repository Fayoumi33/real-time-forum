package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func LikePost(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	var req struct {
		PostID int    `json:"post_id"`
		Type   string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Type != "like" && req.Type != "dislike") {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "invalid request"})
		return
	}

	var existingType string
	err = db.QueryRow(`SELECT type FROM post_likes WHERE post_id = ? AND user_id = ?`, req.PostID, userID).Scan(&existingType)
	if err == sql.ErrNoRows {
		db.Exec(`INSERT INTO post_likes (type, post_id, user_id) VALUES (?, ?, ?)`, req.Type, req.PostID, userID)
	} else if existingType == req.Type {
		// Same reaction: toggle off
		db.Exec(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, req.PostID, userID)
		req.Type = ""
	} else {
		// Switch reaction
		db.Exec(`UPDATE post_likes SET type = ? WHERE post_id = ? AND user_id = ?`, req.Type, req.PostID, userID)
	}

	var likes, dislikes int
	db.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND type = 'like'`, req.PostID).Scan(&likes)
	db.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND type = 'dislike'`, req.PostID).Scan(&dislikes)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"likes":         likes,
		"dislikes":      dislikes,
		"user_reaction": req.Type,
	})
}

func LikeComment(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	var req struct {
		CommentID int    `json:"comment_id"`
		Type      string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Type != "like" && req.Type != "dislike") {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "invalid request"})
		return
	}

	var existingType string
	err = db.QueryRow(`SELECT type FROM comment_likes WHERE comment_id = ? AND user_id = ?`, req.CommentID, userID).Scan(&existingType)
	if err == sql.ErrNoRows {
		db.Exec(`INSERT INTO comment_likes (type, comment_id, user_id) VALUES (?, ?, ?)`, req.Type, req.CommentID, userID)
	} else if existingType == req.Type {
		db.Exec(`DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`, req.CommentID, userID)
		req.Type = ""
	} else {
		db.Exec(`UPDATE comment_likes SET type = ? WHERE comment_id = ? AND user_id = ?`, req.Type, req.CommentID, userID)
	}

	var likes, dislikes int
	db.QueryRow(`SELECT COUNT(*) FROM comment_likes WHERE comment_id = ? AND type = 'like'`, req.CommentID).Scan(&likes)
	db.QueryRow(`SELECT COUNT(*) FROM comment_likes WHERE comment_id = ? AND type = 'dislike'`, req.CommentID).Scan(&dislikes)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"likes":         likes,
		"dislikes":      dislikes,
		"user_reaction": req.Type,
	})
}
