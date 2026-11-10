# SketchDuel native-build readiness

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
  `29068319-a247-48ad-bc51-575c0c773ecd`. Account ownership/access has not been
  verified through authenticated EAS CLI.
- There is no `eas.json`. No `expo-dev-client` dependency is installed.

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

Account access, signing, App Store Connect settings, and an SDK-54-compatible
cloud build image have not been verified. Never paste account credentials,
signing files, or session tokens into chat or this document.

## Recommended external route: SDK 54 TestFlight baseline

Use a separate external checkout of this branch containing the native source.
A standalone TestFlight build includes the custom native module and
does not require Expo Go or `expo-dev-client`.

The following are **owner-run external steps**, not commands executed here:

1. Install the locked dependencies using the existing npm peer-resolution policy:
   `npm ci --legacy-peer-deps`.
2. Use `npx eas-cli@latest login` and `npx eas-cli@latest whoami` to establish
   Expo access. Sign in interactively; do not share credentials.
3. Run `npx eas-cli@latest build:configure` for iOS. Review generated
   `eas.json` and project linking changes before proceeding. Preserve existing
   app identity, permissions, entitlements, and unrelated scripts.
4. Configure the production profile's build environment with the verified
   `EXPO_PUBLIC_DOMAIN`. It is a public server address, not a secret. Do not use a
   guessed production URL or assume localhost will work on an iPhone.
5. In Apple's developer portal, verify Game Center is enabled for the app ID and
   included in the provisioning configuration. Also verify Game Center setup in
   App Store Connect. Do not assume EAS automatically handles every capability.
6. Confirm the selected EAS image can build SDK 54 and satisfies the intended
   distribution requirements. Check that the upload includes both native source
   files before spending build time.
7. Only after explicit owner approval of cloud usage and signing changes, run
   `npx eas-cli@latest build --profile production --platform ios`.
   Inspect logs for compilation and linking of `GameCenterModule`.
8. Review a successful build before separately approving
   `npx eas-cli@latest submit --profile production --platform ios`.
   This uploads to App Store Connect; install through internal TestFlight testing.
   Submission is not public App Store release or a guarantee of Apple acceptance.

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

Only after native SDK 54 acceptance, ask the owner whether to proceed.
Migration belongs in an external native-build-capable workflow; the supported
Expo Go-only workflow here does not cover this custom module.

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
