package main

import (
    "fmt"
    "net/http"
    "rtforum/database"
    "rtforum/handlers"
)

func main() {
    db := database.InitDB()
    hub := handlers.NewHub()
    go hub.Run()
    staticFS := http.FileServer(http.Dir("./static"))
    http.Handle("/static/", http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
        staticFS.ServeHTTP(w, r)
    })))

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
        http.ServeFile(w, r, "./static/index.html")
    })

    http.HandleFunc("/api/session/check", func(w http.ResponseWriter, r *http.Request) {
        handlers.CheckSession(w, r, db)
    })

    http.HandleFunc("/api/register", func(w http.ResponseWriter, r *http.Request) {
        handlers.Register(w, r, db)
    })
    
    http.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
    handlers.Login(w, r, db)
    })

    http.HandleFunc("/api/logout", func(w http.ResponseWriter, r *http.Request) {
    handlers.Logout(w, r, db)
})

http.HandleFunc("/ws" , func (w http.ResponseWriter , r *http.Request){
    handlers.HandleWebSocket(hub , w , r , db);
})

http.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        if r.URL.Query().Get("id") != "" {
            handlers.GetPostDetails(w, r, db)
        } else {
            handlers.GetPosts(w, r, db)
        }
    case http.MethodPost:
        handlers.CreatePost(w, r, db)
    case http.MethodPut:
        handlers.UpdatePost(w, r, db)
    default:
        w.WriteHeader(http.StatusMethodNotAllowed)
    }
})

http.HandleFunc("/api/comments", func(w http.ResponseWriter, r *http.Request) {
    handlers.AddComment(w, r, db)
})

http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
    handlers.GetUsers(w, r, db , hub)
})

http.HandleFunc("/api/messages", func(w http.ResponseWriter, r *http.Request) {
    handlers.GetMessage(w, r, db)
})

http.HandleFunc("/api/likes/post", func(w http.ResponseWriter, r *http.Request) {
    handlers.LikePost(w, r, db)
})

http.HandleFunc("/api/likes/comment", func(w http.ResponseWriter, r *http.Request) {
    handlers.LikeComment(w, r, db)
})

http.HandleFunc("/api/profile", func(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        handlers.GetProfile(w, r, db)
    case http.MethodPost:
        handlers.UpdateProfile(w, r, db)
    default:
        w.WriteHeader(http.StatusMethodNotAllowed)
    }
})

http.HandleFunc("/api/profile/posts", func(w http.ResponseWriter, r *http.Request) {
    handlers.GetMyPosts(w, r, db)
})

http.HandleFunc("/api/profile/liked", func(w http.ResponseWriter, r *http.Request) {
    handlers.GetLikedPosts(w, r, db)
})

    fmt.Println("Server started at http://localhost:8080")
    http.ListenAndServe(":8080", nil)
}

