---
name: Remaining npm audit advisories
description: Avoid incompatible audit-driven framework downgrades and Metro overrides during staged Expo upgrades.
---
Resolve Expo-owned audit findings through supported SDK dependency alignment,
not `npm audit fix --force`. Audit may suggest downgrading Expo, ESLint config,
or Drizzle tooling to much older major versions; those suggestions are not a
compatible upgrade plan. Respect the owner's approval gates between SDK stages.

**Why:** npm's proposed audit fixes have included Expo 52 while the app was on
Expo 58, and older Drizzle/ESLint toolchains. Previously, forcing Metro's
`image-size` dependency to 2.x broke the iOS bundle with an ArrayBuffer error.
An audit count of zero is not worth an incompatible framework or database-tool
downgrade.

**How to apply:** inspect the advisory's dependency chain and actual resolved
versions; use a compatible patched parent where available, and report unresolved
findings rather than hiding them. Do not generalize the old `image-size`
workaround to newer Metro versions without checking their supported API.
Re-check lockfile tarball hosts and paths after every install.
