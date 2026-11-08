- [Expo deep-link routing](expo-deep-link-routing.md) — custom-scheme links need a matching validated route for reliable cold-start handling.
- [React Native window capabilities](react-native-window-capabilities.md) — native may define window without browser event APIs; capability-check methods inside effects.
- [React Native cryptographic randomness](react-native-cryptographic-randomness.md) — native iOS may lack browser crypto; use native secure randomness for tokens.
- [Lockfile registry URLs](lockfile-registry-urls.md) — installs here can write internal mirror URLs into package-lock.json; rewrite to the public registry.
- [Vitest peer resolution](vitest-peer-resolution.md) — npm's peer-resolution workaround requires direct Vite/Babel preset dependencies and matching clean-install flags.
- [Moderation alert recovery tests](moderation-alert-recovery-tests.md) — gate webhook responses; spawn servers with node --import tsx so SIGKILL crashes are real.
- [Social feature scope](social-scope.md) — rivalry records/friend leaderboards deferred to a future release; social scope is sign-in, friends/invites, privacy.

