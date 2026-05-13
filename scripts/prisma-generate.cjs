#!/usr/bin/env node
const path = require("path");
const { getRootDir, loadEnv, runCommand } = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not configured. Expected data/env/.env, .env, or ALPHAPONY_ENV_PATH."
    );
    process.exit(1);
  }

  const prismaBin = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  );

  await runCommand(prismaBin, [
    "generate",
    "--config",
    path.join(rootDir, "backend", "prisma.config.ts")
  ]);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
