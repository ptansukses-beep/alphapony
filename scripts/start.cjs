#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ensureDatabase } = require("./db-ensure.cjs");
const {
  getCommand,
  getRootDir,
  isPidRunning,
  loadEnv,
  runCommand,
  sleep,
  terminatePid
} = require("./_node-utils.cjs");

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  const npmCommand = getCommand("npm");
  const apiBaseUrl =
    process.env.API_BASE_URL || `http://127.0.0.1:${process.env.API_PORT || "4000"}`;
  const webBaseUrl =
    process.env.WEB_BASE_URL ||
    `http://${process.env.WEB_HOST || "127.0.0.1"}:${process.env.WEB_PORT || "3000"}`;

  let bootstrapRequired = false;
  let dependenciesInstalled = false;

  console.log("Starting AlphaPony...");

  if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
    console.log("Dependencies are missing. Installing with npm ci...");
    await runCommand(npmCommand, ["ci"], { cwd: rootDir });
    console.log("Dependencies installed.");
    bootstrapRequired = true;
    dependenciesInstalled = true;
  } else {
    console.log("Dependencies check passed.");
  }

  if (!fs.existsSync(path.join(rootDir, "node_modules", "@prisma", "client", "index.js"))) {
    console.log("Prisma Client is missing. Generating...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "prisma-generate.cjs")], {
      cwd: rootDir
    });
    console.log("Prisma Client generated.");
    bootstrapRequired = true;
  } else {
    console.log("Prisma Client check passed.");
  }

  console.log("Checking database availability...");
  await ensureDatabase();
  console.log("Database is ready.");

  if (
    !fs.existsSync(path.join(rootDir, "backend", "dist", "main.js")) ||
    !fs.existsSync(path.join(rootDir, "frontend", ".next", "BUILD_ID"))
  ) {
    console.log("Build artifacts are missing. Building application...");
    await runCommand(npmCommand, ["run", "build"], { cwd: rootDir });
    console.log("Build completed.");
    bootstrapRequired = true;
  } else {
    console.log("Build artifacts check passed.");
  }

  if (
    process.env.DATABASE_URL &&
    (process.env.ALPHAPONY_AUTO_MIGRATE_ON_START || "1") === "1" &&
    (bootstrapRequired || dependenciesInstalled)
  ) {
    console.log("Running database migrations...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "migrate.cjs")], {
      cwd: rootDir
    });
    console.log("Database migrations completed.");
  } else {
    console.log("Database migration check passed.");
  }

  const runtimeDir = path.join(rootDir, ".runtime");
  const logDir = path.join(runtimeDir, "logs");
  const pidDir = path.join(runtimeDir, "pids");
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(pidDir, { recursive: true });

  const appPidFile = path.join(pidDir, "app.pid");
  if (fs.existsSync(appPidFile)) {
    const runningPid = Number(fs.readFileSync(appPidFile, "utf8").trim());
    if (Number.isFinite(runningPid) && isPidRunning(runningPid)) {
      console.error(`AlphaPony is already running with PID ${runningPid}.`);
      process.exit(1);
    }
  }

  fs.writeFileSync(appPidFile, `${process.pid}\n`);

  const apiLogStream = fs.createWriteStream(path.join(logDir, "api.log"), { flags: "a" });
  const webLogStream = fs.createWriteStream(path.join(logDir, "web.log"), { flags: "a" });
  const apiPidFile = path.join(pidDir, "api.pid");
  const webPidFile = path.join(pidDir, "web.pid");
  const apiLogPath = path.join(logDir, "api.log");
  const webLogPath = path.join(logDir, "web.log");

  console.log("Starting backend service...");
  const apiProcess = spawn(npmCommand, ["run", "start", "-w", "backend"], {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  console.log("Starting frontend service...");
  const webProcess = spawn(npmCommand, ["run", "start", "-w", "frontend"], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOSTNAME: process.env.WEB_HOST || "127.0.0.1",
      PORT: process.env.WEB_PORT || "3000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  fs.writeFileSync(apiPidFile, `${apiProcess.pid}\n`);
  fs.writeFileSync(webPidFile, `${webProcess.pid}\n`);

  apiProcess.stdout.pipe(apiLogStream);
  apiProcess.stderr.pipe(apiLogStream);
  webProcess.stdout.pipe(webLogStream);
  webProcess.stderr.pipe(webLogStream);

  let shuttingDown = false;

  async function cleanup() {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    await Promise.allSettled([
      terminatePid(apiProcess.pid),
      terminatePid(webProcess.pid)
    ]);

    for (const pidFile of [appPidFile, apiPidFile, webPidFile]) {
      fs.rmSync(pidFile, { force: true });
    }

    apiLogStream.end();
    webLogStream.end();
  }

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  const exitPromises = [
    new Promise((resolve, reject) => {
      apiProcess.on("error", reject);
      apiProcess.on("exit", (code, signal) => resolve({ source: "api", code, signal }));
    }),
    new Promise((resolve, reject) => {
      webProcess.on("error", reject);
      webProcess.on("exit", (code, signal) => resolve({ source: "web", code, signal }));
    })
  ];

  let healthcheckPassed = false;
  const maxHealthcheckAttempts = Number(process.env.ALPHAPONY_HEALTHCHECK_RETRIES || "30");

  for (let attempt = 0; attempt < maxHealthcheckAttempts; attempt += 1) {
    try {
      await runCommand(process.execPath, [path.join(rootDir, "scripts", "healthcheck.cjs")], {
        cwd: rootDir,
        stdio: "ignore"
      });

      console.log("Backend started successfully.");
      console.log("Frontend started successfully.");
      console.log(`Frontend: ${webBaseUrl}`);
      console.log(`Backend: ${apiBaseUrl}`);
      console.log(`Logs: ${apiLogPath} , ${webLogPath}`);
      healthcheckPassed = true;
      break;
    } catch {
      if (apiProcess.exitCode != null || webProcess.exitCode != null) {
        break;
      }

      if (attempt === 0) {
        console.log("Waiting for services to become ready...");
      }

      await sleep(2000);
    }
  }

  if (!healthcheckPassed && (apiProcess.exitCode != null || webProcess.exitCode != null)) {
    console.error(`Service startup failed. Check logs: ${apiLogPath} , ${webLogPath}`);
  }

  const firstExit = await Promise.race(exitPromises);
  await cleanup();

  if (firstExit.code && firstExit.code !== 0) {
    process.exit(firstExit.code);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(error.code || 1);
});
