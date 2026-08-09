#!/usr/bin/env node
// audit-log.js — append-only action log for notable unattended agent actions.
//
// Appends one JSON line to ~/.claude/audit/actions.jsonl (creates dir as needed).
// That directory sits at a top-level path under ~/.claude/ that is NOT re-included
// in .gitignore, so it is auto-ignored and stays machine-local.
//
// Record shape: { ts, action, target, context, detail }
//
// CLI:  node scripts/audit-log.js '{"action":"gws.send","target":"email","context":"cron","detail":{}}'
// API:  const { audit } = require('./audit-log')
//         → audit(entry): boolean   (sync; never throws)
//
// Fail-safe: any error is silently swallowed — callers are NEVER broken.
// Redaction: values whose key name looks like a secret are replaced with [REDACTED].
//            Known secret-token prefixes are also caught. Raw values are never logged.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const AUDIT_DIR = path.join(os.homedir(), ".claude", "audit");
const AUDIT_FILE = path.join(AUDIT_DIR, "actions.jsonl");

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

// Key names that strongly suggest the value is a credential.
const SECRET_KEY_RE =
  /\b(password|passwd|secret|token|api[_\-]?key|apikey|access[_\-]?key|private[_\-]?key|credential|auth|bearer|passphrase)\b/i;

// Well-known prefixes for bearer / API tokens — redact regardless of key name.
const SECRET_PREFIX_RE =
  /^(sk-[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{10,}|glpat-[A-Za-z0-9]{10,}|xox[baprs]-[A-Za-z0-9\-]{10,}|ey[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})/;

function redactValue(val) {
  if (typeof val !== "string") return val;
  if (SECRET_PREFIX_RE.test(val)) return "[REDACTED]";
  return val;
}

function redact(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return redactValue(obj);
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));

  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (SECRET_KEY_RE.test(k)) {
      out[k] = "[REDACTED]"; // redact by key name regardless of value
    } else if (typeof v === "string") {
      out[k] = redactValue(v);
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

/**
 * Appends one audit record to actions.jsonl.
 * @param {{ action: string, target?: string, context?: string, detail?: any }} entry
 * @returns {boolean} true on success, false on any error (never throws)
 */
function audit(entry) {
  try {
    const record = {
      ts: new Date().toISOString(),
      action: (entry && entry.action) || "unknown",
      target: (entry && entry.target) || null,
      context: (entry && entry.context) || null,
      detail:
        entry && entry.detail !== undefined ? redact(entry.detail) : null,
    };

    // Create audit dir if needed — mkdir is synchronous and idempotent with recursive.
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }

    fs.appendFileSync(AUDIT_FILE, JSON.stringify(record) + "\n", "utf8");
    return true;
  } catch {
    return false; // fail-safe: swallow all errors, never break the caller
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const raw = process.argv[2];
  if (!raw) {
    process.stderr.write(
      "Usage: node scripts/audit-log.js " +
        '\'{"action":"<verb>","target":"<what>","context":"<why>","detail":{}}\'\n'
    );
    process.exit(1);
  }

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`audit-log: invalid JSON — ${e.message}\n`);
    process.exit(1);
  }

  const ok = audit(entry);
  if (!ok) {
    process.stderr.write(`audit-log: write failed (check permissions on ${AUDIT_FILE})\n`);
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { audit };
