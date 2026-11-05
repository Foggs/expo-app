#!/bin/bash
# Runs automatically after a task branch is merged into the main project.
set -euo pipefail

# Install dependencies from the merged lockfile. Legacy peer mode matches how
# the lockfile is generated (see Vitest/puppeteer peer-resolution notes).
npm install --legacy-peer-deps --no-audit --no-fund

# Installs in this workspace can write internal mirror URLs into the lockfile;
# keep it pointed at the public registry so release builds can install.
sed -i -E 's#http://package-firewall\.replit\.(internal|local)/npm/#https://registry.npmjs.org/#g' package-lock.json

# Apply schema changes non-interactively (stdin is closed during setup).
npx drizzle-kit push --force
