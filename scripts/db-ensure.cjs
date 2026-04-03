#!/usr/bin/env node
const path = require("path");
const {
  commandExists,
  getRootDir,
  loadEnv,
  runCommand,
  sleep
} = require("./_node-utils.cjs");

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/alphapony?schema=public";

function getPlatformInstallHint() {
  if (process.platform === "darwin") {
    return [
      "On macOS, install and start one of the following first:",
      "1. Docker Desktop",
      "2. PostgreSQL"
    ].join("\n");
  }

  if (process.platform === "win32") {
    return [
      "On Windows, install and start one of the following first:",
      "1. Docker Desktop",
      "2. PostgreSQL"
    ].join("\n");
  }

  return [
    "On Linux, install and start one of the following first:",
    "1. Docker + docker compose",
    "2. PostgreSQL"
  ].join("\n");
}

async function canConnectDatabase(connectionString) {
  const { Client } = require("pg");
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

async function waitForDatabase(connectionString, retries = 20) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (await canConnectDatabase(connectionString)) {
      return true;
    }

    await sleep(2000);
  }

  return false;
}

async function ensureDatabase() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
    console.log(`DATABASE_URL is not configured. Using default local URL: ${DEFAULT_DATABASE_URL}`);
  }

  if (await canConnectDatabase(process.env.DATABASE_URL)) {
    return;
  }

  const hasDocker = await commandExists("docker", ["version"]);
  const hasDockerCompose = hasDocker && (await commandExists("docker", ["compose", "version"]));

  if (hasDocker && hasDockerCompose) {
    console.log("Database is unavailable. Trying to start PostgreSQL with Docker...");
    await runCommand("docker", ["compose", "up", "-d", "postgres"], {
      cwd: rootDir
    });

    if (await waitForDatabase(process.env.DATABASE_URL)) {
      console.log("PostgreSQL is ready.");
      return;
    }

    throw new Error(
      "Docker PostgreSQL was started, but DATABASE_URL is still unreachable. Check your .env and local port 5432."
    );
  }

  const hasPgIsReady = await commandExists(process.platform === "win32" ? "pg_isready.exe" : "pg_isready");
  const hasPsql = await commandExists(process.platform === "win32" ? "psql.exe" : "psql", ["--version"]);

  if (hasPgIsReady || hasPsql) {
    throw new Error(
      [
        "PostgreSQL tools were detected, but DATABASE_URL is not reachable.",
        "Please start PostgreSQL and confirm your .env points to a running database.",
        `Current DATABASE_URL: ${process.env.DATABASE_URL}`
      ].join("\n")
    );
  }

  throw new Error(
    [
      "No available database was found.",
      getPlatformInstallHint(),
      "",
      "Then run npm run start again."
    ].join("\n")
  );
}

if (require.main === module) {
  ensureDatabase().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  ensureDatabase
};
