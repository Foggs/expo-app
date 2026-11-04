# SketchDuel — iOS Security & Privacy Readiness Audit

Date: 2026-11-04 · Scope: Expo SDK 54 iOS app (managed workflow), Express/WebSocket backend, Postgres schema, `app.json` iOS config.
This audit lowers rejection and incident risk; it does **not** guarantee App Store approval.

## 1. Summary

| Area | Status |
|---|---|
| Dependency vulnerabilities | Reduced from 195 (2 critical / 106 high) to 40 (1 critical / 20 high). Remaining are dev/build-only or need major upgrades (see §3). |
| Static analysis (SAST) | 1 HIGH, verified false positive, hardened anyway. |
| Privacy dataflow scan | 0 findings. |
| App-owned high-risk issues | 2 fixed (unauthenticated game API in production, response bodies in logs). |
| iOS permissions | Unused photo-library and local-network purpose strings removed; unused `expo-location` and `expo-image-picker` uninstalled. App now requests **no** runtime permissions. |
| Privacy manifest | App-level `ios.privacyManifests` added from verified SDK manifests. |
| Privacy policy | In-app link added. **URL does not resolve — release blocker.** |
| User-generated content (Guideline 1.2) | **No report/block/filter — release blocker.** |

### Release-blocking owner actions
1. **Publish the privacy policy** at `https://sketchduel.app/privacy` (DNS lookup for `sketchduel.app` failed on 2026-11-04). It must cover the data inventory in §4. Use the same URL in App Store Connect. If you use a different URL, change `expo.extra.privacyPolicyUrl` in `app.json`.
2. **Decide how to handle UGC (Guideline 1.2).** Strangers see each other's freehand drawings in random matches and in a public gallery. Gallery names are client-supplied free text. Apple expects all four of these: a way to filter objectionable content, a way to report content with timely responses, a way to block abusive users, and published contact info. None exist today. Options: (a) build report + block + moderation, or (b) limit public exposure (for example, friends-only matches and a private gallery).
3. **Answer App Store Connect privacy labels** as drafted in §6. Re-check them if the code changes.
4. **Remove `app/sepzellc.txt`** from the repo. It holds what looks like business/shipping reference numbers. It is not in the app bundle (verified in the iOS export), but it is committed to git.

## 2. Method & evidence
- Scanners: dependency audit (osv), SAST, HoundDog privacy dataflow. All three were run before and after the fixes.
- Manual review: `server/index.ts`, `server/routes.ts`, `server/websocket.ts`, `server/storage.ts`, `shared/schema.ts`, `lib/sessionToken.ts`, client API usage, `app.json`, and the SDK `PrivacyInfo.xcprivacy` files in `node_modules`.
- Verification: `tsc --noEmit` clean; `expo lint` 0 errors (2 unused-import warnings in `app/screenshot.tsx`); vitest 39/39 passing; `expo export --platform ios` succeeded; `expo config --type introspect` shows no permission usage strings. A production-mode server returned 404 for `/api/games*`, 200 for `/api/health` and `/api/gallery`, and 404 for a traversal attempt via `expo-platform: ../../etc`.
- Lockfile: every `resolved` URL in `package-lock.json` points to `https://registry.npmjs.org/`. A clean `npm ci` against the public registry, outside the workspace config, installed all 1,159 packages with the patched versions.

## 3. Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | High | `/api/games`, `/api/games/:id`, `/api/games/:id/turns` had no auth. Anyone could list active games, read in-progress drawings, and inject turns. The app never calls them (games run over the WebSocket). | **Fixed**: registered only when `NODE_ENV !== "production"`. |
| F2 | Critical/High (deps) | Server runtime: `proxy-addr` IP spoofing (critical), `body-parser` DoS, `path-to-regexp` ReDoS, `express-rate-limit` IPv6 bypass, `ws` memory DoS, `http-proxy-middleware` injection, `drizzle-orm` SQL identifier injection, plus many build-tool transitive issues. | **Fixed**: express 5.3, express-rate-limit 8.7, ws 8.22, http-proxy-middleware 3.0.10, drizzle-orm 0.45, path-to-regexp 8.4; in-range updates for tar, node-forge, xmldom, undici, picomatch, minimatch, js-yaml, etc. |
| F3 | Medium | The request logger wrote API response bodies (gallery names, drawing data) to logs. | **Fixed**: logs only method, path, status, and duration. |
| F4 | High (SAST) | `fs-express` path traversal at `serveExpoManifest`. **False positive**: only `ios`/`android` reached it. | **Hardened**: typed allowlist checked at both the caller and the callee. The scanner still pattern-matches; it is safe to suppress. |
| F5 | Medium | Unused iOS permission strings (photo library ×2, local network) and unused SDKs (`expo-location`, `expo-image-picker`). Unused purpose strings are a common review flag. | **Fixed**: removed. |
| F6 | Medium | `privacyPolicyUrl` was a top-level key Expo does not recognize, so nothing could use it. The app had no in-app privacy link. | **Fixed**: moved to `expo.extra`; added a "Privacy Policy" link on the home screen (opens in an in-app browser). |
| F7 | Medium | Any client with any non-empty `X-Session-Token` can delete any gallery drawing. | **Accepted**: owner requested gallery-wide delete. Risk: vandalism of the public gallery. |
| F8 | Low | WebSocket accepts connections with no `Origin` header (native clients). | Accepted: no cookies or ambient auth, so cross-site WebSocket hijacking has no impact. Origins are allowlisted when present. Payload is capped at 512 KB, with per-connection rate limits and 500 max connections. |
| F9 | Low | CSP on the landing page allows `'unsafe-inline'` and `unpkg.com` scripts. | Residual; affects only the web landing page, not the iOS app. |
| F10 | Low | `LOCAL_DEVELOPMENT.md` shows `Authorization: Bearer dev-local-token`, but the server never checks `API_AUTH_TOKEN`. | Docs-only; owner should fix the docs. |
| F11 | Low | `app/screenshot.tsx` is a mock route bundled into the production app (reachable via the `sketchduel://screenshot` deep link). | Residual; covered by the pre-publish cleanup task. |

