#!/usr/bin/env node
const { getCommand, getRootDir, loadEnv, runCommand } = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  await runCommand(getCommand("npm"), ["run", "start", "-w", "backend"], {
    cwd: rootDir
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
