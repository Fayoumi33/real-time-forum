package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

func GetProfile(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	var username, email string
	err = db.QueryRow(`SELECT username, email FROM users WHERE id = ?`, userID).Scan(&username, &email)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "user not found"})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"username": username,
		"email":    email,
	})
}

func GetMyPosts(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	rows, err := db.Query(`
		SELECT p.id, p.title, p.content, p.created_at, p.user_id, u.username,
		COUNT(CASE WHEN pl.type = 'like' THEN 1 END) as likes_count,
		COUNT(CASE WHEN pl.type = 'dislike' THEN 1 END) as dislikes_count,
		COUNT(DISTINCT c.id) as comments_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_likes pl ON p.id = pl.post_id
		LEFT JOIN comments c ON p.id = c.post_id
		WHERE p.user_id = ?
		GROUP BY p.id
		ORDER BY p.created_at DESC
	`, userID)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to load posts"})
		return
	}
	defer rows.Close()
	posts := []Post{}
	for rows.Next() {
		var post Post
		rows.Scan(&post.ID, &post.Title, &post.Content, &post.CreatedAt, &post.UserID, &post.Username, &post.LikesCount, &post.DislikesCount, &post.CommentsCount)
		posts = append(posts, post)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"posts":   posts,
	})
}

func UpdateProfile(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	var req struct {
		Username        string `json:"username"`
		Email           string `json:"email"`
		CurrentPassword string `json:"currentPassword"`
		Password        string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "invalid request"})
		return
	}
	if req.Username == "" || req.Email == "" {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "username and email are required"})
		return
	}
	if req.Password != "" {
		var hashedCurrent string
		db.QueryRow(`SELECT password FROM users WHERE id = ?`, userID).Scan(&hashedCurrent)
		if err := bcrypt.CompareHashAndPassword([]byte(hashedCurrent), []byte(req.CurrentPassword)); err != nil {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "current password is incorrect"})
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "internal error"})
			return
		}
		_, err = db.Exec(`UPDATE users SET username=?, email=?, password=? WHERE id=?`, req.Username, req.Email, string(hashed), userID)
		if err != nil {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to update profile"})
			return
		}
	} else {
		_, err = db.Exec(`UPDATE users SET username=?, email=? WHERE id=?`, req.Username, req.Email, userID)
		if err != nil {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to update profile"})
			return
		}
	}
	json.NewEncoder(w).Encode(Response{Success: true, Message: "profile updated"})
}

func GetLikedPosts(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	rows, err := db.Query(`
		SELECT p.id, p.title, p.content, p.created_at, p.user_id, u.username,
		COUNT(CASE WHEN pl2.type = 'like' THEN 1 END) as likes_count,
		COUNT(CASE WHEN pl2.type = 'dislike' THEN 1 END) as dislikes_count,
		COUNT(DISTINCT c.id) as comments_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_likes pl2 ON p.id = pl2.post_id
		LEFT JOIN comments c ON p.id = c.post_id
		INNER JOIN post_likes pl ON p.id = pl.post_id AND pl.user_id = ? AND pl.type = 'like'
		GROUP BY p.id
		ORDER BY p.created_at DESC
	`, userID)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to load liked posts"})
		return
	}
	defer rows.Close()
	posts := []Post{}
	for rows.Next() {
		var post Post
		rows.Scan(&post.ID, &post.Title, &post.Content, &post.CreatedAt, &post.UserID, &post.Username, &post.LikesCount, &post.DislikesCount, &post.CommentsCount)
		posts = append(posts, post)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"posts":   posts,
	})
}
