# SketchDuel — iOS Security & Privacy Readiness Audit

Date: 2026-11-05 · Scope: Expo SDK 54 iOS app (managed workflow), Express/WebSocket backend, Postgres schema, `app.json` iOS config.
This audit lowers rejection and incident risk; it does **not** guarantee App Store approval.

## 1. Summary

| Area | Status |
|---|---|
| Dependency vulnerabilities | `npm audit` reports 39 remaining (0 critical / 10 high / 28 moderate / 1 low); see §3 for the current scope and unresolved items. |
| Static analysis (SAST) | 1 HIGH, verified false positive, hardened anyway. |
| Privacy dataflow scan | 0 findings. |
| App-owned high-risk issues | 2 fixed (unauthenticated game API in production, response bodies in logs). |
| iOS permissions | Unused photo-library and local-network purpose strings removed; unused `expo-location` and `expo-image-picker` uninstalled. App now requests **no** runtime permissions. |
| Privacy manifest | App-level `ios.privacyManifests` added from verified SDK manifests. |
| Privacy policy | In-app link added. **URL does not resolve — release blocker.** |
| User-generated content (Guideline 1.2) | **No report/block/filter — release blocker.** |

### Release-blocking owner actions
1. **Publish the privacy policy** at `https://sketchduel.app/privacy` (DNS lookup for `sketchduel.app` failed on 2026-11-04). It must cover the data inventory in §4. Use the same URL in App Store Connect. If you use a different URL, change `expo.extra.privacyPolicyUrl` in `app.json`.
2. **UGC controls (Guideline 1.2): implemented on 2026-11-05.** The app now has report actions for gallery and match drawings, server-side report storage and review, device-level blocking, and a basic name filter. The owner should confirm the configured support mailbox is active and assign someone to review reports promptly; see `docs/content-moderation.md`.
3. **Answer App Store Connect privacy labels** as drafted in §6. Re-check them if the code changes.
4. **Remove `app/sepzellc.txt`** from the repo. It holds what looks like business/shipping reference numbers. It is not in the app bundle (verified in the iOS export), but it is committed to git.

### UGC remediation details
- Gallery drawings with pending reports are hidden; content marked actioned remains hidden. Owners review and resolve reports at `/moderation/reports`, using the server `SESSION_SECRET` as the access key.
- Random matchmaking checks device-level blocks in both directions. The device token itself is not exposed to opponents; only a one-way derived identifier is used.
- The home screen links to `support@sketchduel.app`. Confirm that address is monitored before release, or change `expo.extra.supportEmail` in `app.json`.

## 2. Method & evidence
- Scanners: dependency audit (osv), SAST, HoundDog privacy dataflow. All three were run before and after the fixes.
- Manual review: `server/index.ts`, `server/routes.ts`, `server/websocket.ts`, `server/storage.ts`, `shared/schema.ts`, `lib/sessionToken.ts`, client API usage, `app.json`, and the SDK `PrivacyInfo.xcprivacy` files in `node_modules`.
- Verification: `tsc --noEmit` clean; `npm run lint` 0 errors (2 unused-import warnings in `app/screenshot.tsx`); `npx vitest run` 39/39 passing; `npx expo export --platform ios` succeeded; `npx expo install --check` reports all dependencies up to date; `expo config --type introspect` shows no permission usage strings. A production-mode server returned 404 for `/api/games*`, 200 for `/api/health` and `/api/gallery`, and 404 for a traversal attempt via `expo-platform: ../../etc`.
- Lockfile: every `resolved` URL in `package-lock.json` points to `https://registry.npmjs.org/`. A clean install in a temporary copy with `npm ci --legacy-peer-deps --registry=https://registry.npmjs.org/ --userconfig=/dev/null` installed 1,161 packages and applied the local expo-asset patch. The peer-resolution flag works around npm's `edgesOut` resolver error for the Vitest/Puppeteer peer tree.

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
- Current scan (2026-11-05): `npm audit --json` reports 39 findings (0 critical, 10 high, 28 moderate, 1 low). `npm audit --omit=dev` reports 25 (0 critical, 10 high, 13 moderate, 2 low); that includes Expo CLI/Metro build tooling declared through Expo packages and does not mean all 25 are shipped app runtime code.
- Expo SDK 54 patch updates are applied and verified: `expo@54.0.38`, `expo-router@6.0.24`, `expo-constants@18.0.14`, `expo-font@14.0.12`, `expo-glass-effect@0.1.10`, `expo-linking@8.0.12`, and `expo-web-browser@15.0.11`. `npx expo install --check` reports no mismatches.
- `vitest@4.1.12` is now a development dependency; its earlier critical advisory is cleared. The project also declares `vite` and `babel-preset-expo` directly as development dependencies so clean installs include the tools required by tests and the Expo export. npm's normal peer resolver failed with `edgesOut` while resolving the Puppeteer/Vitest peers; the lockfile installs cleanly with `--legacy-peer-deps`.
- Screenshot tooling updated: `puppeteer-core@25.16.0` and `sharp@0.35.5` are no longer flagged. The capture script remains at `scripts/screenshots/capture.ts`; it uses the installed Chromium binary and screenshot route.
- High findings still reported:
  - `expo-router@6.0.24` and `query-string` include vulnerable `decode-uri-component` versions. npm's suggested Expo Router fix is a major jump beyond SDK 54, so this needs a compatible upstream SDK update or a separately tested dependency change.
  - Expo/Metro/React Native trees include vulnerable `ws` 6/7, `postcss`, and `image-size` versions; npm also reports `brace-expansion` in the dependency tree.
  - Resolved (2026-11-06): the `zod@3.25.76` memory-exhaustion advisory is cleared by upgrading to `zod@4.6.7` (with `drizzle-zod@0.8.3`). `zod-validation-error` was unused and has been removed. Request and WebSocket limits are pinned by tests in `shared/__tests__/schema.test.ts` and `server/__tests__/request-validation.test.ts`.
  - `@react-navigation/core` is flagged through `query-string`.
- Remaining moderate and low findings include Expo CLI/build transitive packages, `@expo/ngrok`, ESLint/TypeScript tooling, `drizzle-kit`, `uuid`, `yaml`, and `deepmerge`. Review them again when compatible SDK/tooling patches are available.

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
- Build-time dependency advisories pinned by Expo SDK 54.
- No server-side retention limits for drawings.
