#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { getRootDir, terminatePid } = require("./_node-utils.cjs");

async function stopPidFile(pidFile) {
  if (!fs.existsSync(pidFile)) {
    return;
  }

  const rawPid = fs.readFileSync(pidFile, "utf8").trim();
  const pid = Number(rawPid);
  if (Number.isFinite(pid) && pid > 0) {
    await terminatePid(pid);
  }

  fs.rmSync(pidFile, { force: true });
}

async function main() {
  const rootDir = getRootDir();
  const pidDir = path.join(rootDir, ".runtime", "pids");

  await stopPidFile(path.join(pidDir, "app.pid"));
  await stopPidFile(path.join(pidDir, "api.pid"));
  await stopPidFile(path.join(pidDir, "web.pid"));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
