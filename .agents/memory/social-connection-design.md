---
name: Social connection design
description: Why friends/invites use their own WebSocket and how invite matches start.
---

Friends presence and invites run on a separate, foreground-only WebSocket, not the game socket. Invite acceptance only reserves a friend room; both clients then join it through the normal room flow.

**Why:** The game socket opens on demand and is closed whenever the match mode stops, so it cannot carry always-on presence. Reusing the room flow keeps match start in one place.

**How to apply:** New social features (e.g. privacy settings, Appear Offline) belong on the social socket and the friend hub. Presence must be refreshed whenever a game starts/ends or a connection closes. Friend IDs must stay in memory only.
