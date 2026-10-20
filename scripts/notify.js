#!/usr/bin/env node
/**
 * notify.js — cross-platform notification channel for autonomous/scheduled Claude runs.
 *
 * Usage:  node scripts/notify.js "<title>" "<message>"
 * Import: const { notify } = require('./scripts/notify');
 *
 * Channel selected via machine.json `notify.channel`:
 *   "email"    — send via gws gmail (DEFAULT); address from notify.email.to
 *   "telegram" — POST to Telegram Bot API via Node built-in https
 *   "discord"  — POST to a Discord webhook URL (notify.discord.webhook)
 *   "slack"    — POST to a Slack incoming-webhook URL (notify.slack.webhook)
 *   "stdout"   — print only; also the safe fallback on any error or missing config
 *
 * SECURITY: tokens and addresses live ONLY in gitignored machine.json.
 * Notifications MUST NOT contain confidential, client, PII, or any sensitive content.
 * Never throws fatally — channel failures fall back to stdout + exit 0.
 */

"use strict";

const { spawnSync } = require("child_process");
const https = require("https");
const { getMachineConfig } = require("./claude-paths");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** RFC 4648 §5 base64url: no padding, URL-safe alphabet. */
function toBase64url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Minimal RFC 2822 string for Gmail's `raw` field.
 * Non-ASCII subjects encoded per RFC 2047 (UTF-8/Base64).
 */
