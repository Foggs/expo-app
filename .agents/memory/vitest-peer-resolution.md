---
name: Vitest peer resolution
description: npm peer-resolution behavior when upgrading Vitest alongside Puppeteer and Expo tooling.
---
When npm throws an Arborist `edgesOut` error while upgrading Vitest with `puppeteer-core` present, retry the dependency update with `--legacy-peer-deps`. Keep Vitest and Vite as explicit development dependencies, and keep `babel-preset-expo` available at the project root so tests and Expo exports resolve after a clean install. A clean install of the resulting peer tree may need `npm ci --legacy-peer-deps`.

**Why:** legacy peer mode skips npm's automatic peer installation and hoisting, which can otherwise leave Vitest's Vite peer or Expo's Babel preset unavailable to project-level tools. A lockfile can also appear installed in the current workspace while `npm ci` rejects it if the peer-resolution mode differs.

**How to apply:** for future Vitest upgrades here, preserve explicit tool dependencies, use the same peer mode for lockfile generation and clean-install validation, and check the public-registry URL rule after every npm lockfile update.
