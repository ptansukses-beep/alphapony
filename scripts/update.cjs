#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  compareVersions,
  copyPath,
  downloadToFile,
  ensureDir,
  getCommand,
  getRootDir,
  loadEnv,
  normalizeVersion,
  removePath,
  runCommand,
  sha256File,
  sleep,
  unzipFile
} = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  const runtimeDir = path.join(rootDir, ".runtime");
  const logDir = path.join(runtimeDir, "logs");
  const downloadDir = path.join(runtimeDir, "downloads");
  const releaseDir = path.join(runtimeDir, "releases");
  ensureDir(logDir);
  ensureDir(downloadDir);
  ensureDir(releaseDir);
  ensureDir(path.join(runtimeDir, "pids"));

  let downloadedRelease = false;
  let releaseRoot = null;

  if (process.env.ALPHAPONY_UPDATE_MANIFEST_URL) {
    const manifestFile = path.join(downloadDir, "latest.json");
    await downloadToFile(process.env.ALPHAPONY_UPDATE_MANIFEST_URL, manifestFile);

    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const currentVersion = normalizeVersion(pkg.version);
    const nextVersion = normalizeVersion(manifest.version);

    if (!nextVersion || compareVersions(nextVersion, currentVersion) <= 0) {
      console.log("AlphaPony is already on the latest version.");
      return;
    }

    if (!manifest.url) {
      throw new Error("Update manifest does not contain a download url.");
    }

    const zipFile = path.join(downloadDir, `alphapony-${nextVersion}.zip`);
    const extractDir = path.join(releaseDir, nextVersion);
    removePath(extractDir);
    removePath(zipFile);
    ensureDir(extractDir);

    await downloadToFile(manifest.url, zipFile);

    if (manifest.sha256) {
      const actualSha = await sha256File(zipFile);
      if (actualSha !== manifest.sha256) {
        throw new Error("Downloaded update checksum mismatch.");
      }
    }

    await unzipFile(zipFile, extractDir);
    const topLevelDirs = fs
      .readdirSync(extractDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(extractDir, entry.name));

    if (topLevelDirs.length === 0) {
      throw new Error("Downloaded update archive is empty.");
    }

    releaseRoot = topLevelDirs[0];
  }

  const backupResult = await runCommand(process.execPath, [path.join(rootDir, "scripts", "backup-db.cjs")], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"]
  }).catch((error) => {
    throw error;
  });

  if (backupResult && backupResult.stdout) {
    console.log(`Database backup created at ${String(backupResult.stdout).trim()}`);
  }

  await runCommand(process.execPath, [path.join(rootDir, "scripts", "stop.cjs")], { cwd: rootDir });

  if (releaseRoot) {
    for (const relativePath of [
      "backend",
      "frontend",
      "scripts",
      "package.json",
      "package-lock.json",
      "docker-compose.yml",
      ".env.example",
      "README.md",
      "README.en.md"
    ]) {
      const sourcePath = path.join(releaseRoot, relativePath);
      const targetPath = path.join(rootDir, relativePath);
      if (fs.existsSync(sourcePath)) {
        removePath(targetPath);
        copyPath(sourcePath, targetPath);
      }
    }

    loadEnv(rootDir);
    downloadedRelease = true;
  }

  let skipBuild = process.env.ALPHAPONY_SKIP_BUILD || "";
  if (!skipBuild && downloadedRelease) {
    skipBuild = "1";
  }

  if (skipBuild !== "1") {
    await runCommand(getCommand("npm"), ["run", "build"], { cwd: rootDir });
  }

  await runCommand(process.execPath, [path.join(rootDir, "scripts", "migrate.cjs")], { cwd: rootDir });

  const logPath = path.join(logDir, "app.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const child = require("child_process").spawn(process.execPath, [path.join(rootDir, "scripts", "start.cjs")], {
    cwd: rootDir,
    env: process.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  child.unref();

  let attempts = 0;
  const maxAttempts = Number(process.env.ALPHAPONY_HEALTHCHECK_RETRIES || "30");

  while (attempts < maxAttempts) {
    try {
      await runCommand(process.execPath, [path.join(rootDir, "scripts", "healthcheck.cjs")], {
        cwd: rootDir,
        stdio: "ignore"
      });
      console.log("AlphaPony update flow completed successfully.");
      return;
    } catch {
      attempts += 1;
      await sleep(2000);
    }
  }

  throw new Error(`Health check failed after update. See ${logPath}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
