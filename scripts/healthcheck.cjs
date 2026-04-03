#!/usr/bin/env node
const { getRootDir, loadEnv } = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  const apiBase =
    process.env.API_BASE_URL || `http://127.0.0.1:${process.env.API_PORT || "4000"}`;
  const webBase =
    process.env.WEB_BASE_URL ||
    `http://${process.env.WEB_HOST || "127.0.0.1"}:${process.env.WEB_PORT || "3000"}`;

  const apiResponse = await fetch(`${apiBase}/api/dashboard/assets`);
  if (!apiResponse.ok) {
    throw new Error(`API health check failed with status ${apiResponse.status}.`);
  }

  const webResponse = await fetch(webBase);
  if (!webResponse.ok) {
    throw new Error(`Web health check failed with status ${webResponse.status}.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
