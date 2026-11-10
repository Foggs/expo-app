# SketchDuel native-build readiness

> Current plan: [Expo upgrade checklist](expo-upgrade-checklist.md).
> The owner chose to upgrade first, then build/test the upgraded app. The SDK 54
> baseline route below is optional historical preparation, not a prerequisite
> or authorization to start a build. The checklist controls the sequence.

## Scope

Prepare a native SDK 54 baseline before considering an SDK upgrade. Keep Game
Center sign-in, identity verification, friends, privacy, invites, and rematches.
This document does not authorize a cloud build, SDK migration, or publication.

## Verified preparation results

- Work is on `expo-sdk-58-upgrade`, branched from `feature-friends-match`.
- The installed Expo version is 54.0.38.
- The existing baseline passed: TypeScript, 168 tests across 21 test files, and
  an iOS JavaScript bundle export. Lint reported zero errors and two existing
  warnings. These results do not prove that Swift compiles or Apple signing works.
- Apple's GameKit integration is implemented as a local Expo module.
- The installed autolinking tool resolves `GameCenterModule` and its `GameCenter`
  pod in this workspace. That is discovery evidence, not compilation evidence.
- The app declares its Game Center entitlement and friend-list permission text.
- The app config references the owner-provided Expo project ID
  `29068319-a247-48ad-bc51-575c0c773ecd`. The owner confirmed the dashboard ID
  matches and EAS device login succeeded with the correct account.
- `eas.json` now contains a production store-distribution profile for a physical
  iPhone Release build, not a Simulator or development-client build.
- EAS manages build numbers remotely, with iOS auto-increment enabled. Before
  the first build, recheck the remote number. The owner reported highest Apple
  build 2 and confirmed initializing the remote number to 2; the next increment
  is expected to be 3. Do not lower a number that has since advanced.
- The profile sets the public backend address to
  `https://sketch-duel.replit.app`, obtained from deployment metadata. Its
  `/api/health` endpoint responded successfully during preparation. This is
  not evidence that the latest Game Center server code is deployed.
- The production `GAME_CENTER_BUNDLE_IDS` override was not present when checked.
  Deploy the matching server default before Game Center acceptance testing.
- The profile keeps npm's legacy peer-resolution mode used by this lockfile.
  No `expo-dev-client` dependency is installed.

## Native source inclusion

The broad `ios/` and `android/` Git ignore entries were narrowed to `/ios/`
and `/android/`. Generated native projects at the repository root remain
excluded, while local modules' native source can be included in Git.

Preserve `modules/game-center/ios/GameCenterModule.swift` and
`modules/game-center/ios/GameCenter.podspec` in version control. Check the
external build upload contents before starting a cloud build; local
autolinking success alone is not compilation or upload evidence.

## External owner prerequisites

- An Expo account with access to the intended project or organization.
- Apple Developer team access for a signed physical-iPhone build and App Store
  Connect access for TestFlight. Confirm the existing app record and ownership of
  `app.replit.sketchduel`; do not silently create a replacement identifier.
- An iPhone for final Game Center acceptance. Friends/invite tests need two
  accounts that are Game Center friends, normally on two iPhones.
- A Mac with Xcode only if using the iOS Simulator or a local iOS build.
  An EAS cloud build for an iPhone does not require the owner's computer to be a Mac.
- A reachable HTTPS backend containing the current identity and social endpoints.
  Confirm its actual address separately before configuring the build.

The owner confirmed Apple membership, certificate/profile portal access, and
Game Center enabled in both Apple portals. Usable signing credentials,
provisioning entitlements, and a compatible cloud image remain unverified.
Never paste account credentials,
signing files, or session tokens into chat or this document.

## Optional historical route: SDK 54 TestFlight baseline

Use a separate external checkout of this branch containing the native source.
A standalone TestFlight build includes the custom native module and
does not require Expo Go or `expo-dev-client`.

The following are **owner-run external steps**, not commands executed here:

1. Install the locked dependencies using the existing npm peer-resolution policy:
   `npm ci --legacy-peer-deps`.
2. Use `npx eas-cli@latest login` and `npx eas-cli@latest whoami` to establish
   Expo access. Sign in interactively; do not share credentials.
