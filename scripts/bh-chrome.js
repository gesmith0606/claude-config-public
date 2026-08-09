#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { getBrowserHarnessOverrides } = require("./claude-paths");

const port = 9222;

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testCdp() {
  try {
    const response = await fetch(`http://localhost:${port}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

function existingPath(candidate) {
  return candidate && fs.existsSync(candidate) ? candidate : null;
}

function macAppExecutable(appPath) {
  if (!appPath || !appPath.endsWith(".app")) {
    return appPath;
  }

  const appName = path.basename(appPath, ".app");
  return path.join(appPath, "Contents", "MacOS", appName);
}

function firstOnPath(commands) {
  const locator = process.platform === "win32" ? "where" : "which";
  for (const command of commands) {
    const result = spawnSync(locator, [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0) {
      const firstLine = result.stdout.split(/\r?\n/).find(Boolean);
      if (firstLine) {
        return firstLine.trim();
      }
    }
  }
  return null;
}

function browserCandidates() {
  switch (process.platform) {
    case "win32":
      return [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Chromium\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ];
    case "darwin":
      return [
        path.join(os.homedir(), "Applications", "Google Chrome.app"),
        path.join(os.homedir(), "Applications", "Chromium.app"),
        path.join(os.homedir(), "Applications", "Microsoft Edge.app"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Google Chrome.app",
        "/Applications/Chromium.app",
        "/Applications/Microsoft Edge.app",
      ];
    default:
      return [];
  }
}

function pathCommands() {
  switch (process.platform) {
    case "win32":
      return ["chrome", "chrome.exe", "msedge", "msedge.exe"];
    case "darwin":
      return ["Google Chrome", "Chromium", "Microsoft Edge", "google-chrome", "chromium"];
    default:
      return ["google-chrome", "chromium-browser", "chromium", "microsoft-edge"];
  }
}

function defaultProfileDir() {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "bh-chrome");
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "bh-chrome");
    default:
      return path.join(os.homedir(), ".config", "bh-chrome");
  }
}

function resolveBrowserPath() {
  const { browserPath } = getBrowserHarnessOverrides();
  if (existingPath(browserPath)) {
    return process.platform === "darwin"
      ? macAppExecutable(browserPath)
      : browserPath;
  }

  for (const candidate of browserCandidates()) {
    if (existingPath(candidate)) {
      return process.platform === "darwin"
        ? macAppExecutable(candidate)
        : candidate;
    }
  }

  return firstOnPath(pathCommands());
}

async function main() {
  if (await testCdp()) {
    console.log(`browser-harness browser already up on :${port}`);
    return;
  }

  const browserPath = resolveBrowserPath();
  if (!browserPath) {
    console.error("FAILED to find Chrome-compatible browser binary");
    process.exit(1);
  }

  const { profileDir } = getBrowserHarnessOverrides();
  const userDataDir = profileDir || defaultProfileDir();
  fs.mkdirSync(userDataDir, { recursive: true });

  const child = spawn(
    browserPath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  child.unref();

  for (let attempt = 0; attempt < 15; attempt++) {
    await wait(1000);
    if (await testCdp()) {
      console.log(`browser-harness browser launched on :${port}`);
      return;
    }
  }

  console.error(`FAILED to bring up browser on :${port}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});