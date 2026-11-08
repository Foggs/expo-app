---
name: Player identity model
description: How device tokens, device keys and Game Center accounts relate; rules for any code that compares player keys.
---
Every request/WS auth resolves the device key (sha256 of the device token) to `{ playerKey, aliasKeys }`. playerKey is canonical for NEW records; aliasKeys (account key + every linked device key) must be used whenever comparing against EXISTING records (games, blocks, gallery owners).

The account key is random, not the first device's key. History is never migrated; it follows through aliases.

**Why:** If a device that "is" the account key later signs into a different Game Center account, its history would belong to two players. Alias lookups also avoid rewrite transactions across blocks/gallery/games.

**How to apply:** New features that store or check player keys (friends, invites, privacy) must canonicalize incoming keys with the identity resolver and match with alias sets, never raw equality. Never expose device tokens; keys (one-way) are fine to send to opponents. The Game Center display name is never sent to the server.

A linked device token must never outlive its player's Game Center sign-in: the client rotates the token on sign-out/decline/player change, and the server refuses to re-point a linked device (409). Live WS connections are refreshed after a link.

**Why:** A shared phone would otherwise let the next person act as the previous player (gallery deletes, reports, blocks, matchmaking).
