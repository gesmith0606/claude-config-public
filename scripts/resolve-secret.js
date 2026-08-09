#!/usr/bin/env node
// resolve-secret.js — runtime secret resolution. No npm deps; Node built-ins only.
//
// Resolution priority (first hit wins):
//   1. Environment variable named <NAME>
//   2. OS keychain — macOS: security(1); Windows: PasswordVault via PowerShell (best-effort)
//   3. Password manager CLI — 1Password (op) or Bitwarden (bw), whichever is on PATH
//
// machine.json `secrets.backend` pins a backend:
//   "env" | "keychain" | "1password" | "bitwarden"   (default: "auto" — tries all three)
//
// CLI:  node scripts/resolve-secret.js <NAME>
//         → prints ONLY the secret value to stdout; exits 2 if not found
// API:  const { resolveSecret } = require('./resolve-secret')
//         → async resolveSecret(name): Promise<string|null>
//
// NEVER prints the resolved value except to the final stdout.
// NEVER writes the value to any log or file.

"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getMachineConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(os.homedir(), ".claude", "machine.json"), "utf8")
    );
  } catch {
    return {};
  }
}

function getBackend() {
  const cfg = getMachineConfig();
  return (cfg.secrets && cfg.secrets.backend) || "auto";
}

// ---------------------------------------------------------------------------
// Individual backends
// ---------------------------------------------------------------------------

function fromEnv(name) {
  const val = process.env[name];
  return val && val.length > 0 ? val : null;
}

function fromKeychainMac(name) {
  // security find-generic-password -s <name> -w prints the password to stdout.
  try {
    const r = spawnSync("security", ["find-generic-password", "-s", name, "-w"], {
      encoding: "utf8",
      timeout: 5000,
    });
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return r.stdout.trim();
    }
  } catch {
    // best-effort
  }
  return null;
}

function fromKeychainWindows(name) {
  // Windows Credential Manager via the WinRT PasswordVault API.
  // Works on Windows 8+ desktop; best-effort (may not be available in all shells).
  const escapedName = name.replace(/'/g, "''"); // PowerShell string escape
  const script = [
    "[Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime] | Out-Null",
    "$v = New-Object Windows.Security.Credentials.PasswordVault",
    "try {",
    `  $c = $v.FindAllByResource('${escapedName}')`,
    "  if ($c -and $c.Count -gt 0) {",
    "    $c[0].RetrievePassword()",
    "    Write-Output $c[0].Password",
    "  } else { exit 1 }",
    "} catch { exit 1 }",
  ].join("; ");

  try {
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", timeout: 8000 }
    );
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return r.stdout.trim();
    }
  } catch {
    // best-effort
  }
  return null;
}

function fromKeychain(name) {
  return os.platform() === "darwin"
    ? fromKeychainMac(name)
    : fromKeychainWindows(name);
}

function cliOnPath(cmd) {
  const probe = os.platform() === "win32" ? "where" : "which";
  try {
    const r = spawnSync(probe, [cmd], { encoding: "utf8", timeout: 3000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

function from1Password(name) {
  if (!cliOnPath("op")) return null;
  try {
    // If the caller passes an op:// URI, use `op read`; otherwise `op item get`.
    const args = name.startsWith("op://")
      ? ["read", name, "--no-newline"]
      : ["item", "get", name, "--fields", "password", "--reveal"];
    const r = spawnSync("op", args, { encoding: "utf8", timeout: 10000 });
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return r.stdout.trim();
    }
  } catch {
    // best-effort
  }
  return null;
}

function fromBitwarden(name) {
  if (!cliOnPath("bw")) return null;
  try {
    const r = spawnSync("bw", ["get", "password", name], {
      encoding: "utf8",
      timeout: 10000,
    });
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return r.stdout.trim();
    }
  } catch {
    // best-effort
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolves a secret by name.
 * Returns the string value, or null if not found in any configured backend.
 * Never throws. Never logs the value.
 */
async function resolveSecret(name) {
  if (!name || typeof name !== "string") return null;

  const backend = getBackend();

  // Env is always tried first — it's free, process-local, and safe.
  const envVal = fromEnv(name);
  if (envVal) return envVal;

  if (backend === "env") return null;

  if (backend === "auto" || backend === "keychain") {
    const kc = fromKeychain(name);
    if (kc) return kc;
    if (backend === "keychain") return null;
  }

  if (backend === "auto" || backend === "1password") {
    const op = from1Password(name);
    if (op) return op;
    if (backend === "1password") return null;
  }

  if (backend === "auto" || backend === "bitwarden") {
    const bw = fromBitwarden(name);
    if (bw) return bw;
  }

  return null;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const name = process.argv[2];
  if (!name) {
    process.stderr.write("Usage: node scripts/resolve-secret.js <SECRET_NAME>\n");
    process.exit(1);
  }

  resolveSecret(name)
    .then((val) => {
      if (!val) {
        process.stderr.write(
          `resolve-secret: "${name}" not found in any configured backend\n`
        );
        process.exit(2);
      }
      // Print ONLY the value — no trailing newline so shell capture is clean.
      process.stdout.write(val);
      process.exit(0);
    })
    .catch(() => {
      process.stderr.write(`resolve-secret: unexpected error resolving "${name}"\n`);
      process.exit(2);
    });
}

module.exports = { resolveSecret };
