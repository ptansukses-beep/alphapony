#!/usr/bin/env node
const path = require("path");
const { ensureDatabase } = require("./db-ensure.cjs");
const { getCommand, getRootDir, loadEnv, runCommand } = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  const npmCommand = getCommand("npm");

  console.log("Installing dependencies...");
  await runCommand(npmCommand, ["ci"], { cwd: rootDir });

  console.log("Generating Prisma client...");
  await runCommand(process.execPath, [path.join(rootDir, "scripts", "prisma-generate.cjs")], {
    cwd: rootDir
  });

  await ensureDatabase();

  console.log("Building application...");
  await runCommand(npmCommand, ["run", "build"], { cwd: rootDir });

  if (process.env.DATABASE_URL) {
    console.log("Running database migrations...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "migrate.cjs")], {
      cwd: rootDir
    });
  } else {
    console.log("Skipping database migrations because DATABASE_URL is not configured.");
  }

  console.log("AlphaPony setup completed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
