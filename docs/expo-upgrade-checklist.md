# SketchDuel Expo upgrade checklist

Last updated: 2026-11-11

## Goal and rules

Upgrade Expo, preserve Game Center, then build and test the upgraded app on an
iPhone through TestFlight. An SDK 54 baseline build is optional and is **not**
a prerequisite or the next step.

- Work on `expo-sdk-58-upgrade`; preserve the original branch.
- Keep Game Center, friends, privacy, invites, and Rematch.
- Preserve the Apple app record and bundle ID `app.replit.sketchduel`.
- Complete one approved step at a time and obtain owner confirmation before
  the next step. This checklist is not approval to execute the remaining work.
- Obtain separate approval for cloud builds, signing changes, backend
  publication, TestFlight submission, and merging.
- Never put credentials, login codes, callback URLs, or signing files here.

**Status key:** checked = completed with the evidence stated; unchecked = not
completed. Owner confirmations are not independent native verification.

## 1. Review the starting point — completed; native compatibility unresolved

- [x] Confirm upgrade branch and installed Expo SDK 54.0.38.
- [x] Record the earlier baseline: TypeScript passed; 168 tests in 21 files
  passed; lint had zero errors and two existing warnings; iOS JS export passed.
  These are historical SDK 54 results, not SDK 58 results.
- [x] Identify custom Swift Game Center module using ExpoModulesCore/GameKit.
- [x] Identify migration areas: Router/navigation, Reanimated/Worklets,
  `expo/fetch`, version-specific `expo-asset` patch, Babel/Metro, and app config.
- [x] Review the staged route: SDK 54 → SDK 57 at 57.0.9 or newer → SDK 58.
  Recheck official guidance and available compatible releases before execution.
- [x] Identify scope limitation: the available Expo Go-only upgrade procedure
  excludes this custom native module. Do not remove Game Center to bypass it.
- [ ] Establish Game Center's SDK 58 compatibility through native compilation
  and actual device behavior; source inspection cannot establish this.
- [x] Guard the Expo Go / missing-native-module path so core-flow checks do not
  rotate a saved Game Center identity. Focused regression tests pass; no device
  or Expo Go run has been performed.

## 2. Establish a native-capable upgrade route — local stage completed

- [x] Select the route: perform dependency/API migration in this workspace;
  use separately approved EAS iOS builds for native compilation and TestFlight.
  This Linux workspace cannot run Xcode or verify Swift compilation.
- [x] Confirm access to the current branch, tracked Swift/podspec source, and
  a recovery checkpoint containing all pre-upgrade work.
- [x] Confirm current SDK 57/58 migration guidance, native module requirements,
  supported Node/Xcode versions, and suitable EAS build images.
  SDK 57/58 release notes and Router migration guidance were reviewed. Local
  Node 22.23.4 meets both SDKs' Node requirements. On 2026-11-11, rechecked
  Expo's infrastructure reference and pinned the production iOS profile to
  `macos-tahoe-26.6-xcode-27.2` image (Node 22.23.4, CocoaPods 1.17.0)
  with owner approval. Owner previously confirmed all three Game Center files
  in the inspected EAS archive. Toolchain selection is complete, but its actual
  native compilation and Game Center compatibility remain unverified.
- [x] Document the exact dependency/migration commands and stage acceptance
  checks before making changes. Keep npm and the existing lockfile.
- [x] Obtain owner approval for the SDK 57 dependency-changing stage.

