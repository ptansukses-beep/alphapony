#!/usr/bin/env node
const path = require("path");
const { spawn } = require("child_process");
const { Client } = require("pg");
const { getRootDir, loadEnv, runCommand, sleep } = require("./_node-utils.cjs");

async function canConnectDatabase(connectionString) {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

async function waitForDatabase(connectionString) {
  const maxAttempts = Number(process.env.ALPHAPONY_DB_WAIT_RETRIES || "60");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await canConnectDatabase(connectionString)) {
      console.log("Database is ready.");
      return;
    }

    console.log(`Waiting for database... (${attempt}/${maxAttempts})`);
    await sleep(2000);
  }

  throw new Error("Database did not become ready in time.");
}

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await waitForDatabase(process.env.DATABASE_URL);

  console.log("Running database migrations...");
  await runCommand(process.execPath, [path.join(rootDir, "scripts", "migrate.cjs")], {
    cwd: rootDir,
    stdio: "inherit"
  });

  if ((process.env.ALPHAPONY_SEED_ON_EMPTY || "1") !== "0") {
    console.log("Checking seed data...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "seed-if-empty.cjs")], {
      cwd: rootDir,
      stdio: "inherit"
    });
  }

  const child = spawn(process.execPath, [path.join(rootDir, "scripts", "start.cjs")], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
