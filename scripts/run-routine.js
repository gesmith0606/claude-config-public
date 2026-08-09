#!/usr/bin/env node
/**
 * run-routine.js — run a Claude Code slash command headlessly and notify the result.
 *
 * For LOCAL OS-scheduler use (Windows Task Scheduler / cron / launchd), where local CLIs
 * (gws, gh) and the knowledge-vault are authenticated on THIS machine. Do NOT use this for
 * cloud `/schedule` routines — those run in the cloud with no local CLI auth.
 *
 * Usage:  node scripts/run-routine.js "<title>" "/command [args]"
 * e.g.    node scripts/run-routine.js "Morning brief" "/brief"
 *
 * Flow: runs `claude -p "<command>"` with CLAUDE_UNATTENDED=1 (so the autonomous-action
 * policy applies), captures stdout, and delivers it via notify.js. Never throws fatally.
 */

"use strict";

const { spawnSync } = require("child_process");
const { notify } = require("./notify");
const { audit } = require("./audit-log");

const [title, command] = process.argv.slice(2);
if (!title || !command) {
  console.error('Usage: node scripts/run-routine.js "<title>" "/command"');
  process.exit(1);
}

// Mark this as an unattended run so CLAUDE.md's autonomous-action policy is enforced.
const env = { ...process.env, CLAUDE_UNATTENDED: "1" };

// Audit trail: record the start of every unattended routine (append-only, redacted, never throws).
audit({ action: "routine.start", target: command, context: "unattended", detail: { title } });

// Unattended routines run on Sonnet ("Opus orchestrates, Sonnet works") — cheaper for scheduled work.
const res = spawnSync("claude", ["-p", command, "--model", "sonnet"], {
  encoding: "utf8",
  timeout: 5 * 60 * 1000,
  env,
  shell: process.platform === "win32", // resolve claude.cmd on Windows
});

let body;
if (res.error) {
  body = `routine failed to launch: ${res.error.message}`;
} else {
  body = ((res.stdout || "") + (res.stderr || "")).trim() || "(no output)";
}

// Audit trail: record completion (exit status only — the body may carry transient content).
audit({
  action: "routine.end",
  target: command,
  context: "unattended",
  detail: { title, exitCode: res.status === undefined ? null : res.status, launchError: res.error ? res.error.message : null },
});

// Cap length so chat webhooks (Discord 2k / Slack / Telegram) don't reject oversized bodies.
body = body.slice(0, 3500);

notify(title, body).then(() => process.exit(0));
