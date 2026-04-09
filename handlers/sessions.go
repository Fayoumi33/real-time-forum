package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// CheckSession validates the session cookie and returns user info if valid.
func CheckSession(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "session expired or not found",
		})
		return
	}
	var username string
	err = db.QueryRow(`SELECT username FROM users WHERE id = ?`, userID).Scan(&username)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "user not found",
		})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"userID":   userID,
		"username": username,
	})
}

func GetUserFromSession(r *http.Request, db *sql.DB) (int, error) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return 0, err
	}

	sessionID := cookie.Value

	var userID int
	var expiresAt string

	query := `SELECT user_id, expires_at FROM sessions WHERE id = ?`
	err = db.QueryRow(query, sessionID).Scan(&userID, &expiresAt)
	if err != nil {
		return 0, err
	}

	expTime, err := time.Parse("2006-01-02 15:04:05", expiresAt)
	if err != nil {
		return 0, err
	}

	if time.Now().After(expTime) {
		_, err = db.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
		return 0, fmt.Errorf("session expired")
	}

	return userID, nil
}
