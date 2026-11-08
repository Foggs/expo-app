---
name: Social connection design
description: Why friends/invites use their own WebSocket and how invite matches start.
---

Friends presence and invites run on a separate, foreground-only WebSocket, not the game socket. Invite acceptance only reserves a friend room; both clients then join it through the normal room flow.

**Why:** The game socket opens on demand and is closed whenever the match mode stops, so it cannot carry always-on presence. Reusing the room flow keeps match start in one place.

**How to apply:** New social features (e.g. privacy settings, Appear Offline) belong on the social socket and the friend hub. Presence must be refreshed whenever a game starts/ends or a connection closes. Friend IDs must stay in memory only.

Friend visibility (Visible / Appear Offline / Do Not Disturb) is saved per Game Center account, not per device. Until the hub has loaded an account's choice it treats the player as Appear Offline. Invites to a Do Not Disturb player are refused when sent with a polite reason; the invite is never delivered.

**Why:** Failing closed means a player who hid themselves is never shown by mistake during a reconnect. Refusing at send time means the busy player never gets a banner.