### Remaining dependency findings (not fixed, with reason)
- `vitest@4.0.18` (critical): the issue applies only while the Vitest UI server runs, which is never in prod. The upgrade is blocked by an npm resolver error with `puppeteer-core`'s peer range. Dev-only.
- `zod@3.25.76` (high): memory exhaustion on oversized collections. The fix needs zod 4 (a major upgrade). Mitigated by the 2 MB JSON body limit, the 512 KB WebSocket cap, and `.max()` limits on every array.
- `decode-uri-component` (via expo-router), `ws@6/7`, `postcss`, `image-size`, `uuid@7` (Expo CLI/Metro/xcode), `sharp`, `extract-zip`, `basic-ftp`, `uuid@3` (dev tools: ngrok, puppeteer), `brace-expansion@1` (eslint). These are build-time or pinned by Expo SDK 54. Expo reports newer patch releases (`expo ~54.0.37`, `expo-router ~6.0.24`, and others) that should be applied with `npx expo install --fix` during release prep.

## 4. Data inventory

| Data | Source | Where it goes | Purpose | Retention | Deletion |
|---|---|---|---|---|---|
| Drawings (stroke paths, colors, widths) | User | Live to opponent over WSS; stored in `turns` per game | Gameplay | Indefinite (no purge job) | None |
| Gallery drawings + display names | User taps save on results | `gallery_drawings`; **publicly visible to all users** | Gallery feature | Until deleted | Any user can delete any item |
| Display name | Server-generated random (e.g. "SwiftArtist42"); gallery stores "You" and opponent's random name | Opponent, gallery, server logs | Gameplay | Logs per host policy; gallery as above | With gallery item |
| Session token (random 256-bit) | Generated on device; Keychain (SecureStore), AsyncStorage fallback | Sent with gallery save (stored in `session_token`) and as delete header | Originally ownership; now only a non-empty check | Until gallery item is deleted | With gallery item |
| Friend room codes | Server | In memory only | Private matches | 10 min TTL | Automatic |
| IP address | Network | Rate limiter memory; hosting infrastructure | Abuse prevention | Transient in app | n/a |
| Share invite link | User action | OS share sheet / SMS / Messenger (user-initiated) | Invite friends | n/a | n/a |

Not collected: accounts, email, contacts, location, photos, camera, microphone, health, payments, advertising ID, analytics, crash reporting. No third-party SDKs send data off device. Processors: Replit (hosting) and the Postgres database provider.

Recommendations (not release-blocking): add a retention purge for `turns` and abandoned `games`. Stop storing `session_token` on gallery rows, since it no longer controls access; this would let you drop the identifier from labels and the manifest.

## 5. iOS configuration review
- **Permissions**: none requested. `LSApplicationQueriesSchemes` (`fb-messenger`, `sms`) is used by the friend-invite share buttons (`canOpenURL`) and is kept.
- **Export compliance**: `ITSAppUsesNonExemptEncryption: false` added. The app uses only OS HTTPS/WSS; `expo-crypto` is used for random bytes, not encryption. The owner should confirm this answer in App Store Connect.
- **ATS**: no `NSAppTransportSecurity` overrides. Production uses `https`/`wss`; plain `ws://` is used only for LAN dev hosts.
- **Privacy manifest** (`ios.privacyManifests`, merged into `PrivacyInfo.xcprivacy` at prebuild):
  - `NSPrivacyTracking: false`, no tracking domains.
  - Required-reason APIs, copied from verified SDK manifests: UserDefaults `CA92.1` (React Native, expo-constants, expo-system-ui); FileTimestamp `C617.1` (React Native, AsyncStorage), `0A2A.1`/`3B52.1` (expo-file-system); DiskSpace `E174.1`/`85F4.1` (expo-file-system).
  - Collected data: Other User Content and Device ID (the session token), both not linked, not tracking, App Functionality.
- **ATT**: not required. No tracking, no IDFA, no `NSUserTrackingUsageDescription`.
- **Account deletion (5.1.1(v))**: not applicable. There is no account creation; the `users` table is unused.

## 6. Draft App Store Connect privacy answers
- Do you or your partners collect data from this app? **Yes.**
- **User Content → Other User Content**: collected; not linked to the user; not used for tracking; purpose: App Functionality.
- **Identifiers → Device ID**: collected (app-generated random token saved with gallery posts); not linked; not used for tracking; purpose: App Functionality. *Drop this if the token is no longer stored server-side.*
- All other categories: **Not collected.**
- Tracking: **No.**
- Age rating questionnaire: answer **Yes** to user-generated content and anonymous interaction with strangers. Expect a higher age rating unless UGC is moderated or restricted.

## 7. Residual risks
- UGC moderation gap (Guideline 1.2); see owner action 2.
- Public, anyone-can-delete gallery (F7).
- Build-time dependency advisories pinned by Expo SDK 54 and the zod 3 line.
- No server-side retention limits for drawings.
