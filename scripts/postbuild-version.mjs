// Post-build: copies the build version into dist/version.json so the client
// can fetch it at runtime to detect stale SW caches.
import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const dist = path.join(root, "dist");
const versionFile = path.join(root, ".build-version");

if (!fs.existsSync(versionFile)) {
  console.warn("[version-postbuild] .build-version not found — skipping");
  process.exit(0);
}

const version = fs.readFileSync(versionFile, "utf-8").trim();

if (!fs.existsSync(dist)) {
  console.warn("[version-postbuild] dist/ not found — skipping");
  process.exit(0);
}

fs.writeFileSync(
  path.join(dist, "version.json"),
  JSON.stringify({ version, built: new Date().toISOString() }, null, 2),
);
console.log(`[version-postbuild] dist/version.json written: ${version}`);
