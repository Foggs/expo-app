# Game Center sign-in

SketchDuel signs iPhone players into Game Center automatically so the same person is recognized on every device they use. Players who decline, and everyone on Android and web, keep playing with the anonymous device identity the app has always used.

## How it works

1. On launch, the iOS app asks Game Center to sign the player in (`modules/game-center`, a local Expo native module). If the player is already signed in on the device, this is silent. Otherwise iOS shows its own sign-in sheet once per launch.
2. The app asks GameKit for an **identity proof** (`fetchItems(forIdentityVerificationSignature:)`) and sends it, with the device token, to `POST /api/identity/game-center`.
3. The server (`server/gameCenterVerifier.ts`) checks the proof before trusting it:
   - The public key URL must be HTTPS on an `apple.com` host.
   - The certificate must belong to Apple Inc., be within its validity dates, and chain through its issuer (fetched only from `cacerts.digicert.com`) to a root in Node's trusted root store.
   - The RSA-SHA256 signature must cover the player ID, the app's bundle ID, the timestamp and the salt.
   - The proof must be under 5 minutes old (with 1 minute allowed for clock skew), and each proof is accepted only once.
4. The device is then linked to the player's account. All later requests with that device's token act as the account, so blocks, reports, matchmaking and gallery ownership follow the player to any linked iPhone. Games, blocks and drawings recorded under the device before linking stay with the player.

### Shared phones and signing out

A linked device token acts as the player, so the app never lets it outlive that player's sign-in:

