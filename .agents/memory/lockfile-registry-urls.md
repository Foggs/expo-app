---
name: Lockfile registry URLs
description: Package installs in this workspace can write internal mirror tarball URLs into package-lock.json, which breaks clean installs elsewhere.
---
After any package install or `npm update`, check package-lock.json for `"resolved"` URLs that do not start with `https://registry.npmjs.org/` (for example, `package-firewall.replit.internal` or `.replit.local`). Rewrite them to the public registry; the integrity hashes stay valid.

**Why:** the iOS release build (EAS or a local Xcode machine) runs `npm ci` outside Replit and cannot reach the internal host. A code review rejected a dependency upgrade for this reason (2026-11-04).

**How to apply:** `grep -c package-firewall package-lock.json` should print 0. Confirm with `npm ci --registry=https://registry.npmjs.org/ --userconfig=/dev/null` in a temporary copy.
