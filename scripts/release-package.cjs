#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  copyPath,
  ensureDir,
  getPlatformTag,
  getRootDir,
  removeMatching,
  removePath,
  sha256File,
  zipDirectory
} = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const version = process.argv[2] || pkg.version;
  const platform = process.argv[3] || getPlatformTag();
  const distDir = path.join(rootDir, "dist", "release");
  const workDir = path.join(distDir, `alphapony-${version}-${platform}`);
  const stageDir = path.join(distDir, `.stage-${version}-${platform}`);
  const zipFile = path.join(distDir, `alphapony-${version}-${platform}.zip`);
  const baseUrl = process.env.ALPHAPONY_RELEASE_BASE_URL || "";
  const compressionLevel = Number(process.env.ALPHAPONY_RELEASE_ZIP_LEVEL || "0");

  removePath(workDir);
  removePath(stageDir);
  removePath(zipFile);
  ensureDir(stageDir);
  ensureDir(distDir);

  for (const item of [
    "backend",
    "frontend",
    "scripts",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    ".dockerignore",
    "docker-compose.yml",
    "docker-compose.hub.yml",
    ".env.example",
    "LICENSE",
    "README.md",
    "README.ch.md"
  ]) {
    const sourcePath = path.join(rootDir, item);
    if (fs.existsSync(sourcePath)) {
      copyPath(sourcePath, path.join(stageDir, item));
    }
  }

  for (const relativePath of ["package.json", path.join("backend", "package.json"), path.join("frontend", "package.json")]) {
    const filePath = path.join(stageDir, relativePath);
    if (fs.existsSync(filePath)) {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      payload.version = version;
      fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
    }
  }

  for (const targetPath of [
    path.join(stageDir, "node_modules"),
    path.join(stageDir, "backend", "node_modules"),
    path.join(stageDir, "frontend", "node_modules"),
    path.join(stageDir, "docs"),
    path.join(stageDir, "backend", "dist"),
    path.join(stageDir, "frontend", ".next"),
    path.join(stageDir, "frontend", ".next-dev"),
    path.join(stageDir, ".next"),
    path.join(stageDir, ".next-dev")
  ]) {
    removePath(targetPath);
  }

  removeMatching(stageDir, (fullPath, entry) => {
    const normalized = fullPath.replace(/\\/g, "/");
    return (
      normalized.endsWith("/.next/cache") ||
      entry.name === ".next-dev" ||
      normalized.endsWith(".tsbuildinfo")
    );
  });

  fs.renameSync(stageDir, workDir);
  await zipDirectory(workDir, zipFile, compressionLevel);

  const sha256 = await sha256File(zipFile);
  const latestJson = {
    version,
    url: baseUrl ? `${baseUrl.replace(/\/$/, "")}/${path.basename(zipFile)}` : "",
    sha256,
    platform
  };

  fs.writeFileSync(path.join(distDir, "latest.json"), `${JSON.stringify(latestJson, null, 2)}\n`);
  console.log(`Created ${zipFile}`);
  console.log(`Created ${path.join(distDir, "latest.json")}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