function buildRfc822(to, from, subject, body) {
  const isAscii = (s) => [...s].every((c) => c.charCodeAt(0) < 128);
  const encodedSubject = isAscii(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");
}

// ---------------------------------------------------------------------------
// Channel: email via gws gmail
// ---------------------------------------------------------------------------

/**
 * Windows quoting chain that correctly delivers JSON to gws:
 *
 *   PowerShell single-quoted string  →  PS invokes gws.cmd via cmd.exe using \"
 *   escaping  →  gws.cmd passes %* to node.exe  →  node (CommandLineToArgvW)
 *   understands \" as escaped "  →  gws.js receives {"raw":"..."} correctly.
 *
 * base64url alphabet [A-Za-z0-9\-_] contains no single quotes, so the raw value
 * is always safe inside PS single-quoted strings (defensive '' escape kept anyway).
 */
function sendViaEmail(title, message, emailCfg) {
  // No hardcoded fallback address: a missing notify.email.to must NOT silently send
  // to an unintended inbox (a data-egress risk, and PII in shared code).
  // Throwing here is caught by notify() and falls through to the safe stdout channel.
  const to = emailCfg && emailCfg.to;
  if (!to) {
    throw new Error("notify.email.to required in machine.json for the email channel");
  }
  // machine.json is seeded from machine.example.json, so an unconfigured machine carries
  // a placeholder address. Guarding only on "missing" let that placeholder through and
  // would send real notification content (briefs contain calendar + mail + PR detail) to
  // a domain the user does not control. Treat a known placeholder as unconfigured.
  if (/@example\.(com|org|net)$/i.test(to) || /^(you|user|me|changeme)@/i.test(to)) {
    throw new Error(
      `notify.email.to is still a placeholder ("${to}") — set a real address in machine.json`
    );
  }
  const raw = toBase64url(buildRfc822(to, to, `[Claude] ${title}`, message));
  const jsonBody = JSON.stringify({ raw });

  let result;

  if (process.platform === "win32") {
    // PS single-quoted string: literal value, no PS variable/backtick expansion.
    const safeJson = jsonBody.replace(/'/g, "''"); // '' escapes ' in PS
    const psCmd = `gws gmail users messages send --json '${safeJson}'`;
    result = spawnSync("powershell", ["-NonInteractive", "-Command", psCmd], {
      encoding: "utf8",
      timeout: 30000,
    });
  } else {
    // macOS / Linux: spawnSync finds gws directly; args passed without shell.
    result = spawnSync(
      "gws",
      ["gmail", "users", "messages", "send", "--json", jsonBody],
      { encoding: "utf8", timeout: 30000 }
    );
  }

  if (result.error) {
    throw new Error(`gws spawn failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = ((result.stderr || "") + (result.stdout || "")).trim().slice(0, 300);
    throw new Error(`gws exited ${result.status}: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Channel: telegram via built-in https
// ---------------------------------------------------------------------------

function sendViaTelegram(title, message, telegramCfg) {
  if (!telegramCfg || !telegramCfg.token || !telegramCfg.chat_id) {
    throw new Error(
      "notify.telegram.token and notify.telegram.chat_id required in machine.json"
    );
  }
  const payload = JSON.stringify({
    chat_id: telegramCfg.chat_id,
    text: `*${title}*\n${message}`,
    parse_mode: "Markdown",
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.telegram.org/bot${telegramCfg.token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Telegram API ${res.statusCode}: ${body.slice(0, 200)}`));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Telegram request timed out")));
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Channel: Discord / Slack incoming webhooks (built-in https)
// ---------------------------------------------------------------------------

/** POST a JSON body to an arbitrary https webhook URL. Resolves on 2xx. */
function postJsonWebhook(urlString, payloadObj) {
  const payload = JSON.stringify(payloadObj);
  return new Promise((resolve, reject) => {
    const req = https.request(
      urlString,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(`Webhook ${res.statusCode}: ${body.slice(0, 200)}`));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Webhook request timed out")));
    req.write(payload);
    req.end();
  });
}

function sendViaDiscord(title, message, cfg) {
  if (!cfg || !cfg.webhook) {
    throw new Error("notify.discord.webhook required in machine.json");
  }
  // Discord caps content at 2000 chars.
  const content = `**${title}**\n${message}`.slice(0, 1990);
  return postJsonWebhook(cfg.webhook, { content });
}

function sendViaSlack(title, message, cfg) {
  if (!cfg || !cfg.webhook) {
    throw new Error("notify.slack.webhook required in machine.json");
  }
  return postJsonWebhook(cfg.webhook, { text: `*${title}*\n${message}` });
}

// ---------------------------------------------------------------------------
// Channel: stdout (always-safe fallback)
// ---------------------------------------------------------------------------

function printToStdout(title, message) {
  console.log(`[notify] ${title}: ${message}`);
}

// ---------------------------------------------------------------------------
// notify() — exported for import by hooks and other scripts
// ---------------------------------------------------------------------------

/**
 * Send a notification via the channel in machine.json `notify`.
 * Never throws — falls back to stdout on any error or missing config.
 *
 * @param {string} title   Short heading. Keep non-sensitive.
 * @param {string} message Body. NO confidential data, PII, client data, or credentials.
 */
async function notify(title, message) {
  let cfg;
  try {
    cfg = getMachineConfig().notify || {};
  } catch (_) {
    cfg = {};
  }

  const channel = (cfg.channel || "email").toLowerCase();

  // Webhook indirection: `webhookSecret` names a secret (env / keychain / pw-manager)
  // resolved at runtime via resolve-secret.js, so raw webhook URLs never sit in machine.json.
  const chanCfg = cfg[channel];
  if (chanCfg && chanCfg.webhookSecret && !chanCfg.webhook) {
    try {
      const { resolveSecret } = require("./resolve-secret");
      const url = await resolveSecret(chanCfg.webhookSecret);
      if (url) cfg = { ...cfg, [channel]: { ...chanCfg, webhook: url } };
    } catch (_) {
      // fall through — the channel sender will throw a clear "webhook required" error
    }
  }

  try {
    if (channel === "email") {
      await sendViaEmail(title, message, cfg.email);
    } else if (channel === "telegram") {
      await sendViaTelegram(title, message, cfg.telegram);
    } else if (channel === "discord") {
      await sendViaDiscord(title, message, cfg.discord);
    } else if (channel === "slack") {
      await sendViaSlack(title, message, cfg.slack);
    } else {
      // "stdout" or any unknown value — intentional print-only mode.
      printToStdout(title, message);
    }
  } catch (err) {
    // Never crash the caller. Surface the error, then fall through to stdout.
    console.error(`[notify] ${channel} channel error: ${err.message}`);
    printToStdout(title, message);
  }
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node scripts/notify.js <title> <message>");
    process.exit(1);
  }
  const [title, ...rest] = args;
  // Join remaining args so multi-word messages don't need extra quoting.
  notify(title, rest.join(" ")).then(() => process.exit(0));
}

module.exports = { notify };
