package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

type Post struct {
	ID            int      `json:"id"`
	Title         string   `json:"title"`
	Content       string   `json:"content"`
	CreatedAt     string   `json:"created_at"`
	UserID        int      `json:"user_id"`
	Username      string   `json:"username"`
	LikesCount    int      `json:"likes_count"`
	DislikesCount int      `json:"dislikes_count"`
	CommentsCount int      `json:"comments_count"`
	Categories    []string `json:"categories"`
	UserReaction  string   `json:"user_reaction"`
}

type CreatePostRequest struct {
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Categories []string `json:"categories"`
}

type GetPostsResponse struct{
	Success bool `json:"success"`
	Posts []Post `json:"posts"`
}

func CreatePost(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}
	var req CreatePostRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "can not read the data"})
		return
	}
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Content) == "" || len(req.Categories) == 0 {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "please fill all the fields"})
		return
	}
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unothorized"})
		return
	}
	result, err := db.Exec(`insert into posts (user_id , title , content) values(?,?,?)`, userID, req.Title, req.Content)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to insert in the database"})
		return
	}
	postID, err := result.LastInsertId()
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to get post ID"})
		return
	}
	for _, categoryName := range req.Categories {
		var categoryID int
		err := db.QueryRow(`select id from categories where name = ?`, categoryName).Scan(&categoryID)
		if err != nil {
			continue
		}
		_, err = db.Exec(`insert into post_categories (post_id , category_id) values(?,?)`, postID, categoryID)
		if err != nil {
			continue
		}
	}
	json.NewEncoder(w).Encode(Response{Success: true, Message: "post created successfully"})
}

func UpdatePost(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	var req struct {
		ID         int      `json:"id"`
		Title      string   `json:"title"`
		Content    string   `json:"content"`
		Categories []string `json:"categories"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "invalid request"})
		return
	}
	if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Content) == "" || len(req.Categories) == 0 {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "all fields are required"})
		return
	}
	var ownerID int
	err = db.QueryRow(`SELECT user_id FROM posts WHERE id = ?`, req.ID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "not authorized"})
		return
	}
	_, err = db.Exec(`UPDATE posts SET title=?, content=? WHERE id=?`, req.Title, req.Content, req.ID)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to update post"})
		return
	}
	db.Exec(`DELETE FROM post_categories WHERE post_id=?`, req.ID)
	for _, categoryName := range req.Categories {
		var categoryID int
		if err := db.QueryRow(`SELECT id FROM categories WHERE name = ?`, categoryName).Scan(&categoryID); err != nil {
			continue
		}
		db.Exec(`INSERT INTO post_categories (post_id, category_id) VALUES (?,?)`, req.ID, categoryID)
	}
	json.NewEncoder(w).Encode(Response{Success: true, Message: "post updated"})
}

func GetPosts(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}

	category := r.URL.Query().Get("category")

	currentUserID, _ := GetUserFromSession(r, db)

	baseQuery := `
		SELECT
			p.id, p.title, p.content, p.created_at, p.user_id, u.username,
			COUNT(CASE WHEN pl.type = 'like' THEN 1 END) as likes_count,
			COUNT(CASE WHEN pl.type = 'dislike' THEN 1 END) as dislikes_count,
			COUNT(DISTINCT c.id) as comments_count,
			GROUP_CONCAT(DISTINCT cat.name) as categories,
			COALESCE((SELECT type FROM post_likes WHERE post_id = p.id AND user_id = ?), '') as user_reaction
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_likes pl ON p.id = pl.post_id
		LEFT JOIN comments c ON p.id = c.post_id
		LEFT JOIN post_categories pc ON p.id = pc.post_id
		LEFT JOIN categories cat ON pc.category_id = cat.id
	`

	var rows *sql.Rows
	var err error

	if category != "" && category != "All" {
		rows, err = db.Query(baseQuery+`
			WHERE p.id IN (
				SELECT pc2.post_id FROM post_categories pc2
				JOIN categories cat2 ON pc2.category_id = cat2.id
				WHERE cat2.name = ?
			)
			GROUP BY p.id ORDER BY p.created_at DESC
		`, currentUserID, category)
	} else {
		rows, err = db.Query(baseQuery+`GROUP BY p.id ORDER BY p.created_at DESC`, currentUserID)
	}

	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to find query"})
		return
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
		var categoriesStr sql.NullString
		err := rows.Scan(
			&post.ID, &post.Title, &post.Content, &post.CreatedAt,
			&post.UserID, &post.Username,
			&post.LikesCount, &post.DislikesCount, &post.CommentsCount,
			&categoriesStr, &post.UserReaction,
		)
		if err != nil {
			json.NewEncoder(w).Encode(Response{Success: false, Message: "failed to scan post"})
			return
		}
		if categoriesStr.Valid && categoriesStr.String != "" {
			post.Categories = strings.Split(categoriesStr.String, ",")
		} else {
			post.Categories = []string{}
		}
		posts = append(posts, post)
	}

	json.NewEncoder(w).Encode(GetPostsResponse{Success: true, Posts: posts})
}