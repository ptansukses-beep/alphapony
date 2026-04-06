const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

function getRootDir() {
  return path.resolve(__dirname, "..");
}

function resolveEnvFile(rootDir) {
  if (process.env.ALPHAPONY_ENV_PATH && fs.existsSync(process.env.ALPHAPONY_ENV_PATH)) {
    return process.env.ALPHAPONY_ENV_PATH;
  }

  const dataEnvPath = path.join(rootDir, "data", "env", ".env");
  if (fs.existsSync(dataEnvPath)) {
    return dataEnvPath;
  }

  const rootEnvPath = path.join(rootDir, ".env");
  if (fs.existsSync(rootEnvPath)) {
    return rootEnvPath;
  }

  return null;
}

function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");

    parsed[key] = value;
  }

  return parsed;
}

function loadEnv(rootDir) {
  const envFile = resolveEnvFile(rootDir);
  if (!envFile) {
    return null;
  }

  const parsed = parseEnvFile(fs.readFileSync(envFile, "utf8"));
  process.env.ALPHAPONY_ENV_PATH = envFile;

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  const apiHost = process.env.API_HOST || "127.0.0.1";
  const apiPort = process.env.API_PORT || "4000";
  const webHost = process.env.WEB_HOST || "127.0.0.1";
  const webPort = process.env.WEB_PORT || "3000";

  if (process.env.API_BASE_URL == null || process.env.API_BASE_URL === "") {
    process.env.API_BASE_URL = `http://${apiHost}:${apiPort}`;
  }

  if (
    process.env.NEXT_PUBLIC_API_BASE_URL == null ||
    process.env.NEXT_PUBLIC_API_BASE_URL === ""
  ) {
    process.env.NEXT_PUBLIC_API_BASE_URL = process.env.API_BASE_URL;
  }

  if (process.env.WEB_BASE_URL == null || process.env.WEB_BASE_URL === "") {
    process.env.WEB_BASE_URL = `http://${webHost}:${webPort}`;
  }

  return envFile;
}

function getCommand(baseName) {
  return process.platform === "win32" ? `${baseName}.cmd` : baseName;
}

async function commandExists(command, args = ["--version"]) {
  try {
    await runCommand(command, args, {
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeVersion(version) {
  return String(version == null ? "" : version).trim().replace(/^v/i, "");
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left)
    .split(".")
    .map((part) => Number(part) || 0);
  const rightParts = normalizeVersion(right)
    .split(".")
    .map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyPath(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function walkDir(dirPath, visitor) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    visitor(fullPath, entry);

    if (entry.isDirectory()) {
      walkDir(fullPath, visitor);
    }
  }
}

function removeMatching(rootDir, predicate) {
  const removals = [];

  walkDir(rootDir, (fullPath, entry) => {
    if (predicate(fullPath, entry)) {
      removals.push(fullPath);
    }
  });

  removals
    .sort((left, right) => right.length - left.length)
    .forEach((targetPath) => removePath(targetPath));
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status} for ${url}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

async function zipDirectory(sourceDir, zipFile, compressionLevel = 0) {
  ensureDir(path.dirname(zipFile));

  if (process.platform === "win32") {
    const sourceParent = path.dirname(sourceDir);
    const sourceName = path.basename(sourceDir);
    const powershell = getCommand("powershell");
    await runCommand(
      powershell,
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${sourceName}' -DestinationPath '${zipFile.replace(/'/g, "''")}' -Force`
      ],
      { cwd: sourceParent }
    );
    return;
  }

  await runCommand("zip", ["-q", "-r", `-${compressionLevel}`, zipFile, path.basename(sourceDir)], {
    cwd: path.dirname(sourceDir)
  });
}

async function unzipFile(zipFile, extractDir) {
  ensureDir(extractDir);

  if (process.platform === "win32") {
    const powershell = getCommand("powershell");
    await runCommand(powershell, [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipFile.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
    ]);
    return;
  }

  await runCommand("unzip", ["-q", zipFile, "-d", extractDir]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPlatformTag() {
  const archMap = {
    x64: "x86_64",
    arm64: "arm64"
  };

  return `${os.platform()}-${archMap[os.arch()] || os.arch()}`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      detached: options.detached ?? false,
      shell: options.shell ?? false
    });

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ code, signal, stdout, stderr });
        return;
      }

      const error = new Error(
        `${command} ${args.join(" ")} exited with ${signal || code || 1}.`
      );
      error.code = code || 1;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function isPidRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminatePid(pid) {
  if (!pid || !isPidRunning(pid)) {
    return;
  }

  if (process.platform === "win32") {
    try {
      await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore"
      });
    } catch {
      return;
    }
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

module.exports = {
  commandExists,
  compareVersions,
  copyPath,
  downloadToFile,
  ensureDir,
  getCommand,
  getPlatformTag,
  getRootDir,
  isPidRunning,
  loadEnv,
  normalizeVersion,
  removeMatching,
  removePath,
  runCommand,
  sha256File,
  sleep,
  terminatePid
  ,
  unzipFile,
  zipDirectory
};
