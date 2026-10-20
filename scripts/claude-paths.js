#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

function getClaudeHome() {
  return process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
}

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function getMachineConfig() {
  return readJsonIfPresent(path.join(getClaudeHome(), "machine.json"));
}

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getKnowledgeVaultPath() {
  const config = getMachineConfig();
  const explicit = process.env.KNOWLEDGE_VAULT_PATH || config.knowledgeVaultPath;
  if (explicit) {
    return explicit;
  }

  const home = os.homedir();
  const discovered = firstExistingPath([
    path.join(home, "repos", "knowledge-vault"),
    path.join(home, "code", "knowledge-vault"),
    path.join(home, "projects", "knowledge-vault"),
    path.join(home, "Documents", "repos", "knowledge-vault"),
  ]);

  return discovered || path.join(home, "repos", "knowledge-vault");
}

function getBrowserHarnessOverrides() {
  const config = getMachineConfig();
  return {
    browserPath:
      process.env.BROWSER_HARNESS_BROWSER || config.browserHarnessBrowserPath || null,
    profileDir:
      process.env.BROWSER_HARNESS_PROFILE_DIR ||
      config.browserHarnessProfileDir ||
      null,
  };
}


// Python interpreter for bundled skill scripts. macOS/Homebrew pythons are
// PEP 668 "externally managed", so `pip install` into them is refused — bootstrap
// provisions a venv at <claude home>/.venv instead and records it here. Order:
// explicit env → machine.json → the bootstrap venv → the per-OS system launcher.
function getPythonPath() {
  const config = getMachineConfig();
  const explicit = process.env.CLAUDE_PYTHON || config.pythonPath;
  if (explicit) return explicit;

  const isWin = process.platform === "win32";
  const venv = path.join(
    getClaudeHome(),
    ".venv",
    isWin ? "Scripts" : "bin",
    isWin ? "python.exe" : "python3"
  );
  if (fs.existsSync(venv)) return venv;

  // No venv: fall back to the system launcher. On Windows prefer `py -3` over the
  // bare `python` Store stub, which silently no-ops.
  return isWin ? "py" : "python3";
}

// Args that must precede the script path for the resolved interpreter ( `py` needs -3 ).
function getPythonArgs() {
  return getPythonPath() === "py" ? ["-3"] : [];
}

module.exports = {
  getPythonArgs,
  getPythonPath,
  getBrowserHarnessOverrides,
  getClaudeHome,
  getKnowledgeVaultPath,
  getMachineConfig,
};