# Real-Time Forum

A full-stack forum application with real-time private messaging, built with Go and vanilla JavaScript.

## Features

- **User Authentication** — Register and login with username or email. Sessions are stored server-side with a 24-hour expiry, and passwords are hashed with bcrypt.
- **Posts & Comments** — Create, read, and update posts. Comments support nested replies. Posts are organized by categories.
- **Likes & Reactions** — Like or dislike posts and comments.
- **Real-Time Private Messaging** — Chat privately with other users via WebSocket. Messages are persisted in the database.
- **Typing Indicator** — See when another user is actively typing in your chat window.
- **Online / Offline Status** — The user list updates in real time when someone connects or disconnects.
- **Unread Message Badges** — Messages from users whose chat is not currently open are marked as unread until opened.
- **Infinite Scroll** — Older messages load automatically as you scroll up in a conversation.
- **User Profiles** — View and update your profile. See your own posts and posts you have liked.

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Go (standard `net/http`)                        |
| Database | SQLite (`modernc.org/sqlite`)                   |
| WebSocket | `gorilla/websocket`                            |
| Sessions | UUID-based cookies (`github.com/google/uuid`)   |
| Frontend | Vanilla JavaScript (SPA, no framework)          |
| Styling  | Plain CSS                                       |

## Project Structure

```
.
├── main.go              # Entry point — route registration and server startup
├── go.mod / go.sum      # Go module files
├── forum.db             # SQLite database (auto-created on first run)
├── database/
│   └── db.go            # Schema creation and default category seeding
├── handlers/
│   ├── auth.go          # Register, Login, Logout
│   ├── handlers.go      # Shared helpers and session utilities
│   ├── posts.go         # Create, list, and update posts
│   ├── comments.go      # Add and list comments
│   ├── likes.go         # Like / dislike posts and comments
│   ├── profile.go       # Get and update user profile; my posts; liked posts
│   ├── sessions.go      # Session validation
│   └── websockets.go    # WebSocket hub, client pumps, typing events
└── static/
    ├── index.html       # Single HTML entry point
    ├── style.css        # Global styles
    ├── main.js          # Bootstrap / global state
    └── js/
        ├── app.js       # App initialization
        ├── auth.js      # Login / register forms
        ├── chat.js      # WebSocket client, messaging, typing indicator
        ├── comments.js  # Comment rendering and submission
        ├── posts.js     # Post feed and post detail
        ├── profile.js   # Profile page
        ├── reactions.js # Like / dislike UI
        ├── router.js    # Client-side SPA router
        ├── state.js     # Shared application state
        ├── toast.js     # Toast notification helper
        └── utils.js     # Shared utility functions
```

## Getting Started

### Prerequisites

- [Go 1.21+](https://go.dev/dl/)

### Run

```bash
git clone <repository-url>
cd real-time-forum-typing-in-progress
go run .
```

The server starts on **http://localhost:8080**. The SQLite database (`forum.db`) is created automatically on the first run.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/register` | Create a new account |
| `POST` | `/api/login` | Login (returns session cookie) |
| `POST` | `/api/logout` | Invalidate the current session |
| `GET` | `/api/session/check` | Check if the current session is valid |
| `GET` | `/api/posts` | List all posts |
| `GET` | `/api/posts?id=<id>` | Get a single post with comments |
| `POST` | `/api/posts` | Create a post |
| `PUT` | `/api/posts` | Update a post |
| `POST` | `/api/comments` | Add a comment |
| `POST` | `/api/likes/post` | Like or dislike a post |
| `POST` | `/api/likes/comment` | Like or dislike a comment |
| `GET` | `/api/users` | List all users with online status |
| `GET` | `/api/messages?userID=<id>&offset=<n>` | Paginated message history |
| `GET` | `/api/profile` | Get the logged-in user's profile |
| `POST` | `/api/profile` | Update the logged-in user's profile |
| `GET` | `/api/profile/posts` | Get posts created by the logged-in user |
| `GET` | `/api/profile/liked` | Get posts liked by the logged-in user |
| `GET /WS` | `/ws` | WebSocket connection for real-time messaging |

## Default Categories

Posts can be tagged with the following categories (seeded on startup):

`Technology` · `Sport` · `Gaming` · `News` · `Programming` · `Quran` · `Other`

## WebSocket Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `private_message` | Client → Server → Client | Send a chat message to another user |
| `typing` | Client → Server → Client | Notify the recipient that you are typing |
| `user_online` | Server → All clients | Broadcast when a user connects |
| `user_offline` | Server → All clients | Broadcast when a user disconnects |
