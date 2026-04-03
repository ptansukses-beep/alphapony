#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  compareVersions,
  downloadToFile,
  ensureDir,
  getRootDir,
  loadEnv,
  normalizeVersion
} = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  if (!process.env.ALPHAPONY_UPDATE_MANIFEST_URL) {
    console.error("ALPHAPONY_UPDATE_MANIFEST_URL is not configured.");
    process.exit(1);
  }

  const manifestFile = path.join(rootDir, ".runtime", "update-manifest.json");
  ensureDir(path.dirname(manifestFile));
  await downloadToFile(process.env.ALPHAPONY_UPDATE_MANIFEST_URL, manifestFile);

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const currentVersion = normalizeVersion(pkg.version);
  const latestVersion = normalizeVersion(manifest.version);

  console.log(
    JSON.stringify(
      {
        currentVersion,
        latestVersion,
        updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
        url: manifest.url || "",
        sha256: manifest.sha256 || ""
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
