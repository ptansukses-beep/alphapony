#!/usr/bin/env node
const { getRootDir, loadEnv } = require("./_node-utils.cjs");

async function fetchOrThrow(url, label) {
  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : null;
    const causeMessage =
      cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "";
    throw new Error(
      `${label} health check request failed for ${url}.${causeMessage ? ` ${causeMessage}` : ""}`
    );
  }

  if (!response.ok) {
    throw new Error(`${label} health check failed for ${url} with status ${response.status}.`);
  }
}

async function main() {
  const rootDir = getRootDir();
  loadEnv(rootDir);

  const apiBase =
    process.env.API_BASE_URL || `http://127.0.0.1:${process.env.API_PORT || "4000"}`;
  const webBase =
    process.env.WEB_BASE_URL ||
    `http://${process.env.WEB_HOST || "127.0.0.1"}:${process.env.WEB_PORT || "3000"}`;

  await fetchOrThrow(`${apiBase}/api/dashboard/assets`, "API");
  await fetchOrThrow(webBase, "Web");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
