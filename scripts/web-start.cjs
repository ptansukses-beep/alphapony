#!/usr/bin/env node
const { getCommand, getRootDir, loadEnv, runCommand } = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  await runCommand(getCommand("npm"), ["run", "start", "-w", "frontend"], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOSTNAME: process.env.WEB_HOST || "127.0.0.1",
      PORT: process.env.WEB_PORT || "3000"
    }
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
