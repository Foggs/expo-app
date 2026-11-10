---
name: Remaining npm audit advisories
description: Which npm audit findings are intentionally left (need Expo/major upgrades) and which overrides exist.
---
`npm audit fix` plus three package.json `overrides` (brace-expansion 1.x, decode-uri-component, postcss under @expo/metro-config) cleared everything fixable without a major upgrade. About 29 moderate/low findings plus one high (image-size) remain.

**Why:** the remaining fixes npm suggests are Expo SDK major changes (even downgrades to Expo 52) or dev-tool upgrades. Forcing metro's image-size to 2.x breaks the iOS bundle ("list argument must be an instance of ArrayBuffer").

**How to apply:** fix the rest by upgrading Expo SDK, not by `npm audit fix --force`. Re-check package-lock.json for internal mirror URLs after any install.
