package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type UserStatus struct {
	ID            int    `json:"id"`
	Username      string `json:"username"`
	Online        bool   `json:"online"`
	LastMessageAt string `json:"last_message_at"`
}

type MessageData struct {
	ID             int    `json:"id"`
	SenderID       int    `json:"sender_id"`
	SenderUsername string `json:"sender_username"`
	ReceiverID     int    `json:"receiver_id"`
	Content        string `json:"content"`
	CreatedAt      string `json:"created_at"`
}

func GetUsers(w http.ResponseWriter, r *http.Request, db *sql.DB, h *Hub) {
	currentUserID, err := GetUserFromSession(r, db)
	if err != nil {
		currentUserID = -1
	}

	rows, err := db.Query(`
		SELECT u.id, u.username,
			COALESCE((
				SELECT MAX(m.created_at) FROM messages m
				WHERE (m.sender_id = u.id AND m.receiver_id = ?)
				   OR (m.sender_id = ? AND m.receiver_id = u.id)
			), '') as last_message_at
		FROM users u
		ORDER BY
			CASE WHEN COALESCE((
				SELECT MAX(m.created_at) FROM messages m
				WHERE (m.sender_id = u.id AND m.receiver_id = ?)
				   OR (m.sender_id = ? AND m.receiver_id = u.id)
			), '') = '' THEN 1 ELSE 0 END,
			last_message_at DESC,
			u.username ASC
	`, currentUserID, currentUserID, currentUserID, currentUserID)

	var result []UserStatus
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "error"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var user UserStatus
		rows.Scan(&user.ID, &user.Username, &user.LastMessageAt)
		_, user.Online = h.Clients[user.ID]
		result = append(result, user)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"users":   result,
	})
}

func GetMessage(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	firstID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "unauthorized"})
		return
	}
	secondID := r.URL.Query().Get("userID")
	offset := r.URL.Query().Get("offset")
	if offset == "" {
		offset = "0"
	}
	rows, err := db.Query(`
		SELECT m.id, m.sender_id, u.username, m.receiver_id, m.content, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE (m.sender_id = ? AND m.receiver_id = ?)
		   OR (m.sender_id = ? AND m.receiver_id = ?)
		ORDER BY m.created_at DESC
		LIMIT 10 OFFSET ?
	`, firstID, secondID, secondID, firstID, offset)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "cannot get messages"})
		return
	}
	defer rows.Close()
	var messages []MessageData
	for rows.Next() {
		var msg MessageData
		rows.Scan(&msg.ID, &msg.SenderID, &msg.SenderUsername, &msg.ReceiverID, &msg.Content, &msg.CreatedAt)
		messages = append(messages, msg)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"messages": messages,
	})
}
