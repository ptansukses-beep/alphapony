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

function formatError(error) {
  if (!error) {
    return "Unknown error.";
  }

  const parts = [];

  if (error.message) {
    parts.push(String(error.message).trim());
  }

  const stderr = String(error.stderr || "").trim();
  const stdout = String(error.stdout || "").trim();

  if (stderr) {
    parts.push(stderr);
  } else if (stdout) {
    parts.push(stdout);
  }

  return parts.filter(Boolean).join(" | ") || "Unknown error.";
}

function printStep(step, message) {
  console.log(`[${step}] ${message}`);
}

function readLogTail(filePath, maxLines = 20) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return "";
  }

  return content.split(/\r?\n/).slice(-maxLines).join("\n");
}

async function main() {
  const rootDir = getRootDir();
  const envFile = loadEnv(rootDir);

  const npmCommand = getCommand("npm");
  const apiBaseUrl =
    process.env.API_BASE_URL || `http://127.0.0.1:${process.env.API_PORT || "4000"}`;
  const webBaseUrl =
    process.env.WEB_BASE_URL ||
    `http://${process.env.WEB_HOST || "127.0.0.1"}:${process.env.WEB_PORT || "3000"}`;

  let bootstrapRequired = false;
  let dependenciesInstalled = false;

  console.log("Starting AlphaPony...");
  printStep("env", `Using env file: ${envFile ?? "none"}`);
  printStep("env", `API target: ${apiBaseUrl}`);
  printStep("env", `Web target: ${webBaseUrl}`);

  if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
    printStep("1/6", "Dependencies are missing. Installing with npm ci...");
    await runCommand(npmCommand, ["ci"], { cwd: rootDir });
    printStep("1/6", "Dependencies installed.");
    bootstrapRequired = true;
    dependenciesInstalled = true;
  } else {
    printStep("1/6", "Dependencies check passed.");
  }

  if (!fs.existsSync(path.join(rootDir, "node_modules", "@prisma", "client", "index.js"))) {
    printStep("2/6", "Prisma Client is missing. Generating...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "prisma-generate.cjs")], {
      cwd: rootDir
    });
    printStep("2/6", "Prisma Client generated.");
    bootstrapRequired = true;
  } else {
    printStep("2/6", "Prisma Client check passed.");
  }

  printStep("3/6", "Checking database availability...");
  await ensureDatabase();
  printStep("3/6", "Database is ready.");

  if (
    !fs.existsSync(path.join(rootDir, "backend", "dist", "main.js")) ||
    !fs.existsSync(path.join(rootDir, "frontend", ".next", "BUILD_ID"))
  ) {
    printStep("4/6", "Build artifacts are missing. Building application...");
    await runCommand(npmCommand, ["run", "build"], { cwd: rootDir });
    printStep("4/6", "Build completed.");
    bootstrapRequired = true;
  } else {
    printStep("4/6", "Build artifacts check passed.");
  }

  if (
    process.env.DATABASE_URL &&
    (process.env.ALPHAPONY_AUTO_MIGRATE_ON_START || "1") === "1" &&
    (bootstrapRequired || dependenciesInstalled)
  ) {
    printStep("5/6", "Running database migrations...");
    await runCommand(process.execPath, [path.join(rootDir, "scripts", "migrate.cjs")], {
      cwd: rootDir
    });
    printStep("5/6", "Database migrations completed.");
  } else {
    printStep("5/6", "Database migration check passed.");
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

  const apiPidFile = path.join(pidDir, "api.pid");
  const webPidFile = path.join(pidDir, "web.pid");
  const apiLogPath = path.join(logDir, "api.log");
  const webLogPath = path.join(logDir, "web.log");
  fs.writeFileSync(apiLogPath, "");
  fs.writeFileSync(webLogPath, "");
  const apiLogStream = fs.createWriteStream(apiLogPath, { flags: "a" });
  const webLogStream = fs.createWriteStream(webLogPath, { flags: "a" });

  printStep("6/6", "Starting backend service...");
  const apiProcess = spawn(npmCommand, ["run", "start", "-w", "backend"], {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  printStep("6/6", "Starting frontend service...");
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
  let lastHealthcheckError = "";

  for (let attempt = 0; attempt < maxHealthcheckAttempts; attempt += 1) {
    try {
      await runCommand(process.execPath, [path.join(rootDir, "scripts", "healthcheck.cjs")], {
        cwd: rootDir,
        stdio: "pipe"
      });

      console.log("Backend started successfully.");
      console.log("Frontend started successfully.");
      console.log(`Frontend: ${webBaseUrl}`);
      console.log(`Backend: ${apiBaseUrl}`);
      console.log(`Logs: ${apiLogPath} , ${webLogPath}`);
      healthcheckPassed = true;
      break;
    } catch (error) {
      lastHealthcheckError = formatError(error);

      if (apiProcess.exitCode != null || webProcess.exitCode != null) {
        break;
      }

      console.log(
        `Waiting for services to become ready... (${attempt + 1}/${maxHealthcheckAttempts}) ${lastHealthcheckError}`
      );

      await sleep(2000);
    }
  }

  if (!healthcheckPassed) {
    if (apiProcess.exitCode != null || webProcess.exitCode != null) {
      const failedSource = apiProcess.exitCode != null ? "backend" : "frontend";
      const failedLogPath = apiProcess.exitCode != null ? apiLogPath : webLogPath;
      const failedTail = readLogTail(failedLogPath);
      console.error(`Service startup failed: ${failedSource} exited before healthcheck passed.`);
      if (lastHealthcheckError) {
        console.error(`Last healthcheck error: ${lastHealthcheckError}`);
      }
      console.error(`Check logs: ${apiLogPath} , ${webLogPath}`);
      if (failedTail) {
        console.error(`Recent ${failedSource} log output:\n${failedTail}`);
      }
    } else {
      console.error(`Service startup timed out after ${maxHealthcheckAttempts} healthcheck attempts.`);
      if (lastHealthcheckError) {
        console.error(`Last healthcheck error: ${lastHealthcheckError}`);
      }
      console.error(`Check logs: ${apiLogPath} , ${webLogPath}`);
    }
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
