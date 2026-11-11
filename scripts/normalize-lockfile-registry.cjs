// Package installs can record Replit's private mirror in the generated lockfile.
// EAS cannot reach it. Preserve package versions and integrity while using the
// same tarball paths at the public npm registry.
const fs = require("node:fs");
const path = require("node:path");

const lockPath = path.join(__dirname, "..", "package-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
let changed = 0;

for (const pkg of Object.values(lock.packages)) {
  if (!pkg.resolved?.startsWith("http")) continue;
  const url = new URL(pkg.resolved);
  const publicRegistry = url.hostname === "registry.npmjs.org" && url.protocol === "https:";
  // npm's replace-registry-host can replace the hostname while leaving the
  // private mirror's /npm/ path prefix, which produces public-registry 404s.
  const mirrorPrefix = url.pathname.startsWith("/npm/") && !url.pathname.startsWith("/npm/-/");
  if (publicRegistry && !mirrorPrefix) continue;
  if (
    (!publicRegistry && url.hostname !== "package-firewall.replit.internal") ||
    !mirrorPrefix ||
    !pkg.integrity ||
    url.username ||
    url.password ||
    url.search
  ) {
    throw new Error("Unexpected lockfile registry entry; review before exporting.");
  }
  pkg.resolved = `https://registry.npmjs.org/${url.pathname.slice("/npm/".length)}`;
  changed++;
}

if (process.argv.includes("--check")) {
  if (changed) throw new Error(`${changed} lockfile URLs need normalization.`);
} else if (changed) {
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}
console.log(`${changed} lockfile registry URLs ${process.argv.includes("--check") ? "need normalization" : "normalized"}.`);
