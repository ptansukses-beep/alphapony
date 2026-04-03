#!/usr/bin/env node
const path = require("path");
const {
  ensureDir,
  getCommand,
  getRootDir,
  loadEnv,
  runCommand
} = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  if ((process.env.ALPHAPONY_SKIP_DB_BACKUP || "0") === "1") {
    console.log("Database backup skipped by ALPHAPONY_SKIP_DB_BACKUP=1");
    return;
  }

  const backupDir = path.join(rootDir, "data", "backups");
  ensureDir(backupDir);

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const backupFile = path.join(backupDir, `alphapony-${timestamp}.dump`);

  try {
    await runCommand(getCommand("pg_dump"), [process.env.DATABASE_URL, "-Fc", "-f", backupFile], {
      cwd: rootDir
    });
    console.log(backupFile);
    return;
  } catch {}

  try {
    const dockerCheck = [];
    await runCommand(
      getCommand("docker"),
      ["ps", "--format", "{{.Names}}"],
      {
        cwd: rootDir,
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
  } catch {}

  try {
    const docker = getCommand("docker");
    await runCommand(
      docker,
      ["exec", "alphapony-postgres", "pg_dump", "-U", "postgres", "-d", "alphapony", "-Fc", "-f", "/tmp/alphapony.dump"],
      { cwd: rootDir }
    );
    await runCommand(
      docker,
      ["cp", "alphapony-postgres:/tmp/alphapony.dump", backupFile],
      { cwd: rootDir }
    );
    await runCommand(docker, ["exec", "alphapony-postgres", "rm", "-f", "/tmp/alphapony.dump"], {
      cwd: rootDir,
      stdio: "ignore"
    });
    console.log(backupFile);
    return;
  } catch {}

  throw new Error(
    "Database backup failed: pg_dump is unavailable and docker container alphapony-postgres is not running."
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
