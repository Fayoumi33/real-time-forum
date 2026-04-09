package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	Age       string `json:"age"`
	Gender    string `json:"gender"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type LoginRequest struct {
    Identifier string `json:"identifier"` 
    Password   string `json:"password"`
}
func Register(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "method not allowed"})
		return
	}
	var req RegisterRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "faild to read request"})
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" ||
		req.Age == "" || req.Gender == "" || req.FirstName == "" || req.LastName == "" {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "All fields are required"})
		return
	}
	var email string
	err = db.QueryRow(`SELECT email FROM users WHERE email = ?`, req.Email).Scan(&email)
	if err == nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "Email already exists"})
		return
	}

	var username string
	err = db.QueryRow(`SELECT username FROM users WHERE username = ?`, req.Username).Scan(&username)
	if err == nil {
		json.NewEncoder(w).Encode(Response{Success: false, Message: "Username already exists"})
		return
	}

	hashedPassword , err := bcrypt.GenerateFromPassword([]byte(req.Password) , bcrypt.DefaultCost)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "internal server error"})
		return
	}
	_, err = db.Exec(`INSERT INTO users(username, email, password, age, gender, Fname, Lname) VALUES(?,?,?,?,?,?,?)`,
    req.Username,
    req.Email,
    string(hashedPassword),
    req.Age,
    req.Gender,
    req.FirstName,
    req.LastName,
)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "internal server error"})
		return
	}
	json.NewEncoder(w).Encode(Response{Success: true , Message: "Registration successful"})
}


func Login(w http.ResponseWriter , r *http.Request , db *sql.DB){
	w.Header().Set("Content-Type" , "application/json")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "method not allowed"})
		return
	}
	var req LoginRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false,Message: "Failed to read requeset"})
		return
	}
	if req.Identifier == "" || req.Password == ""{
		json.NewEncoder(w).Encode(Response{Success: false,Message: "Feilds can not be empty"})
		return
	}
	var userID int
	var hashedPassword string
	var username string
	err = db.QueryRow(`select id, password, username from users where email = ? or username =?`, req.Identifier, req.Identifier).Scan(&userID, &hashedPassword, &username)
	if err != nil  {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "user not found "})
		return
	}
	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword),[]byte(req.Password))
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "invalid password"})
		return
	}
	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour).Format("2006-01-02 15:04:05")
	insertSession := `insert into sessions(id,user_id,expires_at) values (?,?,?)`
	_,err = db.Exec(insertSession,sessionID,userID,expiresAt)
	if err != nil {
		json.NewEncoder(w).Encode(Response{Success: false , Message: "internal server error"})
		return
	}
	http.SetCookie(w,&http.Cookie{
		Name: "session_token",
		Value: sessionID,
		Expires: time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path: "/",
	})
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"userID":   userID,
		"username": username,
		"message":  "login successful",
	})
}  

func Logout(w http.ResponseWriter , r *http.Request , db *sql.DB){
	w.Header().Set("Content-Type" , "application/json")
	cookie , err := r.Cookie("session_token")
	if err == nil {
		sessionID := cookie.Value
	deleteSession := `delete from sessions where id = ?`
	db.Exec(deleteSession,sessionID)
	}
	http.SetCookie(w , &http.Cookie{
		Name: "session_token",
		Value: "",
		Expires: time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Path: "/",
	})
	json.NewEncoder(w).Encode(Response{Success: true , Message: "logout successfull"})
}