- If the linked player is no longer signed in (signed out in Settings, declined, or Game Center unavailable), the app replaces the device token with a new random one at launch and whenever it returns to the foreground. The next person on the phone starts as a new anonymous player. The old token's history stays with the previous player's account.
- If a different Game Center player signs in, the app replaces the token before linking. The server also refuses to move an already-linked device to a different player (`409 DEVICE_LINKED_TO_OTHER_PLAYER`); the app then replaces its token and retries.
- Requests wait for the launch-time check (and any check that starts while they wait), so nothing is sent with a token that is about to be replaced. If the check fails partway, the app treats Game Center as unavailable and replaces a linked token rather than keeping it. A player waiting for a match when the token changes is taken out of the queue; a game already in progress finishes.
- When a device links while connected, the server updates its open connections (and the account's other devices) right away, so account-level blocks apply without reconnecting.

The server stores only Apple's team-scoped player ID, a random account key and the device links. It does **not** store or show the Game Center display name; the name appears only on the player's own home screen. Opponents still see random names.

## Friends and direct invites

On iOS, the **Game Center Friends** button on the home screen opens a list of the player's Game Center friends who also play SketchDuel, each shown as **Online**, **In a game** or **Offline**.

- **Permission**: iOS asks for friend-list access (`NSGKFriendListUsageDescription` in `app.json`) the first time the player taps **Show My Friends**. The app never asks on its own at launch. If access is denied or restricted, the screen explains how to change it in Settings and offers room codes instead.
- **What is sent**: only the friends' team-scoped Game Center player IDs, over a separate WebSocket connection that is open while the app is in the foreground. Friends' names stay on the device. The server keeps the list on that connection, in memory, and forgets it when the connection closes; nothing is written to the database.
- **Who appears**: friends with a SketchDuel account (signed in to Game Center at least once). A friend is shown as Online or In a game only when each player's list includes the other; otherwise they appear Offline. Players who have blocked each other (in either direction) never see each other, and a new block removes them from each other's list immediately.
- **Invites**: an **Invite** button appears next to online friends. The friend sees an Accept/Decline banner on any screen, including over open dialogs. Accepting reserves a private room only those two accounts can join; both apps return to the home screen and join it, which starts the match through the normal friend-room flow. A decline, the 30-second expiry, the sender cancelling or leaving, or either player starting another game closes the invite on both sides with a short message.
- **Limits**: one waiting invite per player, 5 invites per player per minute, 6 friend-list uploads per connection per minute, at most 500 friend IDs per upload. Every message is validated (`shared/schema.ts`).
- Room codes and invite links keep working for everyone, including Android and web players.

### Configuration

| Setting | Where | Default |
|---|---|---|
| Accepted bundle IDs | `GAME_CENTER_BUNDLE_IDS` env var (comma-separated) | `com.sketchduel.app` |
| Game Center capability | `ios.entitlements` in `app.json` | `com.apple.developer.game-center: true` |

If you change the bundle identifier in `app.json`, set `GAME_CENTER_BUNDLE_IDS` on the server to match. Otherwise every sign-in is rejected as a bad signature.

## Testing on a physical iPhone

Game Center does not work in Expo Go or the iOS Simulator's web preview, and it needs a native build that includes the Game Center capability. Use a development build or a TestFlight build.

Before building, follow [Native-build readiness](native-build-readiness.md).
It records an ignored-native-source blocker, the external SDK 54 baseline route,
and the distinction between Simulator coverage and physical-iPhone acceptance.

### One-time setup in App Store Connect

1. In the Apple Developer portal, make sure the App ID `com.sketchduel.app` has **Game Center** enabled and the provisioning profile supports it. Do not assume automatic EAS capability synchronization covers Game Center.
2. In App Store Connect, open the app → **Features** (or **Services**) → **Game Center** and turn it on for the app version. No leaderboards or achievements are required.

First, install the EAS CLI, sign in, and create the build profiles (this project has no `eas.json` yet): `npm install -g eas-cli`, `eas login`, then `eas build:configure`.

### Option A: TestFlight (simplest, closest to release)

1. Build and upload: `eas build --profile production --platform ios`, then `eas submit --platform ios`.
2. Add yourself as an internal tester in App Store Connect → TestFlight, then install from the TestFlight app.
3. TestFlight builds talk to the server set by `EXPO_PUBLIC_DOMAIN` at build time, so publish the server with this change first.

### Option B: development build (faster iteration on code changes)

1. Add the dev client: `npx expo install expo-dev-client`.
2. Register your iPhone (`eas device:create`), then build: `eas build --profile development --platform ios`.
3. Install the build from the link EAS prints, start the dev server, and open the app on the phone.

### What to check

1. **Sign-in**: On an iPhone signed into Game Center (Settings → Game Center), open the app. The Game Center welcome banner appears and your Game Center name shows under the SketchDuel title.
2. **Server verification**: The server log shows `POST /api/identity/game-center 200`. A `401` with `Game Center proof rejected: bad_signature` usually means the bundle ID doesn't match `GAME_CENTER_BUNDLE_IDS`.
3. **Second device**: Sign into the same Game Center account on another iPhone and open the app. Drawings you saved from the first phone can be deleted from the second, and anyone you blocked on the first phone is not matched with you on the second.
4. **Decline**: On a phone signed out of Game Center, cancel the sign-in sheet. The app keeps working, no name is shown, and you can still play, save and delete your own drawings.
5. **Sign out**: Sign out of Game Center in Settings, return to the app, and decline the sign-in. The name disappears, and drawings saved while signed in can no longer be deleted from this phone. Sign back in and relaunch: they can be deleted again.
6. **Android/web**: The app behaves exactly as before, with no sign-in prompt.
7. **Friends**: With two iPhones signed into Game Center accounts that are friends with each other, open **Game Center Friends** on both and allow access. Each shows the other as Online. Invite from one phone; the other shows the banner. Accept, and both phones go into the same match. Try Decline, waiting 30 seconds, and Cancel; both phones should show a message each time. During the match, a third friend sees both as "In a game".
8. **How friends see you**: On the Friends screen, choose **Appear Offline** on one phone. The other phone shows that player as Offline with no Invite button, and the choice appears on a second device signed into the same account. Choose **Do Not Disturb**: the friend sees "Do Not Disturb", and tapping Invite shows a polite message that they aren't taking invites right now. Choose **Visible** to go back.
9. **Friend access denied**: Deny the friend-list prompt. The Friends screen explains how to allow access and offers a room code instead.

iOS only shows the sign-in sheet once per launch. After cancelling it, sign in from Settings → Game Center and relaunch the app.

## Automated tests

- `server/__tests__/gameCenterVerifier.test.ts` generates certificate chains with openssl and checks a valid proof, a wrong bundle ID, a tampered signature, a different player ID, stale and future timestamps, non-Apple and non-HTTPS key URLs, untrusted chains, a non-Apple subject, untrusted issuer hosts, expired certificates and malformed fields.
- `lib/identity/__tests__/gameCenterLink.test.ts` covers the on-device decisions: when the token is kept, replaced after sign-out or a player change, and retried after a `409`.
- `server/__tests__/game-center-friends.test.ts` runs friends and invites against the real server and a throwaway database: mutual-only presence, unlinked friends hidden, friend IDs never written to the database, live "In a game" status, reserved rooms that outsiders and second devices cannot use, blocks hiding both players, decline/cancel/expiry/sender-leaving, two simultaneous accepts, one waiting invite at a time, the per-minute invite limit, and the friend visibility setting (Appear Offline hides the player and blocks invites to them, Do Not Disturb shows them as busy and declines invites with a polite reason, the choice survives reconnects and applies on every device, changes reach the account's other devices live, players without Game Center are refused, and changes are rate-limited and saved in order).
- `lib/social/__tests__/friendsState.test.ts` covers the app's friend and invite state and the messages it shows.
- `server/__tests__/game-center-identity.test.ts` runs the real routes and WebSocket server against a throwaway Postgres database. It covers first-device linking with history carried over, forged/stale/replayed proofs, second-device recognition (gallery, reports, blocks, matchmaking), a shared phone switching players, a link applied to an already-queued connection, and players who never sign in.
