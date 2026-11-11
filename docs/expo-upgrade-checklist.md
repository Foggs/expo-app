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

## 2. Establish a native-capable upgrade route — next; blocked

- [ ] Select a native-capable execution environment and responsible executor
  that can perform the migration while preserving Game Center.
- [ ] Confirm access to the current branch, tracked Swift/podspec source, and
  a recovery checkpoint containing all pre-upgrade work.
- [ ] Confirm current SDK 57/58 migration guidance, native module requirements,
  supported Node/Xcode versions, and suitable EAS build images.
- [ ] Document the exact dependency/migration commands and stage acceptance
  checks before making changes. Keep npm and the existing lockfile.
- [ ] Obtain owner approval for the dependency-changing stage.

**Stop condition:** no dependency changes or cloud builds until this route is
resolved. This workspace's Expo Go-only procedure is not a substitute for
native compatibility validation.

## 3. Upgrade to SDK 57.0.9 or newer — not started

- [ ] Use Expo dependency alignment, not a hand-copied framework version matrix.
- [ ] Migrate affected APIs, review the asset patch, preserve custom settings,
  and remove obsolete config only where required.
- [ ] Run Expo dependency check, online Expo Doctor, TypeScript, lint, the full
  test suite, and iOS/Android JS exports. Record actual results and exceptions.
- [ ] In the native-capable route, verify Game Center still compiles and links.
- [ ] Report intermediate results and obtain approval to continue to SDK 58.

Do not use SDK 55, SDK 56, or SDK 57 before 57.0.9 as intermediate stages in
this plan. Do not bypass compatibility or package-age checks to force progress.

## 4. Upgrade to SDK 58 — not started

- [ ] Align framework dependencies with Expo CLI and address SDK 58 migrations.
- [ ] Preserve web output behavior, deep links, native permissions, identity,
  and required peer dependencies.
- [ ] Re-run dependency check, online Doctor, TypeScript, lint, all tests, and
  both native JS exports. Resolve failures or explicitly document blockers.
- [ ] Verify the resolved SDK and lockfile and review the complete change set.
- [ ] Compile/link Game Center under the target native toolchain.
- [ ] Report results and obtain approval before a TestFlight candidate build.

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
- [ ] Verify signing team, valid distribution certificate, and provisioning
  profile containing the enabled Game Center entitlement. Portal access alone
  does not prove usable signing.
- [ ] Obtain the existing app's numeric App Store Connect Apple ID for submission.
- [ ] Verify the intended backend has the matching Game Center/social code;
  publish it only with separate approval.

No native build or TestFlight submission has been verified in this work.

## 6. Build and submit the upgraded candidate — not started

- [ ] Confirm SDK 58 candidate, suitable build image, public backend address,
  native source upload inclusion, and expected build number.
- [ ] Obtain approval for cloud usage/costs and any required signing changes.
- [ ] Start the approved native build; inspect Swift compilation/linking logs.
- [ ] Record the exact successful build ID, app version, and build number.
- [ ] Review submission targeting the existing Apple app and exact build;
  obtain separate submission approval.
- [ ] Upload to App Store Connect and resolve processing/export-compliance
  requirements. Confirm the build becomes available to the intended testers.

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

## References

- [Native preparation details](native-build-readiness.md) — earlier baseline
  material; this checklist supersedes its former baseline-first sequence.
- [Expo SDK 58 release](https://expo.dev/changelog/sdk-58)
- [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)