3. Review the existing `eas.json` production profile and project link. Do not
   overwrite them with a starter configuration. Use
   `npx eas-cli@latest project:info` to check authenticated access to the intended
   Expo project. Preserve app identity, permissions, entitlements, and scripts.
4. Confirm the configured public backend is the intended test service and has
   the current identity and social code. Bundled `EXPO_PUBLIC_DOMAIN` is a public
   address, not a secret. Keep credentials and private signing material out of
   `eas.json`. The selected EAS production environment may have additional
   account-managed settings; review them before building.
5. In Apple's developer portal, verify Game Center is enabled for the app ID and
   included in the provisioning configuration. Also verify Game Center setup in
   App Store Connect. Do not assume EAS automatically handles every capability.
6. Confirm the selected EAS image can build SDK 54 and satisfies the intended
   distribution requirements. Check that the upload includes both native source
   files before spending build time.
7. Only after explicit owner approval of cloud usage and signing changes, run
   `npx eas-cli@latest build --profile production --platform ios`.
   Inspect logs for compilation and linking of `GameCenterModule`.
8. Review a successful build before separately preparing and approving a
   submission profile. Obtain the existing App Store Connect numeric Apple ID
   (not the bundle ID) to target that record explicitly, and select the reviewed
   build ID rather than blindly submitting the latest build. No submission
   profile, automatic submission, or release automation is configured here.
   Submission uploads to App Store Connect for TestFlight; it is not public
   App Store release or a guarantee of Apple acceptance.

If production-profile configuration or signing fails, stop and record the
specific failure. Do not change SDK versions merely to troubleshoot an unrelated
account or signing problem.

## Coverage and acceptance

| Area | Stock Expo Go | Custom Simulator build | Physical native iPhone build |
| --- | --- | --- | --- |
| Drawing, room codes, matchmaking, results | Requires a supported SDK; SDK 58 Go cannot open SDK 54 | Test | Test |
| Navigation, keyboard, loading and modal animations | Test only on a supported SDK | Test | Test |
| Game Center native integration | Not included | Test supported functions; record actual limitations | Required |
| Identity proof accepted by backend | Not available | Do not assume support or success | Required |
| Friends, privacy, invites and Rematch | Not available | Coverage depends on actual account/runtime support | Required with two players |

Simulator testing means an actual native build running under Xcode's Simulator
on a Mac, not a browser preview. It is useful partial coverage, not a substitute
for device acceptance. No Simulator or iPhone tests have been performed here.

### Physical-iPhone acceptance checklist

- Sign in; verify the backend accepts the identity proof, not just the welcome UI.
- Decline sign-in, sign out, and switch players; check anonymous fallback and
  separation of account-owned content.
- Draw and finish a match; check room codes, matchmaking, results, gallery,
  navigation, keyboard, loading, and modal animations.
- With two friends, verify presence, friend-list permission allowed/denied,
  Appear Offline, Do Not Disturb, and blocking behavior.
- Invite, accept, decline, cancel, and let an invite expire. Confirm an interrupted
  match start exits rather than remaining on “Starting match”.
- Finish an invited match and tap **Rematch**. Check waiting, cancellation,
  unavailable-friend behavior, acceptance, and both players joining the same game.
- Record each device, iOS version, build, outcome, and any failure without
  including account identifiers or credentials.

## Later upgrade checkpoints

Native SDK 54 acceptance is optional, not required before upgrading. Follow the
current upgrade checklist and obtain approval between stages. Migration belongs
in a native-build-capable workflow; the supported Expo Go-only workflow here
does not cover this custom module.

Recheck current official compatibility and release guidance before executing.
The proposed route is SDK 54 → SDK 57 at 57.0.9 or newer → SDK 58. Do not use
SDK 55, SDK 56, or SDK 57 before 57.0.9 as intermediate stages in this plan.

At each stage, preserve the app and Game Center module; run Expo dependency
checks, Expo Doctor, TypeScript, lint, the full test suite, and both native bundle
exports. Also compile a native iOS build and repeat device acceptance. Stop for
owner confirmation between stages. Do not merge based only on a web preview or
bundle export.

## Official references

- [Expo build setup](https://docs.expo.dev/build/setup/)
- [Expo iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)
- [Expo local module discovery](https://docs.expo.dev/modules/autolinking/)
- [Expo SDK upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Apple Game Center setup](https://developer.apple.com/documentation/gamekit/initializing-and-configuring-game-center)
