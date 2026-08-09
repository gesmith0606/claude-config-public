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

module.exports = {
  getBrowserHarnessOverrides,
  getClaudeHome,
  getKnowledgeVaultPath,
  getMachineConfig,
};