**Approved local commands:** install `expo@~57.0.32` with npm's existing
legacy-peer policy, then `npx expo install --fix` using Expo's version matrix.
Verify with `npx expo install --check`, online `npx expo-doctor@latest`,
`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, and
`npx expo export --platform ios` / `--platform android` to temporary output
directories. Inspect the version-specific asset patch before removing it.
SDK 57.0.32 is the current stable SDK 57 patch, above both the 57.0.9 memory
fix and 57.0.17 development-startup fix.

**Stage approvals:** owner approved the SDK 57 local stage, then separately
approved the SDK 58 dependency changes and local checks on 2026-11-11.
Cloud builds, signing changes, uploads, and merge still require separate approval.
JS validation is not a substitute for native compatibility validation.

## 3. Upgrade to SDK 57.0.32 — local checks completed; native unverified

- [x] Use Expo dependency alignment, not a hand-copied framework version matrix.
- [x] Migrate affected APIs, review the asset patch, preserve custom settings,
  and remove obsolete config only where required.
- [x] Run Expo dependency check, online Expo Doctor, TypeScript, lint, the full
  test suite, and iOS/Android JS exports. Record actual results and exceptions.
- [x] Verify a clean public-registry npm install in an isolated temporary
  directory, including the postinstall lifecycle; versions/integrities retained.
- [x] Confirm the custom Game Center module is discovered by iOS autolinking;
  evaluated config retains the Apple bundle ID and Game Center entitlement.
- [ ] In the native-capable route, verify Game Center still compiles and links.
- [x] Report intermediate results and obtain approval to continue to SDK 58.
  Owner approved proceeding with the native-compilation limitation disclosed.

**Results:** Expo dependency check passed; online Doctor passed 21/21;
TypeScript passed; all 172 tests in 22 files passed; iOS/Android Hermes exports
and web export passed. Browser screenshot showed the running home screen.
Both workflows restarted and served successfully. The optional desktop React
Native DevTools installer cannot load `libglib-2.0.so.0` in this hosted Linux
environment; Metro and the app still run.

**Lint exception:** zero errors, ten warnings. Two existing unused imports
remain. The SDK's newly enforced `react-hooks/set-state-in-effect` rule is
warning-only for this staged upgrade, exposing eight existing event/timer/modal
synchronization cases without changing gameplay behavior. Purity and shared-value
mutation errors were fixed rather than suppressed.

**Audit:** 17 moderate findings, no high or critical findings. Do not use
`npm audit fix --force` or jump to SDK 58 without separate approval.

**Changes:** aligned Expo/React Native/React, moved the focus hook to Router's
non-deprecated export, replaced removed `absoluteFillObject`, migrated splash
configuration to its plugin (retaining the image/background/full-screen iOS
behavior), removed obsolete `newArchEnabled` and TypeScript `baseUrl`, and
removed the asset patch after verifying its HTTPS fix is included upstream.
Native Swift and module registration were preserved unchanged.

Do not use SDK 55, SDK 56, or SDK 57 before 57.0.9 as intermediate stages in
this plan. Do not bypass compatibility or package-age checks to force progress.

## 4. Upgrade to SDK 58.0.24 — local checks completed; native unverified

- [x] Align framework dependencies with Expo CLI and address SDK 58 migrations.
- [x] Preserve web output configuration, deep-link configuration, permissions, identity,
  and required peer dependencies.
- [x] Re-run dependency check, online Doctor, TypeScript, lint, all tests, and
  both native JS exports. Resolve failures or explicitly document blockers.
- [x] Verify the resolved SDK and lockfile and review the complete change set.
- [x] Verify clean public-registry installation including postinstall, and
  normalize all lockfile tarball URLs without changing versions/integrities.
- [x] Verify browser results-navigation behavior using isolated in-memory
  drawings: back is blocked, Gallery/back retains drawings, Home and Play Again
  reach home, and empty results redirect without looping.
- [ ] Compile/link Game Center under the target native toolchain.
- [ ] Report results and obtain approval before a TestFlight candidate build.

**Results:** Expo 58.0.24, React Native 0.88.1, React 19.3.0. Expo dependency
check passed; online Doctor passed 20/20; TypeScript passed; all 172 tests in
22 files passed; iOS/Android Hermes exports and web export passed.
Clean public-registry npm installation including postinstall passed.
Both workflows restarted successfully, and the mobile-sized web home screen
rendered. Lint remains zero errors and ten disclosed warnings (same policy
as the SDK 57 stage). Audit reports 16 moderate findings, none high or critical.

**Migrations:** explicitly retain client-rendered single-page web output and
synchronous web routes rather than SDK 58's new server-rendering/async defaults.
Replace removed `beforeRemove` with `usePreventRemove`; block backward removal
but allow intentional replacements for Home, Play Again, rematch routing, and
the empty-results redirect. Browser checks verified these exits except native
friend-rematch acceptance, which requires device testing. Gallery back navigation
was checked, not gallery record loading.

The browser initially saw a blank page during cold startup; one warm reload
rendered correctly and the results-navigation checks then passed with no app
errors. Fixtures were confined to that browser's memory, with no server/database
or gallery writes.

**Game Center status:** Swift source and registration are unchanged. iOS
autolinking discovers `GameCenterModule`; evaluated config retains the Apple
bundle ID, entitlement, and friend permission description. No Swift compilation,
signing, Expo Go run, native device test, or TestFlight submission occurred.

JS exports and a working web preview are not proof of native compatibility.

## 5. Apple and Expo preparation — partly completed

- [x] Owner confirmed active Apple Developer membership.
- [x] Preserve existing App Store Connect app; align iOS/server identity.
- [x] Owner confirmed Game Center enabled in Apple Developer and App Store Connect.
- [x] Owner confirmed access to Certificates and Profiles.
- [x] Owner confirmed Expo dashboard project ID matches configured project.
- [x] Owner confirmed EAS device login succeeded with the correct account.
- [x] Prepare production EAS profile: store distribution, physical iPhone,
  Release build, remote numbering, auto-increment; no automatic submission.
- [x] Owner reported highest existing Apple build number is 2 and initialized
  Expo's remote starting number to 2. The next increment is expected to be 3.
- [ ] Recheck remote number before building; do not lower it if it has advanced.
  Owner subsequently confirmed authenticated project ID matches and remote
  iOS number is 2. Recheck again if another build occurs before this candidate.
- [ ] Verify signing team, valid distribution certificate, and provisioning
  profile containing the enabled Game Center entitlement. Portal access alone
  does not prove usable signing.
  Owner confirmed an unexpired distribution certificate, found the matching
  profile invalid, then confirmed the regenerated profile is active.
  Owner then confirmed EAS lists a distribution certificate and a profile whose
  identifier and expiration match the regenerated Apple profile.
  Certificate/private-key usability, certificate-to-profile pairing, and the
  actual Game Center entitlement remain unverified until further checks/build.
- [ ] Obtain the existing app's numeric App Store Connect Apple ID for submission.
- [ ] Verify the intended backend has the matching Game Center/social code;
  publish it only with separate approval.
  Read-only review confirmed deployment metadata reports a public successful
  deployment at the configured URL and GET `/api/health` returns 200.
  No shared/production `GAME_CENTER_BUNDLE_IDS` environment override or secret
  was present; current workspace code defaults to `app.replit.sketchduel`.
  This does not establish the default in the deployed revision. OPTIONS on the
  identity URL returned generic 200/OK, which the global middleware serves even
  for missing routes; it is not evidence the identity endpoint is deployed.
  No identity proofs, authenticated sockets, database queries, or writes were
  used. Deployed identity/social compatibility remains unverified pending
  release provenance or actual device acceptance.

Cloud build 5 finished successfully in EAS. TestFlight submission and real-device
Game Center acceptance remain unverified.

## 6. Build and submit the upgraded candidate — build succeeded, submission preparation

- [x] Confirm SDK 58 candidate, suitable build image, public backend address,
  native source upload inclusion, and expected build number.
  Backend reachability was confirmed, not Game Center/social acceptance.
- [x] Obtain approval for cloud usage/costs and any required signing changes.
- [ ] Start the approved native build; inspect Swift compilation/linking logs.
  EAS reports the complete build finished successfully; detailed Swift
  compilation/linking logs have not been independently reviewed.
- [x] Record the exact successful build ID, app version, and build number.
- [ ] Review submission targeting the existing Apple app and exact build;
  obtain separate submission approval.
- [ ] Upload to App Store Connect and resolve processing/export-compliance
  requirements. Confirm the build becomes available to the intended testers.

**Submitted candidate:** version 1.0.0, iOS build 5. Rechecked remote number 4,
then submitted one approved attempt with frozen credentials and no automatic
submission. EAS uploaded the compressed 56.8 MB archive and computed the
fingerprint successfully. Build ID: `fddabe5c-571d-4259-8137-ffad31905993`.
[Build status and logs](https://expo.dev/accounts/mrfoggs/projects/sketchduel/builds/fddabe5c-571d-4259-8137-ffad31905993).
**Verified result:** EAS `build:view` reports `FINISHED`, iOS, `STORE`
distribution, production profile, version 1.0.0, build 5; completed
2026-11-11 at 19:58:16 UTC. This establishes a successful native build, not
Game Center runtime or backend acceptance.

### TestFlight submission preparation

The owner approved preparation, then explicitly approved submitting build 5.
One non-interactive submission attempt stopped at authentication setup:
`App Store Connect API Keys cannot be set up in --non-interactive mode.`
No successful upload or submission was reported.
Use the existing build; do not rebuild, increment its number, use `--latest`,
or configure automatic submission.

The owner supplied the numeric **Apple ID of the SketchDuel app record**:
`6758966766`. Configured `submit.production.ios.ascAppId` in `eas.json` with
that value. This targets the owner-identified existing app; no authenticated
Apple lookup has independently verified the app-record mapping.
Submission authentication is separate from build signing: a valid distribution
certificate/profile does not establish an App Store Connect submission API key.
If setup is needed, use EAS's interactive credential flow after approval; do not
copy private keys or passwords into project files or chat.

Next authentication step in the owner's interactive Replit Shell:
`npx eas-cli@27.7.2 credentials --platform ios`, select the production profile,
then **App Store Connect: Manage your API Key**. Review the options before
creating or assigning a key. Build-signing credentials are separate and should
not be deleted or regenerated for this issue.

Prepared interactive command, not yet executed (the non-interactive attempt
above stopped before submission):

```sh
npx eas-cli@27.7.2 submit --platform ios --profile production --id fddabe5c-571d-4259-8137-ffad31905993 --no-auto-testflight-setup
```

The explicit build ID prevents selection of a different candidate. Automatic
TestFlight group setup is disabled; tester access will be reviewed separately.
After upload, confirm Apple processing and any export-compliance requirements
before installing through TestFlight.

TestFlight upload is not public App Store release. Do not submit an unreviewed
“latest” build or substitute an SDK 54 build for the SDK 58 candidate.

## 7. Test on iPhone and finish — not started

- [ ] Verify Game Center sign-in and backend identity-proof acceptance.
- [ ] Check declined sign-in, account switching, and account-data separation.
- [ ] Play complete matches; check drawing, matchmaking, room codes, results,
  gallery, navigation, keyboard, loading dots/progress, and modal animations.
- [ ] With two Game Center friends, verify permissions allowed/denied,
  presence, privacy, blocking, and invites accepted/declined/cancelled/expired.
- [ ] Verify interrupted match start recovers without staying on “Starting match”.
- [ ] Verify Rematch acceptance, cancellation, unavailable friend, and both
  players entering the same game.
- [ ] Record device/iOS version, app/build version, outcomes, and failures
  without account identifiers. Record untested platforms as untested.
- [ ] Fix failures and confirm the affected behavior; obtain final acceptance.
- [ ] Merge only after explicit approval. Public release requires separate approval.

## Progress updates

After each step, update its checkboxes and add a short evidence entry below.
Do not mark an intended action or a successful JS bundle as a native test pass.

| Date | Step | Result / evidence |
| --- | --- | --- |
| 2026-11-10 | Review and setup | SDK 54 remains installed; custom native limitation identified; owner confirmed Apple/Expo setup and remote number initialization. No upgrade or native build performed. |
| 2026-11-11 | Safe fallback | Missing Game Center native module now returns unavailable without reading or rotating stored identity. Focused tests (13), TypeScript, targeted lint, and frontend restart passed. No Expo Go/device test or SDK change performed. |
| 2026-11-11 | SDK 57 stage | Installed Expo 57.0.32 / React Native 0.86.3 / React 19.2.3. Dependency check, online Doctor 21/21, TypeScript, 172 tests, three-platform JS exports, clean npm install, and web home-screen screenshot passed. Lint: zero errors, ten disclosed warnings. Game Center autolinking/config checked, not natively compiled. Paused before SDK 58 and cloud builds for owner approval. |
| 2026-11-11 | SDK 58 stage | Owner approved local SDK 58 work. Installed Expo 58.0.24 / React Native 0.88.1 / React 19.3.0. Dependency check, Doctor 20/20, TypeScript, 172 tests, three-platform exports, clean install, home preview, and isolated results-navigation browser checks passed. Lint: zero errors, ten warnings; audit: 16 moderate, zero high/critical. No native build, signing changes, upload, or merge. |
| 2026-11-11 | Native readiness review | Reviewed current EAS profile, Apple identity/entitlement, tracked native source and ignore rules, and documented Xcode 27.2 image. Production URL confirmed from deployment metadata; health check passed, deployed Game Center behavior unverified. Current EAS access/build number, actual upload archive, and usable signing remain unverified because no EAS CLI is available in this session. No cloud build, signing change, submission, or backend publication occurred. |
| 2026-11-11 | Owner-run readiness checks | Owner confirmed device login, matching Expo project ID, remote iOS build number 2, and all three Game Center native/config files in the EAS archive. Owner reported regenerating the invalid provisioning profile and confirmed it is active. EAS signing credentials, actual profile entitlements, native compilation, and device acceptance remain unverified. No cloud build or submission authorized. |

Latest image configuration: pinned production iOS to
`macos-tahoe-26.6-xcode-27.2` after confirming it remains listed by Expo.
Validated the JSON and preserved store distribution, Release configuration,
remote numbering, auto-increment, environment settings, and no auto-submission.
No cloud build was started.

Latest signing setup: the first approved non-interactive build attempt advanced
the remote number from 2 to 3, then failed during credential setup before native
compilation. Subsequent authenticated inspection reported no configured project
credentials and no reusable distribution certificates in EAS, superseding the
earlier owner-reported credential-summary assessment.

With separate owner approval, the owner ran EAS credential setup. Its output
confirmed creation of a new distribution certificate, assignment to SketchDuel,
and creation of the Apple provisioning profile for `app.replit.sketchduel`.
No certificate revocation was reported. Credential generation is not a successful
signed build or verification of the profile's actual Game Center entitlement.
The retry advanced 3 to 4 and passed credential selection, then failed locally
before upload with ENOSPC while copying the 2.1 GB workspace dependency cache.
Excluded `/.cache/` via `.gitignore` (EAS's default upload exclusions). Removed
disposable prior clean-install test directories and abandoned EAS staging files;
`/tmp` free space increased from about 42 MB to 2.9 GB before archive verification.
Actual `build:inspect --stage archive` then succeeded: 101 MB, zero cache files,
and all three required Game Center native/config files present.
No cloud build or native compilation was reached in this retry.
Recheck the remote number before another attempt; the next auto-increment is
expected to use 5 if the remote number is still 4. Never reset the number.

## References

- [Native preparation details](native-build-readiness.md) — earlier baseline
  material; this checklist supersedes its former baseline-first sequence.
- [Expo SDK 58 release](https://expo.dev/changelog/sdk-58)
- [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)
