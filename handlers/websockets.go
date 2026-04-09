package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	UserID   int
	Username string
	Send     chan []byte
	DB *sql.DB
}

type Hub struct {
	Clients    map[int]*Client
	Register   chan *Client
	Unregister chan *Client
}

type Message struct {
	Type         string `json:"type"`
	From         string `json:"from"`
	FromUsername string `json:"fromUsername"`
	To           string `json:"to"`
	Content      string `json:"content"`
	Timestamp    string `json:"timestamp"`
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[int]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client.UserID] = client
			// Broadcast user_online to all other connected clients (issues 6 & 7)
			status, _ := json.Marshal(map[string]interface{}{
				"type":   "user_online",
				"userID": client.UserID,
			})
			for id, c := range h.Clients {
				if id != client.UserID {
					select {
					case c.Send <- status:
					default:
					}
				}
			}
		case client := <-h.Unregister:
			if _, ok := h.Clients[client.UserID]; ok {
				delete(h.Clients, client.UserID)
				close(client.Send)
				// Broadcast user_offline to all remaining clients (issues 6 & 7)
				status, _ := json.Marshal(map[string]interface{}{
					"type":   "user_offline",
					"userID": client.UserID,
				})
				for _, c := range h.Clients {
					select {
					case c.Send <- status:
					default:
					}
				}
			}
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		var msg Message
		err = json.Unmarshal(data, &msg)
		if err != nil {
			continue
		}
		receiverID, err := strconv.Atoi(msg.To)
		if err != nil {
			continue
		}
		// Enrich message with sender's username before forwarding
		msg.FromUsername = c.Username
		enriched, err := json.Marshal(msg)
		if err != nil {
			continue
		}
		reciver, ok := c.Hub.Clients[receiverID]
		if ok {
			reciver.Send <- enriched
		}
		// Typing events are ephemeral — do not persist them
		if msg.Type != "typing" {
			c.DB.Exec(`INSERT INTO messages(sender_id, receiver_id, content) VALUES(?,?,?)`,
				c.UserID, receiverID, msg.Content)
		}
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()
	for {
		message, ok := <-c.Send
		if !ok {
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
		err := c.Conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			return
		}
	}
}

func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request, db *sql.DB) {
	userID, err := GetUserFromSession(r, db)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "you have to register first"})
		return
	}
	var username string
	err = db.QueryRow(`select username from users where id = ?`, userID).Scan(&username)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "user not found"})
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &Client{
		Hub:      hub,
		Conn:     conn,
		UserID:   userID,
		Username: username,
		Send:     make(chan []byte, 256),
		DB: db,
	}
	client.Hub.Register <- client
	go client.WritePump()
	go client.ReadPump()
}
