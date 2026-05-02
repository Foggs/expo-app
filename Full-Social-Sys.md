# User Story: Option C - Full Social System

## 1. Core User Story
**As a** registered player,  
**I want to** maintain a persistent friends list and send direct game invitations,  
**So that** I can build long-term gaming relationships without relying on temporary room codes.

---

## 2. Acceptance Criteria

### A. Relationship Management
* **Friend Requests:** Users can search for others by Username/ID and send/accept/decline friend requests.
* **Persistence:** Friendships are stored in the database and persist across sessions and server restarts.
* **Presence Tracking:** Users can see the real-time status of friends (Online, Offline, In-Game, Away).

### B. Direct Invitation Flow
* **In-App Notifications:** A "Host" can click an "Invite" button next to an online friend's name.
* **Incoming Alerts:** The "Guest" receives a real-time UI toast/notification to "Accept" or "Decline."
* **Automatic Lobbying:** Upon acceptance, both users are automatically moved into a private match state without manual code entry.

### C. Enhanced Privacy & Security
* **Blocking:** Users can block others to prevent harassment or unwanted invites.
* **Privacy Toggles:** Users can set their status to "Appear Offline" or "Do Not Disturb."
* **Match History:** The system tracks wins/losses specifically between friends for a "rivalry" leaderboard.

---

## 3. Technical Requirements (High-Level)

| Feature | Requirement |
| :--- | :--- |
| **Database** | New tables for `users`, `friendships`, and `notifications`. |
| **Authentication** | Requires a formal Auth system (JWT/Session) to link IDs. |
| **WebSockets** | Needs "Presence" heartbeat logic to updatw
* **Pros:** Highest user retention, professional social foundation, no "code-sharing" friction.
* **Cons:** Highest development cost, requires database migrations, significantly increases architectural complexity.